# 🤖 Douyin + Taobao / QianNiu AI Customer Service Demo — DeepSeek + RAG

> **Public Community Demo** for multi-platform ecommerce customer-service workflows, DeepSeek integration patterns, local knowledge-base/RAG, webhook adapter structure, human takeover, and multi-shop management.

[中文 README](README.md) · [BossAI website](https://bossaios.com) · [v1.0.0 Community Demo Release](https://github.com/liufeng1976/douyin-taobao-cs/releases/tag/v1.0.0)

[![GitHub stars](https://img.shields.io/github/stars/liufeng1976/douyin-taobao-cs?style=social)](https://github.com/liufeng1976/douyin-taobao-cs/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/liufeng1976/douyin-taobao-cs?style=social)](https://github.com/liufeng1976/douyin-taobao-cs/network/members)
[![License](https://img.shields.io/badge/license-BossAI%20Community%20Source-orange)](LICENSE)

**License classification: Source Available, not OSI Open Source.** Personal, educational, research, evaluation, and other non-commercial use is permitted under the BossAI Community Source License 1.0. Company operations, managed ecommerce/customer-service delivery, paid services, SaaS, white-label/OEM, resale, or other commercial use requires separate BossAI authorization. See [`LICENSE`](LICENSE).

## ⚠️ Current status

This repository is intentionally maintained as a **BossAI GitHub acquisition and technical-demo project**. It is **not** the BossAI Commerce production mainline.

- The local customer-service flow, knowledge-base CRUD, RAG wiring, and no-key demo fallback can be run locally.
- If `DEEPSEEK_API_KEY` is not configured, the application returns an explicit local-demo response instead of pretending that a real model call occurred.
- The Douyin and Taobao/QianNiu modules are **integration skeletons**. **Real Douyin, Taobao, or QianNiu production API validation has not been completed.**
- This repository does not include platform App Keys, Secrets, Sessions, shop credentials, customer data, or an official platform partnership/authorization.
- Do not describe the current repository as a production-ready or officially validated Douyin/Taobao customer-service connector. Before production use, verify current official platform APIs, signatures, permissions, message send/receive behavior, order/after-sales scopes, and risk controls using your own authorized accounts.
- `v1.0.0` is a **Community Demo Source Release** only. It is not a hosted SaaS product, production account, signed commercial binary, or commercial-use entitlement.

If the project is useful, consider giving it a **Star**. That helps more developers and ecommerce operators discover the project.

## Continue into the BossAI ecosystem

Use this repository as a demo entry point, then continue to the public BossAI project that matches your next job:

| What you want to do next | BossAI public project | Best for |
| --- | --- | --- |
| Extend customer service into product research, operations, content, sales, project execution, and approval-aware workflows | **[BossAI Ecommerce Manager Skill](https://github.com/liufeng1976/bossai-ecommerce-ai-team-skill)** | Ecommerce operators and AI-agent users |
| Find evidence-backed pains and commercial opportunities across Reddit, Hacker News, GitHub Issues, ArXiv, and RSS | **[BossAI Radar Lite](https://github.com/liufeng1976/bossai-radar-lite)** | Founders, product teams, market researchers |
| Run a Windows local-first script → voice → talking avatar → subtitles/music → final-video workflow | **[BossAI Video Agent](https://github.com/liufeng1976/bossaios-com-video-agent)** | Creators and video-automation users |
| Reuse AI contracts, Skills, Workflows, local RAG, file parsing, and webhook-security primitives in your own application | **[BossAI OS Core](https://github.com/liufeng1976/bossai-os-core)** | Developers and AI application teams |

- **BossAI product/commercial entry point:** https://bossaios.com
- **Current Community Demo Release:** https://github.com/liufeng1976/douyin-taobao-cs/releases/tag/v1.0.0
- **BossAI GitHub account:** https://github.com/liufeng1976

If your immediate problem is ecommerce customer service, the most natural next step is **BossAI Ecommerce Manager Skill**. If you still need to decide what product/opportunity to pursue, start with **BossAI Radar Lite**. If you already have a product or content topic and need local video production, try **BossAI Video Agent**.

## Features

- **Multi-platform management structure** — one backend structure for organizing Douyin and Taobao customer-service flows.
- **DeepSeek AI reply integration** — uses DeepSeek when a key is explicitly configured; otherwise returns an explicit local-demo fallback.
- **Knowledge-base RAG** — FAQ knowledge retrieval provides answer context.
- **Webhook adapter skeletons** — example structure for Douyin and Taobao/QianNiu message entry points; production contracts must be revalidated against current platform documentation.
- **Batch-processing skeleton** — demonstrates an unreplied-message processing flow; real platform polling requires authorized production access.
- **Embeddable support widget** — lightweight frontend widget example.
- **Human takeover** — manual reply entry point remains available.

## Project structure

```text
douyin-taobao-cs/
├── backend/
│   ├── server.js
│   ├── adapters/
│   │   ├── douyin.js      # Douyin adapter skeleton
│   │   └── taobao.js      # Taobao / QianNiu adapter skeleton
│   ├── ai/
│   │   └── index.js       # DeepSeek wiring + explicit no-key demo fallback
│   ├── knowledge/
│   │   └── index.js       # Knowledge-base / RAG retrieval
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── rateLimit.js
│   │   └── errorHandler.js
│   └── utils/
│       ├── logger.js
│       └── store.js
├── frontend/
│   ├── index.html
│   └── app.js
├── widget/
│   └── embed.js
├── tests/
│   └── e2e.test.js
├── scripts/
│   └── verify-community-demo.mjs
├── package.json
└── .env.example
```

## Quick start

### 1. Install

```bash
git clone https://github.com/liufeng1976/douyin-taobao-cs.git
cd douyin-taobao-cs
npm ci
```

### 2. Run the local demo — no platform API required

```bash
npm start
```

Open `http://localhost:3000`.

Without `DEEPSEEK_API_KEY`, AI replies are explicitly labeled as local demo behavior. This lets you inspect the workflow, knowledge base, and UI without making a real DeepSeek request.

### 3. Optional: configure DeepSeek

```bash
cp .env.example .env
# Edit .env:
# DEEPSEEK_API_KEY=<your key>
```

DeepSeek is a third-party service and remains subject to its own service terms, pricing, and data rules.

### 4. Real platform integration — not production-validated in this repository

Only configure platform credentials after you have legitimate current access from the relevant platform:

```text
DOUYIN_APP_KEY
DOUYIN_APP_SECRET
TAOBAO_APP_KEY
TAOBAO_APP_SECRET
TAOBAO_SESSION_KEY
```

Then verify the **current** official platform documentation for webhook signatures, tokens, message sending, order access, after-sales permissions, and risk-control requirements. Do not assume historical endpoint names or fields in this demo are current production contracts.

## Local / Demo API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Health check |
| POST | `/api/chat` | AI / local demo conversation |
| POST | `/api/reply` | Manual-reply entry point; real platform send requires authorized credentials |
| POST | `/api/batch-process` | Batch-processing entry point; real platform polling requires authorized credentials |
| GET | `/api/shops` | List shops |
| GET | `/api/knowledge/:shopId` | List knowledge-base documents |
| POST | `/api/knowledge/:shopId` | Add FAQ knowledge |
| DELETE | `/api/knowledge/:shopId/:docId` | Delete FAQ knowledge |
| POST | `/api/webhook/douyin` | Douyin webhook adapter skeleton |
| POST | `/api/webhook/taobao` | Taobao/QianNiu webhook adapter skeleton |

## Validation

Repository CI installs locked dependencies, starts the local service, and runs the E2E demo baseline **without DeepSeek, Douyin, or Taobao production credentials**:

```bash
npm run verify:community-demo
npm start
# In another terminal:
npm test
```

A passing CI run proves the public local-demo baseline only. It does **not** prove current third-party production API compatibility or platform authorization.

## Technology

- **Runtime:** Node.js + Express
- **AI model:** optional DeepSeek Chat API; explicit local demo fallback when no key is configured
- **Frontend:** Vanilla JavaScript
- **Storage:** in-memory demo store; can be replaced by a production-appropriate persistent store in a separately governed deployment

## License

This repository uses **BossAI Community Source License 1.0**. It is source-available, not OSI-approved open source. Personal/non-commercial use is permitted subject to the license; commercial use requires separate BossAI authorization.

Commercial/product entry point: **https://bossaios.com**

Third-party platforms, SDKs, APIs, trademarks, data, and credentials remain governed by their own terms. The BossAI Community Source License does not grant DeepSeek, Douyin, Taobao, QianNiu, or any other third-party account/API/data/trademark rights. See [`LICENSE`](LICENSE).
