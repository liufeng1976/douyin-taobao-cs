# Security Policy

## Supported public-source line

Security fixes are accepted for the current `main` branch and the latest public-source release line.

## Reporting a vulnerability

Do not open a public issue containing merchant secrets, platform tokens, customer PII, production webhook payloads, private URLs or exploitable credential material.

Use GitHub's private security reporting feature when available. If private reporting is unavailable, contact BossAI through the official commercial/support entry at https://bossaios.com and provide only the minimum information needed to coordinate a private disclosure.

## Security boundaries

This repository is designed so that:

- real Douyin/Taobao credentials are not needed for the public demo;
- `.env` and logs are ignored;
- direct provider master keys are not part of the hardened AI path;
- customer messages are not automatically sent;
- refunds, cancellations, replacements, compensation, order and account mutations are disabled;
- production webhook signatures fail closed;
- public health endpoints do not expose internal intake URLs or secrets.

Never commit real merchant credentials or customer PII to issues, pull requests, examples or tests.
