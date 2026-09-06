# Changelog

## [1.1.0] - Candidate

### Changed
- Repositioned the repository from the legacy auto-reply PoC into an API-free domestic ecommerce customer-service connector reference.
- Replaced direct model-provider access with bounded BossAI OS drafting plus deterministic local safety fallback.
- Replaced the legacy auto-customer-service dashboard with a diagnostic/review-only console.
- Removed runtime third-party dependencies from the hardened service path.

### Added
- Douyin MD5/HMAC-SHA256 signed inbound normalization.
- Taobao/Qianniu HMAC-SHA256 signed inbound normalization.
- `bossai.customer-service-connector-envelope.v1` and stable idempotency.
- Canonical BossAI Customer Service intake bridge and read-only binding probe.
- Mandatory human-review policy and fail-closed external actions.
- API-free synthetic demo, 20 connector tests and 17 local E2E scenarios.
- Public-source CI, security/contribution docs and release truth gates.

### Retired
- Automatic customer-message sends.
- Polling auto-reply scheduled task.
- Customer-facing embedded widget.
- Fabricated default merchant policy/FAQ data.

## [1.0.0]
Existing BossAI Community Demo Source Release. Preserved unchanged as release history.
