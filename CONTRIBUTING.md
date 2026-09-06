# Contributing

Thanks for improving the BossAI Douyin/Taobao customer-service connector reference.

## Before opening a PR

```bash
npm ci
npm run demo
npm run check
```

Use synthetic/demo data. Never submit real merchant keys, tokens, cookies, customer PII or production payloads containing sensitive data.

## Project boundaries

Contributions should preserve these rules:

- this repository is a channel adapter/reference source, not a second BossAI customer-service product or Agent Runtime;
- AI drafting uses the BossAI OS boundary, not direct provider master keys;
- customer-facing output remains review-only;
- automatic sends/refunds/order/account mutations remain disabled;
- canonical Customer Service owns Case/brand routing/history/audit/approval;
- real marketplace API access is optional future integration and must not be claimed without evidence.

## Good contributions

- additional synthetic webhook fixtures;
- normalization compatibility for documented message variants;
- security and signature tests;
- data-minimization improvements;
- better docs, examples, CI and diagnostics;
- read-only platform fact extraction that does not expand business mutation authority.

## Platform-contract evidence

If a PR changes Douyin, Taobao, Tmall or Qianniu integration behavior, include:

1. the exact official documentation page or current platform contract checked;
2. the date it was checked;
3. which fields, signature, token, webhook or read-only API behavior changed;
4. whether validation used only fixtures/local mocks, an authorized sandbox, or your own legitimately authorized production account;
5. known permission, review, rate-limit, risk-control or account-scope constraints.

Fixture/mock success must never be described as production validation. Do not paste credentials, private payloads or customer/order data as evidence.

## PR description

Explain what changed, why it is needed, how the old behavior was reproduced, how the new behavior was verified, whether a third-party platform contract is involved, and whether any user-visible wording changed.

By contributing, you confirm you have the right to submit the contribution and agree that accepted contributions are distributed under the repository's `LICENSE` terms. The BossAI Community Source License is source-available, not OSI-approved open source; contributing, downloading or forking does not itself grant commercial-use rights.
