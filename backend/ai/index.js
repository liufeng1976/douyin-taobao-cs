/**
 * Bounded customer-support drafting through the BossAI OS AI Gateway.
 *
 * This module is intentionally not an Agent Runtime and does not own durable
 * conversation memory, approvals, billing, provider routing or external action
 * authority. Every result is a reviewable draft only.
 */

const { logInfo, logError } = require('../utils/logger');
const { evaluateMessage } = require('../policy/responsePolicy');

const DEFAULT_BOSSAI_OS_URL = 'http://127.0.0.1:3001';
const DEFAULT_MODEL = 'bossai-balanced';

function normalizeBossAiUrl(value) {
  const url = new URL(String(value || DEFAULT_BOSSAI_OS_URL));
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) {
    throw new Error('BossAI OS URL must use HTTPS except for loopback HTTP.');
  }
  return url.origin;
}

function selectedModel() {
  const model = String(process.env.BOSSAI_AI_MODEL || DEFAULT_MODEL).trim();
  if (!model.startsWith('bossai-')) {
    throw new Error('Only public bossai-* model aliases are allowed.');
  }
  return model;
}

function cleanKnowledge(kbContext) {
  if (!Array.isArray(kbContext)) return [];
  return kbContext.slice(0, 5).map((doc) => ({
    question: String(doc?.question || '').trim().slice(0, 500),
    answer: String(doc?.answer || '').trim().slice(0, 4000),
    category: String(doc?.category || 'general').trim().slice(0, 80),
  })).filter((doc) => doc.question && doc.answer);
}

function buildMessages({ message, platform, kbContext, orderContext, policy }) {
  const knowledge = cleanKnowledge(kbContext);
  const verifiedSections = [];

  if (knowledge.length) {
    verifiedSections.push('店铺已配置知识：\n' + knowledge.map((doc, index) => `${index + 1}. Q: ${doc.question}\n   A: ${doc.answer}`).join('\n'));
  }
  if (orderContext && typeof orderContext === 'object') {
    verifiedSections.push(`平台返回的最小订单事实：${JSON.stringify(orderContext)}`);
  }

  const system = [
    '你是 BossAI 客服体系中的“受限草稿生成能力”，不是可自主执行的客服员工。',
    `当前渠道：${platform === 'douyin' ? '抖音电商' : '淘宝/天猫/千牛'}.`,
    '只能依据本次消息、店铺明确配置的知识和平台已核实事实生成回复草稿。',
    '不得编造价格、库存、优惠、发货时效、退换货政策、物流状态、退款结果、补发结果、赔偿结果或任何未核实事实。',
    '不得声称已经退款、取消、改地址、补发、赔偿、修改订单或修改账户。',
    '涉及退款、退货、投诉、差评、取消、赔偿、账户、支付、法律、安全或隐私问题时，只能说明会核实并转人工处理。',
    '所有输出都需要人工审核后才能对客户发送。',
    '使用简洁、礼貌、自然的中文；返回纯回复正文，不要解释内部流程。',
    `风险策略：${policy.policy}; 风险级别：${policy.risk}.`,
  ].join('\n');

  const user = [
    `客户消息：${String(message || '').trim()}`,
    '',
    verifiedSections.length ? verifiedSections.join('\n\n') : '当前没有可用的店铺知识或订单核实事实。',
  ].join('\n');

  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

function safeFallbackDraft({ message, kbContext, policy }) {
  const knowledge = cleanKnowledge(kbContext);
  const best = knowledge[0];

  if (policy.risk === 'high') {
    return '您好，已收到您的问题。这个事项需要进一步核实并由人工客服确认后处理，我先为您记录，请不要重复提交。核实完成后会给您明确答复。';
  }

  if (best) {
    return String(best.answer).trim();
  }

  const question = String(message || '').trim();
  return question
    ? '您好，已收到您的咨询。目前缺少足够的店铺或订单核实信息，我不会直接猜测。请提供相关订单号或具体商品信息，我们核实后再给您准确答复。'
    : '您好，请告诉我您想咨询的商品或订单问题，我们会核实后给您准确答复。';
}

async function generateDraft({ message, platform, customerId, shopId, kbContext, orderContext }) {
  const policy = evaluateMessage(message);
  const apiKey = String(process.env.BOSSAI_OS_API_KEY || '').trim();

  if (!apiKey) {
    return {
      draftText: safeFallbackDraft({ message, kbContext, policy }),
      source: 'local_safety_template',
      reason: 'BOSSAI_OS_API_KEY_NOT_CONFIGURED',
      policy,
      reviewRequired: true,
      externalActionsExecuted: false,
    };
  }

  try {
    const baseUrl = normalizeBossAiUrl(process.env.BOSSAI_OS_URL);
    const model = selectedModel();
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bossai-api-key': apiKey,
      },
      body: JSON.stringify({
        model,
        messages: buildMessages({ message, platform, kbContext, orderContext, policy }),
        stream: false,
      }),
      signal: AbortSignal.timeout(Number(process.env.BOSSAI_AI_TIMEOUT_MS || 15000)),
    });
    if (!response.ok) throw new Error(`BossAI OS Gateway request failed: ${response.status}`);
    const payload = await response.json();
    const draftText = String(payload?.choices?.[0]?.message?.content || '').trim();
    if (!draftText) throw new Error('BossAI OS Gateway returned an empty draft.');

    logInfo({
      module: 'ai',
      event: 'draft_generated',
      platform,
      shopId,
      customerId,
      model,
      risk: policy.risk,
      length: draftText.length,
      externalActionsExecuted: false,
    });

    return {
      draftText,
      source: 'bossai_os_gateway',
      reason: null,
      policy,
      reviewRequired: true,
      externalActionsExecuted: false,
    };
  } catch (error) {
    logError({ module: 'ai', event: 'draft_error', platform, error: error.message });
    return {
      draftText: safeFallbackDraft({ message, kbContext, policy }),
      source: 'local_safety_template',
      reason: error.message,
      policy,
      reviewRequired: true,
      externalActionsExecuted: false,
    };
  }
}

async function generateReply(input) {
  const result = await generateDraft(input);
  return result.draftText;
}

async function detectIntent(message) {
  const policy = evaluateMessage(message);
  const reason = policy.reasons[0] || 'unclassified_support_message';
  const map = {
    refund_or_return: 'refund',
    cancel_or_modify_order: 'order_change',
    compensation_or_dispute: 'complaint',
    payment_or_account: 'account_or_payment',
    legal_or_safety: 'legal_or_safety',
    privacy_or_pii: 'privacy',
    shipping_info: 'shipping',
    product_info: 'product_inquiry',
    greeting: 'greeting',
  };
  return {
    intent: map[reason] || 'other',
    urgency: policy.risk === 'high' ? 'urgent' : 'normal',
    sentiment: 'neutral',
    policy,
  };
}

function clearConversation() {
  return { cleared: false, reason: 'NO_LOCAL_CONVERSATION_MEMORY_AUTHORITY' };
}

module.exports = {
  generateDraft,
  generateReply,
  detectIntent,
  clearConversation,
  normalizeBossAiUrl,
  safeFallbackDraft,
};
