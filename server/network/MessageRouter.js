// 消息路由器 — 传输无关的业务逻辑
// WebSocket、TCP、管道……任何传输层都可以对接

const { MSG } = require('./Protocol');
const { bus, EVENTS } = require('../core/EventBus');

class MessageRouter {
  /**
   * @param {GameWorld} world 游戏世界实例
   */
  constructor(world) {
    this.world = world;

    // 由传输层注入的回调
    this.onSend      = null;  // (playerId, { type, data }) => void
    this.onBroadcast = null;  // ({ type, data }, excludePlayerId?) => void
  }

  // ======================== 入口 ========================

  /**
   * 传输层收到消息后调用此方法
   * @param {string} playerId
   * @param {object} msg { type, data }
   */
  handle(playerId, msg) {
    switch (msg.type) {
      case MSG.PLAYER_JOIN:      return this._handleJoin(playerId, msg.data);
      case MSG.PLAYER_MOVE:      return this._handleMove(playerId, msg.data);
      case MSG.PLAYER_UPDATE:    return this._handleUpdate(playerId, msg.data);
      case MSG.NPC_INTERACT:     return this._handleNPCInteract(playerId, msg.data);
      case MSG.PLAYER_ATTACK:    return this._handleAttack(playerId, msg.data);
      case MSG.DEV_COMMAND:      return this._handleDevCommand(playerId, msg.data);
      case MSG.CHAT_SEND:        return this._handleChat(playerId, msg.data);
      default:
        this._reply(playerId, MSG.ERROR, { msg: `未知消息类型: ${msg.type}` });
    }
  }

  /** 传输层在收到 Join 消息时调用，创建玩家并返回 */
  handlePlayerJoin(tempId, name, color) {
    const player = this.world.addPlayer(tempId, name, color);
    return player;
  }

  /** 玩家断开连接时调用 */
  handleDisconnect(playerId) {
    const player = this.world.players.get(playerId);
    if (!player) return;
    this.world.removePlayer(playerId);
    this._broadcast(MSG.PLAYER_LEFT, { id: playerId });
    bus.emit(EVENTS.PLAYER_LEFT, { playerId, playerName: player.name });
  }

  // ======================== 广播辅助 ========================

  /** 公开广播方法（供 index.js 等使用，无需猴子补丁） */
  broadcast(type, data) {
    this._broadcast(type, data);
  }

  broadcastState() {
    if (this.world.players.size === 0) return;
    this._broadcast(MSG.ENTITIES_UPDATE, {
      players: this.world.getPlayerSnapshots(),
      npcs: this.world.getNPCSnapshots(),
    });
  }

  broadcastNPCDialogue(dialogue) {
    this._broadcast(MSG.NPC_DIALOGUE, dialogue);
  }

  // ======================== 消息处理 ========================

  _handleJoin(playerId, data) {
    const name  = (data && data.name)  || '无名';
    const color = (data && data.color) || null;
    const player = this.world.addPlayer(playerId, name, color);

    console.log(`  ${name} 加入了世界，位置: ${Math.round(player.x)},${Math.round(player.y)}`);

    this._reply(playerId, MSG.INIT_DONE, {
      yourId: player.id,
      world:  this.world.getWorldSnapshot(),
      gold:   this.world.getPlayerGold(player.id),
    });

    this._broadcast(MSG.PLAYER_JOINED, player.toSnapshot(), playerId);
    bus.emit(EVENTS.PLAYER_JOINED, { playerId, player });
  }

  _handleMove(playerId, data) {
    if (!data) return;
    this.world.updatePlayerPosition(playerId, data.x, data.y, data.dir, data.moving);
  }

  _handleUpdate(playerId, data) {
    const player = this.world.players.get(playerId);
    if (!player) return;
    if (player.updateAppearance(data)) {
      this._broadcast(MSG.PLAYER_UPDATED, { id: playerId, name: player.name, color: player.color });
    }
  }

