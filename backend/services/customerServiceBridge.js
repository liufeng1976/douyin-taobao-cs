const { logInfo, logError } = require('../utils/logger');
const { usableValue } = require('../config/readiness');

function normalizeBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const url = new URL(raw);
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) {
    const error = new Error('BossAI Customer Service URL must use HTTPS except for loopback HTTP.');
    error.code = 'INSECURE_CUSTOMER_SERVICE_URL';
    throw error;
  }
  return url.origin;
}

function status() {
  let baseUrl = null;
  let configurationError = null;
  try {
    baseUrl = normalizeBaseUrl(process.env.BOSSAI_CUSTOMER_SERVICE_URL);
  } catch (error) {
    configurationError = error.message;
  }
  return {
    configured: Boolean(baseUrl) && !configurationError,
    baseUrl,
    configurationError,
    intakePath: '/api/connectors/intake',
    externalActionsExecuted: false,
  };
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { message: text.slice(0, 1000) }; }
}

function configuredBindings(env = process.env) {
  const bindings = [];
  const douyinEnabled = String(env.DOUYIN_ENABLED ?? '').trim().toLowerCase() !== 'false';
  const taobaoEnabled = String(env.TAOBAO_ENABLED ?? '').trim().toLowerCase() !== 'false';
  const douyinAccountRef = String(env.DOUYIN_ACCOUNT_REF || env.DOUYIN_SHOP_ID || '').trim();
  const taobaoAccountRef = String(env.TAOBAO_ACCOUNT_REF || '').trim();
  if (douyinEnabled && usableValue(douyinAccountRef)) bindings.push({ channel: 'douyin', accountRef: douyinAccountRef });
  if (taobaoEnabled && usableValue(taobaoAccountRef)) bindings.push({ channel: String(env.TAOBAO_CHANNEL || 'taobao').toLowerCase() === 'tmall' ? 'tmall' : 'taobao', accountRef: taobaoAccountRef });
  return bindings;
}

