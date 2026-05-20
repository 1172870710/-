// WebSocket 事件处理 —— Godot 客户端专用
// 协议：JSON 消息 { type: 'event-name', data: {...} }

const { WebSocketServer } = require('ws');

class WebSocketHandler {
  constructor(gameWorld, port = 3002) {
    this.world = gameWorld;
    this.wss = new WebSocketServer({ port });
    // ws → playerId 映射
    this.socketMap = new Map();

    console.log(`  WebSocket 服务已启动: ws://localhost:${port}`);

    this.wss.on('connection', (ws) => {
      console.log(`  Godot 客户端连接`);

      ws.on('message', (raw) => {
        let msg;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          this._send(ws, { type: 'error', data: { msg: '无效的 JSON' } });
          return;
        }
        this._handle(ws, msg.type, msg.data || {});
      });

      ws.on('close', () => {
        const playerId = this.socketMap.get(ws);
        if (playerId) {
          const player = this.world.players.get(playerId);
          if (player) {
            console.log(`  Godot 玩家离开: ${player.name}`);
            this.world.removePlayer(playerId);
            this._broadcast({ type: 'player-left', data: { id: playerId } });
          }
          this.socketMap.delete(ws);
        }
      });
    });
  }

  _handle(ws, type, data) {
    switch (type) {
      // ---- 加入世界 ----
      case 'player-join': {
        const name = data.name || '无名';
        const color = data.color || null;
        const player = this.world.addPlayer(ws.id || `godot_${Date.now()}`, name, color);
        ws.id = player.id;
        this.socketMap.set(ws, player.id);

        console.log(`  ${name} 加入了世界（Godot），位置: ${Math.round(player.x)},${Math.round(player.y)}`);

        this._send(ws, {
          type: 'init-done',
          data: {
            yourId: player.id,
            world: this.world.getWorldSnapshot(),
            gold: this.world.getPlayerGold(player.id),
          },
        });

        this._broadcast({ type: 'player-joined', data: player.toSnapshot() }, ws);
        break;
      }

      // ---- 位置更新 ----
      case 'player-move': {
        const p = this.world.players.get(this.socketMap.get(ws));
        if (!p) return;
        this.world.updatePlayerPosition(p.id, data.x, data.y, data.dir, data.moving);
        break;
      }

      // ---- NPC 交互 ----
      case 'npc-interact': {
        this._handleNPCInteract(ws, data);
        break;
      }

      // ---- 攻击 ----
      case 'player-attack': {
        this._handleAttack(ws, data);
        break;
      }

      // ---- 开发者模式 ----
      case 'dev-command': {
        this._handleDevCommand(ws, data);
        break;
      }

      // ---- 聊天 ----
      case 'chat-send': {
        const player = this.world.players.get(this.socketMap.get(ws));
        if (!player) return;
        this._broadcast({
          type: 'chat-broadcast',
          data: { fromId: player.id, fromName: player.name, text: data.text || '', time: Date.now() },
        });
        break;
      }
    }
  }

  async _handleNPCInteract(ws, data) {
    const playerId = this.socketMap.get(ws);
    const player = this.world.players.get(playerId);
    if (!player) return;

    const { npcId, type, text, itemKey, quantity } = data || {};
    const npc = this.world.npcs.get(npcId);
    if (!npc) {
      this._send(ws, { type: 'npc-interact-response', data: { ok: false, msg: 'NPC 不存在' } });
      return;
    }

    // 距离检查
    const dx = npc.x - player.x;
    const dy = npc.y - player.y;
    if (Math.sqrt(dx * dx + dy * dy) > 80) {
      this._send(ws, { type: 'npc-interact-response', data: { ok: false, msg: '太远了，走近点' } });
      return;
    }

    let result;
    switch (type) {
      case 'talk':
        result = await this.world.handleNPCTalk(npcId, playerId, text || '');
        this._send(ws, {
          type: 'npc-interact-response',
          data: { ok: true, type: 'talk', npcName: npc.name, npcJob: npc.job, text: result.text, emotion: result.emotion },
        });
        break;

      case 'gift':
        result = this.world.handleNPCGift(npcId, playerId, itemKey);
        if (result) {
          this._send(ws, {
            type: 'npc-interact-response',
            data: { ok: result.ok, type: 'gift', msg: result.msg, reaction: result.reaction || '', npcName: npc.name },
          });
        }
        break;

      case 'shop':
        const shop = this.world.getNPCShop(npcId);
        this._send(ws, {
          type: 'npc-interact-response',
          data: { ok: true, type: 'shop', shop, gold: this.world.getPlayerGold(playerId), npcName: npc.name, npcJob: npc.job },
        });
        break;

      default:
        this._send(ws, { type: 'npc-interact-response', data: { ok: false, msg: '未知交互类型' } });
    }
  }

  _handleAttack(ws, data) {
    const player = this.world.players.get(this.socketMap.get(ws));
    if (!player || !player.isAlive()) return;

    const dir = data.dir || player.dir;
    const targets = this.world.findAttackTargets(player.id, dir);
    if (targets) {
      const result = this.world.applyAttack(player.id, targets);
      this._send(ws, { type: 'attack-result', data: result });
      if (result.hit && result.targetId) {
        // 通知被攻击的玩家（如果是玩家）
        for (const [w, pid] of this.socketMap) {
          if (pid === result.targetId) {
            const targetPlayer = this.world.players.get(result.targetId);
            this._send(w, {
              type: 'attacked',
              data: { attackerId: player.id, attackerName: player.name, damage: result.damage,
                myHp: targetPlayer ? targetPlayer.hp : 0, myMaxHp: targetPlayer ? targetPlayer.maxHp : 100 },
            });
            break;
          }
        }
      }
    }
  }

  _handleDevCommand(ws, data) {
    const player = this.world.players.get(this.socketMap.get(ws));
    if (!player) return;

    switch (data.cmd) {
      case 'set_hp': {
        const v = parseInt(data.value);
        if (!isNaN(v) && v >= 0) { player.hp = Math.min(player.maxHp, v); this._send(ws, { type: 'dev-update', data: { hp: player.hp } }); }
        break;
      }
      case 'set_speed': {
        const s = parseFloat(data.value);
        if (!isNaN(s) && s > 0 && s <= 20) { player.customSpeed = s; this._send(ws, { type: 'dev-update', data: { customSpeed: s } }); }
        break;
      }
      case 'set_damage': {
        const d = parseFloat(data.value);
        if (!isNaN(d) && d > 0 && d <= 200) { player.customDamage = d; this._send(ws, { type: 'dev-update', data: { customDamage: d } }); }
        break;
      }
      case 'heal_all':
        for (const p of this.world.players.values()) p.hp = p.maxHp;
        this._send(ws, { type: 'dev-update', data: { msg: '所有玩家已恢复' } });
        break;
      case 'hp_all_npcs':
        for (const n of this.world.npcs.values()) n.hp = n.maxHp;
        this._send(ws, { type: 'dev-update', data: { msg: '所有 NPC 已恢复' } });
        break;
    }
  }

  // 广播世界状态到所有 Godot 客户端
  broadcastState() {
    if (this.socketMap.size === 0) return;
    const msg = JSON.stringify({
      type: 'entities-update',
      data: { players: this.world.getPlayerSnapshots(), npcs: this.world.getNPCSnapshots() },
    });
    for (const [ws] of this.socketMap) {
      if (ws.readyState === 1) ws.send(msg);
    }
  }

  // 广播 NPC 对话
  broadcastNPCDialogue(dialogue) {
    const msg = JSON.stringify({ type: 'npc-dialogue', data: dialogue });
    for (const [ws] of this.socketMap) {
      if (ws.readyState === 1) ws.send(msg);
    }
  }

  _send(ws, msg) {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  _broadcast(msg, exclude = null) {
    const str = JSON.stringify(msg);
    for (const [ws] of this.socketMap) {
      if (ws !== exclude && ws.readyState === 1) ws.send(str);
    }
  }
}

module.exports = WebSocketHandler;