  async _handleNPCInteract(playerId, data) {
    const player = this.world.players.get(playerId);
    if (!player) return;

    const { npcId, type, text, itemKey, quantity } = data || {};
    const npc = this.world.npcs.get(npcId);
    if (!npc) {
      this._reply(playerId, MSG.NPC_INTERACT_RESP, { ok: false, msg: 'NPC 不存在' });
      return;
    }

    // 距离检查
    const dx = npc.x - player.x;
    const dy = npc.y - player.y;
    if (Math.sqrt(dx * dx + dy * dy) > 80) {
      this._reply(playerId, MSG.NPC_INTERACT_RESP, { ok: false, msg: '太远了，走近点' });
      return;
    }

    let result;
    switch (type) {
      case 'talk':
        result = await this.world.handleNPCTalk(npcId, playerId, text || '');
        this._reply(playerId, MSG.NPC_INTERACT_RESP, {
          ok: true, type: 'talk', npcName: npc.name, npcJob: npc.job,
          text: result.text, emotion: result.emotion,
        });
        break;

      case 'gift':
        result = this.world.handleNPCGift(npcId, playerId, itemKey);
        if (result) {
          this._reply(playerId, MSG.NPC_INTERACT_RESP, {
            ok: result.ok, type: 'gift', msg: result.msg,
            reaction: result.reaction || '', npcName: npc.name,
          });
        }
        break;

      case 'shop':
        this._reply(playerId, MSG.NPC_INTERACT_RESP, {
          ok: true, type: 'shop',
          shop: this.world.getNPCShop(npcId),
          gold: this.world.getPlayerGold(playerId),
          npcName: npc.name, npcJob: npc.job,
        });
        break;

      case 'buy': {
        const qty = quantity || 1;
        result = this.world.handleNPCTradeBuy(npcId, playerId, itemKey, qty);
        this._reply(playerId, MSG.NPC_INTERACT_RESP, {
          ok: result?.ok || false, type: 'buy', msg: result?.msg || '交易失败',
          gold: this.world.getPlayerGold(playerId),
        });
        break;
      }

      case 'sell': {
        const qty = quantity || 1;
        result = this.world.handleNPCTradeSell(npcId, playerId, itemKey, qty);
        this._reply(playerId, MSG.NPC_INTERACT_RESP, {
          ok: result?.ok || false, type: 'sell', msg: result?.msg || '交易失败',
          gold: this.world.getPlayerGold(playerId),
        });
        break;
      }

      default:
        this._reply(playerId, MSG.NPC_INTERACT_RESP, { ok: false, msg: '未知交互类型' });
    }
  }

  _handleAttack(playerId, data) {
    const player = this.world.players.get(playerId);
    if (!player || !player.isAlive()) return;

    const dir = (data && data.dir) || player.dir;
    const targets = this.world.findAttackTargets(playerId, dir);

    if (targets) {
      const result = this.world.applyAttack(playerId, targets);
      this._reply(playerId, MSG.ATTACK_RESULT, result);

      // 如果目标被击中，通知目标
      if (result.hit && result.targetId) {
        if (targets.isPlayer) {
          const targetPlayer = this.world.players.get(result.targetId);
          this._reply(result.targetId, MSG.ATTACKED, {
            attackerId:   playerId,
            attackerName: player.name,
            damage:       result.damage,
            myHp:         targetPlayer ? targetPlayer.hp : 0,
            myMaxHp:      targetPlayer ? targetPlayer.maxHp : 100,
          });
        }
      }
    }
  }

  _handleDevCommand(playerId, data) {
    const player = this.world.players.get(playerId);
    if (!player) return;

    switch (data.cmd) {
      case 'set_hp': {
        const v = parseInt(data.value);
        if (!isNaN(v) && v >= 0) {
          player.hp = Math.min(player.maxHp, v);
          this._reply(playerId, MSG.DEV_UPDATE, { hp: player.hp });
        }
        break;
      }
      case 'set_speed': {
        const s = parseFloat(data.value);
        if (!isNaN(s) && s > 0 && s <= 20) {
          player.customSpeed = s;
          this._reply(playerId, MSG.DEV_UPDATE, { customSpeed: s });
        }
        break;
      }
      case 'set_damage': {
        const d = parseFloat(data.value);
        if (!isNaN(d) && d > 0 && d <= 200) {
          player.customDamage = d;
          this._reply(playerId, MSG.DEV_UPDATE, { customDamage: d });
        }
        break;
      }
      case 'heal_all':
        for (const p of this.world.players.values()) p.hp = p.maxHp;
        this._reply(playerId, MSG.DEV_UPDATE, { msg: '所有玩家已恢复' });
        break;
      case 'hp_all_npcs':
        for (const n of this.world.npcs.values()) n.hp = n.maxHp;
        this._reply(playerId, MSG.DEV_UPDATE, { msg: '所有 NPC 已恢复' });
        break;
    }
  }

  _handleChat(playerId, data) {
    const player = this.world.players.get(playerId);
    if (!player) return;
    this._broadcast(MSG.CHAT_BROADCAST, {
      fromId: playerId, fromName: player.name,
      text: (data && data.text) || '', time: Date.now(),
    });
  }

  // ======================== 内部 ========================

  _reply(playerId, type, data) {
    if (this.onSend) this.onSend(playerId, { type, data });
  }

  _broadcast(type, data, excludePlayerId) {
    if (this.onBroadcast) this.onBroadcast({ type, data }, excludePlayerId);
  }
}

module.exports = MessageRouter;
