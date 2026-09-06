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

Current public metadata still contains the legacy "DeepSeek AI auto-reply / RAG" positioning and should be replaced with:

`API-free Douyin/Taobao/Tmall/Qianniu customer-service connector reference: signed webhooks, normalization, idempotency, human review, BossAI intake.`

Recommended homepage: `https://bossaios.com`.

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

Measure actual GitHub traffic and downstream conversions before claiming growth impact.
