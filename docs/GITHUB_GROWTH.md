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

Current public repository metadata has been updated to:

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

## Traffic baseline and snapshots

The first governed traffic baseline is stored in:

`governance/github-traffic-baseline-2026-09-06.json`

It records a GitHub Traffic API rolling-14-day window of 203 views / 106 unique visitors and 30 clones / 26 unique cloners, plus 20 stars, 5 forks and 0 open public issues at capture time. These numbers are evidence of existing traffic, not proof that a later optimization caused growth.

Run the current read-only report with:

```bash
npm run growth:traffic
```

Save a point-in-time snapshot inside the repository when a durable comparison is needed:

```bash
npm run growth:traffic -- --save governance/github-traffic-snapshot-YYYY-MM-DD.json
```

Compare any two baseline/snapshot files with:

```bash
npm run growth:traffic:compare -- governance/github-traffic-baseline-2026-09-06.json governance/github-traffic-snapshot-YYYY-MM-DD.json
```

Traffic views/clones are rolling 14-day windows, so their differences are window differences rather than cumulative acquisition. Stars/forks/issues are point-in-time cumulative counts. The report explicitly flags first public Issue, increased Stars/Forks and newly observed external referrers; otherwise it prints `NO MATERIAL CHANGE`.

## Optional local daily monitor

For a Windows machine that already has authenticated GitHub CLI access, snapshots can be collected locally without storing a PAT in GitHub Actions. Local snapshots are written under `.bossai-local/github-traffic/`, which is gitignored.

Preflight only (does not create a task):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-github-traffic-monitor.ps1 -Confirmation INSTALL_BOSSAI_GITHUB_TRAFFIC_MONITOR -PreflightOnly
```

Install a daily local task (default 09:15 Windows local time):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-github-traffic-monitor.ps1 -Confirmation INSTALL_BOSSAI_GITHUB_TRAFFIC_MONITOR
```

A different local clock time can be supplied with `-At HH:mm`. The scheduled runner performs read-only GitHub traffic queries using the current Windows user's existing `gh` authentication. It does not publish content, create Issues, message customers or mutate marketplace data.

## External distribution

Prepared, human-approved external distribution is governed by `docs/EXTERNAL_DISTRIBUTION.md` and `governance/external-distribution-campaign.template.json`.

Current channel policy:

- Show HN: priority candidate after explicit approval;
- r/selfhosted: New Project Megathread only until the repository is at least three months old (2026-09-21), with rules rechecked immediately before posting;
- r/ecommerce: no direct promotion under the current rules.

Do not automatically publish, cross-post, solicit votes, or claim that one referrer observation proves causation.

Measure actual GitHub traffic and downstream conversions before claiming growth impact.
