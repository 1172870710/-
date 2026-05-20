const Player = require('./Player');
const NPC = require('./NPC');
const { generatePersonality } = require('../ai/Personality');
const MemorySystem = require('../ai/MemorySystem');
const RelationshipGraph = require('../ai/RelationshipGraph');
const LLMClient = require('../ai/LLMClient');
const PromptBuilder = require('../ai/PromptBuilder');
const DecisionParser = require('../ai/DecisionParser');
const BehaviorExecutor = require('../ai/BehaviorExecutor');
const NPCBrain = require('../ai/NPCBrain');

class GameWorld {
  constructor(tileMap, npcCount = 5) {
    this.tileMap = tileMap;
    this.players = new Map();
    this.npcs = new Map();
    this.npcBrains = new Map();

    // 全局共享的关系图谱
    this.relationshipGraph = new RelationshipGraph();

    // LLM 客户端（从环境变量读 Key）
    const apiKey = process.env.DEEPSEEK_API_KEY;
    this.llmClient = apiKey && apiKey !== 'sk-your-key-here'
      ? new LLMClient(apiKey)
      : null;

    // 行为执行器
    this.behaviorExecutor = new BehaviorExecutor(tileMap);

    // Prompt 构造器和解析器
    this.promptBuilder = new PromptBuilder();
    this.decisionParser = new DecisionParser();

    // 预设 NPC
    this._spawnNPCs(npcCount);
  }

  // 创建预设 NPC
  _spawnNPCs(count) {
    for (let i = 0; i < count; i++) {
      const personality = generatePersonality(i);
      const npcId = `npc_${i}`;
      const npc = new NPC(npcId, personality, this.tileMap);
      const memory = new MemorySystem(npcId);
      const graph = this.relationshipGraph;

      // 初始化 NPC 之间的关系
      for (const [, other] of this.npcs) {
        graph.init(npcId, other.id);
      }
      // 也与自身建立（后续玩家加入时再建）
      graph.init(npcId, npcId); // 占位，实际不需要

      const brain = new NPCBrain(
        npc, personality, memory, graph,
        this.llmClient, this.promptBuilder,
        this.decisionParser, this.behaviorExecutor
      );

      this.npcs.set(npcId, npc);
      this.npcBrains.set(npcId, brain);

      console.log(`  NPC: ${personality.name}（${personality.job}）- ${personality.backstory}`);
    }
    console.log(`  已生成 ${count} 个 NPC${this.llmClient ? '（LLM 已启用）' : '（LLM 未配置，使用随机行为）'}`);
  }

  // 添加玩家
  addPlayer(id, name, color) {
    const pos = this.tileMap.getRandomWalkable();
    const player = new Player(id, name, pos.x, pos.y, color);
    this.players.set(id, player);

    // 建立玩家与所有 NPC 的关系
    for (const [npcId] of this.npcs) {
      this.relationshipGraph.init(id, npcId);
    }

    return player;
  }

  // 移除玩家
  removePlayer(id) {
    this.players.delete(id);
  }

  // 获取所有玩家数据
  getPlayerSnapshots() {
    const snapshots = [];
    for (const player of this.players.values()) {
      snapshots.push(player.toSnapshot());
    }
    return snapshots;
  }

  // 获取所有 NPC 数据
  getNPCSnapshots() {
    const snapshots = [];
    for (const npc of this.npcs.values()) {
      snapshots.push(npc.toSnapshot());
    }
    return snapshots;
  }

  // 获取完整世界状态快照
  getWorldSnapshot() {
    return {
      players: this.getPlayerSnapshots(),
      npcs: this.getNPCSnapshots(),
      map: {
        width: this.tileMap.width,
        height: this.tileMap.height,
        tileSize: this.tileMap.tileSize,
      },
      mapData: this.tileMap.map,
    };
  }

  // 更新玩家位置（带碰撞检测）
  updatePlayerPosition(id, x, y, dir, moving) {
    const player = this.players.get(id);
    if (!player) return false;

    if (this.tileMap.isWalkable(x, y)) {
      player.x = x;
      player.y = y;
    }
    player.dir = dir;
    player.moving = moving;
    return true;
  }

