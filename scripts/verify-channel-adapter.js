const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const expect = (condition, message) => { if (!condition) failures.push(message); };

const ai = read('backend/ai/index.js');
const server = read('backend/server.js');
const douyin = read('backend/adapters/douyin.js');
const taobao = read('backend/adapters/taobao.js');
const batch = read('backend/batch-cron.js');
const widget = read('widget/embed.js');
const envExample = read('.env.example');
const readiness = read('backend/config/readiness.js');
const bridge = read('backend/services/customerServiceBridge.js');
const pkg = JSON.parse(read('package.json'));
const douyinContract = JSON.parse(read('connectors/contracts/douyin-customer-service-inbound.v1.json'));
const taobaoContract = JSON.parse(read('connectors/contracts/taobao-customer-service-inbound.v1.json'));
const preflight = JSON.parse(read('governance/current-batch.preflight.json'));
const evidence = JSON.parse(read('governance/current-batch.evidence.json'));

expect(ai.includes('/v1/chat/completions'), 'AI draft path must use BossAI OS chat contract.');
expect(ai.includes('x-bossai-api-key'), 'AI draft path must use BossAI OS customer key header.');
expect(ai.includes("startsWith('bossai-')"), 'AI draft path must reject provider model identifiers.');
expect(!/api\.deepseek\.com|DEEPSEEK_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY/.test(ai), 'AI source must not directly reference provider endpoints or provider keys.');
expect(!/DEEPSEEK_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY/.test(envExample), '.env.example must not encourage direct provider configuration.');
expect(envExample.includes('DOUYIN_ENABLED=false') && envExample.includes('TAOBAO_ENABLED=false'), 'Public-source defaults must keep real marketplace channels off.');
expect(envExample.includes('BOSSAI_CUSTOMER_SERVICE_URL=http://127.0.0.1:4190'), 'Canonical Customer Service loopback default must be 4190.');
expect(readiness.includes('BOSSAI_CUSTOMER_SERVICE_URL_INSECURE'), 'Readiness must reject insecure canonical URLs.');
expect(readiness.includes('MANAGEMENT_API_KEYS_CONTAINS_PLACEHOLDER'), 'Readiness must reject placeholder management credentials.');
expect(readiness.includes('NO_DOMESTIC_CHANNEL_ENABLED'), 'Production readiness must require an explicitly enabled channel.');
expect(server.includes("url.pathname === '/ready'"), 'Server must expose /ready separately from /health.');
expect(server.includes("url.pathname === '/api/integration/probe'"), 'Server must expose authenticated read-only canonical probe.');
expect(server.includes("code: 'DIRECT_CHANNEL_SEND_DISABLED'"), 'Historical /api/reply must fail closed.');
expect(server.includes("response.setHeader('x-frame-options', 'DENY')"), 'Diagnostic UI must deny framing.');
expect(server.includes('content-security-policy'), 'Diagnostic UI must emit CSP.');
expect(bridge.includes('/api/connectors/intake'), 'Bridge must forward to canonical connector intake.');
expect(!server.includes("url.pathname === '/api/connectors/intake'"), 'Local server must not own canonical intake.');
expect(douyin.includes('DIRECT_CHANNEL_SEND_DISABLED'), 'Douyin direct send must be disabled.');
expect(taobao.includes('DIRECT_CHANNEL_SEND_DISABLED'), 'Taobao direct send must be disabled.');
expect(batch.includes('No polling, AI reply, or external customer message was executed.'), 'Legacy batch cron must be a no-op.');
expect(widget.includes('widget/embed.js is retired'), 'Legacy widget must be retired.');
expect(douyin.includes("createHash('md5')") && douyin.includes("createHmac('sha256'"), 'Douyin verifier must support configured MD5/HMAC-SHA256 modes.');
expect(douyin.includes("req.headers['event-sign']"), 'Douyin verifier must read event-sign.');
expect(!douyin.includes('setImmediate('), 'Douyin must not ACK before canonical intake result.');
expect(taobao.includes("createHmac('sha256'"), 'Taobao signing must use HMAC-SHA256.');
expect(!taobao.includes("digest('base64')"), 'Taobao Authorization verification must remain hex-only.');
expect(!taobao.includes('setImmediate('), 'Taobao must not ACK before canonical intake result.');
expect(taobao.includes('gw.api.taobao.com/router/rest'), 'Taobao helper must use the domestic gateway.');
expect(!/receiver_name|receiver_mobile|receiver_address/.test(taobao), 'Taobao helper must not request receiver PII.');

for (const contract of [douyinContract, taobaoContract]) {
  expect(contract.schemaVersion === 'bossai.tool-connector-extraction.v1', `${contract.id}: connector schema mismatch.`);
  expect(contract.businessMutationAllowed === false, `${contract.id}: business mutations must be disabled.`);
  expect(contract.customerMessageSendAllowed === false, `${contract.id}: customer sends must be disabled.`);
  expect(contract.upstreamModelProviderKeyAllowed === false, `${contract.id}: upstream provider keys must be disabled.`);
  expect(contract.governance?.toolGovernanceAuthority === 'bossai-os', `${contract.id}: BossAI OS must remain tool governance authority.`);
}

expect(pkg.version === '1.1.0', 'Hardened public-source candidate must target v1.1.0.');
expect(pkg.license === 'LicenseRef-BossAI-Community-Source-1.0', 'Candidate must preserve the existing BossAI Community Source license identity.');
expect(preflight.targetCompletionLevel === 2, 'Preflight must not overclaim beyond L2.');
expect(preflight.machineChecks.includes('npm test') && preflight.machineChecks.includes('npm run test:e2e'), 'Preflight must register core machine checks.');
expect(evidence.completionLevel === 2 && evidence.productionReady === false && evidence.livePlatformValidated === false, 'Evidence must not claim production/live-platform readiness.');
expect(evidence.releaseHistoryBoundary.includes('v1.0.0'), 'Evidence must preserve existing v1.0.0 release history.');

if (failures.length) {
  console.error('Channel adapter verification failed:');
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Channel adapter verification passed.');
console.log('Boundaries: API-free reference + signed inbound normalization + canonical intake + review-only BossAI OS drafts; no automatic external actions.');
