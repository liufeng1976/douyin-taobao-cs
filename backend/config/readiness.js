function present(value) {
  return Boolean(String(value ?? '').trim());
}

function isPlaceholder(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  const normalized = raw.toLowerCase();
  return normalized.startsWith('your-')
    || normalized.startsWith('your_')
    || normalized.startsWith('replace-')
    || normalized.startsWith('replace_')
    || normalized.startsWith('change-me')
    || normalized.startsWith('changeme')
    || normalized === 'dev-key-001'
    || normalized === 'test-key'
    || normalized === 'test-secret'
    || /^<[^>]+>$/.test(raw);
}

function usableValue(value) {
  return present(value) && !isPlaceholder(value);
}

function booleanEnv(value, fallback = false) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function safeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return { configured: false, valid: false, secure: false, loopback: false, origin: null };
  try {
    const url = new URL(raw);
    const loopback = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
    const secure = url.protocol === 'https:' || (loopback && url.protocol === 'http:');
    return { configured: true, valid: true, secure, loopback, origin: url.origin };
  } catch {
    return { configured: true, valid: false, secure: false, loopback: false, origin: null };
  }
}

function fieldDiagnostics(entries) {
  const missingFields = [];
  const placeholderFields = [];
  for (const [label, value] of entries) {
    if (!present(value)) missingFields.push(label);
    else if (isPlaceholder(value)) placeholderFields.push(label);
  }
  return { missingFields, placeholderFields };
}

function channelReadiness(env = process.env) {
  const douyinAccount = present(env.DOUYIN_ACCOUNT_REF) ? env.DOUYIN_ACCOUNT_REF : env.DOUYIN_SHOP_ID;
  const douyinDiagnostics = fieldDiagnostics([
    ['DOUYIN_APP_KEY', env.DOUYIN_APP_KEY],
    ['DOUYIN_APP_SECRET', env.DOUYIN_APP_SECRET],
    [present(env.DOUYIN_ACCOUNT_REF) ? 'DOUYIN_ACCOUNT_REF' : 'DOUYIN_SHOP_ID', douyinAccount],
    ['DOUYIN_WEBHOOK_SIGN_METHOD', env.DOUYIN_WEBHOOK_SIGN_METHOD],
  ]);
  const douyin = {
    enabled: booleanEnv(env.DOUYIN_ENABLED, present(env.DOUYIN_APP_KEY) || present(env.DOUYIN_APP_SECRET) || present(env.DOUYIN_ACCOUNT_REF) || present(env.DOUYIN_SHOP_ID)),
    configured: usableValue(env.DOUYIN_APP_KEY)
      && usableValue(env.DOUYIN_APP_SECRET)
      && usableValue(douyinAccount),
    ...douyinDiagnostics,
    signMethodConfigured: present(env.DOUYIN_WEBHOOK_SIGN_METHOD),
    signMethod: present(env.DOUYIN_WEBHOOK_SIGN_METHOD) ? String(env.DOUYIN_WEBHOOK_SIGN_METHOD).trim().toLowerCase() : null,
  };
  douyin.signMethodValid = douyin.signMethodConfigured && ['hmac-sha256', 'md5'].includes(douyin.signMethod);
  douyin.ready = !douyin.enabled || (douyin.configured && douyin.signMethodValid);

  const taobaoDiagnostics = fieldDiagnostics([
    ['TAOBAO_APP_KEY', env.TAOBAO_APP_KEY],
    ['TAOBAO_APP_SECRET', env.TAOBAO_APP_SECRET],
    ['TAOBAO_ACCOUNT_REF', env.TAOBAO_ACCOUNT_REF],
    ['TAOBAO_CHANNEL', env.TAOBAO_CHANNEL],
  ]);
  const taobao = {
    enabled: booleanEnv(env.TAOBAO_ENABLED, present(env.TAOBAO_APP_KEY) || present(env.TAOBAO_APP_SECRET) || present(env.TAOBAO_ACCOUNT_REF)),
    configured: usableValue(env.TAOBAO_APP_KEY)
      && usableValue(env.TAOBAO_APP_SECRET)
      && usableValue(env.TAOBAO_ACCOUNT_REF),
    ...taobaoDiagnostics,
    channelConfigured: present(env.TAOBAO_CHANNEL),
    channel: present(env.TAOBAO_CHANNEL) ? String(env.TAOBAO_CHANNEL).trim().toLowerCase() : null,
  };
  taobao.channelValid = taobao.channelConfigured && ['taobao', 'tmall'].includes(taobao.channel);
  taobao.ready = !taobao.enabled || (taobao.configured && taobao.channelValid);

  return { douyin, taobao };
}

