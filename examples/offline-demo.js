const douyin = require('../backend/adapters/douyin');
const taobao = require('../backend/adapters/taobao');
const { evaluateMessage, assertNoAutomaticSend } = require('../backend/policy/responsePolicy');

process.env.DOUYIN_APP_KEY = 'demo-douyin-app';
process.env.DOUYIN_APP_SECRET = 'demo-douyin-secret';
process.env.DOUYIN_ACCOUNT_REF = 'demo-douyin-store';
process.env.DOUYIN_WEBHOOK_SIGN_METHOD = 'hmac-sha256';
process.env.TAOBAO_APP_KEY = 'demo-taobao-app';
process.env.TAOBAO_APP_SECRET = 'demo-taobao-secret';
process.env.TAOBAO_ACCOUNT_REF = 'demo-taobao-store';
process.env.TAOBAO_CHANNEL = 'taobao';

function heading(title) {
  console.log(`\n=== ${title} ===`);
}

function printEnvelope(envelope) {
  console.log(JSON.stringify(envelope, null, 2));
}

const douyinEntry = {
  tag: 'im-message',
  msg_id: 'demo-dy-001',
  data: JSON.stringify({
    user_id: 'demo-buyer-dy',
    nickname: '演示客户A',
    shop_id: 'demo-shop-dy',
    content: '这件商品什么时候发货？',
    create_time: 1788660000,
  }),
};
const douyinRaw = JSON.stringify([douyinEntry]);
const douyinSign = douyin.createDouyinSign(
  douyinRaw,
  process.env.DOUYIN_APP_KEY,
  process.env.DOUYIN_APP_SECRET,
  process.env.DOUYIN_WEBHOOK_SIGN_METHOD,
);

heading('Douyin simulated signed webhook');
console.log(`signatureVerified=${douyin.verifyDouyinSign(douyinRaw, douyinSign)}`);
const douyinEnvelope = douyin.normalizeDouyinEntry(douyinEntry, douyinRaw);
printEnvelope(douyinEnvelope);
console.log('policy=', evaluateMessage(douyinEnvelope.message));

const taobaoPayload = {
  msg_id: 'demo-tb-001',
  from_id: 'demo-buyer-tb',
  to_id: 'demo-seller-tb',
  nickname: '演示客户B',
  content: '我要退款并投诉',
  gmt_send: '2026-09-06T12:00:00+08:00',
};
const taobaoRaw = JSON.stringify(taobaoPayload);
const taobaoSign = taobao.createTaobaoWebhookSign(
  taobaoRaw,
  process.env.TAOBAO_APP_KEY,
  process.env.TAOBAO_APP_SECRET,
);

heading('Taobao/Qianniu simulated signed webhook');
const taobaoSignatureVerified = taobao.verifyTaobaoWebhookSign(taobaoRaw, taobaoSign);
console.log(`signatureVerified=${taobaoSignatureVerified}`);
const taobaoEnvelope = taobao.normalizeTaobaoMessage(taobaoPayload, taobaoRaw);
printEnvelope(taobaoEnvelope);
console.log('policy=', evaluateMessage(taobaoEnvelope.message));

heading('External action boundary');
console.log(JSON.stringify(assertNoAutomaticSend(), null, 2));

heading('Demo result');
const douyinSignatureVerified = douyin.verifyDouyinSign(douyinRaw, douyinSign);
if (!douyinSignatureVerified || !taobaoSignatureVerified) {
  console.error('FAIL: a synthetic webhook signature did not verify.');
  process.exitCode = 1;
} else {
  console.log('PASS: both synthetic webhook signatures verified; no real Douyin/Taobao API, merchant credential, customer message send, refund, order mutation, or external network call was used.');

  heading('Next BossAI step');
  console.log('Continue from channel/customer-service intake into governed ecommerce execution with BossAI Ecommerce Agent:');
  console.log('https://github.com/liufeng1976/bossai-ecommerce-ai-team-skill');
  console.log('Run in that repository: npm test && npm run demo');
  console.log('Then share privacy-safe trial feedback here:');
  console.log('https://github.com/liufeng1976/bossai-ecommerce-ai-team-skill/issues/new?template=douyin_connector_handoff.yml');
  console.log('This demo does not automatically clone another repository, make network requests, send telemetry, transfer customer data/credentials, or grant commercial authorization.');
}
