// 战斗系统 — 攻击判定、伤害计算、复活逻辑
const { bus, EVENTS } = require('../core/EventBus');

const ATTACK_RANGE = 40;
const HIT_SIZE = 28;

class CombatSystem {
  /**
   * @param {object} opts
   * @param {Map} opts.players  — GameWorld.players
   * @param {Map} opts.npcs     — GameWorld.npcs
   * @param {Map} opts.npcBrains — GameWorld.npcBrains
   * @param {TileMap} opts.tileMap
   */
  constructor({ players, npcs, npcBrains, tileMap }) {
    this.players = players;
    this.npcs = npcs;
    this.npcBrains = npcBrains;
    this.tileMap = tileMap;
  }

  /**
   * 找到攻击目标（攻击者朝向的前方区域）
   * @returns {object|null} { targetId, targetX, targetY, isPlayer }
   */
  findTargets(attackerId, dir) {
    const attacker = this.players.get(attackerId);
    if (!attacker || !attacker.isAlive()) return null;

    const attackX = attacker.x + (dir === 'right' ? ATTACK_RANGE : dir === 'left' ? -ATTACK_RANGE : 0);
    const attackY = attacker.y + (dir === 'down' ? ATTACK_RANGE : dir === 'up' ? -ATTACK_RANGE : 0);

    // 先找 NPC
    for (const [npcId, npc] of this.npcs) {
      if (!npc.isAlive()) continue;
      const dx = npc.x - attackX;
      const dy = npc.y - attackY;
      if (Math.abs(dx) < HIT_SIZE && Math.abs(dy) < HIT_SIZE) {
        return { targetId: npcId, targetX: npc.x, targetY: npc.y, isPlayer: false, npc: true };
      }
    }

    // 再找其他玩家
    for (const [pid, p] of this.players) {
      if (pid === attackerId || !p.isAlive()) continue;
      const dx = p.x - attackX;
      const dy = p.y - attackY;
      if (Math.abs(dx) < HIT_SIZE && Math.abs(dy) < HIT_SIZE) {
        return { targetId: pid, targetX: p.x, targetY: p.y, isPlayer: true, npc: false };
      }
    }

    return null;
  }

  /**
   * 执行攻击
   */
  apply(attackerId, targets) {
    const attacker = this.players.get(attackerId);
    if (!attacker) return { hit: false };

    const damage = attacker.customDamage || 15;

    const result = {
      hit: true, damage, targetId: targets.targetId,
      x: targets.targetX, y: targets.targetY,
      myHp: attacker.hp, myMaxHp: attacker.maxHp,
    };

    if (targets.isPlayer) {
      this._applyToPlayer(attacker, targets, damage, result);
    } else {
      this._applyToNPC(attacker, targets, damage, result);
    }

    return result;
  }

  // ======================== 内部 ========================

  _applyToPlayer(attacker, targets, damage, result) {
    const target = this.players.get(targets.targetId);
    if (!target || !target.isAlive()) {
      result.hit = false;
      return;
    }

    const died = target.takeDamage(damage);
    result.msg = died ? `击败了 ${target.name}！` : `攻击了 ${target.name}（-${damage}HP）`;
    result.died = died;

    if (died) {
      setTimeout(() => {
        const pos = this.tileMap.getRandomWalkable();
        target.x = pos.x;
        target.y = pos.y;
        target.hp = target.maxHp;
        target.lastHitTime = Date.now();
      }, 3000);
    }
  }

  _applyToNPC(attacker, targets, damage, result) {
    const npc = this.npcs.get(targets.targetId);
    if (!npc || !npc.isAlive()) {
      result.hit = false;
      return;
    }

    const died = npc.takeDamage(damage);
    const brain = this.npcBrains.get(targets.targetId);
    if (brain) {
      brain.onAttacked(attacker.id, attacker.name);
    }

    result.msg = died ? `${npc.name} 倒下了！` : `攻击了 ${npc.name}（-${damage}HP）`;
    result.died = died;
    result.npcName = npc.name;

    if (died) {
      setTimeout(() => {
        const pos = this.tileMap.getRandomWalkable();
        npc.x = pos.x;
        npc.y = pos.y;
        npc.hp = npc.maxHp;
        npc.emotion = 'neutral';
      }, 5000);
    }
  }
}

module.exports = CombatSystem;
