## What changed

<!-- Describe the smallest useful change. -->

## Why

<!-- What problem does this solve? -->

## Verification

- [ ] `npm ci`
- [ ] `npm run verify:community-demo`
- [ ] `npm test` with the local service running where required
- [ ] I used synthetic fixtures/placeholders only; no real customer/order data is included.
- [ ] I removed App Keys, App Secrets, tokens, session keys, cookies, shop credentials, passwords, API keys, and private logs.

## Third-party platform contract

- [ ] This change does **not** alter Douyin / Taobao / QianNiu / DeepSeek integration behavior.
- [ ] This change **does** alter third-party integration behavior, and I documented the official source, date checked, test scope, permissions/limits, and whether validation was fixture-only, sandbox, or my own legitimately authorized production environment below.

Official documentation / source (if applicable):

<!-- Link or reference; do not paste credentials or private content. -->

Validation scope and date:

<!-- Example: fixture-only, checked 2026-09-06. Do not call fixture success production validation. -->

## Truth boundary

- [ ] I am not claiming official platform endorsement or partnership.
- [ ] I am not describing local fixtures/mocks as completed production API validation.
- [ ] I am not implying that this repository includes hosted service, platform credentials, customer data, or commercial-use authorization.
- [ ] No second BossAI identity, billing, payment, entitlement, or commercial-governance authority is introduced.

## User-visible wording

<!-- If README/UI/release wording changed, quote the exact claim and explain the evidence supporting it. -->
