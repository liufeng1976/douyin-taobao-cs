# Roadmap

## v1.1.0 — public-source hardening

- API-free signed webhook demo.
- Canonical connector envelope and stable idempotency.
- Douyin/Taobao signature verification tests.
- BossAI OS bounded review-only drafting.
- Canonical BossAI Customer Service intake bridge.
- Human-review and fail-closed external-action policy.
- Data minimization and read-only order facts.
- CI, security, contribution and public-release truth gates.

## Future — only when evidence exists

- Validate additional documented Douyin/Taobao message variants using synthetic fixtures first.
- Add other domestic-commerce channel adapters under the same connector contract.
- Validate real merchant callbacks only with authorized test accounts and explicit production evidence.
- Improve canonical accountRef/brand binding diagnostics.
- Add more observability without creating a second durable workflow authority.

## Not on this roadmap

- automatic refunds or order/account mutation;
- a second BossAI customer-service product/runtime;
- direct model-provider master-key ownership;
- claims of platform approval without evidence.
