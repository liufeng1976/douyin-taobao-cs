## What changed

Describe the connector/reference change and the user/developer value.

## Verification

- [ ] `npm run demo`
- [ ] `npm run check`
- [ ] I used synthetic/demo data only.
- [ ] No real merchant secret, token, cookie or customer PII is included.
- [ ] Automatic customer sends/refunds/order/account mutations remain disabled.
- [ ] This change does not create a second BossAI runtime/approval/customer-service state authority.
- [ ] Any real-platform claim is backed by explicit evidence; otherwise it is described as unvalidated.

## Third-party platform contract

- [ ] This change does **not** alter Douyin / Taobao / Tmall / Qianniu integration behavior.
- [ ] This change **does** alter platform integration behavior, and I documented the official source, date checked, validation scope, permissions/limits, and whether validation was fixture-only, sandbox, or my own legitimately authorized production environment below.

Official documentation / source (if applicable):

<!-- Link/reference only. Do not paste credentials or private content. -->

Validation scope and date:

<!-- Example: fixture-only, checked 2026-09-06. Fixture success is not production validation. -->

## Truth boundary

- [ ] I am not claiming official platform endorsement or partnership.
- [ ] I am not describing local fixtures/mocks as completed production API validation.
- [ ] I am not implying that this repository includes hosted service, platform credentials, customer data, or commercial-use authorization.
- [ ] No second BossAI identity, runtime, billing, payment, entitlement, approval or customer-service state authority is introduced.

## User-visible wording

<!-- If README/UI/release wording changed, quote the claim and explain the evidence supporting it. -->

## Public-source / license

- [ ] Existing `LICENSE` and v1.0.0 release history are preserved unless the PR is explicitly a reviewed licensing/release-history change.
