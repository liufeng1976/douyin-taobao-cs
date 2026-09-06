# Contributing to douyin-taobao-cs

Thanks for helping improve this BossAI Community Demo.

This repository is maintained as a **source-available technical demo and acquisition project**, not as a claim that Douyin, Taobao, or QianNiu production APIs have already been fully validated.

## Good contributions

The most useful pull requests are small, reproducible, and evidence-backed. Good areas include:

- local Demo bugs and E2E reliability;
- DeepSeek optional integration and explicit no-key fallback behavior;
- RAG / FAQ retrieval quality;
- human-review and handoff flows;
- multi-shop demo structure;
- adapter structure improvements that are checked against current official platform documentation;
- documentation corrections with a verifiable source;
- tests that prevent misleading claims or accidental production credential dependencies.

## Production-platform changes require evidence

If a pull request changes Douyin, Taobao, or QianNiu adapter behavior, include:

1. the exact official documentation page or current platform contract you checked;
2. the date you checked it;
3. which fields/signature/token/webhook behavior were validated;
4. whether the change was tested only with fixtures/local mocks or with your own legitimately authorized production/sandbox account;
5. any known permissions, review, rate-limit, risk-control, or account-scope constraints.

Do not describe fixture/local-mock success as production validation.

## Never submit secrets or customer data

Do **not** commit or paste any of the following into code, tests, issues, pull requests, screenshots, logs, or fixtures:

- App Key / App Secret;
- access tokens or refresh tokens;
- Taobao/QianNiu session keys;
- cookies or login sessions;
- shop credentials;
- passwords or API keys;
- real customer conversations;
- names, phone numbers, addresses, order IDs, payment information, or other customer/order data;
- private logs or internal company data.

Use synthetic fixtures and obvious placeholders only.

## Keep the truth boundary intact

A contribution must not imply any of the following unless the repository contains reproducible evidence for the claim:

- official partnership or endorsement by Douyin, Taobao, QianNiu, DeepSeek, or another third party;
- completed production API approval;
- production-ready message sending, order access, after-sales access, or risk-control clearance;
- a hosted BossAI service;
- commercial-use authorization from downloading or forking this repository.

The current Community Demo may run locally without platform production credentials, and no-key mode must remain explicitly identified as Demo fallback rather than a real DeepSeek call.

## Before opening a pull request

Run:

```bash
npm ci
npm run verify:community-demo
npm start
# in another terminal
npm test
```

Your pull request should explain:

- what changed;
- why it is needed;
- how you reproduced the old behavior;
- how you verified the new behavior;
- whether any third-party API contract is involved;
- whether any user-visible wording changed.

## License and rights

Only submit material that you wrote yourself or have the right to contribute.

Accepted contributions are distributed as part of this repository under the repository's current [`LICENSE`](LICENSE), unless a separate written agreement explicitly says otherwise. The BossAI Community Source License is source-available and is not an OSI-approved open-source license. Commercial-use rights are not granted merely by contributing, downloading, forking, or installing the repository.

Third-party APIs, SDKs, trademarks, accounts, credentials, and data remain governed by their own terms.

## Scope

This repository is not the production BossAI Commerce authority and must not grow a second BossAI identity, billing, payment, entitlement, or commercial-governance system.

For broader ecommerce orchestration, see [BossAI Ecommerce Manager Skill](https://github.com/liufeng1976/bossai-ecommerce-ai-team-skill). For BossAI product/commercial information, see https://bossaios.com.
