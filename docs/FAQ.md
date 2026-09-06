# FAQ

## 没有抖音/淘宝 API 能运行吗？

可以。`npm run demo` 使用合成消息和演示密钥，不调用真实平台或外部网络。`npm run check` 也不需要真实商家凭据。

## 这是已经上线的自动客服吗？

不是。它是公开的 Channel Adapter / Reference Implementation。真实平台回调、商家授权、品牌绑定和受治理发送需要单独生产验收。

## 为什么不自动回复？

客服消息可能涉及退款、投诉、地址、账户、支付、法律和隐私。这个仓库只生成待审核草稿，最终外部动作必须进入 canonical BossAI Customer Service 的人工审核边界。

## 还能直接配置 DeepSeek Key 吗？

v1.1.0 硬化线不再使用 Provider 主密钥。可选 AI 草稿通过 BossAI OS 的 `bossai-*` 公共模型别名；没有 BossAI OS Key 时使用本地安全模板。

## 为什么保留 v1.0.0？

`v1.0.0` 是已经发布的 Community Demo Source Release。版本历史不可随意移动或覆盖。v1.1.0 在它之上收敛为更可信的 API-free Connector Reference。

## 可以商业使用吗？

请阅读根目录 `LICENSE`。本仓库是 BossAI Community Source License 1.0 下的 source-available 项目，不是 OSI Open Source。商业用途需要 BossAI 授权，入口：https://bossaios.com

## Issue 能贴真实回调吗？

不要。请使用脱敏或合成数据，绝不要公开商家 Secret、Access Token、Cookie 或客户 PII。
