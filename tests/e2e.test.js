const assert = require('assert/strict');
const http = require('http');

process.env.NODE_ENV = 'development';
process.env.ALLOW_UNAUTHENTICATED_LOCAL = 'true';
process.env.BOSSAI_OS_API_KEY = '';
process.env.BOSSAI_AI_MODEL = 'bossai-balanced';
process.env.BOSSAI_CUSTOMER_SERVICE_URL = '';
process.env.REQUIRE_SIGNED_WEBHOOKS = 'true';
process.env.WEBHOOK_BRIDGE_TIMEOUT_MS = '120';
process.env.DOUYIN_APP_KEY = 'e2e-douyin-app';
process.env.DOUYIN_APP_SECRET = 'e2e-douyin-secret';
process.env.DOUYIN_SHOP_ID = 'e2e-douyin-shop';
process.env.DOUYIN_ACCOUNT_REF = 'douyin-e2e-account';
process.env.DOUYIN_WEBHOOK_SIGN_METHOD = 'hmac-sha256';
process.env.TAOBAO_APP_KEY = 'e2e-taobao-app';
process.env.TAOBAO_APP_SECRET = 'e2e-taobao-secret';
process.env.TAOBAO_ACCOUNT_REF = 'taobao-e2e-account';
process.env.TAOBAO_CHANNEL = 'taobao';

const { startServer } = require('../backend/server');
const douyin = require('../backend/adapters/douyin');
const taobao = require('../backend/adapters/taobao');

