/**
 * BossAI domestic customer-service channel adapter source workspace.
 *
 * Zero-runtime-dependency HTTP service: accepts signed Douyin/Taobao callbacks,
 * normalizes inbound messages, and forwards them to canonical BossAI Customer
 * Service connector intake. It never sends customer messages automatically.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { logInfo, logError } = require('./utils/logger');
const douyinAdapter = require('./adapters/douyin');
const taobaoAdapter = require('./adapters/taobao');
const aiEngine = require('./ai');
const knowledgeBase = require('./knowledge');
const customerServiceBridge = require('./services/customerServiceBridge');
const { evaluateMessage, assertNoAutomaticSend } = require('./policy/responsePolicy');
const { listShops } = require('./utils/store');
const { evaluateReadiness, publicReadiness } = require('./config/readiness');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const MAX_BODY_BYTES = 1024 * 1024;
const rateMap = new Map();

function loadLocalEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadLocalEnv();

const PORT = Number(process.env.PORT || 3000);

function json(response, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    ...extraHeaders,
  });
  response.end(body);
}

function requestIp(request) {
  return String(request.socket?.remoteAddress || '').replace(/^::ffff:/, '') || 'unknown';
}

function isLoopbackIp(ip) {
  return ['127.0.0.1', '::1'].includes(String(ip || '').replace(/^::ffff:/, ''));
}

function managementAuthorized(request) {
  const localDevBypass = process.env.NODE_ENV !== 'production'
    && process.env.ALLOW_UNAUTHENTICATED_LOCAL !== 'false'
    && isLoopbackIp(requestIp(request));
  if (localDevBypass) return { ok: true };

  const keys = new Set(String(process.env.API_KEYS || '').split(',').map((key) => key.trim()).filter(Boolean));
  if (!keys.size) return { ok: false, status: 503, code: 'MANAGEMENT_API_AUTH_NOT_CONFIGURED', message: '管理 API 未配置 API_KEYS，已拒绝访问' };
  const provided = String(request.headers['x-api-key'] || '').trim();
  if (!provided || !keys.has(provided)) return { ok: false, status: 401, code: 'UNAUTHORIZED', message: '未授权访问' };
  return { ok: true };
}

function requireManagementAuth(request, response) {
  const result = managementAuthorized(request);
  if (result.ok) return true;
  json(response, result.status, { code: result.code, error: result.message, externalActionsExecuted: false });
  return false;
}

function checkRateLimit(request, response) {
  const ip = requestIp(request);
  const now = Date.now();
  let entry = rateMap.get(ip);
  if (!entry || now >= entry.resetAt) entry = { count: 0, resetAt: now + 60000 };
  entry.count += 1;
  rateMap.set(ip, entry);
  if (entry.count > 100) {
    json(response, 429, { code: 'RATE_LIMITED', error: '请求过于频繁，请稍后再试', externalActionsExecuted: false });
    return false;
  }
  if (rateMap.size > 1000) {
    for (const [key, value] of rateMap) if (value.resetAt < now) rateMap.delete(key);
  }
  return true;
}

function corsHeaders(request) {
  const origin = String(request.headers.origin || '');
  if (process.env.NODE_ENV !== 'production') return { 'access-control-allow-origin': origin || '*' };
  const allowed = String(process.env.APP_URL || '').split(',').map((item) => item.trim()).filter(Boolean);
  return origin && allowed.includes(origin) ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {};
}

function applyCommonHeaders(request, response) {
  const headers = corsHeaders(request);
  for (const [key, value] of Object.entries(headers)) response.setHeader(key, value);
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('x-frame-options', 'DENY');
  response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
}

function readRawBody(request, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        const error = new Error('Request body too large.');
        error.status = 413;
        error.code = 'REQUEST_BODY_TOO_LARGE';
        reject(error);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

async function readJsonBody(request) {
  const raw = await readRawBody(request);
  if (!raw.length) return {};
  try { return JSON.parse(raw.toString('utf8')); }
  catch {
    const error = new Error('Invalid JSON body.');
    error.status = 400;
    error.code = 'INVALID_JSON';
    throw error;
  }
}

function serveFrontend(url, response) {
  const pathname = decodeURIComponent(url.pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  if (!['index.html', 'app.js'].includes(relative)) return false;
  const target = path.resolve(FRONTEND, relative);
  if (!target.startsWith(FRONTEND + path.sep) || !fs.existsSync(target)) return false;
  const body = fs.readFileSync(target);
  response.writeHead(200, {
    'content-type': relative.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store',
  });
  response.end(body);
  return true;
}

function healthPayload() {
  const readiness = evaluateReadiness();
  return {
    ok: true,
    productRole: 'domestic-channel-adapter-source',
    canonicalCustomerService: 'bossai-commerce-copilot',
    readiness: publicReadiness(readiness),
    boundedAi: {
      authority: 'bossai-os',
      configured: readiness.boundedAiConfigured,
      directProviderAccess: false,
    },
    knowledge: knowledgeBase.status(),
    externalActionPolicy: assertNoAutomaticSend(),
    externalActionsExecuted: false,
    uptime: process.uptime(),
  };
}

function integrationPayload() {
  const readiness = evaluateReadiness();
  return {
    schema: 'bossai.domestic-channel-adapter-status.v1',
    readiness,
    bridge: customerServiceBridge.status(),
    channels: {
      douyin: {
        configured: Boolean(process.env.DOUYIN_APP_KEY && process.env.DOUYIN_APP_SECRET && (process.env.DOUYIN_ACCOUNT_REF || process.env.DOUYIN_SHOP_ID)),
        inbound: 'signed-webhook',
        signatureRequired: process.env.NODE_ENV === 'production' || process.env.REQUIRE_SIGNED_WEBHOOKS === 'true',
        signatureMethod: process.env.DOUYIN_WEBHOOK_SIGN_METHOD || 'hmac-sha256',
        automaticSend: false,
      },
      taobao: {
        configured: Boolean(process.env.TAOBAO_APP_KEY && process.env.TAOBAO_APP_SECRET && process.env.TAOBAO_ACCOUNT_REF),
        inbound: 'signed-message-service-webhook',
        signatureRequired: process.env.NODE_ENV === 'production' || process.env.REQUIRE_SIGNED_WEBHOOKS === 'true',
        signatureMethod: 'hmac-sha256-hex-authorization',
        automaticSend: false,
      },
    },
    boundedAiConfigured: Boolean(String(process.env.BOSSAI_OS_API_KEY || '').trim()),
    directProviderAccess: false,
    externalActionsExecuted: false,
  };
}

async function handleApi(request, response, url) {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      ...corsHeaders(request),
      'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type,x-api-key',
    });
    response.end();
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    json(response, 200, healthPayload());
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/ready') {
    const readiness = evaluateReadiness();
    json(response, readiness.ready ? 200 : 503, publicReadiness(readiness));
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/webhook/douyin') {
    const body = await readRawBody(request);
    request.body = body;
    json(response, 200, await douyinAdapter.handleWebhook(request));
    return true;
  }
  if (request.method === 'POST' && url.pathname === '/api/webhook/taobao') {
    const body = await readRawBody(request);
    request.body = body;
    json(response, 200, await taobaoAdapter.handleWebhook(request));
    return true;
  }

  if (!url.pathname.startsWith('/api/')) return false;
  if (!requireManagementAuth(request, response)) return true;

  if (request.method === 'GET' && url.pathname === '/api/integration/status') {
    json(response, 200, integrationPayload());
    return true;
  }
  if (request.method === 'GET' && url.pathname === '/api/integration/probe') {
    const probe = await customerServiceBridge.probeIntegration();
    json(response, probe.reachable && probe.healthOk && probe.allBindingsMatched ? 200 : 503, probe);
    return true;
  }
  if (request.method === 'GET' && url.pathname === '/api/shops') {
    json(response, 200, { shops: await listShops(), externalActionsExecuted: false });
    return true;
  }
  if (request.method === 'POST' && url.pathname === '/api/chat') {
    if (!checkRateLimit(request, response)) return true;
    const input = await readJsonBody(request);
    const { message, platform, shopId, customerId } = input;
    if (!message || !platform || !shopId) {
      json(response, 400, { code: 'DRAFT_INPUT_INVALID', error: 'message, platform, shopId 为必填项', externalActionsExecuted: false });
      return true;
    }
    if (!['douyin', 'taobao', 'tmall'].includes(String(platform).toLowerCase())) {
      json(response, 400, { code: 'UNSUPPORTED_CHANNEL', error: `不支持的平台: ${platform}`, externalActionsExecuted: false });
      return true;
    }
    const kbContext = await knowledgeBase.search(shopId, message);
    const draft = await aiEngine.generateDraft({ message, platform, shopId, customerId, kbContext });
    json(response, 200, {
      draft: draft.draftText,
      reply: draft.draftText,
      source: draft.source,
      reason: draft.reason,
      policy: draft.policy,
      reviewRequired: true,
      automaticSend: false,
      externalActionsExecuted: false,
      platform,
      shopId,
    });
    return true;
  }
  if (request.method === 'POST' && url.pathname === '/api/policy/evaluate') {
    const input = await readJsonBody(request);
    json(response, 200, { ...evaluateMessage(input.message || '', input.intent || ''), externalActionsExecuted: false });
    return true;
  }
  if (request.method === 'POST' && url.pathname === '/api/batch-process') {
    const input = await readJsonBody(request);
    const platforms = Array.isArray(input.platforms) ? input.platforms : ['douyin', 'taobao'];
    const results = {};
    for (const platform of platforms) {
      if (platform === 'douyin') results.douyin = await douyinAdapter.pollAndReply();
      if (platform === 'taobao') results.taobao = await taobaoAdapter.pollAndReply();
    }
    json(response, 200, { ok: true, results, automaticExternalActions: false, externalActionsExecuted: false });
    return true;
  }
  if (request.method === 'POST' && url.pathname === '/api/reply') {
    json(response, 409, {
      code: 'DIRECT_CHANNEL_SEND_DISABLED',
      error: '本仓库不再直接向客户发送消息。请在 BossAI Customer Service 完成人工审核，并通过受治理渠道执行。',
      reviewRequired: true,
      externalActionsExecuted: false,
    });
    return true;
  }

  const knowledgeCollection = url.pathname.match(/^\/api\/knowledge\/([^/]+)$/);
  if (knowledgeCollection && request.method === 'GET') {
    const shopId = decodeURIComponent(knowledgeCollection[1]);
    json(response, 200, { documents: await knowledgeBase.list(shopId), authority: knowledgeBase.status(), externalActionsExecuted: false });
    return true;
  }
  if (knowledgeCollection && request.method === 'POST') {
    const shopId = decodeURIComponent(knowledgeCollection[1]);
    const input = await readJsonBody(request);
    const document = await knowledgeBase.add(shopId, input);
    json(response, 201, { ok: true, document, compatibilityOnly: true, externalActionsExecuted: false });
    return true;
  }
  const knowledgeItem = url.pathname.match(/^\/api\/knowledge\/([^/]+)\/([^/]+)$/);
  if (knowledgeItem && request.method === 'DELETE') {
    const removed = await knowledgeBase.remove(decodeURIComponent(knowledgeItem[1]), decodeURIComponent(knowledgeItem[2]));
    json(response, removed ? 200 : 404, { ok: removed, externalActionsExecuted: false });
    return true;
  }

  return false;
}

async function handleRequest(request, response) {
  applyCommonHeaders(request, response);
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  try {
    if (await handleApi(request, response, url)) return;
    if (request.method === 'GET' && serveFrontend(url, response)) return;
    json(response, 404, { code: 'NOT_FOUND', error: 'Not found', externalActionsExecuted: false });
  } catch (error) {
    logError({ module: 'server', event: 'request_error', url: url.pathname, code: error.code, error: error.message });
    if (!response.headersSent) {
      json(response, Number(error.status || 500), {
        code: error.code || 'INTERNAL_ERROR',
        error: process.env.NODE_ENV === 'production' && !error.status ? '服务器错误' : error.message,
        externalActionsExecuted: false,
      });
    } else if (!response.writableEnded) {
      response.end();
    }
  }
}

function startServer(port = PORT) {
  const server = http.createServer(handleRequest);
  server.listen(port, '0.0.0.0', () => {
    const address = server.address();
    logInfo({ module: 'server', event: 'start', port: typeof address === 'object' ? address.port : port, role: 'domestic-channel-adapter-source' });
    console.log(`BossAI 国内客服渠道适配层: http://localhost:${typeof address === 'object' ? address.port : port}`);
    console.log('Douyin webhook: /api/webhook/douyin');
    console.log('Taobao webhook: /api/webhook/taobao');
  });
  return server;
}

if (require.main === module) startServer();

module.exports = { startServer, handleRequest, healthPayload, integrationPayload, managementAuthorized };
