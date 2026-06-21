/**
 * AI 客服嵌入组件 (Widget)
 * 可嵌入到抖音/淘宝店铺页面的浮动客服按钮
 * 使用方式: <script src="/widget/embed.js" data-shop-id="xxx" data-platform="douyin"></script>
 */
(function () {
  var script = document.currentScript;
  var shopId = script.getAttribute('data-shop-id') || 'default';
  var apiBase = script.getAttribute('data-api') || '/api';
  var platform = script.getAttribute('data-platform') || 'douyin';

  if (document.getElementById('ai-cs-widget')) return;

  // CSS styles
  var style = document.createElement('style');
  style.textContent = [
    '#ai-cs-widget * { box-sizing: border-box; }',
    '#ai-cs-widget .cs-btn { position:fixed; bottom:80px; right:20px; z-index:99999; width:60px; height:60px; border-radius:50%; border:none; background:linear-gradient(135deg,#667eea,#764ba2); color:white; font-size:28px; cursor:pointer; box-shadow:0 4px 16px rgba(102,126,234,0.4); display:flex; align-items:center; justify-content:center; transition:transform 0.2s; }',
    '#ai-cs-widget .cs-btn:hover { transform:scale(1.1); }',
    '#ai-cs-widget .cs-panel { position:fixed; bottom:150px; right:20px; z-index:99999; width:360px; height:500px; background:white; border-radius:16px; box-shadow:0 8px 32px rgba(0,0,0,0.15); display:none; flex-direction:column; overflow:hidden; font-family:-apple-system,sans-serif; }',
    '#ai-cs-widget .cs-panel.open { display:flex; }',
    '#ai-cs-widget .cs-header { background:linear-gradient(135deg,#667eea,#764ba2); color:white; padding:16px; font-weight:600; display:flex; justify-content:space-between; align-items:center; }',
    '#ai-cs-widget .cs-body { flex:1; overflow-y:auto; padding:12px; background:#f9fafb; }',
    '#ai-cs-widget .cs-message { margin-bottom:10px; max-width:85%; padding:10px 14px; border-radius:12px; font-size:14px; line-height:1.5; word-break:break-word; }',
    '#ai-cs-widget .cs-message.agent { background:white; color:#333; border:1px solid #e5e7eb; }',
    '#ai-cs-widget .cs-message.user { background:#667eea; color:white; margin-left:auto; }',
    '#ai-cs-widget .cs-input-row { display:flex; padding:10px; border-top:1px solid #e5e7eb; background:white; }',
    '#ai-cs-widget .cs-input-row input { flex:1; padding:10px 14px; border:1px solid #e5e7eb; border-radius:20px; outline:none; font-size:14px; }',
    '#ai-cs-widget .cs-input-row button { margin-left:8px; padding:10px 16px; background:#667eea; color:white; border:none; border-radius:20px; cursor:pointer; font-size:14px; font-weight:600; }',
    '@media (max-width:480px) { #ai-cs-widget .cs-panel { width:100vw; height:100vh; bottom:0; right:0; border-radius:0; } }'
  ].join('\n');
  document.head.appendChild(style);

  // HTML structure
  var container = document.createElement('div');
  container.id = 'ai-cs-widget';
  container.innerHTML =
    '<button class="cs-btn" id="cs-toggle">\u{1F4AC}</button>' +
    '<div class="cs-panel" id="cs-panel">' +
    '<div class="cs-header">' +
    '<span>\u{1F916} AI 智能客服</span>' +
    '<span style="cursor:pointer" id="cs-close">✕</span>' +
    '</div>' +
    '<div class="cs-body" id="cs-body">' +
    '<div class="cs-message agent">\u{1F44B} 您好！我是AI客服，有什么可以帮您的？</div>' +
    '</div>' +
    '<div class="cs-input-row">' +
    '<input type="text" id="cs-input" placeholder="输入您的问题...">' +
    '<button id="cs-send">发送</button>' +
    '</div>' +
    '</div>';
  document.body.appendChild(container);

  // Elements
  var panel = document.getElementById('cs-panel');
  var body = document.getElementById('cs-body');
  var input = document.getElementById('cs-input');

  // Events
  document.getElementById('cs-toggle').onclick = function() {
    panel.classList.toggle('open');
  };
  document.getElementById('cs-close').onclick = function() {
    panel.classList.remove('open');
  };
  input.onkeydown = function(e) {
    if (e.key === 'Enter') document.getElementById('cs-send').click();
  };

  // Send message
  function sendMessage() {
    var text = input.value.trim();
    if (!text) return;
    appendMsg('user', text);
    input.value = '';

    fetch(apiBase + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        platform: platform,
        shopId: shopId,
        customerId: getCustomerId()
      }),
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      appendMsg('agent', d.reply || '抱歉，请稍后再试。');
    })
    .catch(function() {
      appendMsg('agent', '网络开小差了，请重试 \u{1F605}');
    });
  }

  function appendMsg(role, text) {
    var div = document.createElement('div');
    div.className = 'cs-message ' + role;
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  function getCustomerId() {
    var id = localStorage.getItem('ai_cs_customer_id');
    if (!id) {
      id = 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem('ai_cs_customer_id', id);
    }
    return id;
  }

  document.getElementById('cs-send').onclick = sendMessage;
})();