  // 游戏 Tick：更新所有 NPC
  tickNPCs() {
    for (const [npcId, brain] of this.npcBrains) {
      brain.reactiveUpdate(this);
    }
    // 玩家回血
    for (const player of this.players.values()) {
      player.regenTick();
    }
  }

  // 异步：NPC 深思（不阻塞游戏循环）
  async tickNPCThink() {
    // 没有玩家在线时，不做 LLM 思考（省 token）
    if (this.players.size === 0) return;

    const promises = [];
    for (const [npcId, brain] of this.npcBrains) {
      promises.push(brain.tryDeliberativeThink(this));
    }
    await Promise.allSettled(promises);
  }

  // 收集 NPC 对话
  collectNPCDialogues() {
    const dialogues = [];
    for (const [npcId, brain] of this.npcBrains) {
      const d = brain.consumeDialogue();
      if (d) {
        const npc = this.npcs.get(npcId);
        dialogues.push({
          npcId,
          npcName: npc ? npc.name : '???',
          npcX: npc ? npc.x : 0,
          npcY: npc ? npc.y : 0,
          text: d,
        });
      }
    }
    return dialogues;
  }

  // 获取 LLM 统计
  getLLMStats() {
    if (!this.llmClient) return { enabled: false };
    return {
      enabled: true,
      ...this.llmClient.getStats(),
    };
  }

  // ======================== 攻击系统 ========================

  // 找到攻击目标（玩家朝向的前方一格区域）
  findAttackTargets(attackerId, dir) {
    const attacker = this.players.get(attackerId);
    if (!attacker || !attacker.isAlive()) return null;

    const RANGE = 40; // 攻击距离
    const attackX = attacker.x + (dir === 'right' ? RANGE : dir === 'left' ? -RANGE : 0);
    const attackY = attacker.y + (dir === 'down' ? RANGE : dir === 'up' ? -RANGE : 0);

    // 先找 NPC
    for (const [npcId, npc] of this.npcs) {
      if (!npc.isAlive()) continue;
      const dx = npc.x - attackX;
      const dy = npc.y - attackY;
      if (Math.abs(dx) < 28 && Math.abs(dy) < 28) {
        return { targetId: npcId, targetX: npc.x, targetY: npc.y, isPlayer: false, npc: true };
      }
    }

    // 再找其他玩家
    for (const [pid, p] of this.players) {
      if (pid === attackerId || !p.isAlive()) continue;
      const dx = p.x - attackX;
      const dy = p.y - attackY;
      if (Math.abs(dx) < 28 && Math.abs(dy) < 28) {
        return { targetId: pid, targetX: p.x, targetY: p.y, isPlayer: true, npc: false };
      }
    }

    return null; // 没打到东西
  }

  // 执行攻击
  applyAttack(attackerId, targets) {
    const attacker = this.players.get(attackerId);
    if (!attacker) return { hit: false };

    const damage = attacker.customDamage || 15;

    let result = { hit: true, damage, targetId: targets.targetId, x: targets.targetX, y: targets.targetY, myHp: attacker.hp, myMaxHp: attacker.maxHp };

    if (targets.isPlayer) {
      // 攻击玩家
      const target = this.players.get(targets.targetId);
      if (target && target.isAlive()) {
        const died = target.takeDamage(damage);
        result.msg = died ? `击败了 ${target.name}！` : `攻击了 ${target.name}（-${damage}HP）`;
        result.died = died;
        if (died) {
          // 延迟复活
          setTimeout(() => {
            const pos = this.tileMap.getRandomWalkable();
            target.x = pos.x;
            target.y = pos.y;
            target.hp = target.maxHp;
            target.lastHitTime = Date.now(); // 重置回血计时
          }, 3000);
        }
      } else {
        result.hit = false;
      }
    } else {
      // 攻击 NPC
      const npc = this.npcs.get(targets.targetId);
      if (npc && npc.isAlive()) {
        const died = npc.takeDamage(damage);
        const brain = this.npcBrains.get(targets.targetId);
        if (brain) {
          brain.onAttacked(attackerId, attacker.name);
        }
        result.msg = died ? `${npc.name} 倒下了！` : `攻击了 ${npc.name}（-${damage}HP）`;
        result.died = died;
        result.npcName = npc.name;
        if (died) {
          // NPC 5 秒后复活
          setTimeout(() => {
            const pos = this.tileMap.getRandomWalkable();
            npc.x = pos.x;
            npc.y = pos.y;
            npc.hp = npc.maxHp;
            npc.emotion = 'neutral';
          }, 5000);
        }
      } else {
        result.hit = false;
      }
    }

    return result;
  }