async function request(base, pathname, options = {}) {
  const response = await fetch(base + pathname, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  return { status: response.status, body, headers: response.headers };
}

async function closeServer(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function run() {
  const intakeEnvelopes = [];
  const intakeServer = http.createServer((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (request.method === 'GET' && request.url === '/health') {
        const body = JSON.stringify({ ok: true, runtimeOwnedBy: 'bossai-os', automaticExternalActions: false });
        response.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
        response.end(body);
        return;
      }
      if (request.method === 'GET' && request.url === '/api/brands') {
        const body = JSON.stringify({
          items: [
            { id: 'brand-douyin-e2e', channelBindings: [{ channel: 'douyin', accountRef: 'douyin-e2e-account', enabled: true }] },
            { id: 'brand-taobao-e2e', channelBindings: [{ channel: 'taobao', accountRef: 'taobao-e2e-account', enabled: true }] },
          ],
          externalActionsExecuted: false,
        });
        response.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
        response.end(body);
        return;
      }
      if (request.method === 'POST' && request.url === '/api/connectors/intake') {
        intakeEnvelopes.push(JSON.parse(raw || '{}'));
        const body = JSON.stringify({ schema: 'bossai.customer-service-connector-intake.v1', idempotentReplay: false });
        response.writeHead(201, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
        response.end(body);
        return;
      }
      response.writeHead(404).end();
    });
  });
  intakeServer.listen(0, '127.0.0.1');
  await new Promise((resolve) => intakeServer.once('listening', resolve));
  process.env.BOSSAI_CUSTOMER_SERVICE_URL = `http://127.0.0.1:${intakeServer.address().port}`;

  const server = startServer(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passed += 1;
    } catch (error) {
      console.error(`✗ ${name}: ${error.message}`);
      failed += 1;
    }
  }

  try {
    await test('health exposes safe liveness summary without internal intake URL', async () => {
      const result = await request(base, '/health');
      assert.equal(result.status, 200);
      assert.equal(result.body.ok, true);
      assert.equal(result.body.productRole, 'domestic-channel-adapter-source');
      assert.equal(result.body.boundedAi.directProviderAccess, false);
      assert.equal(result.body.externalActionsExecuted, false);
      assert.equal(result.body.externalActionPolicy.automaticCustomerMessageSend, false);
      assert.equal(result.body.readiness.ready, true);
      assert.equal(Object.prototype.hasOwnProperty.call(result.body, 'connectorBridge'), false);
      assert.equal(JSON.stringify(result.body).includes(process.env.BOSSAI_CUSTOMER_SERVICE_URL), false);
      assert.equal(result.headers.get('x-frame-options'), 'DENY');
      assert.match(result.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
    });

    await test('ready endpoint reports traffic readiness separately from liveness', async () => {
      const result = await request(base, '/ready');
      assert.equal(result.status, 200);
      assert.equal(result.body.ready, true);
      assert.deepEqual(result.body.enabledChannels.sort(), ['douyin', 'taobao']);
      assert.equal(result.body.canonicalIntakeConfigured, true);
      assert.equal(result.body.externalActionsExecuted, false);
    });

    await test('real entry serves diagnostic console', async () => {
      const result = await request(base, '/');
      assert.equal(result.status, 200);
      assert.match(result.body, /抖音 \/ 淘宝客服渠道适配诊断/);
      assert.match(result.body, /必须进入人工审核/);
    });

    await test('read-only integration probe verifies canonical service and accountRef brand bindings', async () => {
      const result = await request(base, '/api/integration/probe');
      assert.equal(result.status, 200);
      assert.equal(result.body.reachable, true);
      assert.equal(result.body.healthOk, true);
      assert.equal(result.body.allBindingsMatched, true);
      assert.equal(result.body.externalReadPerformed, true);
      assert.equal(result.body.externalActionsExecuted, false);
      assert.deepEqual(result.body.bindings.map((item) => [item.channel, item.matched]), [['douyin', true], ['taobao', true]]);
    });

    await test('integration status exposes configured signed channel bridge without enabling send', async () => {
      const result = await request(base, '/api/integration/status');
      assert.equal(result.status, 200);
      assert.equal(result.body.bridge.configured, true);
      assert.equal(result.body.channels.douyin.configured, true);
      assert.equal(result.body.channels.douyin.signatureMethod, 'hmac-sha256');
      assert.equal(result.body.channels.taobao.configured, true);
      assert.equal(result.body.channels.taobao.signatureMethod, 'hmac-sha256-hex-authorization');
      assert.equal(result.body.channels.douyin.automaticSend, false);
      assert.equal(result.body.channels.taobao.automaticSend, false);
      assert.equal(result.body.externalActionsExecuted, false);
    });

    await test('low-risk draft preview uses local safety path without BossAI OS key', async () => {
      const result = await request(base, '/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: '什么时候发货', platform: 'douyin', shopId: 'e2e-shop', customerId: 'buyer-1' }),
      });
      assert.equal(result.status, 200);
      assert.equal(result.body.source, 'local_safety_template');
      assert.equal(result.body.reason, 'BOSSAI_OS_API_KEY_NOT_CONFIGURED');
      assert.equal(result.body.reviewRequired, true);
      assert.equal(result.body.automaticSend, false);
      assert.equal(result.body.externalActionsExecuted, false);
      assert.ok(result.body.draft);
    });

    await test('high-risk refund message remains mandatory human review', async () => {
      const result = await request(base, '/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: '我要退款并投诉', platform: 'taobao', shopId: 'e2e-shop', customerId: 'buyer-2' }),
      });
      assert.equal(result.status, 200);
      assert.equal(result.body.policy.risk, 'high');
      assert.equal(result.body.policy.policy, 'human_review_required');
      assert.match(result.body.draft, /人工|核实/);
    });

    await test('signed Douyin callback is normalized and delivered before success ACK', async () => {
      const entry = {
        tag: 'im-message',
        msg_id: 'dy-e2e-msg-1',
        data: JSON.stringify({
          user_id: 'dy-buyer-e2e',
          shop_id: 'e2e-douyin-shop',
          content: '什么时候发货',
          create_time: 1788652800,
        }),
      };
      const rawBody = JSON.stringify([entry]);
      const sign = douyin.createDouyinSign(rawBody, process.env.DOUYIN_APP_KEY, process.env.DOUYIN_APP_SECRET, 'hmac-sha256');
      const before = intakeEnvelopes.length;
      const result = await request(base, '/api/webhook/douyin', {
        method: 'POST',
        headers: { 'event-sign': sign, 'app-id': process.env.DOUYIN_APP_KEY },
        body: rawBody,
      });
      assert.equal(result.status, 200);
      assert.deepEqual(result.body, { code: 0, msg: 'success' });
      assert.equal(intakeEnvelopes.length, before + 1);
      const envelope = intakeEnvelopes.at(-1);
      assert.equal(envelope.channel, 'douyin');
      assert.equal(envelope.accountRef, 'douyin-e2e-account');
      assert.equal(envelope.sourceMessageId, 'dy-e2e-msg-1');
      assert.equal(envelope.message, '什么时候发货');
    });

    await test('signed Taobao callback uses Authorization hex signature and canonical intake', async () => {
      const payload = {
        msg_id: 'tb-e2e-msg-1',
        from_id: 'tb-buyer-e2e',
        nickname: 'Buyer',
        content: '我要退款',
        gmt_send: 1788652800000,
        tid: 'tb-order-1',
      };
      const rawBody = JSON.stringify(payload);
      const authorization = taobao.createTaobaoWebhookSign(rawBody, process.env.TAOBAO_APP_KEY, process.env.TAOBAO_APP_SECRET);
      const before = intakeEnvelopes.length;
      const result = await request(base, '/api/webhook/taobao', {
        method: 'POST',
        headers: { authorization },
        body: rawBody,
      });
      assert.equal(result.status, 200);
      assert.deepEqual(result.body, { code: 0, msg: 'success' });
      assert.equal(intakeEnvelopes.length, before + 1);
      const envelope = intakeEnvelopes.at(-1);
      assert.equal(envelope.channel, 'taobao');
      assert.equal(envelope.accountRef, 'taobao-e2e-account');
      assert.equal(envelope.sourceMessageId, 'tb-e2e-msg-1');
      assert.equal(envelope.intent, 'refund_or_return');
      assert.equal(envelope.orderId, 'tb-order-1');
    });

    await test('invalid marketplace callback signature is rejected before intake', async () => {
      const before = intakeEnvelopes.length;
      const rawBody = JSON.stringify({ msg_id: 'tb-e2e-invalid', from_id: 'buyer', content: 'hello' });
      const result = await request(base, '/api/webhook/taobao', {
        method: 'POST',
        headers: { authorization: 'not-a-valid-signature' },
        body: rawBody,
      });
      assert.equal(result.status, 401);
      assert.equal(result.body.code, 'TAOBAO_WEBHOOK_SIGNATURE_INVALID');
      assert.equal(intakeEnvelopes.length, before);
    });

    await test('callback returns 503 instead of silently dropping message when canonical intake is unavailable', async () => {
      const savedUrl = process.env.BOSSAI_CUSTOMER_SERVICE_URL;
      try {
        process.env.BOSSAI_CUSTOMER_SERVICE_URL = 'http://127.0.0.1:1';
        const payload = { msg_id: 'tb-e2e-retry-1', from_id: 'buyer', content: '查一下物流' };
        const rawBody = JSON.stringify(payload);
        const authorization = taobao.createTaobaoWebhookSign(rawBody, process.env.TAOBAO_APP_KEY, process.env.TAOBAO_APP_SECRET);
        const result = await request(base, '/api/webhook/taobao', {
          method: 'POST',
          headers: { authorization },
          body: rawBody,
        });
        assert.equal(result.status, 503);
        assert.equal(result.body.code, 'CANONICAL_CUSTOMER_SERVICE_INTAKE_UNAVAILABLE');
      } finally {
        process.env.BOSSAI_CUSTOMER_SERVICE_URL = savedUrl;
      }
    });

    await test('Douyin platform probe is acknowledged without creating a customer case', async () => {
      const probe = [{ tag: '0', msg_id: '0', data: '2026-09-06T12:00:00+08:00' }];
      const rawBody = JSON.stringify(probe);
      const sign = douyin.createDouyinSign(rawBody, process.env.DOUYIN_APP_KEY, process.env.DOUYIN_APP_SECRET, 'hmac-sha256');
      const before = intakeEnvelopes.length;
      const result = await request(base, '/api/webhook/douyin', {
        method: 'POST',
        headers: { 'event-sign': sign, 'app-id': process.env.DOUYIN_APP_KEY },
        body: rawBody,
      });
      assert.equal(result.status, 200);
      assert.deepEqual(result.body, { code: 0, msg: 'success' });
      assert.equal(intakeEnvelopes.length, before);
    });

    let documentId;
    await test('local compatibility knowledge can be added without default fake policy', async () => {
      const before = await request(base, '/api/knowledge/e2e-shop');
      assert.deepEqual(before.body.documents, []);
      const added = await request(base, '/api/knowledge/e2e-shop', {
        method: 'POST',
        body: JSON.stringify({ question: '测试知识', answer: '这是已核实测试答案', category: 'test', provenance: 'e2e' }),
      });
      assert.equal(added.status, 201);
      documentId = added.body.document.id;
      assert.equal(added.body.compatibilityOnly, true);
    });

    await test('knowledge-backed draft remains review-only', async () => {
      const result = await request(base, '/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: '测试知识', platform: 'douyin', shopId: 'e2e-shop', customerId: 'buyer-3' }),
      });
      assert.equal(result.status, 200);
      assert.equal(result.body.draft, '这是已核实测试答案');
      assert.equal(result.body.reviewRequired, true);
      assert.equal(result.body.automaticSend, false);
    });

    await test('historical direct reply endpoint fails closed', async () => {
      const result = await request(base, '/api/reply', {
        method: 'POST',
        body: JSON.stringify({ platform: 'douyin', message: 'hello' }),
      });
      assert.equal(result.status, 409);
      assert.equal(result.body.code, 'DIRECT_CHANNEL_SEND_DISABLED');
      assert.equal(result.body.externalActionsExecuted, false);
    });

    await test('legacy batch endpoint cannot poll or auto reply', async () => {
      const result = await request(base, '/api/batch-process', {
        method: 'POST',
        body: JSON.stringify({ platforms: ['douyin', 'taobao'] }),
      });
      assert.equal(result.status, 200);
      assert.equal(result.body.results.douyin.supported, false);
      assert.equal(result.body.results.taobao.supported, false);
      assert.equal(result.body.externalActionsExecuted, false);
    });

    await test('local knowledge cleanup works', async () => {
      const result = await request(base, `/api/knowledge/e2e-shop/${encodeURIComponent(documentId)}`, { method: 'DELETE' });
      assert.equal(result.status, 200);
      assert.equal(result.body.ok, true);
    });
  } finally {
    await closeServer(server);
    await closeServer(intakeServer);
  }

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
