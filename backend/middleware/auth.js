/**
 * API 认证中间件
 */
const crypto = require('crypto');

const API_KEYS = new Set(
  (process.env.API_KEYS || 'dev-key-001').split(',').map(k => k.trim())
);

function authenticate(req, res, next) {
  // 开发模式跳过
  if (process.env.NODE_ENV === 'development') return next();

  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey || !API_KEYS.has(apiKey)) {
    return res.status(401).json({ error: '未授权访问' });
  }

  req.shopId = req.headers['x-shop-id'] || 'default';
  next();
}

module.exports = { authenticate };
