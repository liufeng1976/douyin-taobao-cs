# External Distribution Plan

This document prepares public-safe distribution for `douyin-taobao-cs` without automatically publishing anything.

## Objective

Increase qualified external discovery for the runnable API-free connector reference, then measure whether external visitors become cloners, Stars, Forks, Community Demo feedback, or BossAI Ecommerce Manager trial users.

The project remains source-available under BossAI Community Source License 1.0. Do not call it OSI open source. Do not claim live Douyin/Taobao production API validation.

## Current evidence baseline

Baseline captured 2026-09-06:

- 203 rolling-14-day views
- 106 unique visitors
- 30 clones
- 26 unique cloners
- 20 Stars
- 5 Forks
- 0 public Issues
- dominant referrer: `github.com`
- observed external referrers: Bing and ChatGPT

Use `npm run growth:traffic` before and after any public distribution. Traffic values are rolling 14-day windows, not cumulative acquisition totals.

## Channel decision matrix

### 1. Show HN — PRIORITY CANDIDATE

Status: **GO only with explicit human approval to publish.**

Why it fits:

- the project is personally built and runnable;
- users can try it locally without signup, email, merchant API credentials or production secrets;
- it has a non-trivial technical core: signed webhook verification, normalization, idempotency, data minimization and human-review boundaries;
- GitHub is the original source and direct runnable entry.

Rules to preserve:

- title starts with `Show HN:`;
- link directly to the GitHub repository, not a marketing landing page;
- do not solicit upvotes or comments;
- do not use HN primarily for repeated BossAI promotion;
- be present to answer technical questions;
- disclose source-available licensing and the absence of live marketplace-production validation.

References:

- https://news.ycombinator.com/showhn.html
- https://news.ycombinator.com/newsguidelines.html

#### Proposed Show HN title

`Show HN: API-free Douyin/Taobao customer-service webhook connector`

Submission URL:

`https://github.com/liufeng1976/douyin-taobao-cs`

#### Proposed first comment

I built this because most ecommerce customer-service examples assume live merchant API credentials and mix inbound messages, model calls, customer replies and order mutations in one service.

This reference takes a narrower approach: it can be cloned and run without Douyin/Taobao credentials, verifies synthetic signed Douyin and Taobao/Qianniu webhooks, normalizes them into one intake envelope, uses stable idempotency, minimizes order/customer data, and keeps customer-facing output review-only.

Quick path: `npm ci && npm run demo`.

The current v1.1.0 release has 20 connector/signature/policy tests and 17 local HTTP E2E scenarios. It is source-available under the BossAI Community Source License 1.0, not OSI open source. It does not claim live Douyin/Taobao merchant production API validation.

I am especially interested in feedback on the webhook normalization/idempotency boundary and whether the review-only external-action model is useful for other marketplace connectors.

### 2. r/selfhosted — CONDITIONAL / MEGATHREAD ONLY UNTIL 2026-09-21

Repository public creation date: **2026-06-21**.

The project is younger than three months until **2026-09-21**. Before that date, do not create a standalone project post. Use only the current New Project Megathread, subject to the current subreddit rules.

Current rule behavior also expects promoted apps to be self-hostable, released, directly tryable and documented. This repository satisfies those technical prerequisites, but compliance with the current weekly thread/rules must be rechecked immediately before posting.

Reference example of the current weekly policy:

- https://www.reddit.com/r/selfhosted/comments/1ulvzjo/new_project_megathread_week_of_02_jul_2026/

#### Proposed Megathread top-level comment

**Project Name:** BossAI Douyin / Taobao Customer Service Connector

**Repo:** https://github.com/liufeng1976/douyin-taobao-cs

**What it is:** A self-hostable, API-free reference for Douyin Shop and Taobao/Tmall/Qianniu customer-service inbound webhook handling. It verifies signed callbacks, normalizes messages into a common envelope, adds stable idempotency and data minimization, and keeps external customer/order actions behind human review.

**Why it may be useful here:** You can run the demo locally with Node.js 20+ using `npm ci && npm run demo`; no merchant API account, model key, signup or hosted service is required for the demo.

**Current boundary:** v1.1.0 is a source-available reference, not OSI open source. No live Douyin/Taobao merchant production API access is included or claimed. Automatic customer sends, refunds and order mutations remain disabled.

**AI disclosure:** AI-assisted development was used in the engineering workflow; the repository includes explicit tests, safety boundaries and release evidence. The runnable behavior and claims should be judged from the source and tests rather than from marketing claims.

Feedback on the webhook normalization and review boundary is welcome. Please do not post merchant credentials or customer data.

### 3. r/ecommerce — NO-GO FOR DIRECT PROMOTION

Do not submit this repository as a promotional post, feedback request or external-link post to r/ecommerce under its current rules.

Current rules prohibit self-promotion, external links and developer research/feedback requests, and state that obvious or suspected AI content may be removed. Participate there only as a normal community member answering relevant questions without trying to route users to BossAI.

Reference:

- https://www.reddit.com/r/ecommerce/comments/1legguv/welcome_to_recommerce_please_read_and_abide_by/

## Publication truth boundary

Any public post must preserve all of the following:

- API-free demo is real and runnable;
- synthetic signed-webhook verification is not live marketplace validation;
- no merchant credential, customer PII or production token is included;
- automatic customer message send is disabled;
- refunds/cancellations/replacements/compensation/order/account mutations are disabled;
- BossAI OS is the bounded AI/provider authority;
- BossAI Customer Service is the canonical intake/review authority;
- license is BossAI Community Source License 1.0 / source-available;
- no claim of revenue, lead volume, conversion uplift or production deployment without evidence.

## Measurement protocol

Before a human publishes one approved distribution item:

1. Run `npm run growth:traffic` and preserve the latest local snapshot.
2. Record channel, exact title/comment, publication timestamp and public URL in a campaign record.
3. Do not publish another major distribution item for at least one clean observation interval unless there is a separate reason; otherwise attribution becomes ambiguous.
4. Compare subsequent snapshots using `npm run growth:traffic:compare -- <before.json> <after.json>`.
5. Treat a new referrer as directional evidence only. Do not claim causation from one observation.
6. Prefer qualified outcomes over raw views: unique cloners, Stars/Forks, public feedback, trial intake and substantive technical discussion.

## Human approval gate

This file is preparation only. Creating an HN submission, Reddit post/comment, social post, direct message, email, or any other external publication requires explicit human approval for that concrete action.
