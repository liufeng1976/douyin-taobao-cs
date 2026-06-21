/**
 * 抖音 + 淘宝 AI 自动客服系统
 *
 * 架构:
 *   Webhook 接入层 → 平台适配器 → AI 推理引擎 → 自动回复
 *
 * 多平台统一管理，一个后台同时服务抖音和淘宝店铺
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const { logInfo, logError } = require('./utils/logger');
const douyinAdapter = require('./adapters/douyin');
const taobaoAdapter = require('./adapters/taobao');
const aiEngine = require('./ai');
const knowledgeBase = require('./knowledge');
const authMiddleware = require('./middleware/auth');
const rateLimit = require('./middleware/rateLimit');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CORS ---
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.APP_URL].filter(Boolean)
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key'],
}));

// --- 静态资源 (前端面板) ---
app.use(express.static(require('path').join(__dirname, '..', 'frontend')));

// --- 原始 body 用于 webhook 签名验证 ---
app.use('/api/webhook/douyin', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    const result = await douyinAdapter.handleWebhook(req);
    res.json(result);
  } catch (err) { next(err); }
});

app.use('/api/webhook/taobao', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    const result = await taobaoAdapter.handleWebhook(req);
    res.json(result);
  } catch (err) { next(err); }
});

app.use(express.json());

// --- 健康检查 ---
app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// --- 店铺管理 API ---
app.get('/api/shops', authMiddleware.authenticate, async (req, res, next) => {
  try {
    const { listShops } = require('./utils/store');
    const shops = await listShops();
    res.json({ shops });
  } catch (err) { next(err); }
});

// --- AI 对话接口 ---
app.post('/api/chat', authMiddleware.authenticate, rateLimit, async (req, res, next) => {
  try {
    const { message, platform, shopId, customerId } = req.body;

    if (!message || !platform || !shopId) {
      return res.status(400).json({ error: 'message, platform, shopId 为必填项' });
    }

    // 获取知识库上下文
    const kbContext = await knowledgeBase.search(shopId, message);

    // AI 生成回复
    const reply = await aiEngine.generateReply({
      message,
      platform,
      shopId,
      customerId,
      kbContext,
    });

    res.json({ reply, platform, shopId });
  } catch (err) { next(err); }
});

// --- 批量处理 (定时任务调用) ---
app.post('/api/batch-process', authMiddleware.authenticate, async (req, res, next) => {
  try {
    const { platforms = ['douyin', 'taobao'] } = req.body;
    const results = {};

    for (const platform of platforms) {
      if (platform === 'douyin') {
        results.douyin = await douyinAdapter.pollAndReply();
      } else if (platform === 'taobao') {
        results.taobao = await taobaoAdapter.pollAndReply();
      }
    }

    res.json({ ok: true, results });
  } catch (err) { next(err); }
});

// --- 知识库管理 API ---
app.get('/api/knowledge/:shopId', authMiddleware.authenticate, async (req, res, next) => {
  try {
    const docs = await knowledgeBase.list(req.params.shopId);
    res.json({ documents: docs });
  } catch (err) { next(err); }
});

app.post('/api/knowledge/:shopId', authMiddleware.authenticate, async (req, res, next) => {
  try {
    const { question, answer, category } = req.body;
    if (!question || !answer) return res.status(400).json({ error: 'question 和 answer 为必填项' });
    const doc = await knowledgeBase.add(req.params.shopId, { question, answer, category });
    res.json({ ok: true, id: doc.id });
  } catch (err) { next(err); }
});

app.delete('/api/knowledge/:shopId/:docId', authMiddleware.authenticate, async (req, res, next) => {
  try {
    await knowledgeBase.remove(req.params.shopId, req.params.docId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// --- 手动回复接口 ---
app.post('/api/reply', authMiddleware.authenticate, async (req, res, next) => {
  try {
    const { platform, shopId, customerId, message } = req.body;
    let result;

    if (platform === 'douyin') {
      result = await douyinAdapter.sendMessage(shopId, customerId, message);
    } else if (platform === 'taobao') {
      result = await taobaoAdapter.sendMessage(shopId, customerId, message);
    } else {
      return res.status(400).json({ error: '不支持的平台: ' + platform });
    }

    res.json({ ok: true, result });
  } catch (err) { next(err); }
});

// --- 错误处理 ---
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  logInfo({ module: 'server', event: 'start', port: PORT });
  console.log(`🚀 AI 客服系统已启动: http://localhost:${PORT}`);
  console.log(`   📱 抖音 webhook: /api/webhook/douyin`);
  console.log(`   🛒 淘宝 webhook: /api/webhook/taobao`);
});
