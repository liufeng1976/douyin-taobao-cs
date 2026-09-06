/**
 * Channel configuration projection only.
 *
 * This repository does not own merchant/shop master data. It exposes the
 * minimum local configuration state needed to diagnose inbound adapters.
 */

function configured(value) {
  return Boolean(String(value || '').trim());
}

async function listShops() {
  const douyinAccountRef = String(process.env.DOUYIN_ACCOUNT_REF || process.env.DOUYIN_SHOP_ID || '').trim();
  const taobaoAccountRef = String(process.env.TAOBAO_ACCOUNT_REF || '').trim();

  return [
    {
      id: 'douyin-channel',
      name: '抖音电商渠道',
      platform: 'douyin',
      accountRef: douyinAccountRef || null,
      configured: configured(process.env.DOUYIN_APP_KEY)
        && configured(process.env.DOUYIN_APP_SECRET)
        && configured(douyinAccountRef),
      authority: 'channel-configuration-only',
    },
    {
      id: 'taobao-channel',
      name: String(process.env.TAOBAO_CHANNEL || '').toLowerCase() === 'tmall' ? '天猫/千牛渠道' : '淘宝/千牛渠道',
      platform: String(process.env.TAOBAO_CHANNEL || 'taobao').toLowerCase() === 'tmall' ? 'tmall' : 'taobao',
      accountRef: taobaoAccountRef || null,
      configured: configured(process.env.TAOBAO_APP_KEY)
        && configured(process.env.TAOBAO_APP_SECRET)
        && configured(taobaoAccountRef),
      authority: 'channel-configuration-only',
    },
  ];
}

async function getShop(id) {
  const items = await listShops();
  return items.find((item) => item.id === id || item.accountRef === id) || null;
}

module.exports = { listShops, getShop };
