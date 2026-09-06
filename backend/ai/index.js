/**
 * AI 推理引擎
 *
 * 使用 DeepSeek 大模型进行:
 *  1. 意图识别 (售前咨询/售后/物流/投诉/退货)
 *  2. 智能回复生成
 *  3. 多轮对话上下文管理
 *  4. 知识库检索增强 (RAG)
 */

const axios = require('axios');
const crypto = require('crypto');
const { logInfo, logError } = require('../utils/logger');

const AI_API = 'https://api.deepseek.com/chat/completions';

// --- 对话记忆 (内存缓存, 生产环境可替换为 Redis) ---
const conversationCache = new Map(); // key: shopId_customerId, value: [{role, content}]
const CACHE_TTL = 30 * 60 * 1000; // 30分钟过期

// --- 系统 Prompt ---
const SYSTEM_PROMPT = `你是一个专业的电商客服助手，同时服务于抖音电商和淘宝店铺。

## 你的职责
1. 解答客户产品咨询 (规格、价格、库存、使用方法等)
2. 处理物流查询 (快递单号、物流进度)
3. 处理售后问题 (退换货、退款、质量问题)
4. 引导下单 (优惠活动、搭配推荐)

## 回复规则
- 使用简洁、热情、有温度的中文
- 优先使用知识库信息回答
- 涉及订单查询时，先核对订单号
- 涉及投诉/差评时，先安抚情绪再解决问题
- 无法回答的问题，告知会转接人工客服
- 回复控制在 200 字以内，除非需要详细说明
- 使用适当的 emoji 增加亲和力

## 敏感处理
- 不要承诺退款金额 (需核实)
- 不要泄露其他客户信息
- 遇到恶意投诉保持冷静，统一回复"已为您记录，会有专人处理"`;

function demoReply(message, kbContext) {
  const firstKbAnswer = Array.isArray(kbContext) && kbContext[0]?.answer
    ? String(kbContext[0].answer).trim()
    : '';

  if (firstKbAnswer) {
    return `[本地演示模式] ${firstKbAnswer}`;
  }

  if (/发货|物流|快递|到货/.test(message)) {
    return '您好，当前为本地演示模式。真实物流状态需要在取得平台授权后接入订单/物流 API 查询；当前不会伪造物流结果。';
  }

  if (/退货|退款|售后/.test(message)) {
    return '您好，当前为本地演示模式。退换货规则可通过本地知识库演示，真实订单退款与售后操作需要平台 API 授权并经过人工审核。';
  }

  return '您好，当前为本地演示模式：可体验客服流程与知识库 RAG；配置 DEEPSEEK_API_KEY 后才会调用 DeepSeek，抖音/淘宝真实消息收发还需要各平台正式 API 凭据与验收。';
}

/**
 * 生成 AI 回复
 */
async function generateReply({ message, platform, customerId, shopId, kbContext, orderContext, conversationId }) {
  if (!process.env.DEEPSEEK_API_KEY) {
    logInfo({ module: 'ai', event: 'demo_fallback', platform, customerId });
    return demoReply(message, kbContext);
  }

  try {
    const cacheKey = `${shopId}_${customerId}`;

    // 获取或创建对话上下文
    if (!conversationCache.has(cacheKey)) {
      conversationCache.set(cacheKey, []);
    }
    const history = conversationCache.get(cacheKey);

    // 构建消息列表
    const messages = [
      { role: 'system', content: buildSystemPrompt(platform, kbContext) },
    ];

    // 添加订单上下文
    if (orderContext) {
      messages.push({
        role: 'system',
        content: `当前客户关联订单: ${JSON.stringify(orderContext)}`,
      });
    }

    // 添加历史对话 (保留最近10轮)
    const recentHistory = history.slice(-20);
    messages.push(...recentHistory);

    // 添加当前消息
    messages.push({ role: 'user', content: message });

    // 调用 DeepSeek
    const response = await axios.post(
      AI_API,
      {
        model: process.env.AI_MODEL || 'deepseek-chat',
        messages,
        temperature: 0.7,
        max_tokens: 600,
        top_p: 0.9,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        timeout: 15000,
      }
    );

    const reply = response.data?.choices?.[0]?.message?.content?.trim();

    if (reply) {
      // 保存对话历史
      history.push({ role: 'user', content: message });
      history.push({ role: 'assistant', content: reply });
      conversationCache.set(cacheKey, history);

      // 设置过期清理
      setTimeout(() => {
        if (conversationCache.has(cacheKey)) {
          conversationCache.delete(cacheKey);
        }
      }, CACHE_TTL);

      logInfo({ module: 'ai', event: 'reply_generated', platform, customerId, length: reply.length });
    }

    return reply;
  } catch (err) {
    logError({ module: 'ai', event: 'generate_error', error: err.message, platform });
    // 降级回复
    return '您好，我正在处理您的问题，请稍等。如需紧急帮助，请联系人工客服。';
  }
}

/**
 * 意图识别
 */
async function detectIntent(message) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return { intent: 'other', urgency: 'normal', sentiment: 'neutral', mode: 'demo' };
  }

  try {
    const response = await axios.post(
      AI_API,
      {
        model: process.env.AI_MODEL || 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `分析客户消息的意图，返回 JSON: {"intent": "类别", "urgency": "normal|urgent", "sentiment": "positive|neutral|negative"}

意图类别: product_inquiry(产品咨询), order_status(订单查询), shipping(物流查询), refund(退款/退货), complaint(投诉), promotion(活动咨询), greeting(问候), other(其他)`,
          },
          { role: 'user', content: message },
        ],
        temperature: 0.3,
        max_tokens: 100,
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        timeout: 8000,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    return JSON.parse(content);
  } catch {
    return { intent: 'other', urgency: 'normal', sentiment: 'neutral' };
  }
}

/**
 * 构建系统 Prompt (包含知识库信息)
 */
function buildSystemPrompt(platform, kbContext) {
  let prompt = SYSTEM_PROMPT;

  prompt += `\n\n## 当前平台: ${platform === 'douyin' ? '抖音电商' : '淘宝/千牛'}`;

  if (kbContext && kbContext.length > 0) {
    prompt += '\n\n## 知识库参考\n';
    kbContext.forEach((doc, i) => {
      prompt += `${i + 1}. Q: ${doc.question}\n   A: ${doc.answer}\n`;
    });
  }

  return prompt;
}

/**
 * 清除会话缓存
 */
function clearConversation(shopId, customerId) {
  const key = `${shopId}_${customerId}`;
  conversationCache.delete(key);
}

module.exports = {
  generateReply,
  detectIntent,
  clearConversation,
};
