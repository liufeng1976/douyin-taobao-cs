# 🤖 抖音 + 淘宝 AI 自动客服系统

同时管理**抖音电商**和**淘宝/千牛**的 AI 智能客服系统。

## ✨ 核心功能

- **多平台统一管理** — 一个后台，同时服务抖音和淘宝两家店铺
- **AI 智能回复** — 基于 DeepSeek 大模型，精准理解客户意图
- **知识库 RAG** — FAQ 知识库增强检索，自动匹配最佳答案
- **Webhook 实时接入** — 对接抖音开放平台 & 淘宝千牛消息推送
- **轮询兜底** — 定时拉取未回复消息并自动回复
- **浮动客服组件** — 可嵌入店铺页面的 Widget
- **手动接管** — 支持人工介入回复

## 📁 项目结构

```
douyin-taobao-cs/
├── backend/
│   ├── server.js          # 主服务入口
│   ├── adapters/
│   │   ├── douyin.js      # 抖音电商适配器
│   │   └── taobao.js      # 淘宝/千牛适配器
│   ├── ai/
│   │   └── index.js       # AI 推理引擎 (DeepSeek)
│   ├── knowledge/
│   │   └── index.js       # 知识库 RAG 检索
│   ├── middleware/
│   │   ├── auth.js        # API 认证
│   │   ├── rateLimit.js   # 限流
│   │   └── errorHandler.js# 错误处理
│   └── utils/
│       ├── logger.js      # 日志
│       └── store.js       # 店铺存储
├── frontend/
│   ├── index.html         # 管理面板
│   └── app.js             # 面板逻辑
├── widget/
│   └── embed.js           # 浮动客服组件
├── docs/
│   └── README.md
├── tests/
│   └── e2e.test.js
├── package.json
└── .env.example
```

## 🚀 快速开始

### 1. 安装依赖
```bash
cd douyin-taobao-cs
npm install
```

### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 填入你的 API Key:
#   DEEPSEEK_API_KEY    DeepSeek API Key
#   DOUYIN_APP_KEY      抖音开放平台 App Key
#   DOUYIN_APP_SECRET   抖音开放平台 App Secret
#   TAOBAO_APP_KEY      淘宝开放平台 App Key
#   TAOBAO_APP_SECRET   淘宝开放平台 App Secret
#   TAOBAO_SESSION_KEY  淘宝 Session Key
```

### 3. 启动服务
```bash
npm start
# 服务运行在 http://localhost:3000
```

### 4. 配置 Webhook

**抖音**: 在抖音开放平台配置消息推送地址:
```
https://your-domain.com/api/webhook/douyin
```

**淘宝/千牛**: 在淘宝开放平台配置消息服务地址:
```
https://your-domain.com/api/webhook/taobao
```

## 📡 API 文档

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/chat | AI 对话接口 |
| POST | /api/reply | 手动回复 |
| POST | /api/batch-process | 批量轮询处理 |
| GET | /api/shops | 获取店铺列表 |
| GET | /api/knowledge/:shopId | 获取知识库 |
| POST | /api/knowledge/:shopId | 添加 FAQ |
| DELETE | /api/knowledge/:shopId/:docId | 删除 FAQ |
| POST | /api/webhook/douyin | 抖音消息 webhook |
| POST | /api/webhook/taobao | 淘宝消息 webhook |

## 🔧 定时任务配置

建议配置 cron 定时调用批量处理接口:
```bash
# 每分钟轮询一次未回复消息
*/1 * * * * curl -X POST http://localhost:3000/api/batch-process -H "x-api-key: dev-key-001" -H "Content-Type: application/json" -d '{"platforms":["douyin","taobao"]}'
```

## 🛠 技术栈

- **运行时**: Node.js + Express
- **AI 模型**: DeepSeek Chat API
- **前端**: Vanilla JS (轻量无框架)
- **存储**: 内存 (可升级为 Prisma + SQLite/PostgreSQL)