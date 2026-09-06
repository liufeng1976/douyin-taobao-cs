const fs = require('fs');
const path = require('path');
const { evaluateReadiness } = require('../backend/config/readiness');

const ROOT = path.resolve(__dirname, '..');

function loadEnvFile(file = path.join(ROOT, '.env')) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
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

loadEnvFile();
const env = { ...process.env, NODE_ENV: 'production' };
const result = evaluateReadiness(env);

console.log('BossAI domestic channel production readiness');
console.log(`ready=${result.ready}`);
console.log(`signedWebhooksRequired=${result.signedWebhooksRequired}`);
console.log(`canonicalIntakeConfigured=${result.canonicalIntake.configured}`);
console.log(`canonicalIntakeLoopback=${result.canonicalIntake.loopback}`);
console.log(`canonicalIntakeOptionalApiKeyConfigured=${result.canonicalIntake.optionalApiKeyConfigured}`);
console.log(`managementApiAuthenticated=${result.managementApi.authenticated}`);
console.log(`enabledChannels=${Object.entries(result.channels).filter(([, value]) => value.enabled).map(([name]) => name).join(',') || 'none'}`);
for (const [name, channel] of Object.entries(result.channels)) {
  if (!channel.enabled) continue;
  console.log(`${name}MissingFields=${channel.missingFields.join(',') || 'none'}`);
  console.log(`${name}PlaceholderFields=${channel.placeholderFields.join(',') || 'none'}`);
}

if (result.warnings.length) {
  console.log('warnings:');
  for (const warning of result.warnings) console.log(`- ${warning}`);
}
if (result.blockers.length) {
  console.error('blockers:');
  for (const blocker of result.blockers) console.error(`- ${blocker}`);
  console.error('Production traffic is NOT authorized by this check.');
  process.exit(1);
}

console.log('Configuration preflight passed. This does not prove live platform authorization, network reachability, merchant consent, or end-to-end production acceptance.');
