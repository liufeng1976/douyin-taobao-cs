/**
 * 知识库模块
 *
 * 管理 FAQ 问答对，提供给 AI 引擎做 RAG 检索增强
 * 目前使用内存存储，生产环境可替换为向量数据库 (如 ChromaDB / pgvector)
 */

const { logInfo, logError } = require('../utils/logger');

// 内存存储: shopId -> [{id, question, answer, category}]
const knowledgeStore = new Map();

// 初始化一些默认 FAQ
function initDefaultKB(shopId) {
  if (!knowledgeStore.has(shopId)) {
    knowledgeStore.set(shopId, [
      {
        id: 'default_1',
        question: '什么时候发货',
        answer: '您好，订单付款后我们会尽快安排发货，一般48小时内发出。如有特殊情况会第一时间通知您～ 📦',
        category: 'shipping',
      },
      {
        id: 'default_2',
        question: '支持哪些快递',
        answer: '我们合作的快递有顺丰、中通、圆通和韵达，会根据您的地址选择最优快递。如有特殊需求可以备注。',
        category: 'shipping',
      },
      {
        id: 'default_3',
        question: '退换货政策',
        answer: '支持7天无理由退换货，商品需保持原状未使用。质量问题我们承担来回运费，非质量问题需买家承担运费。',
        category: 'refund',
      },
      {
        id: 'default_4',
        question: '怎么查物流',
        answer: '您可以在订单详情里查看物流信息，也可以把订单号发给我，我帮您查询～',
        category: 'shipping',
      },
      {
        id: 'default_5',
        question: '有没有优惠',
        answer: '我们定期会有促销活动，建议关注店铺首页和直播间。新客户首单还有专属优惠哦！🎉',
        category: 'promotion',
      },
    ]);
  }
}

/**
 * 搜索知识库 (简单的关键词匹配 + 分词)
 * 生产环境建议使用向量检索 (embedding + cosine similarity)
 */
async function search(shopId, query) {
  try {
    initDefaultKB(shopId);

    const docs = knowledgeStore.get(shopId) || [];
    if (!query || docs.length === 0) return [];

    const q = query.toLowerCase();

    // 分词 + 关键词匹配打分
    const scored = docs.map(doc => {
      const question = doc.question.toLowerCase();
      const answer = doc.answer.toLowerCase();
      let score = 0;

      // 精确匹配加分
      if (question.includes(q) || q.includes(question)) score += 5;

      // 关键词匹配
      const keywords = extractKeywords(q);
      for (const kw of keywords) {
        if (question.includes(kw)) score += 2;
        if (answer.includes(kw)) score += 1;
      }

      return { ...doc, score };
    });

    // 按分数排序，取 top 5
    const results = scored
      .filter(d => d.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return results;
  } catch (err) {
    logError({ module: 'knowledge', event: 'search_error', error: err.message });
    return [];
  }
}

/**
 * 提取中文关键词 (简易分词)
 */
function extractKeywords(text) {
  // 移除标点，按常见词拆分
  const cleaned = text.replace(/[，。？！、；：""''（）\s]/g, ' ');
  const words = cleaned.split(/\s+/).filter(w => w.length >= 2);
  return words;
}

/**
 * 列出知识库内容
 */
async function list(shopId) {
  initDefaultKB(shopId);
  return knowledgeStore.get(shopId) || [];
}

/**
 * 添加知识条目
 */
async function add(shopId, { question, answer, category }) {
  initDefaultKB(shopId);

  const id = `kb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const doc = { id, question, answer, category: category || 'general' };

  const docs = knowledgeStore.get(shopId);
  docs.push(doc);
  knowledgeStore.set(shopId, docs);

  logInfo({ module: 'knowledge', event: 'add', shopId, id, question: question.slice(0, 30) });
  return doc;
}

/**
 * 删除知识条目
 */
async function remove(shopId, docId) {
  const docs = knowledgeStore.get(shopId) || [];
  const filtered = docs.filter(d => d.id !== docId);
  knowledgeStore.set(shopId, filtered);
  logInfo({ module: 'knowledge', event: 'remove', shopId, docId });
}

module.exports = {
  search,
  list,
  add,
  remove,
};
