/**
 * 抖音电商适配器
 *
 * 对接抖音开放平台 IM 客服消息 API
 * 文档: https://op.jinritemai.com/docs/api-docs
 *
 * 功能:
 *  1. 接收 webhook 消息 → 解析客户问题
 *  2. 拉取待回复消息列表 (轮询模式)
 *  3. 通过 AI 引擎生成回复 → 自动发送
 *  4. 获取订单信息辅助回答
 */

const axios = require('axios');
const crypto = require('crypto');
const { logInfo, logError } = require('../utils/logger');

const DOUYIN_API = 'https://openapi-fxg.jinritemai.com';

/**
 * 抖音消息 webhook 处理
 * 接收抖音推送的客户消息，解析后送给 AI 引擎
 */
async function handleWebhook(req) {
  const body = req.body.toString('utf-8');
  const payload = JSON.parse(body);

  try {
    // 签名验证
    const sign = req.headers['event-sign'] || req.headers['x-douyin-sign'];
    if (sign && !verifyDouyinSign(body, sign)) {
      logError({ module: 'douyin', event: 'webhook_sign_fail' });
      return { code: 10001, msg: '签名验证失败' };
    }

    const { event, data } = payload;

    logInfo({ module: 'douyin', event: 'webhook_received', type: event });

    switch (event) {
      case 'im_receive_msg':
        // 收到客户消息 → 异步处理
        setImmediate(() => handleCustomerMessage(data));
        break;
      case 'im_enter_session':
        // 用户进入会话
        logInfo({ module: 'douyin', event: 'session_enter', userId: data?.user_id });
        break;
      case 'im_close_session':
        // 会话关闭
        logInfo({ module: 'douyin', event: 'session_close', userId: data?.user_id });
        break;
      default:
        logInfo({ module: 'douyin', event: 'unknown_event', type: event });
    }

    return { code: 0, msg: 'ok' };
  } catch (err) {
    logError({ module: 'douyin', event: 'webhook_error', error: err.message });
    return { code: 10002, msg: '处理失败' };
  }
}

/**
 * 处理客户消息
 */
async function handleCustomerMessage(data) {
  try {
    const {
      user_id: customerId,
      content: message,
      msg_type: msgType,
      shop_id: shopId,
      conversation_id: conversationId,
    } = data;

    const ai = require('../ai');
    const kb = require('../knowledge');

    // 查询知识库
    const kbContext = await kb.search(shopId, message);

    // AI 生成回复
    const reply = await ai.generateReply({
      message,
      platform: 'douyin',
      customerId,
      shopId,
      conversationId,
      kbContext,
    });

    if (reply) {
      await sendMessage(shopId, customerId, reply, conversationId);
    }
  } catch (err) {
    logError({ module: 'douyin', event: 'handle_message_error', error: err.message });
  }
}

/**
 * 发送消息给客户
 *
 * 抖音 IM 发送消息 API: /im/sendMsg
 */
async function sendMessage(shopId, customerId, content, conversationId) {
  try {
    const token = await getAccessToken(shopId);

    const params = {
      method: 'im.sendMsg',
      app_key: process.env.DOUYIN_APP_KEY,
      access_token: token,
      timestamp: new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14),
      v: '2',
    };

    const body = {
      open_id: customerId,
      msg_content: JSON.stringify({
        msg_type: 'text',
        text: content,
      }),
    };

    const res = await axios.post(`${DOUYIN_API}/im/sendMsg`, body, { params });
    logInfo({ module: 'douyin', event: 'send_msg', customerId, success: res.data?.code === 10000 });
    return res.data;
  } catch (err) {
    logError({ module: 'douyin', event: 'send_msg_error', error: err.message });
    throw err;
  }
}

/**
 * 轮询待回复消息
 */
async function pollAndReply() {
  try {
    // 获取未回复消息列表
    const messages = await getUnrepliedMessages();
    if (!messages || messages.length === 0) return { processed: 0 };

    const ai = require('../ai');
    const kb = require('../knowledge');
    let processed = 0;

    for (const msg of messages) {
      try {
        const kbContext = await kb.search(msg.shop_id, msg.content);
        const reply = await ai.generateReply({
          message: msg.content,
          platform: 'douyin',
          customerId: msg.user_id,
          shopId: msg.shop_id,
          kbContext,
        });

        if (reply) {
          await sendMessage(msg.shop_id, msg.user_id, reply, msg.conversation_id);
          processed++;
        }
      } catch (e) {
        logError({ module: 'douyin', event: 'poll_reply_error', error: e.message });
      }
    }

    logInfo({ module: 'douyin', event: 'poll_complete', processed, total: messages.length });
    return { processed, total: messages.length };
  } catch (err) {
    logError({ module: 'douyin', event: 'poll_error', error: err.message });
    return { processed: 0, error: err.message };
  }
}

/**
 * 获取未回复消息
 */
async function getUnrepliedMessages() {
  try {
    const token = await getAccessToken(process.env.DOUYIN_SHOP_ID);
    const params = {
      method: 'im.getUnreadMsg',
      app_key: process.env.DOUYIN_APP_KEY,
      access_token: token,
      timestamp: new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14),
      v: '2',
    };

    const res = await axios.get(`${DOUYIN_API}/im/getUnreadMsg`, { params });
    return res.data?.data?.list || [];
  } catch (err) {
    logError({ module: 'douyin', event: 'get_unread_error', error: err.message });
    return [];
  }
}

// --- Token 管理 ---
let cachedToken = null;
let tokenExpiry = 0;

/**
 * 获取抖音 access_token (带缓存)
 */
async function getAccessToken(shopId) {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  try {
    const params = {
      app_id: process.env.DOUYIN_APP_KEY,
      app_secret: process.env.DOUYIN_APP_SECRET,
      grant_type: 'authorization_self',
    };

    const res = await axios.get(`${DOUYIN_API}/oauth2/access_token`, { params });
    if (res.data?.data?.access_token) {
      cachedToken = res.data.data.access_token;
      tokenExpiry = Date.now() + (res.data.data.expires_in || 7200) * 1000 - 60000;
    }
    return cachedToken;
  } catch (err) {
    logError({ module: 'douyin', event: 'token_error', error: err.message });
    throw err;
  }
}

// --- 签名验证 ---
function verifyDouyinSign(body, sign) {
  try {
    const computed = crypto
      .createHmac('sha256', process.env.DOUYIN_APP_SECRET)
      .update(body)
      .digest('hex');
    return computed === sign;
  } catch {
    return false;
  }
}

module.exports = {
  handleWebhook,
  sendMessage,
  pollAndReply,
  getUnrepliedMessages,
};
