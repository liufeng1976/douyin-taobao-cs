// AI 客服前端面板 JavaScript
const API = '/api';
const SHOP_ID = 'douyin-shop-001';

document.getElementById('send-btn').addEventListener('click', sendTestMessage);
document.getElementById('user-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') sendTestMessage();
});
document.getElementById('add-faq-btn').addEventListener('click', addFAQ);

async function sendTestMessage() {
  const input = document.getElementById('user-input');
  const platform = document.getElementById('platform-select').value;
  const message = input.value.trim();
  if (!message) return;

  appendMessage('user', message, platform);
  input.value = '';

  try {
    const res = await fetch(API + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'dev-key-001' },
      body: JSON.stringify({ message, platform, shopId: SHOP_ID, customerId: 'test-customer' }),
    });
    const data = await res.json();
    appendMessage('bot', data.reply || '抱歉，暂时无法回复。', platform);
  } catch (err) {
    appendMessage('bot', '网络错误，请重试。', platform);
  }
}

function appendMessage(role, text, platform) {
  const msgs = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  const badges = {
    douyin: '<span class="badge douyin">抖音</span>',
    taobao: '<span class="badge taobao">淘宝</span>'
  };
  const badge = badges[platform] || '';
  const prefix = role === 'user'
    ? '👤 客户 ' + badge
    : '🤖 AI 客服';
  div.innerHTML = '<div class="meta">' + prefix + '</div>' + escapeHtml(text);
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

async function loadFAQ() {
  try {
    const res = await fetch(API + '/knowledge/' + SHOP_ID, {
      headers: { 'x-api-key': 'dev-key-001' }
    });
    const data = await res.json();
    const list = document.getElementById('faq-list');
    list.innerHTML = (data.documents || []).map(function(d) {
      return '<li class="faq-item">' +
        '<div>' +
        '<div class="q">' + escapeHtml(d.question) + '</div>' +
        '<div class="a">' + escapeHtml(d.answer) + '</div>' +
        '</div>' +
        '<button onclick="deleteFAQ(\'' + d.id + '\')" style="background:none;border:none;cursor:pointer;color:#d63031;">✕</button>' +
        '</li>';
    }).join('') || '<li class="faq-item" style="color:#636e72">暂无 FAQ，添加几条吧～</li>';
  } catch (err) {
    console.error('加载 FAQ 失败', err);
  }
}

async function addFAQ() {
  const q = document.getElementById('new-question').value.trim();
  const a = document.getElementById('new-answer').value.trim();
  if (!q || !a) return alert('请填写问题和答案');

  try {
    await fetch(API + '/knowledge/' + SHOP_ID, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'dev-key-001' },
      body: JSON.stringify({ question: q, answer: a, category: 'general' }),
    });
    document.getElementById('new-question').value = '';
    document.getElementById('new-answer').value = '';
    loadFAQ();
  } catch (err) {
    alert('添加失败');
  }
}

async function deleteFAQ(id) {
  try {
    await fetch(API + '/knowledge/' + SHOP_ID + '/' + id, {
      method: 'DELETE',
      headers: { 'x-api-key': 'dev-key-001' }
    });
    loadFAQ();
  } catch (err) {
    alert('删除失败');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 初始化
loadFAQ();
setInterval(loadFAQ, 30000);