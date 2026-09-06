/**
 * Douyin Shop inbound customer-service channel adapter.
 *
 * Responsibility: verify/normalize inbound marketplace messages and forward
 * them to the canonical BossAI Customer Service connector intake contract.
 * This source workspace does not own customer-service workflow state or send
 * customer-facing messages automatically.
 */

const crypto = require('crypto');
const { logInfo, logError, logWarn } = require('../utils/logger');
const { buildEnvelope } = require('../contracts/customerServiceIntake');
const customerServiceBridge = require('../services/customerServiceBridge');
const { evaluateMessage } = require('../policy/responsePolicy');

function safeEqual(a, b) {
  const left = Buffer.from(String(a || '').toLowerCase());
  const right = Buffer.from(String(b || '').toLowerCase());
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function safeEqualExact(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/**
 * 抖店消息推送 event-sign.
 * The platform lets the application choose MD5 or HMAC-SHA256 for callbacks.
 * Both algorithms use the unmodified raw request body.
 */
function normalizeDouyinSignMethod(value) {
  const method = String(value || 'hmac-sha256').trim().toLowerCase();
  if (['hmac-sha256', 'hmac_sha256', 'hmacsha256'].includes(method)) return 'hmac-sha256';
  if (method === 'md5') return 'md5';
  return null;
}

function createDouyinSign(body, appId, secret, signMethod = process.env.DOUYIN_WEBHOOK_SIGN_METHOD || 'hmac-sha256') {
  if (!appId || !secret) return null;
  const method = normalizeDouyinSignMethod(signMethod);
  if (!method) return null;
  const signParam = `${appId}${body}${secret}`;
  return method === 'hmac-sha256'
    ? crypto.createHmac('sha256', secret).update(signParam, 'utf8').digest('hex')
    : crypto.createHash('md5').update(signParam, 'utf8').digest('hex');
}

function verifyDouyinSign(
  body,
  sign,
  appId = process.env.DOUYIN_APP_KEY,
  secret = process.env.DOUYIN_APP_SECRET,
  signMethod = process.env.DOUYIN_WEBHOOK_SIGN_METHOD || 'hmac-sha256'
) {
  if (!sign || !appId || !secret) return false;
  const computed = createDouyinSign(body, appId, secret, signMethod);
  return Boolean(computed) && safeEqual(computed, sign);
}

function parseMaybeJson(value) {
  if (value && typeof value === 'object') return value;
  const text = String(value || '').trim();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { content: text }; }
}

function messageText(data) {
  const direct = data?.message || data?.text || data?.content || data?.msg_content || data?.message_content;
  if (direct && typeof direct === 'object') {
    return String(direct.text || direct.content || direct.message || '').trim();
  }
  const parsed = parseMaybeJson(direct);
  if (parsed && typeof parsed === 'object' && direct !== parsed) {
    return String(parsed.text || parsed.content || parsed.message || direct || '').trim();
  }
  return String(direct || '').trim();
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

function normalizeDouyinEntry(entry, rawBody) {
  const data = parseMaybeJson(entry?.data ?? entry?.content ?? entry);
  const message = messageText(data);
  if (!message) return null;

  const shopId = String(data.shop_id || data.shopId || process.env.DOUYIN_SHOP_ID || '').trim();
  const accountRef = String(process.env.DOUYIN_ACCOUNT_REF || shopId).trim();
  const customerReferenceId = String(
    data.user_id || data.open_id || data.from_id || data.buyer_id || data.customer_id || ''
  ).trim();
  const receivedAt = toIsoTimestamp(data.create_time || data.gmt_send || data.timestamp || data.time);
  const policy = evaluateMessage(message);

  return buildEnvelope({
    channel: 'douyin',
    accountRef,
    sourceMessageId: entry?.msg_id || entry?.msgId || data.msg_id || data.msgId || data.message_id,
    rawBody,
    customerReferenceId,
    customerName: data.nickname || data.user_name || data.customer_name || 'Customer',
    subject: data.subject || `Douyin customer message${entry?.tag ? ` (${entry.tag})` : ''}`,
    message,
    receivedAt,
    intent: policy.reasons[0] || 'GENERAL_SUPPORT',
    orderId: data.order_id || data.orderId || data.tid || null,
    order: data.order || null,
    cursor: entry?.msg_id || entry?.msgId || null,
  });
}

async function routeEntry(entry, rawBody, bridgeOptions = {}) {
  const envelope = normalizeDouyinEntry(entry, rawBody);
  if (!envelope) {
    logInfo({ module: 'douyin', event: 'webhook_non_customer_message_ignored', tag: entry?.tag || null });
    return { routed: false, reason: 'NO_CUSTOMER_TEXT' };
  }
  const result = await customerServiceBridge.submitEnvelope(envelope, bridgeOptions);
  logInfo({
    module: 'douyin',
    event: 'customer_message_routed',
    sourceMessageId: envelope.sourceMessageId,
    delivered: result.delivered,
    reason: result.reason || null,
  });
  return { routed: result.delivered, envelope, bridge: result };
}

async function handleWebhook(req) {
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
  const sign = req.headers['event-sign'];
  const callbackAppId = String(req.headers['app-id'] || '').trim();
  const configuredAppId = String(process.env.DOUYIN_APP_KEY || '').trim();
  const requireSignature = process.env.NODE_ENV === 'production' || process.env.REQUIRE_SIGNED_WEBHOOKS === 'true';
  const signMethod = process.env.DOUYIN_WEBHOOK_SIGN_METHOD || 'hmac-sha256';

  if (callbackAppId && configuredAppId && !safeEqualExact(callbackAppId, configuredAppId)) {
    const error = new Error('Douyin callback app-id does not match the configured application.');
    error.status = 401;
    error.code = 'DOUYIN_WEBHOOK_APP_ID_MISMATCH';
    throw error;
  }

  if ((sign || requireSignature) && !verifyDouyinSign(rawBody, sign, configuredAppId, process.env.DOUYIN_APP_SECRET, signMethod)) {
    logError({ module: 'douyin', event: 'webhook_sign_fail', signMethod: normalizeDouyinSignMethod(signMethod) || 'invalid' });
    const error = new Error('Douyin webhook signature verification failed.');
    error.status = 401;
    error.code = 'DOUYIN_WEBHOOK_SIGNATURE_INVALID';
    throw error;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody || 'null');
  } catch (error) {
    error.status = 400;
    error.code = 'DOUYIN_WEBHOOK_JSON_INVALID';
    throw error;
  }

  const entries = Array.isArray(payload) ? payload : [payload];
  logInfo({ module: 'douyin', event: 'webhook_received', count: entries.length });

  const bridgeTimeoutMs = Number(process.env.WEBHOOK_BRIDGE_TIMEOUT_MS || 120);
  for (const entry of entries) {
    if (String(entry?.msg_id ?? entry?.msgId ?? '') === '0') continue;
    const result = await routeEntry(entry, rawBody, { retries: 0, timeoutMs: bridgeTimeoutMs });
    if (result.reason === 'NO_CUSTOMER_TEXT') continue;
    if (!result.routed) {
      const error = new Error(`Canonical customer-service intake unavailable: ${result.bridge?.reason || 'delivery failed'}`);
      error.status = 503;
      error.code = 'CANONICAL_CUSTOMER_SERVICE_INTAKE_UNAVAILABLE';
      throw error;
    }
  }

  return { code: 0, msg: 'success' };
}

async function sendMessage() {
  const error = new Error('Direct Douyin customer-message sending is disabled in this source workspace. Approve and send through the canonical BossAI Customer Service workflow.');
  error.status = 409;
  error.code = 'DIRECT_CHANNEL_SEND_DISABLED';
  throw error;
}

async function pollAndReply() {
  logWarn({ module: 'douyin', event: 'polling_retired', reason: 'USE_SIGNED_WEBHOOK_CONNECTOR_INTAKE' });
  return {
    processed: 0,
    supported: false,
    reason: 'POLLING_RETIRED_USE_SIGNED_WEBHOOK',
    automaticExternalActions: false,
  };
}

async function getUnrepliedMessages() {
  return [];
}

module.exports = {
  handleWebhook,
  sendMessage,
  pollAndReply,
  getUnrepliedMessages,
  verifyDouyinSign,
  createDouyinSign,
  normalizeDouyinSignMethod,
  normalizeDouyinEntry,
  routeEntry,
};
