const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const manifestPath = path.join(ROOT, 'governance', 'public-source-release-candidate.v1.1.0.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const failures = [];

function sha256Candidates(relative) {
  const absolute = path.join(ROOT, relative);
  if (!fs.existsSync(absolute)) return null;
  const raw = fs.readFileSync(absolute);
  const normalized = raw.toString('utf8').replace(/\r\n/g, '\n');
  return {
    raw: crypto.createHash('sha256').update(raw).digest('hex'),
    normalizedLf: crypto.createHash('sha256').update(normalized, 'utf8').digest('hex'),
  };
}

if (manifest.version !== '1.1.0' || manifest.tag !== 'v1.1.0') failures.push('Unexpected release-candidate version/tag.');
if (manifest.license !== 'LicenseRef-BossAI-Community-Source-1.0') failures.push('Release-candidate license identity changed.');
if (manifest.productionPlatformApiValidated !== false) failures.push('Release candidate must not claim live platform API validation.');
if (manifest.sourceOnly !== true) failures.push('Release candidate must remain source-only.');
if (manifest.forcePushAllowed !== false) failures.push('Force push must remain forbidden.');
if (!Array.isArray(manifest.existingReleaseHistoryProtected) || !manifest.existingReleaseHistoryProtected.includes('v1.0.0')) failures.push('v1.0.0 release history must remain protected.');

for (const [relative, expected] of Object.entries(manifest.files || {})) {
  const actual = sha256Candidates(relative);
  if (!actual) {
    failures.push(`Missing release-candidate file: ${relative}`);
  } else if (actual.raw !== expected && actual.normalizedLf !== expected) {
    failures.push(`SHA-256 mismatch: ${relative}\n  expected=${expected}\n  raw=${actual.raw}\n  normalizedLf=${actual.normalizedLf}`);
  }
}

if (failures.length) {
  console.error('Release candidate verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Release candidate verification passed for v1.1.0.');
console.log(`${Object.keys(manifest.files).length} critical public/runtime files match the reviewed SHA-256 manifest.`);
