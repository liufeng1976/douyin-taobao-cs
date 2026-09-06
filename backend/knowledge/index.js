/**
 * Local compatibility knowledge store.
 *
 * This is intentionally non-authoritative and process-local. Production
 * knowledge ownership belongs to canonical BossAI Customer Service / BossAI OS.
 * No invented default policies are injected here.
 */

const { logInfo, logError } = require('../utils/logger');

const knowledgeStore = new Map();

function ensureShop(shopId) {
  const key = String(shopId || 'default').trim() || 'default';
  if (!knowledgeStore.has(key)) knowledgeStore.set(key, []);
  return key;
}

function extractKeywords(value) {
  const text = String(value || '').toLowerCase().replace(/[，。？！、；："“”'‘’（）()\s]/g, ' ').trim();
  const tokens = new Set(text.split(/\s+/).filter((item) => item.length >= 2));
  const chinese = text.replace(/[^\u4e00-\u9fff]/g, '');
  for (let size = 2; size <= 4; size++) {
    for (let index = 0; index + size <= chinese.length; index++) tokens.add(chinese.slice(index, index + size));
  }
  return Array.from(tokens).slice(0, 80);
}

async function search(shopId, query) {
  try {
    const key = ensureShop(shopId);
    const docs = knowledgeStore.get(key) || [];
    if (!query || docs.length === 0) return [];

    const q = String(query).toLowerCase().trim();
    const keywords = extractKeywords(q);
    return docs
      .map((doc) => {
        const question = String(doc.question || '').toLowerCase();
        const answer = String(doc.answer || '').toLowerCase();
        let score = 0;
        if (question === q) score += 12;
        else if (question.includes(q) || q.includes(question)) score += 6;
        for (const keyword of keywords) {
          if (question.includes(keyword)) score += 2;
          if (answer.includes(keyword)) score += 1;
        }
        return { ...doc, score };
      })
      .filter((doc) => doc.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  } catch (error) {
    logError({ module: 'knowledge', event: 'search_error', error: error.message });
    return [];
  }
}

async function list(shopId) {
  const key = ensureShop(shopId);
  return knowledgeStore.get(key) || [];
}

async function add(shopId, { question, answer, category, provenance }) {
  const key = ensureShop(shopId);
  const q = String(question || '').trim();
  const a = String(answer || '').trim();
  if (!q || !a) throw Object.assign(new Error('question and answer are required'), { status: 400 });

  const id = `kb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const doc = {
    id,
    question: q.slice(0, 1000),
    answer: a.slice(0, 8000),
    category: String(category || 'general').trim().slice(0, 80),
    provenance: String(provenance || 'operator-entered-local-compatibility').trim().slice(0, 300),
    createdAt: new Date().toISOString(),
  };
  knowledgeStore.get(key).push(doc);
  logInfo({ module: 'knowledge', event: 'add', shopId: key, id, category: doc.category });
  return doc;
}

async function remove(shopId, docId) {
  const key = ensureShop(shopId);
  const docs = knowledgeStore.get(key) || [];
  const next = docs.filter((doc) => doc.id !== docId);
  knowledgeStore.set(key, next);
  const removed = next.length !== docs.length;
  logInfo({ module: 'knowledge', event: 'remove', shopId: key, docId, removed });
  return removed;
}

function status() {
  return {
    authority: 'local-compatibility-only',
    persistence: 'process-memory',
    productionKnowledgeAuthority: 'canonical-bossai-customer-service',
    defaultPoliciesInjected: false,
  };
}

module.exports = { search, list, add, remove, status, extractKeywords };
