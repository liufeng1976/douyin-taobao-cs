/**
 * 淘宝 / 千牛适配器
 *
 * 对接淘宝开放平台千牛客服消息 API
 * 文档: https://open.taobao.com/api.htm
 *
 * 功能:
 *  1. 接收千牛推送的买家消息
 *  2. 轮询待回复消息
 *  3. AI 自动回复
 *  4. 订单查询辅助
 */

const axios = require('axios');
const crypto = require('crypto');
const { logInfo, logError } = require('../utils/logger');

const TAOBAO_API = 'https://eco.taobao.com/router/rest';

/**
 * 淘宝/千牛消息 webhook 处理
 */
async function handleWebhook(req) {
  const body = req.body.toString('utf-8');
  let payload;

  try {
    // 淘宝 webhook 可能用 form 或 JSON
    if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      const qs = require('querystring');
      payload = qs.parse(body);
    } else {
      payload = JSON.parse(body);
    }

    // 消息类型判断
    const msgType = payload.type || payload.msg_type;

    logInfo({ module: 'taobao', event: 'webhook_received', type: msgType });

    if (msgType === 'message' || msgType === 'im_message') {
      // 收到买家消息 → 异步处理
      setImmediate(() => handleBuyerMessage(payload));
    }

    return { code: 0, msg: 'success' };
  } catch (err) {
    logError({ module: 'taobao', event: 'webhook_error', error: err.message });
    return { code: 1, msg: '处理失败' };
  }
}

/**
 * 处理买家消息
 */
async function handleBuyerMessage(data) {
  try {
    const {
      buyer_nick: customerId,
      content: message,
      tid: orderId,
      shop_id: shopId,
    } = data;

    const ai = require('../ai');
    const kb = require('../knowledge');

    // 如果有关联订单，先查订单信息
    let orderContext = null;
    if (orderId) {
      orderContext = await getOrderInfo(orderId);
    }

    const kbContext = await kb.search(shopId, message);

    const reply = await ai.generateReply({
      message,
      platform: 'taobao',
      customerId,
      shopId,
      kbContext,
      orderContext,
    });

    if (reply) {
      await sendMessage(shopId, customerId, reply);
    }
  } catch (err) {
    logError({ module: 'taobao', event: 'handle_message_error', error: err.message });
  }
}

/**
 * 发送消息给买家
 *
 * 千牛发送消息 API: taobao.openim.messages.send
 */
async function sendMessage(shopId, customerId, content) {
  try {
    const params = buildTaobaoParams({
      method: 'taobao.openim.messages.send',
      to_users: JSON.stringify([customerId]),
      msg_content: JSON.stringify({
        msg_type: 'text',
        text: { text: content },
      }),
    });

    const res = await axios.post(TAOBAO_API, null, { params });
    logInfo({ module: 'taobao', event: 'send_msg', customerId });
    return res.data;
  } catch (err) {
    logError({ module: 'taobao', event: 'send_msg_error', error: err.message });
    throw err;
  }
}

/**
 * 轮询待回复消息并自动回复
 */
async function pollAndReply() {
  try {
    const messages = await getUnrepliedMessages();
    if (!messages || messages.length === 0) return { processed: 0 };

    const ai = require('../ai');
    const kb = require('../knowledge');
    let processed = 0;

    for (const msg of messages) {
      try {
        const kbContext = await kb.search(msg.shop_id || 'default', msg.content);
        const reply = await ai.generateReply({
          message: msg.content,
          platform: 'taobao',
          customerId: msg.buyer_nick,
          shopId: msg.shop_id || 'default',
          kbContext,
        });

        if (reply) {
          await sendMessage(msg.shop_id || 'default', msg.buyer_nick, reply);
          processed++;
        }
      } catch (e) {
        logError({ module: 'taobao', event: 'poll_reply_error', error: e.message });
      }
    }

    logInfo({ module: 'taobao', event: 'poll_complete', processed, total: messages.length });
    return { processed, total: messages.length };
  } catch (err) {
    logError({ module: 'taobao', event: 'poll_error', error: err.message });
    return { processed: 0, error: err.message };
  }
}

/**
 * 获取未回复消息列表
 */
async function getUnrepliedMessages() {
  try {
    const params = buildTaobaoParams({
      method: 'taobao.openim.messages.search',
      start_time: new Date(Date.now() - 3600000).toISOString(),
      end_time: new Date().toISOString(),
      page_no: '1',
      page_size: '50',
    });

    const res = await axios.post(TAOBAO_API, null, { params });
    const list = res.data?.openim_messages_search_response?.messages?.message || [];
    return list;
  } catch (err) {
    logError({ module: 'taobao', event: 'get_unread_error', error: err.message });
    return [];
  }
}

/**
 * 获取订单信息
 */
async function getOrderInfo(orderId) {
  try {
    const params = buildTaobaoParams({
      method: 'taobao.trade.fullinfo.get',
      tid: orderId,
      fields: 'tid,status,payment,buyer_nick,orders.title,orders.price,orders.num,receiver_name,receiver_mobile,receiver_state,receiver_city,receiver_district,receiver_address',
    });

    const res = await axios.post(TAOBAO_API, null, { params });
    return res.data?.trade_fullinfo_get_response?.trade || null;
  } catch {
    return null;
  }
}

// --- 淘宝 API 签名 ---
function buildTaobaoParams(apiParams) {
  const publicParams = {
    method: apiParams.method,
    app_key: process.env.TAOBAO_APP_KEY,
    session: process.env.TAOBAO_SESSION_KEY,
    timestamp: new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14),
    format: 'json',
    v: '2.0',
    sign_method: 'hmac-sha256',
  };

  // 合并参数
  const allParams = { ...publicParams, ...apiParams };
  delete allParams.method; // method 不参与签名

  // 排序
  const sortedKeys = Object.keys(allParams).sort();
  const signStr = sortedKeys.map(k => `${k}${allParams[k]}`).join('');

  // HMAC-SHA256 签名
  const sign = crypto
    .createHmac('sha256', process.env.TAOBAO_APP_SECRET)
    .update(signStr)
    .digest('hex')
    .toUpperCase();

  return { ...publicParams, ...apiParams, sign };
}

module.exports = {
  handleWebhook,
  sendMessage,
  pollAndReply,
  getOrderInfo,
};
