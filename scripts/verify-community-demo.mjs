import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const license = readFileSync(resolve(root, 'LICENSE'), 'utf8');
const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
const status = readFileSync(resolve(root, 'PROJECT_FROZEN_DO_NOT_USE.md'), 'utf8');

const expected = {
  version: '1.0.0',
  license: 'LicenseRef-BossAI-Community-Source-1.0',
};

if (pkg.version !== expected.version) {
  throw new Error(`Expected version ${expected.version}, received ${pkg.version}`);
}
if (pkg.license !== expected.license) {
  throw new Error(`Expected license ${expected.license}, received ${pkg.license}`);
}
if (pkg.private !== true) {
  throw new Error('package.json must remain private=true; this repository is not an npm publication target.');
}
if (!license.includes('BossAI Community Source License 1.0')) {
  throw new Error('LICENSE must contain BossAI Community Source License 1.0.');
}
if (!readme.includes('公开社区演示 / Public Community Demo')) {
  throw new Error('README must clearly identify the repository as a public community demo.');
}
if (!readme.includes('尚未完成真实抖音 / 淘宝生产 API 验收')) {
  throw new Error('README must disclose that real Douyin/Taobao production API validation is not complete.');
}
if (!status.includes('Superseded')) {
  throw new Error('Historical frozen status must be explicitly marked as superseded.');
}

console.log(JSON.stringify({
  schemaVersion: 'bossai.community-demo-release.v1',
  version: pkg.version,
  license: pkg.license,
  npmPublicationBlocked: pkg.private === true,
  publicCommunityDemo: true,
  productionPlatformApiValidated: false,
  sourceReleaseOnly: true,
}));
