/**
 * 店铺存储 (生产环境替换为 Prisma/数据库)
 */
const stores = new Map();

function initDefaults() {
  if (stores.size === 0) {
    stores.set('douyin-shop-001', {
      id: 'douyin-shop-001',
      name: '抖音旗舰店',
      platform: 'douyin',
      shopId: process.env.DOUYIN_SHOP_ID || 'your-douyin-shop-id',
      status: 'active',
    });
    stores.set('taobao-shop-001', {
      id: 'taobao-shop-001',
      name: '淘宝官方店',
      platform: 'taobao',
      shopId: 'your-taobao-shop-id',
      status: 'active',
    });
  }
}

async function listShops() {
  initDefaults();
  return Array.from(stores.values());
}

async function getShop(id) {
  initDefaults();
  return stores.get(id) || null;
}

module.exports = { listShops, getShop };
