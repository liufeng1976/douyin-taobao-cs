const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const exists = (relative) => fs.existsSync(path.join(ROOT, relative));
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const expect = (condition, message) => { if (!condition) failures.push(message); };

const requiredFiles = [
  'README.md', 'README_EN.md', 'LICENSE', 'NOTICE.md', 'CHANGELOG.md',
  'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md',
  'examples/offline-demo.js',
  'docs/ARCHITECTURE.md', 'docs/ROADMAP.md', 'docs/FAQ.md', 'docs/PUBLIC_RELEASE.md', 'docs/GITHUB_GROWTH.md',
  '.github/workflows/ci.yml', '.github/workflows/source-release.yml', '.github/workflows/v1.1-source-release.yml',
  '.github/release-requests/v1.0.0.json', '.github/release-requests/v1.1.0.json',
  '.github/dependabot.yml', '.github/ISSUE_TEMPLATE/bug_report.yml', '.github/ISSUE_TEMPLATE/feature_request.yml', '.github/ISSUE_TEMPLATE/community_demo_feedback.yml',
  '.github/ISSUE_TEMPLATE/config.yml', '.github/pull_request_template.md',
  'governance/current-batch.preflight.json', 'governance/current-batch.evidence.json',
  'governance/public-source-release-candidate.v1.1.0.json',
  'governance/github-traffic-baseline-2026-09-06.json',
  'scripts/publish-v1.1.0.ps1', 'scripts/verify-release-candidate.js', 'scripts/github-traffic-report.js'
];
for (const file of requiredFiles) expect(exists(file), `Missing public-release file: ${file}`);

const pkg = JSON.parse(read('package.json'));
const readme = read('README.md');
const readmeEn = read('README_EN.md');
const license = read('LICENSE');
const gitignore = read('.gitignore');
const ci = read('.github/workflows/ci.yml');
const release10 = read('.github/workflows/source-release.yml');
const release11 = read('.github/workflows/v1.1-source-release.yml');
const request10 = JSON.parse(read('.github/release-requests/v1.0.0.json'));
const request11 = JSON.parse(read('.github/release-requests/v1.1.0.json'));