  // ======================== NPC 交互 ========================

  // 玩家与 NPC 对话
  async handleNPCTalk(npcId, playerId, text) {
    const npc = this.npcs.get(npcId);
    const player = this.players.get(playerId);
    if (!npc || !player) return null;

    const brain = this.npcBrains.get(npcId);
    if (brain) brain.onSpokenTo(playerId, player.name, text || '');

    // 生成回复（优先 LLM）
    const response = await this._generateNPCResponse(npc, brain, player, text);
    return response;
  }

  // 玩家赠送礼物
  handleNPCGift(npcId, playerId, itemKey) {
    const npc = this.npcs.get(npcId);
    const player = this.players.get(playerId);
    if (!npc || !player) return null;

    const { ITEMS } = require('../../shared/items');
    const item = ITEMS[itemKey];
    if (!item) return { ok: false, msg: '没有这个物品' };

    const brain = this.npcBrains.get(npcId);
    if (brain) brain.onReceivedGift(playerId, player.name, item.name);

    const likeScore = this._calcGiftLike(npc, brain, itemKey);
    let reaction;
    let moodChange = {};
    if (likeScore > 0.6) {
      reaction = `${npc.name}高兴地收下了${item.name}！${['谢谢你！', '太好了！', '我很喜欢！'][Math.floor(Math.random()*3)]}`;
      moodChange = { happiness: +0.2, affection: +0.15 };
    } else if (likeScore > 0.3) {
      reaction = `${npc.name}收下了${item.name}。${['嗯，谢谢。', '哦，好的。', '放那吧。'][Math.floor(Math.random()*3)]}`;
      moodChange = { happiness: +0.05 };
    } else {
      reaction = `${npc.name}皱了皱眉：${['这个...不太需要。', '你留着自己用吧。', '呃，我不喜欢这个。'][Math.floor(Math.random()*3)]}`;
      moodChange = { happiness: -0.05, affection: -0.05 };
    }

    return { ok: true, reaction, moodChange, itemName: item.name };
  }

  // 玩家交易
  handleNPCTradeBuy(npcId, playerId, itemKey, quantity = 1) {
    const npc = this.npcs.get(npcId);
    const player = this.players.get(playerId);
    if (!npc || !player) return null;

    const item = npc.shop[itemKey];
    if (!item || item.stock < quantity) {
      return { ok: false, msg: `${item ? '库存不足' : '没有这个物品'}` };
    }

    const totalPrice = item.price * quantity;
    if (player.gold < totalPrice) {
      return { ok: false, msg: `金币不足（需要 ${totalPrice} 金币）` };
    }

    // 扣钱，减库存
    player.gold -= totalPrice;
    item.stock -= quantity;

    return {
      ok: true,
      msg: `购买了 ${item.name} ×${quantity}，花费 ${totalPrice} 金币`,
      itemName: item.name, quantity, cost: totalPrice,
    };
  }

  handleNPCTradeSell(npcId, playerId, itemKey, quantity = 1) {
    const npc = this.npcs.get(npcId);
    const player = this.players.get(playerId);
    if (!npc || !player) return null;

    const { ITEMS } = require('../../shared/items');
    const itemDef = ITEMS[itemKey];
    if (!itemDef) return { ok: false, msg: '无效物品' };

    // 卖出价是原价的一半
    const sellPrice = Math.floor(itemDef.price * 0.5) * quantity;
    if (sellPrice <= 0) return { ok: false, msg: '这个不值钱' };

    player.gold += sellPrice;

    return {
      ok: true,
      msg: `出售了 ${itemDef.name} ×${quantity}，获得 ${sellPrice} 金币`,
      itemName: itemDef.name, quantity, gain: sellPrice,
    };
  }

