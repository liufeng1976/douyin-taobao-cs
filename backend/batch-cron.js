/**
 * Legacy polling entrypoint retained only so old scheduled tasks fail safely.
 *
 * Douyin/Taobao customer-service intake is webhook/message-service driven now.
 * This script performs no polling and no customer-facing action.
 */

console.warn('[douyin-taobao-cs] batch-cron.js is retired.');
console.warn('Use signed Douyin/Taobao callbacks -> BossAI Customer Service /api/connectors/intake.');
console.warn('No polling, AI reply, or external customer message was executed.');
process.exit(0);
