const { getShopItems, getPlayerInventory, ITEMS } = require('../../shared/items');

// 从物品键列表构建商店数据（JSON 中指定 shop 时使用）
function buildShopFromList(itemKeys) {
  const shop = {};
  for (const key of itemKeys) {
    const def = ITEMS[key];
    if (def) {
      shop[key] = {
        ...def,
        stock: 1 + Math.floor(Math.random() * 5),
      };
    }
  }
  return shop;
}

class NPC {
  constructor(npcData, tileMap) {
    this.id = npcData.id;
    this.name = npcData.name;
    this.job = npcData.job;
    this.backstory = npcData.backstory;

    // 位置：随机可行走坐标
    const pos = tileMap.getRandomWalkable();
    this.x = pos.x;
    this.y = pos.y;
    this.dir = 'down';
    this.moving = false;

    // 外观
    this.color = npcData.color || '#3498db';

    // 状态
    this.speed = 1;
    this.goal = null;
    this.emotion = 'neutral';
    this.currentAction = 'idle';
    this.currentTarget = null;

    // 商店（JSON 指定优先，否则按职业自动生成）
    this.shop = npcData.shop ? buildShopFromList(npcData.shop) : getShopItems(npcData.job);
    this.gold = 10 + Math.floor(Math.random() * 30);

    // 战斗
    this.maxHp = 50 + Math.floor(Math.random() * 30);
    this.hp = this.maxHp;
    this.lastHitTime = 0;

    this.lastThinkTime = 0;
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.lastHitTime = Date.now();
    this.emotion = 'angry';
    return this.hp <= 0;
  }

  isAlive() {
    return this.hp > 0;
  }

  // 获取商店信息（给客户端）
  getShopForClient() {
    const items = {};
    for (const [key, item] of Object.entries(this.shop)) {
      items[key] = {
        name: item.name,
        emoji: item.emoji,
        price: item.price,
        desc: item.desc,
        stock: item.stock,
      };
    }
    return items;
  }

  toSnapshot() {
    return {
      id: this.id,
      name: this.name,
      job: this.job,
      x: this.x,
      y: this.y,
      dir: this.dir,
      moving: this.moving,
      color: this.color,
      emotion: this.emotion,
      isNPC: true,
      hp: this.hp,
      maxHp: this.maxHp,
    };
  }
}

module.exports = NPC;
