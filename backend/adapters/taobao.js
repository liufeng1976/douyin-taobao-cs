/**
 * Taobao / Tmall / Qianniu inbound customer-service channel adapter.
 *
 * Inbound messages are verified/normalized and forwarded to the canonical
 * BossAI Customer Service connector intake contract. This workspace keeps
 * read-only marketplace fact helpers but does not automatically send replies.
 */

const crypto = require('crypto');
const { logInfo, logError, logWarn } = require('../utils/logger');
const { buildEnvelope, minimalOrderFacts } = require('../contracts/customerServiceIntake');
const customerServiceBridge = require('../services/customerServiceBridge');
const { evaluateMessage } = require('../policy/responsePolicy');

const TAOBAO_API = process.env.TAOBAO_API_URL || 'https://gw.api.taobao.com/router/rest';

function safeEqualText(a, b) {
  const left = Buffer.from(String(a || '').trim().toLowerCase());
  const right = Buffer.from(String(b || '').trim().toLowerCase());
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/**
 * Alibaba message-service signature:
 * Authorization = HEX(HMAC-SHA256(app_key + raw_body, app_secret)).
 * Raw body must remain byte-for-byte unchanged before verification.
 */
function createTaobaoWebhookSign(body, appKey, secret) {
  if (!appKey || !secret) return null;
  return crypto.createHmac('sha256', secret).update(`${appKey}${body}`, 'utf8').digest('hex');
}

function verifyTaobaoWebhookSign(body, authorization, appKey = process.env.TAOBAO_APP_KEY, secret = process.env.TAOBAO_APP_SECRET) {
  if (!authorization || !appKey || !secret) return false;
  const provided = String(authorization).replace(/^HMAC-SHA256\s+/i, '').trim();
  const expected = createTaobaoWebhookSign(body, appKey, secret);
  return Boolean(expected) && safeEqualText(provided, expected);
}

function parseMaybeJson(value) {
  if (value && typeof value === 'object') return value;
  const text = String(value || '').trim();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { content: text }; }
}

