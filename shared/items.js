// 物品数据 —— 客户端和服务端共用
const ITEMS = {
  bread:   { name: '面包',   emoji: '🍞', price: 5,  desc: '刚烤好的面包，香喷喷的' },
  apple:   { name: '苹果',   emoji: '🍎', price: 3,  desc: '新鲜的红苹果，又甜又脆' },
  flower:  { name: '花束',   emoji: '🌸', price: 2,  desc: '一束美丽的野花' },
  fish:    { name: '鱼',     emoji: '🐟', price: 4,  desc: '刚钓上来的新鲜鱼' },
  gem:     { name: '宝石',   emoji: '💎', price: 20, desc: '闪闪发光的神秘宝石' },
  potion:  { name: '药水',   emoji: '🧪', price: 15, desc: '散发着微光的治疗药水' },
  scroll:  { name: '卷轴',   emoji: '📜', price: 25, desc: '写满古老文字的神秘卷轴' },
  meat:    { name: '烤肉',   emoji: '🍖', price: 8,  desc: '滋滋冒油的烤兽肉' },
  ring:    { name: '戒指',   emoji: '💍', price: 30, desc: '精致的银戒指' },
  cloth:   { name: '布料',   emoji: '🧶', price: 6,  desc: '柔软结实的布料' },
};

// 根据职业生成 NPC 的商店库存
function getShopItems(job) {
  const pool = {
    '面包师':   ['bread', 'apple', 'cloth'],
    '铁匠':     ['ring', 'gem', 'meat'],
    '商人':     Object.keys(ITEMS),      // 全品类
    '猎人':     ['meat', 'fish', 'cloth'],
    '药师':     ['potion', 'scroll', 'flower'],
    '农民':     ['bread', 'apple', 'flower'],
    '渔夫':     ['fish', 'bread', 'potion'],
    '酒馆老板': ['meat', 'bread', 'apple', 'fish'],
    '守卫':     ['meat', 'bread'],
    '裁缝':     ['cloth', 'flower', 'ring'],
    '木匠':     ['bread', 'apple', 'flower'],
    '学者':     ['scroll', 'potion', 'gem'],
    '吟游诗人': ['flower', 'ring', 'bread'],
    '流浪者':   ['bread', 'meat', 'apple'],
    '矿工':     ['gem', 'meat', 'bread'],
  };
  const itemKeys = pool[job] || ['bread', 'apple'];
  // 每个 NPC 库存 3-6 种，每种 1-5 个
  const count = Math.min(itemKeys.length, 3 + Math.floor(Math.random() * 4));
  const shuffled = [...itemKeys].sort(() => Math.random() - 0.5);
  const shop = {};
  for (let i = 0; i < count; i++) {
    const key = shuffled[i];
    shop[key] = {
      ...ITEMS[key],
      stock: 1 + Math.floor(Math.random() * 5),
    };
  }
  return shop;
}

// 玩家初始拥有的物品
function getPlayerInventory() {
  return {
    bread: { ...ITEMS.bread, stock: 2 },
    apple: { ...ITEMS.apple, stock: 1 },
    flower: { ...ITEMS.flower, stock: 1 },
  };
}

module.exports = { ITEMS, getShopItems, getPlayerInventory };
