const crypto = require('crypto');

const SCHEMA = 'bossai.customer-service-connector-envelope.v1';
const SUPPORTED_CHANNELS = new Set(['douyin', 'taobao', 'tmall']);

function text(value, max = 12000) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeChannel(value) {
  const channel = text(value, 40).toLowerCase();
  if (!SUPPORTED_CHANNELS.has(channel)) {
    const error = new Error(`Unsupported customer-service channel: ${channel || '(empty)'}`);
    error.code = 'UNSUPPORTED_CHANNEL';
    error.status = 400;
    throw error;
  }
  return channel;
}

function stableSourceMessageId({ channel, accountRef, explicitId, rawBody, customerReferenceId, receivedAt, message }) {
  const id = text(explicitId, 200);
  if (id) return id;
  const digest = crypto.createHash('sha256')
    .update([
      normalizeChannel(channel),
      text(accountRef, 200),
      text(rawBody, 50000),
      text(customerReferenceId, 200),
      text(receivedAt, 80),
      text(message, 12000),
    ].join('\u001f'))
    .digest('hex');
  return `derived-${digest}`;
}

function minimalOrderFacts(order) {
  if (!order || typeof order !== 'object') return null;
  const productSource = Array.isArray(order.products)
    ? order.products
    : Array.isArray(order.orders?.order)
      ? order.orders.order
      : Array.isArray(order.orders)
        ? order.orders
        : null;
  const result = {
    orderId: text(order.orderId || order.tid || order.id, 200) || null,
    status: text(order.status || order.order_status, 120) || null,
    payment: text(order.payment, 120) || null,
    products: productSource
      ? productSource.slice(0, 20).map((item) => ({
          title: text(item?.title, 300),
          skuId: text(item?.skuId || item?.sku_id, 120) || null,
          quantity: Number.isFinite(Number(item?.quantity ?? item?.num)) ? Number(item?.quantity ?? item?.num) : null,
        }))
      : null,
  };
  if (!result.orderId && !result.status && !result.payment && !result.products) return null;
  return result;
}

function buildEnvelope(input = {}) {
  const channel = normalizeChannel(input.channel);
  const accountRef = text(input.accountRef, 200);
  const customerReferenceId = text(input.customerReferenceId || input.customerId, 200);
  const message = text(input.message || input.messageText, 12000);
  const receivedAt = text(input.receivedAt || new Date().toISOString(), 80);

  if (!accountRef || !message) {
    const error = new Error('accountRef and message are required for connector intake.');
    error.code = 'CONNECTOR_ENVELOPE_INVALID';
    error.status = 400;
    throw error;
  }

  return {
    schema: SCHEMA,
    channel,
    accountRef,
    sourceMessageId: stableSourceMessageId({
      channel,
      accountRef,
      explicitId: input.sourceMessageId,
      rawBody: input.rawBody,
      customerReferenceId,
      receivedAt,
      message,
    }),
    cursor: text(input.cursor, 500) || null,
    customerReferenceId,
    customerName: text(input.customerName || 'Customer', 200),
    subject: text(input.subject || 'Customer message', 500),
    message,
    receivedAt,
    intent: text(input.intent || 'GENERAL_SUPPORT', 120),
    orderId: text(input.orderId || input.order?.orderId || input.order?.tid, 200) || null,
    order: minimalOrderFacts(input.order),
    shipment: input.shipment && typeof input.shipment === 'object'
      ? {
          carrier: text(input.shipment.carrier, 120) || null,
          trackingNumber: text(input.shipment.trackingNumber, 200) || null,
          status: text(input.shipment.status || input.shipment.packageStatus, 160) || null,
          observedAt: text(input.shipment.observedAt || input.shipment.lastVerifiedEventAt, 80) || null,
        }
      : null,
  };
}

module.exports = {
  SCHEMA,
  buildEnvelope,
  stableSourceMessageId,
  minimalOrderFacts,
  normalizeChannel,
};
