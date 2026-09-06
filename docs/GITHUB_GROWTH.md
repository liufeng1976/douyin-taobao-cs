# GitHub Growth Notes

## Search intent

The repository should naturally cover terms such as:

- Douyin customer service webhook
- Taobao AI customer service
- Qianniu webhook
- Tmall customer support connector
- 中国电商 AI 客服
- 抖音客服 webhook
- 淘宝 / 千牛客服 API
- human-in-the-loop ecommerce support

Do not keyword-stuff or claim unavailable production access.

## About description

Current public metadata is aligned to the v1.1.0 API-free connector positioning:

`API-free Douyin/Taobao/Tmall/Qianniu customer-service connector: signed webhooks, normalization, idempotency, human review, BossAI intake.`

Current homepage: `https://bossaios.com`.

## Recommended topics

`bossai`, `douyin`, `taobao`, `tmall`, `qianniu`, `customer-service`, `webhook`, `ecommerce`, `ai-agent`, `human-in-the-loop`, `connector`, `china-ecommerce`.

## Conversion path

GitHub search / repository About → README first screen → `npm run demo` → architecture/safety proof → Community Demo Feedback / Star / Fork → related BossAI public projects → https://bossaios.com for commercial use.

The primary issue conversion route is:

`https://github.com/liufeng1976/douyin-taobao-cs/issues/new?template=community_demo_feedback.yml`

Never ask users to paste merchant secrets, tokens, cookies or customer PII into issues.

## Applying repository metadata

Use the guarded script only after reviewing the target description/topics:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/apply-github-growth-metadata.ps1 -Confirmation APPLY_BOSSAI_DOUYIN_TAOBAO_GITHUB_GROWTH_METADATA
```

The script changes only the GitHub About description, homepage and discovery topics. It does not change repository visibility, source code, branches, tags or releases.

## Read-only traffic reporting

With an authenticated GitHub CLI account that has repository traffic access, run:

```bash
npm run growth:traffic
```

For machine-readable output:

```bash
node scripts/github-traffic-report.js --json
```

The report compares the current rolling 14-day GitHub traffic window against `governance/github-traffic-baseline-2026-09-06.json`. Views/clones are rolling-window deltas, not cumulative growth. Stars/forks/issues are point-in-time cumulative count deltas.

Measure actual GitHub traffic and downstream conversions before claiming growth impact.

## Save and compare traffic snapshots

Current rolling-window report:

```bash
npm run growth:traffic
```

Save a dated report inside the repository:

```bash
npm run growth:traffic -- --save governance/github-traffic-snapshot-YYYY-MM-DD.json
```

Compare two saved points:

```bash
npm run growth:traffic:compare -- governance/github-traffic-baseline-2026-09-06.json governance/github-traffic-snapshot-YYYY-MM-DD.json
```

Traffic views/clones are GitHub rolling 14-day windows, so their deltas are window differences rather than cumulative acquisition. Stars, forks and open issues are point-in-time counts and can be interpreted as cumulative count changes between snapshots.

## 2026-09-06 traffic baseline

GitHub's repository traffic API reported the following rolling 14-day baseline before enough time had elapsed to attribute any lift to the v1.1.0 post-release optimization batch:

- 203 views / 106 unique visitors;
- 30 clones / 26 unique cloners;
- 20 stars / 5 forks;
- 0 public issues;
- top referrers: GitHub 171 views, Bing 6, ChatGPT 1;
- visitors opened the Taobao and Douyin adapter implementation files, not only the repository overview.

The durable evidence record is `governance/github-traffic-baseline-2026-09-06.json`.

### Seven-day observation rule

For the next seven days, compare rolling GitHub traffic rather than claiming immediate causality. Watch:

1. unique visitors and unique cloners;
2. non-GitHub referrers and search discovery;
3. stars and forks;
4. Community Demo Feedback / issue creation;
5. popular-path movement into README, adapter code, release notes and issues;
6. downstream BossAI website traffic only when independently measurable.

A useful signal is not simply "more views". Prefer evidence that a visitor progresses deeper in the funnel: repository view → demo/code inspection → clone/star/fork → issue/feedback → BossAI commercial entry.
