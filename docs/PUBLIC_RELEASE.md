# Public Release Guide

## Positioning

Use this description:

> API-free BossAI reference for Douyin/Taobao/Tmall/Qianniu customer-service signed webhooks, normalization, idempotency, human review and governed intake.

Do not claim live marketplace API access unless separately validated.

## v1.1.0 release boundary

- Preserve existing `v1.0.0` tag and release.
- Keep `BossAI Community Source License 1.0` unchanged unless a separate reviewed licensing decision is made.
- `v1.1.0` is a source release; no signed production binary is implied.
- Missing real Douyin/Taobao APIs do not block the public source release.

## Pre-publish checks

```bash
npm ci
npm run demo
npm run check
git diff --check
```

Verify `.env` is untracked and no merchant credentials, provider keys or customer PII are committed.

## Safe publish from Windows

The reviewed v1.1.0 candidate includes a guarded publisher:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/publish-v1.1.0.ps1 -Confirmation PUBLISH_BOSSAI_DOUYIN_TAOBAO_V1_1_0 -CreatePullRequest
```

The exact confirmation token is required before any Git write. To validate the entire publish path without creating a branch, commit or push, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/publish-v1.1.0.ps1 -Confirmation PUBLISH_BOSSAI_DOUYIN_TAOBAO_V1_1_0 -PreflightOnly
```

The script fetches the latest `origin/main`, requires it to match the reviewed SHA in the RC manifest, verifies that `v1.0.0` still exists and `v1.1.0` does not, runs the full candidate checks, creates a new local release branch, commits the candidate, rebases onto the reviewed remote main, reruns all checks, and pushes only `release/douyin-taobao-cs-v1.1.0` without force. Any unreviewed remote change or conflict stops the process before push.

`-CreatePullRequest` is optional. When GitHub CLI is installed and authenticated it opens a PR; otherwise the release branch is still pushed and the PR can be opened from GitHub UI.

## Suggested repository topics

`bossai`, `douyin`, `taobao`, `tmall`, `qianniu`, `customer-service`, `webhook`, `ecommerce`, `ai-agent`, `human-in-the-loop`, `connector`, `china-ecommerce`.

## Traffic conversion

1. Visitor understands the project in under 30 seconds.
2. Visitor runs `npm run demo` without platform accounts.
3. Visitor sees safety and architecture boundaries.
4. Visitor stars/forks or opens a synthetic-data issue.
5. Visitor discovers the wider BossAI ecosystem and https://bossaios.com.
