const fs = require('fs');
const path = require('path');
const { probeIntegration } = require('../backend/services/customerServiceBridge');

const ROOT = path.resolve(__dirname, '..');
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

(async () => {
  const result = await probeIntegration({ timeoutMs: 3000 });
  console.log('BossAI canonical customer-service integration probe');
  console.log(`configured=${result.configured}`);
  console.log(`reachable=${result.reachable}`);
  console.log(`healthOk=${result.healthOk}`);
  console.log(`allBindingsMatched=${result.allBindingsMatched}`);
  for (const binding of result.bindings || []) {
    console.log(`binding ${binding.channel}:${binding.accountRef} matched=${binding.matched}${binding.brandId ? ` brandId=${binding.brandId}` : ''}`);
  }
  if (result.reason) console.log(`reason=${result.reason}`);
  console.log('externalActionsExecuted=false');
  if (!(result.reachable && result.healthOk && result.allBindingsMatched)) process.exit(1);
})().catch((error) => {
  console.error(`probe_failed=${error.message}`);
  console.log('externalActionsExecuted=false');
  process.exit(1);
});
