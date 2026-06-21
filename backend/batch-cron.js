/**
 * 定时批量处理脚本
 * 用法: node backend/batch-cron.js [--platform=douyin,taobao]
 */
const http = require('http');
const PORT = process.env.PORT || 3000;
const API_KEY = 'dev-key-001';

const platforms = process.argv[2]
  ? process.argv[2].replace('--platform=', '').split(',')
  : ['douyin', 'taobao'];

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      'http://localhost:' + PORT + path,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let result = '';
        res.on('data', (c) => (result += c));
        res.on('end', () => resolve(JSON.parse(result)));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  const ts = new Date().toISOString();
  console.log('[' + ts + '] 批量处理开始, 平台: ' + platforms.join(', '));

  try {
    const result = await post('/api/batch-process', { platforms });
    console.log('结果:', JSON.stringify(result, null, 2));
    console.log('[' + ts + '] 批量处理完成');
  } catch (err) {
    console.error('[' + ts + '] 批量处理失败:', err.message);
    process.exit(1);
  }
}

run();