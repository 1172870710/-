const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#2c3e50'];

class Player {
  constructor(id, name, x, y, color) {
    this.id = id;
    this.name = name || '无名';
    this.x = x;
    this.y = y;
    this.dir = 'down';   // up | down | left | right
    this.moving = false;
    this.color = color || this.randomColor();
    this.gold = 50; // 初始金币
    this.maxHp = 100;
    this.hp = 100;
    this.hpRegenTimer = 0;   // 回血计时（受伤 5 秒后开始）
    this.hpRegenDelay = 5000;
    this.lastHitTime = 0;
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.lastHitTime = Date.now();
    return this.hp <= 0; // true = 死亡
  }

  isAlive() {
    return this.hp > 0;
  }

  regenTick() {
    if (this.hp >= this.maxHp) return;
    if (Date.now() - this.lastHitTime < this.hpRegenDelay) return;
    this.hp = Math.min(this.maxHp, this.hp + 0.5); // 每 tick 回 0.5
  }

  randomColor() {
    return PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
  }

  // 更新外观（名字/颜色），返回是否真的有变化
  updateAppearance(data) {
    let changed = false;
    if (data.name && data.name.trim() && data.name !== this.name) {
      this.name = data.name.trim();
      changed = true;
    }
    if (data.color && PLAYER_COLORS.includes(data.color) && data.color !== this.color) {
      this.color = data.color;
      changed = true;
    }
    return changed;
  }

  toSnapshot() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      dir: this.dir,
      moving: this.moving,
      color: this.color,
      hp: this.hp,
      maxHp: this.maxHp,
    };
  }
}

module.exports = Player;
