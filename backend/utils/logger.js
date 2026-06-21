const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function formatLog(level, data) {
  const ts = new Date().toISOString();
  const entry = { ts, level, ...data };
  return JSON.stringify(entry);
}

function logInfo(data) {
  const line = formatLog('INFO', data);
  console.log(line);
  appendToFile('info.log', line);
}

function logError(data) {
  const line = formatLog('ERROR', data);
  console.error(line);
  appendToFile('error.log', line);
}

function logWarn(data) {
  const line = formatLog('WARN', data);
  console.warn(line);
  appendToFile('warn.log', line);
}

function appendToFile(filename, line) {
  try {
    fs.appendFileSync(path.join(LOG_DIR, filename), line + '\n');
  } catch (_) {}
}

module.exports = { logInfo, logError, logWarn };
