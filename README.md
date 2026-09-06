# 🤖 抖音 + 淘宝 / 千牛 AI 自动客服｜DeepSeek + RAG

> **公开社区演示 / Public Community Demo** — 用于展示多平台客服流程、DeepSeek 接入方式、知识库 RAG、Webhook 适配器结构、人工接管与多店铺管理思路。

[![GitHub stars](https://img.shields.io/github/stars/liufeng1976/douyin-taobao-cs?style=social)](https://github.com/liufeng1976/douyin-taobao-cs/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/liufeng1976/douyin-taobao-cs?style=social)](https://github.com/liufeng1976/douyin-taobao-cs/network/members)
[![License](https://img.shields.io/badge/license-BossAI%20Community%20Source-orange)](LICENSE)

**许可状态：Source Available / 源码公开，不是 OSI Open Source。** 个人、教育、研究、评估及其他非商业用途免费；公司经营、代运营、客户服务、收费交付、SaaS、白标/OEM 或其他商业用途需要 BossAI 商业授权。完整条款见 [`LICENSE`](LICENSE)。

## ⚠️ 当前状态 / Current status

这个仓库现在作为 **BossAI GitHub 获客与技术演示项目** 维护，不是 BossAI Commerce 的生产主线。

- 本地客服流程、知识库 CRUD、RAG 接线和无 Key Demo fallback 可以直接运行。
- 未配置 `DEEPSEEK_API_KEY` 时，系统会明确返回“本地演示模式”结果，不会假装已经调用真实模型。
- 抖音与淘宝/千牛代码目前是 **平台集成骨架**；**尚未完成真实抖音 / 淘宝生产 API 验收**，仓库不附带平台 App Key、Secret、Session 或店铺凭据。
- 不应把当前仓库描述为“已获得抖音/淘宝官方生产接入”或“开箱即用的生产客服”。真实上线前必须使用你自己的正式平台权限、核对最新 API 文档并完成签名、消息收发、订单/售后权限和风控验收。
- 当前 `v1.0.0` Release 仅是 **Community Demo Source Release**，不包含 SaaS、托管服务、生产账号或商业授权。

如果这个项目对你有帮助，欢迎 **Star**。这会帮助更多做抖音、淘宝、千牛、电商客服和 AI 自动化的人发现它。

## BossAI 生态

这个项目是 BossAI GitHub 公开项目体系中的流量入口。现有代码和使用方式保持独立，不要求迁移。

- **BossAI 官网**：https://bossaios.com
- **BossAI 电商总管 Skill**：https://github.com/liufeng1976/bossai-ecommerce-ai-team-skill
- **当前 Community Demo Release**：https://github.com/liufeng1976/douyin-taobao-cs/releases/tag/v1.0.0
- **BossAI GitHub**：https://github.com/liufeng1976

如果你需要的不只是“自动回复”，而是继续覆盖选品、运营、客服、销售、内容、项目管理和人工审批，可以继续查看 BossAI 电商总管 Skill。

## ✨ 核心功能

- **多平台统一管理结构** — 一个后台组织抖音和淘宝店铺客服数据流
- **AI 智能回复** — 配置 DeepSeek Key 后调用模型；无 Key 时明确进入本地 Demo fallback
- **知识库 RAG** — FAQ 知识库增强检索，自动匹配参考答案
- **Webhook 适配器骨架** — 提供抖音、淘宝/千牛消息入口的示例结构，生产使用需重新核对平台当前协议
- **轮询处理骨架** — 展示未回复消息批处理流程，真实平台调用需正式权限
- **浮动客服组件** — 可嵌入页面的 Widget 示例
- **手动接管** — 支持人工回复入口

## 📁 项目结构

```text
douyin-taobao-cs/
├── backend/
│   ├── server.js          # 主服务入口
│   ├── adapters/
│   │   ├── douyin.js      # 抖音电商适配器骨架
│   │   └── taobao.js      # 淘宝/千牛适配器骨架
│   ├── ai/
│   │   └── index.js       # DeepSeek 接线 + 无 Key Demo fallback
│   ├── knowledge/
│   │   └── index.js       # 知识库 RAG 检索
│   ├── middleware/
│   │   ├── auth.js        # API 认证
│   │   ├── rateLimit.js   # 限流
│   │   └── errorHandler.js# 错误处理
│   └── utils/
│       ├── logger.js       # 日志
│       └── store.js        # 店铺存储
├── frontend/
│   ├── index.html         # 管理面板
│   └── app.js             # 面板逻辑
├── widget/
│   └── embed.js           # 浮动客服组件
├── tests/
│   └── e2e.test.js
├── scripts/
│   └── verify-community-demo.mjs
├── package.json
└── .env.example
```

## 🚀 快速开始

### 1. 安装依赖

```bash
git clone https://github.com/liufeng1976/douyin-taobao-cs.git
cd douyin-taobao-cs
npm ci
```

### 2. 本地 Demo：不需要平台 API

```bash
npm start
```

打开 `http://localhost:3000`。未配置 `DEEPSEEK_API_KEY` 时，AI 回复会明确标记为本地演示模式，适合查看流程、知识库和界面，不会调用真实 DeepSeek。

### 3. 可选：配置 DeepSeek

```bash
cp .env.example .env
# 编辑 .env：
# DEEPSEEK_API_KEY=<your key>
```

DeepSeek 是第三方服务；使用时受其自己的服务条款、计费和数据规则约束。

### 4. 真实平台联调（当前仓库未完成生产验收）

只有在你已经取得对应平台正式权限后，才配置：

```text
DOUYIN_APP_KEY
DOUYIN_APP_SECRET
TAOBAO_APP_KEY
TAOBAO_APP_SECRET
TAOBAO_SESSION_KEY
```

然后依据平台**当前**官方文档核对 webhook 签名、token、消息发送、订单查询和售后权限。不要直接把仓库中的历史 endpoint/字段假定为当前生产协议。

## 📡 本地 API / Demo API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /health | 健康检查 |
| POST | /api/chat | AI / Demo 对话接口 |
| POST | /api/reply | 手动回复入口；真实平台发送需正式凭据 |
| POST | /api/batch-process | 批处理入口；真实平台轮询需正式凭据 |
| GET | /api/shops | 获取店铺列表 |
| GET | /api/knowledge/:shopId | 获取知识库 |
| POST | /api/knowledge/:shopId | 添加 FAQ |
| DELETE | /api/knowledge/:shopId/:docId | 删除 FAQ |
| POST | /api/webhook/douyin | 抖音 webhook 适配器骨架 |
| POST | /api/webhook/taobao | 淘宝/千牛 webhook 适配器骨架 |

## ✅ 验证

仓库 CI 使用锁文件安装依赖，启动本地服务，并在**不配置 DeepSeek/抖音/淘宝生产凭据**的情况下运行 E2E Demo 测试：

```bash
npm run verify:community-demo
npm start
# 另一个终端：
npm test
```

这只能证明公开 Demo 的本地基线，不代表第三方平台生产 API 已验证。

## 🛠 技术栈

- **运行时**: Node.js + Express
- **AI 模型**: DeepSeek Chat API（可选；无 Key 时进入明确 Demo fallback）
- **前端**: Vanilla JS
- **存储**: 内存（可升级为 Prisma + SQLite/PostgreSQL）

## 📄 许可 / License

本仓库采用 **BossAI Community Source License 1.0**：源码公开，个人/非商业免费，商业用途需要 BossAI 授权。它是 source-available 许可证，不应表述为 OSI 认可的开源许可证。

商业授权入口：**https://bossaios.com**

第三方平台、SDK、API、商标、数据及凭据继续受各自条款约束。BossAI Community Source License 不授予 DeepSeek、抖音、淘宝、千牛或任何第三方服务的账号、API、数据或商标权利。参见 [`LICENSE`](LICENSE)。
