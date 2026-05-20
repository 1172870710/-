// 行为执行器 —— 将决策转为具体的游戏行为

const { TILE_SIZE } = require('../../shared/constants');

class BehaviorExecutor {
  constructor(tileMap) {
    this.tileMap = tileMap;
    // 记录 NPC 闲逛目标点
    this.wanderTargets = new Map();
  }

  // 执行决策（由 NPCBrain 每 500ms 调用）
  execute(npc, decision, world) {
    if (!decision) return;

    // 更新 NPC 情绪
    npc.emotion = decision.emotion || 'neutral';
    npc.currentAction = decision.action;
    npc.currentTarget = decision.target;
    if (decision.goal) npc.goal = decision.goal;

    // 根据动作类型执行
    switch (decision.action) {
      case 'wander': this._wander(npc); break;
      case 'approach': this._approach(npc, decision.target, world); break;
      case 'flee': this._flee(npc, decision.target, world); break;
      case 'talk': this._talk(npc, decision); break;
      case 'guard': this._guard(npc); break;
      case 'attack': this._approach(npc, decision.target, world); break;
      default: this._wander(npc); break;
    }
  }

  // 闲逛：走向随机点，到达后重新选点
  _wander(npc) {
    if (!this.wanderTargets.has(npc.id)) {
      this._newWanderTarget(npc);
    }

    const target = this.wanderTargets.get(npc.id);
    const dx = target.x - npc.x;
    const dy = target.y - npc.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < TILE_SIZE) {
      // 到达了，随机停顿 0-2 秒，再选新目标
      if (!target.paused) {
        target.paused = Date.now();
        target.pauseDuration = 500 + Math.random() * 1500;
        npc.moving = false;
        return;
      }
      if (Date.now() - target.paused < target.pauseDuration) {
        npc.moving = false;
        return;
      }
      this._newWanderTarget(npc);
      return;
    }

    // 走向目标
    const speed = npc.speed || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    let newX = npc.x + nx * speed;
    let newY = npc.y + ny * speed;

    if (this.tileMap.isWalkable(newX, npc.y)) npc.x = newX;
    if (this.tileMap.isWalkable(npc.x, newY)) npc.y = newY;

    npc.dir = Math.abs(nx) > Math.abs(ny)
      ? (nx > 0 ? 'right' : 'left')
      : (ny > 0 ? 'down' : 'up');
    npc.moving = true;
  }

  _newWanderTarget(npc) {
    const pos = this.tileMap.getRandomWalkable();
    this.wanderTargets.set(npc.id, {
      x: pos.x,
      y: pos.y,
      paused: null,
      pauseDuration: 0,
    });
  }

  // 靠近目标
  _approach(npc, targetId, world) {
    const target = this._findEntity(targetId, world);
    if (!target) {
      this._wander(npc);
      return;
    }

    const dx = target.x - npc.x;
    const dy = target.y - npc.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 距离小于 20 像素就停下
    if (dist < 20) {
      npc.moving = false;
      npc.dir = this._faceTarget(npc, target);
      return;
    }

    const speed = npc.speed || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    let newX = npc.x + nx * speed;
    let newY = npc.y + ny * speed;

    if (this.tileMap.isWalkable(newX, npc.y)) npc.x = newX;
    if (this.tileMap.isWalkable(npc.x, newY)) npc.y = newY;

    npc.dir = Math.abs(nx) > Math.abs(ny)
      ? (nx > 0 ? 'right' : 'left')
      : (ny > 0 ? 'down' : 'up');
    npc.moving = true;
  }

  // 逃跑
  _flee(npc, targetId, world) {
    const target = this._findEntity(targetId, world);
    if (!target) {
      this._wander(npc);
      return;
    }

    const dx = npc.x - target.x;
    const dy = npc.y - target.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 跑远了就停
    if (dist > 120) {
      npc.moving = false;
      return;
    }

    const speed = npc.speed || 1;
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : -1;
    let newX = npc.x + nx * speed;
    let newY = npc.y + ny * speed;

    if (this.tileMap.isWalkable(newX, npc.y)) npc.x = newX;
    if (this.tileMap.isWalkable(npc.x, newY)) npc.y = newY;

    npc.dir = Math.abs(nx) > Math.abs(ny)
      ? (nx > 0 ? 'right' : 'left')
      : (ny > 0 ? 'down' : 'up');
    npc.moving = true;
  }

  // 说话（原地停止，对话内容广播）
  _talk(npc, decision) {
    npc.moving = false;
    // 如果有目标，面向目标
    if (decision.target && this._lastTargetPos) {
      npc.dir = this._faceTarget(npc, this._lastTargetPos);
    }
    // 对话内容由 NPCBrain 处理（通过 socket 广播）
  }

  // 守卫：在当前位置周围小幅巡逻
  _guard(npc) {
    if (!this.wanderTargets.has(npc.id)) {
      const angle = Math.random() * Math.PI * 2;
      const r = 30;
      this.wanderTargets.set(npc.id, {
        x: npc.x + Math.cos(angle) * r,
        y: npc.y + Math.sin(angle) * r,
        paused: null,
        pauseDuration: 0,
      });
    }
    this._wander(npc); // 复用闲逛逻辑，但范围小
  }

  // 找到世界中的实体
  _findEntity(id, world) {
    if (!id) return null;
    return world.players.get(id) || world.npcs.get(id) || null;
  }

  _faceTarget(npc, target) {
    const dx = target.x - npc.x;
    const dy = target.y - npc.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  }
}

module.exports = BehaviorExecutor;