  // 获取 NPC 商店
  getNPCShop(npcId) {
    const npc = this.npcs.get(npcId);
    if (!npc) return null;
    return npc.getShopForClient();
  }

  // 获取玩家金币
  getPlayerGold(playerId) {
    const player = this.players.get(playerId);
    return player ? player.gold : 0;
  }

  // ======================== NPC 回复生成 ========================
  async _generateNPCResponse(npc, brain, player, text) {
    // 优先 LLM 生成对话
    if (brain) {
      try {
        const llmReply = await brain.generateResponse(player.name, text || '');
        if (llmReply) {
          return { text: llmReply, emotion: npc.emotion || 'neutral' };
        }
      } catch (e) {
        // LLM 失败，降级到模板
      }
    }

    // 降级：模板回复
    // 如果有 LLM，这里会调用 LLM 生成更丰富的对话
    // 目前使用模板回复

    const greetings = [
      `哦，${player.name}啊，今天怎么有空过来？`,
      `你好啊${player.name}，找我有什么事？`,
      `是${player.name}啊，我正在忙呢。`,
      `哟，${player.name}来了，要不要看看我的东西？`,
    ];

    const moodReplies = {
      angry: [`哼！`, `别惹我。`, `我现在不想说话。`],
      happy: [`嘿嘿，今天心情不错！`, `有什么好事吗？`, `来来来，跟你说个事。`],
      sad: [`唉...`, `没什么，就是有点累。`, `生活不容易啊。`],
      surprised: [`哇！你吓我一跳！`, `哎呀，你怎么在这？`, `真巧啊！`],
    };

    // 根据情绪调整回复
    const mood = npc.emotion || 'neutral';
    const moodList = moodReplies[mood];
    if (moodList && Math.random() < 0.4) {
      return { text: moodList[Math.floor(Math.random() * moodList.length)], emotion: mood };
    }

    const greeting = greetings[Math.floor(Math.random() * greetings.length)];

    // 有时会说跟职业/背景相关的话
    const jobTalks = {
      '铁匠': '刚打了一把新剑，要不要看看？',
      '面包师': '刚出炉的面包，香得很！',
      '商人': '最近生意还行，货物充足。',
      '猎人': '北边的树林里最近猎物不少。',
      '药师': '我在采药草，这片林子里的药材不错。',
      '酒馆老板': '晚上来喝一杯？新进的麦酒。',
      '守卫': '最近镇子里还算太平。',
      '农民': '地里的庄稼长得不错。',
    };

    const jobTalk = jobTalks[npc.job];
    if (jobTalk && Math.random() < 0.5) {
      return { text: `${greeting} ${jobTalk}`, emotion: 'neutral' };
    }

    return { text: greeting, emotion: 'neutral' };
  }

  _calcGiftLike(npc, brain, itemKey) {
    // 不同 NPC 对不同物品的好感度
    const preferences = {
      '面包师':  { bread: 0.9, apple: 0.6, flower: 0.4 },
      '铁匠':    { gem: 0.9, meat: 0.7, ring: 0.8 },
      '猎人':    { meat: 0.9, fish: 0.8, cloth: 0.5 },
      '药师':    { potion: 0.9, scroll: 0.7, flower: 0.8 },
      '商人':    { gem: 0.9, ring: 0.9, scroll: 0.7 },
      '农民':    { bread: 0.8, apple: 0.9, flower: 0.7 },
      '守卫':    { meat: 0.8, bread: 0.7, gem: 0.3 },
      '酒馆老板': { meat: 0.9, bread: 0.8, apple: 0.6 },
    };
    const pref = preferences[npc.job];
    if (pref && pref[itemKey] !== undefined) return pref[itemKey];
    return 0.5; // 默认中立
  }
}

module.exports = GameWorld;