function evaluateReadiness(env = process.env) {
  const production = String(env.NODE_ENV || '').trim().toLowerCase() === 'production';
  const customerServiceUrl = safeUrl(env.BOSSAI_CUSTOMER_SERVICE_URL);
  const channels = channelReadiness(env);
  const enabledChannels = Object.entries(channels).filter(([, value]) => value.enabled);
  const blockers = [];
  const warnings = [];

  if (!customerServiceUrl.configured) blockers.push('BOSSAI_CUSTOMER_SERVICE_URL_NOT_CONFIGURED');
  else if (!customerServiceUrl.valid) blockers.push('BOSSAI_CUSTOMER_SERVICE_URL_INVALID');
  else if (!customerServiceUrl.secure) blockers.push('BOSSAI_CUSTOMER_SERVICE_URL_INSECURE');

  if (production && !present(env.API_KEYS)) blockers.push('MANAGEMENT_API_KEYS_NOT_CONFIGURED');
  else if (production && String(env.API_KEYS).split(',').map((value) => value.trim()).filter(Boolean).some(isPlaceholder)) blockers.push('MANAGEMENT_API_KEYS_CONTAINS_PLACEHOLDER');
  if (production && !booleanEnv(env.REQUIRE_SIGNED_WEBHOOKS, true)) blockers.push('SIGNED_WEBHOOKS_REQUIRED_IN_PRODUCTION');

  if (!enabledChannels.length) blockers.push('NO_DOMESTIC_CHANNEL_ENABLED');
  for (const [name, channel] of enabledChannels) {
    if (!channel.configured) blockers.push(`${name.toUpperCase()}_CHANNEL_CONFIGURATION_INCOMPLETE`);
    if (name === 'douyin' && !channel.signMethodConfigured) blockers.push('DOUYIN_WEBHOOK_SIGN_METHOD_NOT_CONFIGURED');
    else if (name === 'douyin' && !channel.signMethodValid) blockers.push('DOUYIN_WEBHOOK_SIGN_METHOD_INVALID');
    if (name === 'taobao' && !channel.channelConfigured) blockers.push('TAOBAO_CHANNEL_NOT_CONFIGURED');
    else if (name === 'taobao' && !channel.channelValid) blockers.push('TAOBAO_CHANNEL_INVALID');
  }

  const bossAiUrl = safeUrl(env.BOSSAI_OS_URL);
  if (present(env.BOSSAI_OS_API_KEY) && (!bossAiUrl.configured || !bossAiUrl.valid || !bossAiUrl.secure)) {
    warnings.push('BOSSAI_OS_URL_INVALID_FOR_OPTIONAL_DRAFT_PREVIEW');
  }
  if (!present(env.BOSSAI_OS_API_KEY)) warnings.push('BOSSAI_OS_BOUNDED_AI_NOT_CONFIGURED');

  const timeoutMs = Number(env.WEBHOOK_BRIDGE_TIMEOUT_MS || 120);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 50 || timeoutMs > 1000) warnings.push('WEBHOOK_BRIDGE_TIMEOUT_OUTSIDE_RECOMMENDED_RANGE');

  return {
    ready: blockers.length === 0,
    production,
    blockers,
    warnings,
    canonicalIntake: {
      configured: customerServiceUrl.configured && customerServiceUrl.valid,
      secure: customerServiceUrl.secure,
      loopback: customerServiceUrl.loopback,
      optionalApiKeyConfigured: present(env.BOSSAI_CUSTOMER_SERVICE_API_KEY),
    },
    managementApi: {
      authenticated: present(env.API_KEYS),
      localBypassEnabled: !production && env.ALLOW_UNAUTHENTICATED_LOCAL !== 'false',
    },
    signedWebhooksRequired: production || booleanEnv(env.REQUIRE_SIGNED_WEBHOOKS, false),
    channels,
    boundedAiConfigured: present(env.BOSSAI_OS_API_KEY),
    externalActionsExecuted: false,
  };
}

function publicReadiness(readiness = evaluateReadiness()) {
  return {
    ready: readiness.ready,
    production: readiness.production,
    blockerCount: readiness.blockers.length,
    warningCount: readiness.warnings.length,
    canonicalIntakeConfigured: readiness.canonicalIntake.configured,
    signedWebhooksRequired: readiness.signedWebhooksRequired,
    enabledChannels: Object.entries(readiness.channels).filter(([, value]) => value.enabled).map(([name]) => name),
    externalActionsExecuted: false,
  };
}

module.exports = { present, isPlaceholder, usableValue, booleanEnv, safeUrl, fieldDiagnostics, channelReadiness, evaluateReadiness, publicReadiness };