async function probeIntegration(options = {}) {
  const current = status();
  if (!current.configured) {
    return {
      configured: false,
      reachable: false,
      healthOk: false,
      bindings: [],
      allBindingsMatched: false,
      reason: current.configurationError ? 'INVALID_CUSTOMER_SERVICE_URL' : 'BOSSAI_CUSTOMER_SERVICE_URL_NOT_CONFIGURED',
      externalReadPerformed: false,
      externalActionsExecuted: false,
    };
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const apiKey = String(options.apiKey ?? process.env.BOSSAI_CUSTOMER_SERVICE_API_KEY ?? '').trim();
  const timeoutMs = Math.max(100, Math.min(Number(options.timeoutMs ?? 3000) || 3000, 10000));
  const headers = apiKey ? { 'x-api-key': apiKey } : {};
  const requestedBindings = Array.isArray(options.bindings) ? options.bindings : configuredBindings();

  try {
    const healthResponse = await fetchImpl(`${current.baseUrl}/health`, {
      method: 'GET', headers, signal: AbortSignal.timeout(timeoutMs),
    });
    const health = await parseJsonResponse(healthResponse);
    if (!healthResponse.ok || health?.ok !== true) {
      return {
        configured: true,
        reachable: healthResponse.ok,
        healthOk: false,
        bindings: requestedBindings.map((binding) => ({ ...binding, matched: false })),
        allBindingsMatched: false,
        reason: 'CANONICAL_CUSTOMER_SERVICE_HEALTH_FAILED',
        externalReadPerformed: true,
        externalActionsExecuted: false,
      };
    }

    const brandsResponse = await fetchImpl(`${current.baseUrl}/api/brands`, {
      method: 'GET', headers, signal: AbortSignal.timeout(timeoutMs),
    });
    const brandsPayload = await parseJsonResponse(brandsResponse);
    if (!brandsResponse.ok) {
      return {
        configured: true,
        reachable: true,
        healthOk: true,
        bindings: requestedBindings.map((binding) => ({ ...binding, matched: false })),
        allBindingsMatched: false,
        reason: brandsPayload?.code || 'CANONICAL_BRAND_BINDINGS_READ_FAILED',
        externalReadPerformed: true,
        externalActionsExecuted: false,
      };
    }

    const brands = Array.isArray(brandsPayload?.items) ? brandsPayload.items : [];
    const bindings = requestedBindings.map((binding) => {
      const match = brands.find((brand) => (brand?.channelBindings || []).some((candidate) =>
        candidate?.enabled !== false
        && String(candidate?.channel || '').trim().toLowerCase() === String(binding.channel || '').trim().toLowerCase()
        && String(candidate?.accountRef || '').trim() === String(binding.accountRef || '').trim()
      ));
      return {
        channel: binding.channel,
        accountRef: binding.accountRef,
        matched: Boolean(match),
        brandId: match ? String(match.id || '') || null : null,
      };
    });

    return {
      configured: true,
      reachable: true,
      healthOk: true,
      bindings,
      allBindingsMatched: bindings.length > 0 && bindings.every((binding) => binding.matched),
      reason: bindings.length === 0 ? 'NO_CONFIGURED_CHANNEL_BINDINGS' : (bindings.every((binding) => binding.matched) ? null : 'CHANNEL_ACCOUNT_BINDING_MISMATCH'),
      externalReadPerformed: true,
      externalActionsExecuted: false,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      healthOk: false,
      bindings: requestedBindings.map((binding) => ({ ...binding, matched: false })),
      allBindingsMatched: false,
      reason: error?.name === 'TimeoutError' ? 'CANONICAL_CUSTOMER_SERVICE_PROBE_TIMEOUT' : 'CANONICAL_CUSTOMER_SERVICE_UNREACHABLE',
      detail: error?.message || String(error),
      externalReadPerformed: true,
      externalActionsExecuted: false,
    };
  }
}

async function submitEnvelope(envelope, options = {}) {
  const current = status();
  if (!current.configured) {
    return {
      delivered: false,
      reason: current.configurationError ? 'INVALID_CUSTOMER_SERVICE_URL' : 'BOSSAI_CUSTOMER_SERVICE_URL_NOT_CONFIGURED',
      detail: current.configurationError,
      externalActionsExecuted: false,
    };
  }

  const retries = Math.max(0, Math.min(Number(options.retries ?? process.env.CONNECTOR_BRIDGE_RETRIES ?? 2), 3));
  const apiKey = String(options.apiKey ?? process.env.BOSSAI_CUSTOMER_SERVICE_API_KEY ?? '').trim();
  const requestedTimeout = Number(options.timeoutMs ?? process.env.CONNECTOR_BRIDGE_TIMEOUT_MS ?? 4000);
  const timeoutMs = Math.max(50, Math.min(Number.isFinite(requestedTimeout) ? requestedTimeout : 4000, 30000));
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('Global fetch is required for customer-service bridge delivery.');
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchImpl(`${current.baseUrl}/api/connectors/intake`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify(envelope),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const payload = await parseJsonResponse(response);

      if (response.ok) {
        logInfo({
          module: 'customerServiceBridge',
          event: 'connector_intake_delivered',
          channel: envelope.channel,
          sourceMessageId: envelope.sourceMessageId,
          status: response.status,
          idempotentReplay: Boolean(payload?.idempotentReplay),
        });
        return {
          delivered: true,
          status: response.status,
          response: payload,
          externalActionsExecuted: false,
        };
      }

      const error = new Error(`BossAI Customer Service intake failed: HTTP ${response.status}`);
      error.code = payload?.code || 'CUSTOMER_SERVICE_INTAKE_FAILED';
      error.status = response.status;
      error.responseBody = payload;
      throw error;
    } catch (error) {
      lastError = error;
      logError({
        module: 'customerServiceBridge',
        event: 'connector_intake_error',
        channel: envelope.channel,
        sourceMessageId: envelope.sourceMessageId,
        attempt: attempt + 1,
        error: error.message,
        code: error.code,
      });
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }

  return {
    delivered: false,
    reason: lastError?.code || 'CUSTOMER_SERVICE_INTAKE_FAILED',
    detail: lastError?.message || 'Unknown connector intake failure',
    externalActionsExecuted: false,
  };
}

module.exports = { normalizeBaseUrl, status, configuredBindings, probeIntegration, submitEnvelope };
