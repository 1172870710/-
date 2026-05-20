const { getShopItems, getPlayerInventory } = require('../../shared/items');

class NPC {
  constructor(id, personality, tileMap) {
    this.id = id;
    this.name = personality.name;
    this.job = personality.job;
    this.backstory = personality.backstory;

    // 位置：随机可行走坐标
    const pos = tileMap.getRandomWalkable();
    this.x = pos.x;
    this.y = pos.y;
    this.dir = 'down';
    this.moving = false;

    // 外观
    this.color = '#3498db'; // NPC 统一样式（后续可个性化）

    // 状态
    this.speed = 1;
    this.goal = null;
    this.emotion = 'neutral';
    this.currentAction = 'idle';
    this.currentTarget = null;

    // 商店和玩家互动
    this.shop = getShopItems(personality.job);
    this.gold = 10 + Math.floor(Math.random() * 30); // NPC 持有的金币

    // 战斗
    this.maxHp = 50 + Math.floor(Math.random() * 30); // 50-80
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
