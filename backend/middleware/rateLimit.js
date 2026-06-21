/**
 * 简易限流中间件
 */
const rateMap = new Map(); // ip -> {count, resetAt}

const MAX_REQUESTS = 100;  // 每分钟最大请求数
const WINDOW_MS = 60000;   // 1分钟窗口

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  let entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    rateMap.set(ip, entry);
  }

  entry.count++;

  if (entry.count > MAX_REQUESTS) {
    return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
  }

  next();
}

// 定期清理过期记录
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateMap) {
    if (now > entry.resetAt) rateMap.delete(ip);
  }
}, 60000);

module.exports = rateLimit;
