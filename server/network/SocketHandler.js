// Socket.IO 事件处理 —— 多人联机 + NPC 交互
class SocketHandler {
  constructor(io, gameWorld) {
    this.io = io;
    this.world = gameWorld;
    this.init();
  }

  init() {
    this.io.on('connection', (socket) => {
      console.log(`玩家连接: ${socket.id}`);

      // ----- 加入世界 -----
      socket.on('player-join', (data) => {
        const name = (data && data.name) || '无名';
        const color = (data && data.color) || null;
        const player = this.world.addPlayer(socket.id, name, color);
        console.log(`  ${name} 加入了世界，位置: ${Math.round(player.x)},${Math.round(player.y)}`);

        socket.emit('init-done', {
          yourId: socket.id,
          world: this.world.getWorldSnapshot(),
          gold: this.world.getPlayerGold(socket.id),
        });

        socket.broadcast.emit('player-joined', player.toSnapshot());
      });

      // ----- 位置更新 -----
      socket.on('player-move', (data) => {
        this.world.updatePlayerPosition(
          socket.id,
          data.x, data.y,
          data.dir,
          data.moving
        );
      });

      // ----- 更新外观 -----
      socket.on('player-update', (data) => {
        const player = this.world.players.get(socket.id);
        if (!player) return;
        if (player.updateAppearance(data)) {
          this.io.emit('player-updated', {
            id: socket.id,
            name: player.name,
            color: player.color,
          });
        }
      });

      // ----- NPC 交互 -----
      socket.on('npc-interact', async (data) => {
        const { npcId, type, text, itemKey, quantity } = data || {};
        const player = this.world.players.get(socket.id);
        if (!player) return;
        const npc = this.world.npcs.get(npcId);
        if (!npc) return socket.emit('npc-interact-response', { ok: false, msg: 'NPC 不存在' });

        // 检查距离
        const dx = npc.x - player.x;
        const dy = npc.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 80) return socket.emit('npc-interact-response', { ok: false, msg: '太远了，走近点' });

        let result;
        switch (type) {
          case 'talk':
            result = await this.world.handleNPCTalk(npcId, socket.id, text || '');
            socket.emit('npc-interact-response', {
              ok: true, type: 'talk',
              npcName: npc.name, npcJob: npc.job,
              text: result.text,
              emotion: result.emotion,
            });
            break;

          case 'gift':
            result = this.world.handleNPCGift(npcId, socket.id, itemKey);
            if (result) {
              socket.emit('npc-interact-response', {
                ok: result.ok, type: 'gift',
                msg: result.msg,
                reaction: result.reaction || '',
                npcName: npc.name,
              });
            }
            break;

          case 'shop':
            const shop = this.world.getNPCShop(npcId);
            const gold = this.world.getPlayerGold(socket.id);
            socket.emit('npc-interact-response', {
              ok: true, type: 'shop',
              shop, gold, npcName: npc.name, npcJob: npc.job,
            });
            break;

          case 'buy':
            const qtyBuy = quantity || 1;
            result = this.world.handleNPCTradeBuy(npcId, socket.id, itemKey, qtyBuy);
            socket.emit('npc-interact-response', {
              ok: result?.ok || false, type: 'buy',
              msg: result?.msg || '交易失败',
              gold: this.world.getPlayerGold(socket.id),
            });
            break;

          case 'sell':
            const qtySell = quantity || 1;
            result = this.world.handleNPCTradeSell(npcId, socket.id, itemKey, qtySell);
            socket.emit('npc-interact-response', {
              ok: result?.ok || false, type: 'sell',
              msg: result?.msg || '交易失败',
              gold: this.world.getPlayerGold(socket.id),
            });
            break;

          default:
            socket.emit('npc-interact-response', { ok: false, msg: '未知交互类型' });
        }
      });

      // ----- 攻击 -----
      socket.on('player-attack', (data) => {
        const player = this.world.players.get(socket.id);
        if (!player || !player.isAlive()) return;

        // 检测范围内是否有可攻击目标（NPC 或玩家）
        const dir = data.dir || player.dir;
        const targets = this.world.findAttackTargets(socket.id, dir);
        if (targets) {
          const result = this.world.applyAttack(socket.id, targets);
          // 通知攻击者
          socket.emit('attack-result', result);
          // 如果目标被击中，通知目标
          if (result.hit && result.targetId) {
            const targetSocket = this.io.sockets.sockets.get(result.targetId);
            if (targetSocket && targets.isPlayer) {
              const targetPlayer = this.world.players.get(result.targetId);
              targetSocket.emit('attacked', {
                attackerId: socket.id,
                attackerName: player.name,
                damage: result.damage,
                myHp: targetPlayer ? targetPlayer.hp : 0,
                myMaxHp: targetPlayer ? targetPlayer.maxHp : 100,
              });
            }
          }
        }
      });

      // ----- 开发者模式指令 -----
      socket.on('dev-command', (data) => {
        const player = this.world.players.get(socket.id);
        if (!player) return;

        switch (data.cmd) {
          case 'set_hp':
            const val = parseInt(data.value);
            if (!isNaN(val) && val >= 0) {
              player.hp = Math.min(player.maxHp, val);
              socket.emit('dev-update', { hp: player.hp });
            }
            break;

          case 'set_speed':
            const speed = parseFloat(data.value);
            if (!isNaN(speed) && speed > 0 && speed <= 20) {
              player.customSpeed = speed;
              socket.emit('dev-update', { customSpeed: speed });
            }
            break;

          case 'set_damage':
            const dmg = parseFloat(data.value);
            if (!isNaN(dmg) && dmg > 0 && dmg <= 200) {
              player.customDamage = dmg;
              socket.emit('dev-update', { customDamage: dmg });
            }
            break;

          case 'heal_all':
            for (const p of this.world.players.values()) p.hp = p.maxHp;
            socket.emit('dev-update', { msg: '所有玩家已恢复' });
            break;

          case 'hp_all_npcs':
            for (const n of this.world.npcs.values()) {
              n.hp = n.maxHp;
            }
            socket.emit('dev-update', { msg: '所有 NPC 已恢复' });
            break;
        }
      });

      // ----- 聊天消息 -----
      socket.on('chat-send', (data) => {
        const player = this.world.players.get(socket.id);
        if (!player) return;
        const msg = {
          fromId: socket.id,
          fromName: player.name,
          text: (data && data.text) || '',
          time: Date.now(),
        };
        this.io.emit('chat-broadcast', msg);
      });

      // ----- 断开连接 -----
      socket.on('disconnect', () => {
        const player = this.world.players.get(socket.id);
        if (player) {
          console.log(`玩家离开: ${player.name}`);
          this.world.removePlayer(socket.id);
          this.io.emit('player-left', { id: socket.id });
        }
      });
    });
  }

  // 广播所有实体状态
  broadcastState() {
    if (this.world.players.size === 0) return;
    this.io.emit('entities-update', {
      players: this.world.getPlayerSnapshots(),
      npcs: this.world.getNPCSnapshots(),
    });
  }

  // 广播 NPC 对话
  broadcastNPCDialogue(dialogue) {
    this.io.emit('npc-dialogue', dialogue);
  }
}

module.exports = SocketHandler;
