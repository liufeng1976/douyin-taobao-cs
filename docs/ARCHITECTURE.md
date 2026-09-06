# Architecture

## Role

`douyin-taobao-cs` is a public domestic-commerce channel adapter/reference source. It does not own a second BossAI Agent Runtime, customer-service state machine, approval authority, provider router, billing system or commerce ledger.

## Data path

```text
Synthetic demo OR signed marketplace callback
        ↓
channel signature verification
        ↓
normalization + stable sourceMessageId
        ↓
bossai.customer-service-connector-envelope.v1
        ↓
canonical BossAI Customer Service /api/connectors/intake
        ↓
brand routing / Case / facts / knowledge / reviewable draft
        ↓
human approval
        ↓
governed external action
```

## AI boundary

Optional drafting is delegated through BossAI OS `/v1/chat/completions` with a customer-level `x-bossai-api-key` and public `bossai-*` model aliases. Without a BossAI OS key, deterministic local safety templates are used.

No direct provider master-key route belongs in this repository.

## External-action boundary

The adapter can verify, normalize, route and perform explicitly read-only minimal fact retrieval. It cannot automatically send customer messages, refund, cancel, replace, compensate, mutate an order or mutate an account.

## Reliability

Marketplace callbacks only return success after canonical intake accepts the normalized envelope. Intake failure returns a retryable 5xx rather than acknowledging and silently losing the message. Stable `sourceMessageId` supports canonical idempotency.

## Privacy

The Taobao order-fact helper requests only order ID, state, payment and product title/SKU/quantity. Receiver name, phone and address are outside the reference contract.
