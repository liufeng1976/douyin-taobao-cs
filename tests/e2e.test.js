/**
 * E2E 测试 — AI 客服系统
 * 运行: npm test
 */
const http = require('http');

const BASE = `http://localhost:${process.env.PORT || 3000}`;
const API_KEY = 'dev-key-001';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        ...(options.headers || {}),
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function run() {
  console.log('=== AI 客服系统 E2E 测试 ===\n');
  let passed = 0, failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (e) {
      console.log(`  ❌ ${name}: ${e.message}`);
      failed++;
    }
  }

  // 1. 健康检查
  await test('健康检查', async () => {
    const res = await request('/health');
    if (!res.body.ok) throw new Error('服务未就绪');
  });

  // 2. AI 对话 - 抖音
  await test('抖音 AI 对话', async () => {
    const res = await request('/api/chat', {
      method: 'POST',
      body: { message: '什么时候发货', platform: 'douyin', shopId: 'douyin-shop-001', customerId: 'test-1' },
    });
    if (!res.body.reply) throw new Error('AI 未返回回复');
    console.log(`     回复: ${res.body.reply.slice(0, 60)}...`);
  });

  // 3. AI 对话 - 淘宝
  await test('淘宝 AI 对话', async () => {
    const res = await request('/api/chat', {
      method: 'POST',
      body: { message: '怎么退货', platform: 'taobao', shopId: 'taobao-shop-001', customerId: 'test-2' },
    });
    if (!res.body.reply) throw new Error('AI 未返回回复');
    console.log(`     回复: ${res.body.reply.slice(0, 60)}...`);
  });

  // 4. 知识库 CRUD
  let docId;
  await test('添加 FAQ', async () => {
    const res = await request('/api/knowledge/douyin-shop-001', {
      method: 'POST',
      body: { question: '测试问题', answer: '测试答案', category: 'test' },
    });
    if (!res.body.ok) throw new Error('添加失败');
    docId = res.body.id;
  });

  await test('查询知识库', async () => {
    const res = await request('/api/knowledge/douyin-shop-001');
    if (!res.body.documents) throw new Error('查询失败');
    if (!res.body.documents.find(d => d.id === docId)) throw new Error('未找到新增的 FAQ');
  });

  await test('删除 FAQ', async () => {
    const res = await request(`/api/knowledge/douyin-shop-001/${docId}`, { method: 'DELETE' });
    if (!res.body.ok) throw new Error('删除失败');
  });

  // 5. 获取店铺列表
  await test('获取店铺列表', async () => {
    const res = await request('/api/shops');
    if (!res.body.shops) throw new Error('获取失败');
    console.log(`     店铺数: ${res.body.shops.length}`);
  });

  // 总结
  console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('测试运行失败:', e.message);
  process.exit(1);
});