expect(pkg.version === '1.1.0', 'package.json must target v1.1.0.');
expect(pkg.license === 'LicenseRef-BossAI-Community-Source-1.0', 'package.json must preserve BossAI Community Source License identity.');
expect(/BossAI Community Source License 1\.0/.test(license), 'Root LICENSE must remain BossAI Community Source License 1.0.');
expect(pkg.repository?.url === 'https://github.com/liufeng1976/douyin-taobao-cs.git', 'Repository URL must match the public GitHub repository.');
expect(pkg.scripts?.demo === 'node examples/offline-demo.js', 'package.json must expose the API-free demo.');
expect(pkg.scripts?.['growth:traffic'] === 'node scripts/github-traffic-report.js', 'package.json must expose the read-only GitHub traffic report.');
expect(Object.keys(pkg.dependencies || {}).length === 0, 'Hardened runtime must not reintroduce unnecessary third-party runtime dependencies.');
expect(/API-free/i.test(readme) && /npm run demo/.test(readme), 'README must lead with the API-free runnable path.');
expect(/没有抖音、淘宝 API 不是.*阻塞/.test(readme), 'README must say missing real APIs do not block public-source use.');
expect(/source-available/i.test(readmeEn), 'English README must truthfully describe source-available licensing.');
expect(/不是 OSI Open Source/.test(readme), 'README must not mislabel Community Source as OSI open source.');
expect(/bossaios\.com/.test(readme), 'README must retain the BossAI commercial/traffic entry.');
expect(/bossai-ecommerce-ai-team-skill/.test(readme) && /bossai-radar-lite/.test(readme) && /bossaios-com-video-agent/.test(readme) && /bossai-os-core/.test(readme), 'README must preserve BossAI ecosystem routing links.');
expect(gitignore.split(/\r?\n/).includes('.env'), '.env must be ignored.');
expect(gitignore.split(/\r?\n/).includes('logs/'), 'logs/ must be ignored.');
expect(gitignore.split(/\r?\n/).includes('nul'), 'Windows nul artifact must be ignored.');
expect(/node: \[20, 22\]/.test(ci), 'CI must cover Node 20 and 22.');
expect(/actions\/checkout@v7/.test(ci) && /actions\/setup-node@v7/.test(ci), 'CI must use Node 24-compatible GitHub JavaScript actions.');
expect(/npm run demo/.test(ci) && /npm run check/.test(ci), 'CI must run API-free demo and full verification.');
expect(request10.tag === 'v1.0.0', 'Existing v1.0.0 release request must remain present.');
expect(request11.tag === 'v1.1.0' && request11.version === '1.1.0', 'v1.1.0 release request mismatch.');
expect(request11.license === pkg.license && request11.sourceOnly === true && request11.productionPlatformApiValidated === false, 'v1.1.0 release truth boundary mismatch.');
expect(/preserving it without movement/.test(release11), 'v1.1 release workflow must preserve an existing immutable tag without movement.');
expect(/if: steps\.immutable_state\.outputs\.exists == 'false'/.test(release11), 'v1.1 release workflow may create tag/release only when the immutable tag is absent.');
expect(/gh release view \"\$TAG\"/.test(release11), 'v1.1 maintenance path must verify the existing GitHub Release.');
expect(/actions\/checkout@v7/.test(release10) && /actions\/setup-node@v7/.test(release10), 'v1.0 historical release workflow must use Node 24-compatible GitHub JavaScript actions.');
expect(/actions\/checkout@v7/.test(release11) && /actions\/setup-node@v7/.test(release11), 'v1.1 release workflow must use Node 24-compatible GitHub JavaScript actions.');
expect(/Existing v1\.0\.0 remains immutable release history/.test(release11), 'v1.1 release notes must preserve v1.0.0 history.');

try {
  const trackedEnv = execFileSync('git', ['ls-files', '--error-unmatch', '.env'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
  if (trackedEnv) failures.push('.env is tracked by Git.');
} catch {}

const scanRoots = ['backend', 'frontend', 'connectors', 'examples', 'docs', 'scripts', 'tests', '.github'];
const providerSecrets = [/\bsk-[A-Za-z0-9_-]{16,}\b/g, /\bghp_[A-Za-z0-9]{20,}\b/g, /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g];
const assignments = /\b(?:DOUYIN_APP_SECRET|TAOBAO_APP_SECRET|TAOBAO_SESSION_KEY|BOSSAI_OS_API_KEY|BOSSAI_CUSTOMER_SERVICE_API_KEY|API_KEYS)\s*=\s*['"]([^'"]+)['"]/g;

function walk(relative) {
  if (!exists(relative)) return [];
  const absolute = path.join(ROOT, relative);
  const files = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...walk(child));
    else files.push(child);
  }
  return files;
}

for (const relative of scanRoots.flatMap(walk)) {
  let content;
  try { content = read(relative); } catch { continue; }
  for (const pattern of providerSecrets) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) failures.push(`Potential committed credential pattern in ${relative}.`);
  }
  assignments.lastIndex = 0;
  for (const match of content.matchAll(assignments)) {
    const value = match[1].trim().toLowerCase();
    const synthetic = value.startsWith('demo-') || value.startsWith('e2e-') || value.startsWith('test-') || value.startsWith('your-') || value.startsWith('change-me');
    if (!synthetic) failures.push(`Potential non-synthetic secret assignment in ${relative}.`);
  }
}

const backendAndEnv = ['backend/ai/index.js', 'backend/server.js', '.env.example'].map(read).join('\n');
expect(!/api\.deepseek\.com|DEEPSEEK_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY/.test(backendAndEnv), 'Hardened runtime/config must not contain direct provider key paths.');

if (failures.length) {
  console.error('Public release verification failed:');
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Public release verification passed.');
console.log('Scope: v1.1.0 GitHub/source-available readiness only; no live Douyin/Taobao production API claim is made.');
