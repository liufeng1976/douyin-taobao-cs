/**
 * Local adapter-management API authentication.
 * Webhook endpoints use platform signatures and do not pass through here.
 */

const API_KEYS = new Set(
  String(process.env.API_KEYS || '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean)
);

function isLoopback(req) {
  const ip = String(req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
  return ['127.0.0.1', '::1'].includes(ip) || ip === '';
}

function authenticate(req, res, next) {
  const localDevBypass = process.env.NODE_ENV !== 'production'
    && process.env.ALLOW_UNAUTHENTICATED_LOCAL !== 'false'
    && isLoopback(req);
  if (localDevBypass) return next();

  if (API_KEYS.size === 0) {
    return res.status(503).json({
      code: 'MANAGEMENT_API_AUTH_NOT_CONFIGURED',
      error: '管理 API 未配置 API_KEYS，已拒绝访问',
    });
  }

  const apiKey = String(req.headers['x-api-key'] || '').trim();
  if (!apiKey || !API_KEYS.has(apiKey)) {
    return res.status(401).json({ code: 'UNAUTHORIZED', error: '未授权访问' });
  }

  next();
}

module.exports = { authenticate, isLoopback };
