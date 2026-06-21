const { logError } = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logError({
    module: 'errorHandler',
    event: 'uncaught',
    error: err.message,
    stack: err.stack?.split('\n').slice(0, 3).join(' | '),
    url: req.url,
  });

  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? '服务器错误' : err.message,
  });
}

module.exports = errorHandler;
