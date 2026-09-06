const assert = require('assert/strict');
const crypto = require('crypto');

const { buildEnvelope, minimalOrderFacts } = require('../backend/contracts/customerServiceIntake');
const { evaluateMessage, assertNoAutomaticSend } = require('../backend/policy/responsePolicy');
const douyin = require('../backend/adapters/douyin');
const taobao = require('../backend/adapters/taobao');
const ai = require('../backend/ai');
const knowledge = require('../backend/knowledge');
const customerServiceBridge = require('../backend/services/customerServiceBridge');
const { evaluateReadiness, publicReadiness, isPlaceholder } = require('../backend/config/readiness');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function withEnv(patch, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(patch)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

test('canonical envelope uses stable explicit message id', () => {
  const envelope = buildEnvelope({
    channel: 'douyin',
    accountRef: 'dy-account-1',
    sourceMessageId: 'msg-123',
    customerReferenceId: 'buyer-1',
    message: '什么时候发货',
    receivedAt: '2026-09-06T00:00:00.000Z',
  });
  assert.equal(envelope.schema, 'bossai.customer-service-connector-envelope.v1');
  assert.equal(envelope.sourceMessageId, 'msg-123');
  assert.equal(envelope.channel, 'douyin');
});

test('derived source message id is deterministic and account-scoped for replay idempotency', () => {
  const input = {
    channel: 'taobao',
    accountRef: 'tb-account-1',
    customerReferenceId: 'buyer-2',
    message: '查一下物流',
    receivedAt: '2026-09-06T00:00:01.000Z',
    rawBody: '{"content":"查一下物流"}',
  };
  const first = buildEnvelope(input).sourceMessageId;
  assert.equal(first, buildEnvelope(input).sourceMessageId);
  assert.match(first, /^derived-[a-f0-9]{64}$/);
  const otherAccount = buildEnvelope({ ...input, accountRef: 'tb-account-2' }).sourceMessageId;
  assert.notEqual(first, otherAccount, 'derived ids must not collide across channel accounts');
});

test('minimal order facts strip receiver PII and addresses', () => {
  const facts = minimalOrderFacts({
    tid: '10001',
    status: 'WAIT_SELLER_SEND_GOODS',
    payment: '88.00',
    receiver_name: 'should-not-leak',
    receiver_mobile: '18800000000',
    receiver_address: 'should-not-leak',
    products: [{ title: '商品A', sku_id: 'sku-1', num: 2 }],
  });
  assert.deepEqual(Object.keys(facts).sort(), ['orderId', 'payment', 'products', 'status']);
  assert.equal(JSON.stringify(facts).includes('should-not-leak'), false);
  assert.equal(JSON.stringify(facts).includes('18800000000'), false);

  const taobaoFacts = minimalOrderFacts({
    tid: '10002',
    status: 'WAIT_BUYER_CONFIRM_GOODS',
    orders: { order: [{ title: '淘宝商品B', sku_id: 'sku-tb-2', num: 1 }] },
  });
  assert.deepEqual(taobaoFacts.products, [{ title: '淘宝商品B', skuId: 'sku-tb-2', quantity: 1 }]);
});

test('refund/complaint/account changes always require human review', () => {
  for (const message of ['我要退款', '我要投诉并要求赔偿', '帮我修改收货地址', '账户扣款异常']) {
    const policy = evaluateMessage(message);
    assert.equal(policy.risk, 'high', message);
    assert.equal(policy.reviewRequired, true, message);
    assert.equal(policy.automaticSendAllowed, false, message);
    assert.equal(policy.externalMutationAllowed, false, message);
  }
});

test('even low-risk informational messages are draft-only', () => {
  const policy = evaluateMessage('什么时候发货');
  assert.equal(policy.risk, 'low');
  assert.equal(policy.policy, 'reviewable_draft_only');
  assert.equal(policy.reviewRequired, true);
  assert.equal(policy.automaticSendAllowed, false);
});

test('external action policy fails closed', () => {
  const guard = assertNoAutomaticSend();
  for (const [key, value] of Object.entries(guard)) {
    if (key === 'approvalAuthority') continue;
    assert.equal(value, false, `${key} must remain false`);
  }
});

test('Douyin event-sign supports the configured official MD5 and HMAC-SHA256 modes', () => {
  const appId = 'app-123';
  const secret = 'secret-456';
  const body = '[{"tag":"100","msg_id":"9001","data":"{}"}]';
  const signParam = `${appId}${body}${secret}`;
  const md5 = crypto.createHash('md5').update(signParam, 'utf8').digest('hex');
  const hmac = crypto.createHmac('sha256', secret).update(signParam, 'utf8').digest('hex');
  assert.equal(douyin.verifyDouyinSign(body, md5, appId, secret, 'md5'), true);
  assert.equal(douyin.verifyDouyinSign(body, hmac, appId, secret, 'hmac-sha256'), true);
  assert.equal(douyin.verifyDouyinSign(body, md5, appId, secret, 'hmac-sha256'), false);
  assert.equal(douyin.verifyDouyinSign(body, 'bad-sign', appId, secret, 'md5'), false);
});

test('Douyin message normalizes to canonical intake envelope', async () => {
  await withEnv({ DOUYIN_ACCOUNT_REF: 'dy-canonical-account', DOUYIN_SHOP_ID: 'shop-1' }, () => {
    const entry = {
      tag: 'im-message',
      msg_id: 'dy-msg-1',
      data: JSON.stringify({
        user_id: 'dy-buyer-1',
        shop_id: 'shop-1',
        content: '什么时候发货',
        create_time: 1788652800,
      }),
    };
    const envelope = douyin.normalizeDouyinEntry(entry, JSON.stringify([entry]));
    assert.equal(envelope.channel, 'douyin');
    assert.equal(envelope.accountRef, 'dy-canonical-account');
    assert.equal(envelope.sourceMessageId, 'dy-msg-1');
    assert.equal(envelope.customerReferenceId, 'dy-buyer-1');
    assert.equal(envelope.message, '什么时候发货');
  });
});

test('Alibaba message-service Authorization requires official HMAC-SHA256 hex encoding', () => {
  const appKey = 'tb-app';
  const secret = 'tb-secret';
  const body = '{"msg_id":"tb-msg-1","content":"你好"}';
  const base = `${appKey}${body}`;
  const hex = crypto.createHmac('sha256', secret).update(base, 'utf8').digest('hex');
  const base64 = crypto.createHmac('sha256', secret).update(base, 'utf8').digest('base64');
  assert.equal(taobao.verifyTaobaoWebhookSign(body, hex.toUpperCase(), appKey, secret), true);
  assert.equal(taobao.verifyTaobaoWebhookSign(body, base64, appKey, secret), false);
});

test('Taobao/Qianniu message normalizes without inventing external action', async () => {
  await withEnv({ TAOBAO_ACCOUNT_REF: 'tb-canonical-account', TAOBAO_CHANNEL: 'taobao' }, () => {
    const payload = {
      msg_id: 'tb-msg-1',
      from_id: 'buyer-nick',
      nickname: 'Buyer',
      content: '我要退款',
      gmt_send: 1788652800000,
      tid: 'order-1',
    };
    const envelope = taobao.normalizeTaobaoMessage(payload, JSON.stringify(payload));
    assert.equal(envelope.channel, 'taobao');
    assert.equal(envelope.accountRef, 'tb-canonical-account');
    assert.equal(envelope.sourceMessageId, 'tb-msg-1');
    assert.equal(envelope.intent, 'refund_or_return');
    assert.equal(envelope.orderId, 'order-1');
  });
});

test('TOP HMAC-SHA256 signing includes method and produces deterministic signature', () => {
  const options = {
    appKey: '123456',
    secret: 'secret',
    session: 'session',
    timestamp: '2026-09-06 12:00:00',
  };
  const first = taobao.buildTaobaoParams({ method: 'taobao.trade.fullinfo.get', tid: '10001', fields: 'tid,status' }, options);
  const second = taobao.buildTaobaoParams({ method: 'taobao.trade.fullinfo.get', tid: '10001', fields: 'tid,status' }, options);
  assert.equal(first.sign, second.sign);
  assert.equal(first.method, 'taobao.trade.fullinfo.get');
  assert.match(first.sign, /^[A-F0-9]{64}$/);
});

test('Taobao order fact read requests only minimal fields and normalizes nested order lines', async () => {
  let requestedUrl = null;
  const facts = await taobao.getOrderInfo('10003', {
    appKey: '123456',
    secret: 'secret',
    session: 'session',
    timestamp: '2026-09-06 12:00:00',
    apiUrl: 'https://gw.api.taobao.com/router/rest',
    fetchImpl: async (url) => {
      requestedUrl = new URL(url);
      return new Response(JSON.stringify({
        trade_fullinfo_get_response: {
          trade: {
            tid: '10003',
            status: 'WAIT_BUYER_CONFIRM_GOODS',
            payment: '66.00',
            receiver_name: 'must-not-surface',
            orders: { order: [{ title: '商品C', sku_id: 'sku-c', num: 2 }] },
          },
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  assert.equal(requestedUrl.searchParams.get('fields'), 'tid,status,payment,orders.title,orders.sku_id,orders.num');
  assert.equal(requestedUrl.searchParams.get('fields').includes('receiver_'), false);
  assert.equal(JSON.stringify(facts).includes('must-not-surface'), false);
  assert.deepEqual(facts.products, [{ title: '商品C', skuId: 'sku-c', quantity: 2 }]);
});

test('canonical bridge delivers connector envelope without executing external action', async () => {
  await withEnv({ BOSSAI_CUSTOMER_SERVICE_URL: 'http://127.0.0.1:4190' }, async () => {
    const envelope = buildEnvelope({
      channel: 'douyin',
      accountRef: 'dy-account-1',
      sourceMessageId: 'bridge-msg-1',
      customerReferenceId: 'buyer-1',
      message: '你好',
    });
    const calls = [];
    const result = await customerServiceBridge.submitEnvelope(envelope, {
      retries: 0,
      timeoutMs: 100,
      apiKey: 'test-key',
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return new Response(JSON.stringify({ idempotentReplay: false }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    assert.equal(result.delivered, true);
    assert.equal(result.externalActionsExecuted, false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://127.0.0.1:4190/api/connectors/intake');
    assert.equal(calls[0].options.headers['x-api-key'], 'test-key');
    assert.equal(JSON.parse(calls[0].options.body).sourceMessageId, 'bridge-msg-1');
  });
});

test('canonical bridge fails closed when intake is not configured', async () => {
  await withEnv({ BOSSAI_CUSTOMER_SERVICE_URL: undefined }, async () => {
    const envelope = buildEnvelope({
      channel: 'taobao',
      accountRef: 'tb-account-1',
      sourceMessageId: 'bridge-msg-2',
      customerReferenceId: 'buyer-2',
      message: '你好',
    });
    const result = await customerServiceBridge.submitEnvelope(envelope, { retries: 0 });
    assert.equal(result.delivered, false);
    assert.equal(result.reason, 'BOSSAI_CUSTOMER_SERVICE_URL_NOT_CONFIGURED');
    assert.equal(result.externalActionsExecuted, false);
  });
});

test('bounded AI falls back safely when BossAI OS API key is absent', async () => {
  await withEnv({ BOSSAI_OS_API_KEY: undefined, BOSSAI_AI_MODEL: 'bossai-balanced', AI_MODEL: undefined }, async () => {
    const result = await ai.generateDraft({
      message: '我要退款',
      platform: 'taobao',
      shopId: 'test',
      customerId: 'buyer',
      kbContext: [],
    });
    assert.equal(result.source, 'local_safety_template');
    assert.equal(result.reason, 'BOSSAI_OS_API_KEY_NOT_CONFIGURED');
    assert.equal(result.reviewRequired, true);
    assert.equal(result.externalActionsExecuted, false);
    assert.equal(result.policy.risk, 'high');
    assert.match(result.draftText, /人工|核实/);
  });
});

test('knowledge store starts empty and never injects fabricated default policy', async () => {
  const shopId = `empty-${Date.now()}`;
  assert.deepEqual(await knowledge.list(shopId), []);
  assert.equal(knowledge.status().defaultPoliciesInjected, false);
});

test('production placeholder detection rejects template credentials and account references', () => {
  for (const value of ['your-shop-id', 'your_app_key', 'change-me-now', 'dev-key-001', '<secret>']) {
    assert.equal(isPlaceholder(value), true, value);
  }
  assert.equal(isPlaceholder('merchant-actual-ref-2026'), false);
  const result = evaluateReadiness({
    NODE_ENV: 'production',
    REQUIRE_SIGNED_WEBHOOKS: 'true',
    API_KEYS: 'dev-key-001',
    BOSSAI_CUSTOMER_SERVICE_URL: 'http://127.0.0.1:4190',
    DOUYIN_ENABLED: 'true',
    DOUYIN_APP_KEY: 'your-douyin-app-key',
    DOUYIN_APP_SECRET: 'your-douyin-secret',
    DOUYIN_SHOP_ID: 'your-shop-id',
    DOUYIN_WEBHOOK_SIGN_METHOD: 'hmac-sha256',
    TAOBAO_ENABLED: 'false',
  });
  assert.equal(result.ready, false);
  assert.ok(result.blockers.includes('MANAGEMENT_API_KEYS_CONTAINS_PLACEHOLDER'));
  assert.ok(result.blockers.includes('DOUYIN_CHANNEL_CONFIGURATION_INCOMPLETE'));
  assert.deepEqual(result.channels.douyin.placeholderFields.sort(), ['DOUYIN_APP_KEY', 'DOUYIN_APP_SECRET', 'DOUYIN_SHOP_ID'].sort());
  assert.deepEqual(result.channels.douyin.missingFields, []);
});

test('production readiness fails closed when canonical intake, management auth or channel credentials are missing', () => {
  const result = evaluateReadiness({
    NODE_ENV: 'production',
    REQUIRE_SIGNED_WEBHOOKS: 'true',
    DOUYIN_ENABLED: 'true',
    TAOBAO_ENABLED: 'false',
  });
  assert.equal(result.ready, false);
  assert.ok(result.blockers.includes('BOSSAI_CUSTOMER_SERVICE_URL_NOT_CONFIGURED'));
  assert.ok(result.blockers.includes('MANAGEMENT_API_KEYS_NOT_CONFIGURED'));
  assert.ok(result.blockers.includes('DOUYIN_CHANNEL_CONFIGURATION_INCOMPLETE'));
});

test('production readiness passes with one explicitly enabled fully configured channel', () => {
  const result = evaluateReadiness({
    NODE_ENV: 'production',
    REQUIRE_SIGNED_WEBHOOKS: 'true',
    API_KEYS: 'management-key',
    BOSSAI_CUSTOMER_SERVICE_URL: 'https://customer-service.example.com',
    DOUYIN_ENABLED: 'true',
    DOUYIN_APP_KEY: 'douyin-app',
    DOUYIN_APP_SECRET: 'douyin-secret',
    DOUYIN_ACCOUNT_REF: 'douyin-account',
    DOUYIN_WEBHOOK_SIGN_METHOD: 'hmac-sha256',
    TAOBAO_ENABLED: 'false',
    WEBHOOK_BRIDGE_TIMEOUT_MS: '120',
  });
  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
  assert.deepEqual(publicReadiness(result).enabledChannels, ['douyin']);
});

test('production readiness rejects insecure non-loopback canonical intake URL', () => {
  const result = evaluateReadiness({
    NODE_ENV: 'production',
    REQUIRE_SIGNED_WEBHOOKS: 'true',
    API_KEYS: 'management-key',
    BOSSAI_CUSTOMER_SERVICE_URL: 'http://customer-service.example.com',
    DOUYIN_ENABLED: 'true',
    DOUYIN_APP_KEY: 'douyin-app',
    DOUYIN_APP_SECRET: 'douyin-secret',
    DOUYIN_ACCOUNT_REF: 'douyin-account',
    TAOBAO_ENABLED: 'false',
  });
  assert.equal(result.ready, false);
  assert.ok(result.blockers.includes('BOSSAI_CUSTOMER_SERVICE_URL_INSECURE'));
});

async function run() {
  let passed = 0;
  for (const item of tests) {
    try {
      await item.fn();
      console.log(`✓ ${item.name}`);
      passed += 1;
    } catch (error) {
      console.error(`✗ ${item.name}`);
      console.error(error.stack || error.message);
      process.exitCode = 1;
    }
  }
  console.log(`\n${passed}/${tests.length} channel-adapter tests passed.`);
  if (passed !== tests.length) process.exitCode = 1;
}

run();
