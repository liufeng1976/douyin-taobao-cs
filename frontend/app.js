const API = '/api';

const $ = (id) => document.getElementById(id);

function setPill(id, text, state) {
  const element = $(id);
  element.textContent = text;
  element.className = `pill ${state || ''}`.trim();
}

async function api(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  let payload = {};
  try { payload = await response.json(); } catch { payload = {}; }
  if (!response.ok) {
    const error = new Error(payload.error || payload.message || `HTTP ${response.status}`);
    error.code = payload.code;
    throw error;
  }
  return payload;
}

async function loadStatus() {
  try {
    const data = await api('/integration/status');
    setPill('bridge-status', data.bridge?.configured ? '已配置' : '未配置', data.bridge?.configured ? 'ok' : 'block');
    setPill('douyin-status', data.channels?.douyin?.configured ? '已配置' : '未配置', data.channels?.douyin?.configured ? 'ok' : 'warn');
    setPill('taobao-status', data.channels?.taobao?.configured ? '已配置' : '未配置', data.channels?.taobao?.configured ? 'ok' : 'warn');
  } catch (error) {
    setPill('bridge-status', '无法读取', 'block');
    setPill('douyin-status', '无法读取', 'block');
    setPill('taobao-status', '无法读取', 'block');
  }
}

async function generateDraft() {
  const button = $('send-btn');
  const message = $('user-input').value.trim();
  const platform = $('platform-select').value;
  const shopId = $('shop-id').value.trim() || 'local-diagnostic';
  if (!message) return;

  button.disabled = true;
  button.textContent = '生成中…';
  $('draft-output').textContent = '正在生成受限草稿…';
  setPill('review-badge', '待生成', 'warn');

  try {
    $('draft-output').classList.remove('error');
    const data = await api('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, platform, shopId, customerId: 'local-diagnostic-customer' }),
    });
    $('draft-output').textContent = data.draft || data.reply || '未生成草稿。';
    $('draft-source').textContent = data.source || 'unknown';
    $('draft-risk').textContent = data.policy?.risk || 'unknown';
    $('draft-policy').textContent = data.policy?.policy || 'unknown';
    setPill('review-badge', data.reviewRequired ? '必须人工审核' : '待确认', data.reviewRequired ? 'warn' : 'block');
  } catch (error) {
    $('draft-output').textContent = `草稿生成失败：${error.message}`;
    $('draft-output').classList.add('error');
    $('draft-source').textContent = 'error';
    $('draft-risk').textContent = '—';
    $('draft-policy').textContent = error.code || 'request_failed';
    setPill('review-badge', '失败', 'block');
  } finally {
    button.disabled = false;
    button.textContent = '生成待审核草稿';
  }
}

async function loadKnowledge() {
  const shopId = $('shop-id').value.trim() || 'local-diagnostic';
  const list = $('faq-list');
  try {
    const data = await api(`/knowledge/${encodeURIComponent(shopId)}`);
    const items = data.documents || [];
    if (!items.length) {
      list.innerHTML = '<li class="faq-item"><div class="faq-a">暂无本地诊断知识。生产知识应由统一客服/知识权威提供。</div></li>';
      return;
    }
    list.innerHTML = items.map((item) => `
      <li class="faq-item">
        <div class="faq-q">${escapeHtml(item.question)}</div>
        <div class="faq-a">${escapeHtml(item.answer)}</div>
        <div class="faq-tools"><button data-delete-id="${escapeAttribute(item.id)}">删除</button></div>
      </li>`).join('');
    list.querySelectorAll('[data-delete-id]').forEach((button) => {
      button.addEventListener('click', () => deleteKnowledge(button.dataset.deleteId));
    });
  } catch (error) {
    list.innerHTML = `<li class="faq-item"><div class="faq-a error">读取失败：${escapeHtml(error.message)}</div></li>`;
  }
}

async function addKnowledge() {
  const shopId = $('shop-id').value.trim() || 'local-diagnostic';
  const question = $('new-question').value.trim();
  const answer = $('new-answer').value.trim();
  if (!question || !answer) return;
  try {
    await api(`/knowledge/${encodeURIComponent(shopId)}`, {
      method: 'POST',
      body: JSON.stringify({
        question,
        answer,
        category: 'operator-verified',
        provenance: 'local-diagnostic-console',
      }),
    });
    $('new-question').value = '';
    $('new-answer').value = '';
    await loadKnowledge();
  } catch (error) {
    window.alert(`添加失败：${error.message}`);
  }
}

async function deleteKnowledge(id) {
  try {
    const shopId = $('shop-id').value.trim() || 'local-diagnostic';
    await api(`/knowledge/${encodeURIComponent(shopId)}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await loadKnowledge();
  } catch (error) {
    window.alert(`删除失败：${error.message}`);
  }
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value ?? '');
  return div.innerHTML;
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

$('send-btn').addEventListener('click', generateDraft);
$('add-faq-btn').addEventListener('click', addKnowledge);
$('shop-id').addEventListener('change', loadKnowledge);
$('user-input').addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') generateDraft();
});

loadStatus();
loadKnowledge();