function unwrapPayload(payload) {
  const outer = parseMaybeJson(payload);
  for (const key of ['message', 'data', 'content', 'body']) {
    const value = outer?.[key];
    if (value && typeof value === 'string' && /^[\[{]/.test(value.trim())) {
      const parsed = parseMaybeJson(value);
      if (parsed && typeof parsed === 'object') return { ...outer, ...parsed };
    }
  }
  return outer;
}

function toIsoTimestamp(value) {
  if (!value) return new Date().toISOString();
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    const millis = numeric < 1000000000000 ? numeric * 1000 : numeric;
    const date = new Date(millis);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizeTaobaoMessage(payload, rawBody) {
  const data = unwrapPayload(payload);
  const content = data.content && typeof data.content === 'object'
    ? data.content.text || data.content.content || data.content.message
    : data.content;
  const message = String(data.message || data.text || content || '').trim();
  if (!message) return null;

  const accountRef = String(
    process.env.TAOBAO_ACCOUNT_REF || data.shop_id || data.shopId || data.to_id || data.seller_nick || ''
  ).trim();
  const customerReferenceId = String(
    data.buyer_nick || data.from_id || data.customer_id || data.customerId || data.user_id || ''
  ).trim();
  const policy = evaluateMessage(message);
  const orderId = data.tid || data.order_id || data.orderId || null;

  return buildEnvelope({
    channel: String(process.env.TAOBAO_CHANNEL || 'taobao').toLowerCase() === 'tmall' ? 'tmall' : 'taobao',
    accountRef,
    sourceMessageId: data.msg_id || data.msgId || data.message_id || data.id,
    rawBody,
    customerReferenceId,
    customerName: data.nickname || data.buyer_nick || data.customer_name || 'Customer',
    subject: data.subject || 'Taobao/Qianniu customer message',
    message,
    receivedAt: toIsoTimestamp(data.gmt_send || data.timestamp || data.create_time || data.time),
    intent: policy.reasons[0] || 'GENERAL_SUPPORT',
    orderId,
    order: data.order || (orderId ? { orderId } : null),
    cursor: data.msg_id || data.msgId || null,
  });
}

async function routeMessage(payload, rawBody, bridgeOptions = {}) {
  const envelope = normalizeTaobaoMessage(payload, rawBody);
  if (!envelope) {
    logInfo({ module: 'taobao', event: 'webhook_non_customer_message_ignored' });
    return { routed: false, reason: 'NO_CUSTOMER_TEXT' };
  }

  // Keep callback routing fast and deterministic. Order facts are enriched later
  // through an explicit read-only action, never inside the callback acknowledgement path.
  const result = await customerServiceBridge.submitEnvelope(envelope, bridgeOptions);
  logInfo({
    module: 'taobao',
    event: 'customer_message_routed',
    sourceMessageId: envelope.sourceMessageId,
    delivered: result.delivered,
    reason: result.reason || null,
  });
  return { routed: result.delivered, envelope, bridge: result };
}

async function handleWebhook(req) {
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
  const authorization = req.headers.authorization || (process.env.NODE_ENV !== 'production' ? req.headers['x-taobao-sign'] : '');
  const requireSignature = process.env.NODE_ENV === 'production' || process.env.REQUIRE_SIGNED_WEBHOOKS === 'true';

  if ((authorization || requireSignature) && !verifyTaobaoWebhookSign(rawBody, authorization)) {
    const error = new Error('Taobao webhook signature verification failed.');
    error.status = 401;
    error.code = 'TAOBAO_WEBHOOK_SIGNATURE_INVALID';
    throw error;
  }

  let payload;
  try {
    const contentType = String(req.headers['content-type'] || '');
    if (contentType.includes('application/x-www-form-urlencoded')) {
      payload = Object.fromEntries(new URLSearchParams(rawBody));
    } else {
      payload = JSON.parse(rawBody || '{}');
    }
  } catch (error) {
    error.status = 400;
    error.code = 'TAOBAO_WEBHOOK_BODY_INVALID';
    throw error;
  }

  logInfo({ module: 'taobao', event: 'webhook_received' });
  const bridgeTimeoutMs = Number(process.env.WEBHOOK_BRIDGE_TIMEOUT_MS || 120);
  const result = await routeMessage(payload, rawBody, { retries: 0, timeoutMs: bridgeTimeoutMs });
  if (result.reason !== 'NO_CUSTOMER_TEXT' && !result.routed) {
    const error = new Error(`Canonical customer-service intake unavailable: ${result.bridge?.reason || 'delivery failed'}`);
    error.status = 503;
    error.code = 'CANONICAL_CUSTOMER_SERVICE_INTAKE_UNAVAILABLE';
    throw error;
  }
  return { code: 0, msg: 'success' };
}

async function sendMessage() {
  const error = new Error('Direct Taobao customer-message sending is disabled in this source workspace. Approve and send through the canonical BossAI Customer Service workflow.');
  error.status = 409;
  error.code = 'DIRECT_CHANNEL_SEND_DISABLED';
  throw error;
}

async function pollAndReply() {
  logWarn({ module: 'taobao', event: 'polling_retired', reason: 'USE_SIGNED_MESSAGE_SERVICE_WEBHOOK' });
  return {
    processed: 0,
    supported: false,
    reason: 'POLLING_RETIRED_USE_SIGNED_WEBHOOK',
    automaticExternalActions: false,
  };
}

function taobaoTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function buildTaobaoParams(apiParams, options = {}) {
  const appKey = String(options.appKey ?? process.env.TAOBAO_APP_KEY ?? '').trim();
  const secret = String(options.secret ?? process.env.TAOBAO_APP_SECRET ?? '').trim();
  const session = String(options.session ?? process.env.TAOBAO_SESSION_KEY ?? '').trim();
  if (!appKey || !secret) throw new Error('TAOBAO_APP_KEY and TAOBAO_APP_SECRET are required.');

  const allParams = {
    method: apiParams.method,
    app_key: appKey,
    ...(session ? { session } : {}),
    timestamp: options.timestamp || taobaoTimestamp(),
    format: 'json',
    v: '2.0',
    sign_method: 'hmac-sha256',
    ...apiParams,
  };

  const signStr = Object.keys(allParams)
    .filter((key) => key !== 'sign' && allParams[key] !== undefined && allParams[key] !== null)
    .sort()
    .map((key) => `${key}${allParams[key]}`)
    .join('');
  const sign = crypto.createHmac('sha256', secret).update(signStr, 'utf8').digest('hex').toUpperCase();
  return { ...allParams, sign };
}

async function getOrderInfo(orderId, options = {}) {
  if (!orderId) return null;
  try {
    const params = buildTaobaoParams({
      method: 'taobao.trade.fullinfo.get',
      tid: String(orderId),
      fields: 'tid,status,payment,orders.title,orders.sku_id,orders.num',
    }, options);
    const url = new URL(options.apiUrl || TAOBAO_API);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const response = await fetchImpl(url, { method: 'POST', signal: AbortSignal.timeout(Number(options.timeoutMs || 8000)) });
    if (!response.ok) throw new Error(`Taobao order facts request failed: HTTP ${response.status}`);
    const payload = await response.json();
    return minimalOrderFacts(payload?.trade_fullinfo_get_response?.trade || null);
  } catch (error) {
    logError({ module: 'taobao', event: 'order_fact_read_error', orderId: String(orderId), error: error.message });
    return null;
  }
}

async function getUnrepliedMessages() {
  return [];
}

module.exports = {
  handleWebhook,
  sendMessage,
  pollAndReply,
  getOrderInfo,
  getUnrepliedMessages,
  verifyTaobaoWebhookSign,
  createTaobaoWebhookSign,
  normalizeTaobaoMessage,
  routeMessage,
  buildTaobaoParams,
  taobaoTimestamp,
};
