const Player = require('../entities/Player');
const NPC = require('../entities/NPC');
const { loadNPCData } = require('../data/NPCDataLoader');
const MemorySystem = require('../ai/MemorySystem');
const RelationshipGraph = require('../social/RelationshipGraph');
const { bus, EVENTS } = require('../core/EventBus');
const LLMClient = require('../ai/LLMClient');
const PromptBuilder = require('../ai/PromptBuilder');
const DecisionParser = require('../ai/DecisionParser');
const BehaviorExecutor = require('../ai/BehaviorExecutor');
const NPCBrain = require('../ai/NPCBrain');
const { NPCInternalState } = require('../social/NPCInternalState');
const { EventImpactSystem } = require('../social/EventImpactSystem');
const { BehaviorResponse } = require('../social/BehaviorResponse');
const { ScheduleSystem } = require('../social/ScheduleSystem');
const { SecretSystem } = require('../social/SecretSystem');
const { EventChain } = require('../social/EventChain');
const { DramaEngine } = require('../social/DramaEngine');
const CombatSystem = require('../combat/CombatSystem');
const ShopManager = require('../economy/ShopManager');
const GiftSystem = require('../economy/GiftSystem');

class GameWorld {
  constructor(tileMap) {
    this.tileMap = tileMap;
    this.players = new Map();
    this.npcs = new Map();
    this.npcBrains = new Map();
    this.npcInternalStates = new Map();

    // 全局共享的关系图谱
    this.relationshipGraph = new RelationshipGraph(bus);

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

    // 子系统（战斗 / 经济）
    const subSystemOpts = {
      players: this.players, npcs: this.npcs,
      npcBrains: this.npcBrains, tileMap: this.tileMap,
    };
    this.combat = new CombatSystem(subSystemOpts);
    this.shop   = new ShopManager(subSystemOpts);
    this.gift   = new GiftSystem(subSystemOpts);

    // 事件冲击系统（Phase 1）
    this.eventImpactSystem = new EventImpactSystem({
      graph: this.relationshipGraph,
      internalStates: this.npcInternalStates,
    });

    // 行为响应系统（Phase 2）
    this.behaviorResponse = new BehaviorResponse();

    // 日程系统（Phase 3）
    this.scheduleSystem = new ScheduleSystem();

    // 秘密系统（Phase 4）
    this.secretSystem = new SecretSystem({
      graph: this.relationshipGraph,
      internalStates: this.npcInternalStates,
    });

    // 事件涟漪传播（Phase 5 — 创建后注入，因为需要 npcBrains 引用）
    this.eventChain = new EventChain({
      graph: this.relationshipGraph,
      impactSystem: this.eventImpactSystem,
      npcBrains: this.npcBrains,
    });

    // AI 服务上下文（注入给 NPCBrain，减少参数）
    this.serviceContext = {
      graph:             this.relationshipGraph,
      llm:               this.llmClient,
      prompt:            this.promptBuilder,
      parser:            this.decisionParser,
      executor:          this.behaviorExecutor,
      impactSystem:      this.eventImpactSystem,
      behaviorResponse:  this.behaviorResponse,
      scheduleSystem:    this.scheduleSystem,
      secretSystem:      this.secretSystem,
      eventChain:        this.eventChain,
    };

    // 从 npcs.json 加载预设 NPC
    this._spawnNPCs();

    // 戏剧引擎（Phase 6 — 在 _spawnNPCs 之后，需要 npcBrains）
    this.dramaEngine = new DramaEngine({
      graph: this.relationshipGraph,
      internalStates: this.npcInternalStates,
      secretSystem: this.secretSystem,
      scheduleSystem: this.scheduleSystem,
      impactSystem: this.eventImpactSystem,
      behaviorResponse: this.behaviorResponse,
      eventChain: this.eventChain,
      npcBrains: this.npcBrains,
      npcs: this.npcs,
      llmClient: this.llmClient,
      intervalMs: 300000, // 5 分钟
    });
  }

  // 从数据文件加载并创建 NPC
  _spawnNPCs() {
    const npcList = loadNPCData();

    // 第一遍：创建所有 NPC 实例
    for (const data of npcList) {
      const npcId = data.id;
      const npc = new NPC(data, this.tileMap);
      const memory = new MemorySystem(npcId);
      const internalState = new NPCInternalState(npcId, data, bus);

      const brain = new NPCBrain(npc, data, memory, this.serviceContext, internalState);

      this.npcs.set(npcId, npc);
      this.npcBrains.set(npcId, brain);
      this.npcInternalStates.set(npcId, internalState);
    }

    // 第二遍：初始化 NPC 间关系
    for (const data of npcList) {
      for (const [, other] of this.npcs) {
        if (data.id !== other.id) {
          this.relationshipGraph.init(data.id, other.id);
        }
      }
    }

    // 第三遍：应用 JSON 中预设的初始关系
    for (const data of npcList) {
      if (data.relationships) {
        for (const [targetId, dims] of Object.entries(data.relationships)) {
          if (this.npcs.has(targetId)) {
            this.relationshipGraph.adjust(data.id, targetId, dims, 'initial_setup');
          } else {
            console.warn(`  ⚠ NPC ${data.id} 的预设关系目标 ${targetId} 不存在，已忽略`);
          }
        }
      }
    }

    // 打印 NPC 列表
    for (const data of npcList) {
      const extras = [];
      if (data.title) extras.push(data.title);
      if (data.gender) extras.push(data.gender);
      if (data.age) extras.push(`${data.age}岁`);
      const extraStr = extras.length ? `（${extras.join('，')}）` : '';
      console.log(`  NPC: ${data.name}${extraStr} — ${data.job} — ${data.backstory}`);
    }
    // 第四遍：注册 NPC 到日程系统
    for (const [, npc] of this.npcs) {
      this.scheduleSystem.registerNPC(npc.id, { x: npc.x, y: npc.y });
    }

    const count = npcList.length;
    console.log(`  已加载 ${count} 个 NPC${this.llmClient ? '（LLM 已启用）' : '（LLM 未配置，使用随机行为）'}（含日程系统）`);
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
    // 日程系统定期清理过期覆写（每 ~3s）
    this._scheduleTickCounter = (this._scheduleTickCounter || 0) + 1;
    if (this._scheduleTickCounter % 90 === 0) { // 30fps * 3s
      this.scheduleSystem.tick();
    }
    // 秘密系统定期传播扫描（每 ~60s）
    if (this._scheduleTickCounter % 1800 === 0) { // 30fps * 60s
      this.secretSystem.propagateTick();
    }
  }

  // 异步：NPC 深思 + 戏剧引擎（不阻塞游戏循环）
  async tickNPCThink() {
    // 没有玩家在线时，不做 LLM 思考（省 token）
    if (this.players.size === 0) return;

    const promises = [];
    for (const [npcId, brain] of this.npcBrains) {
      promises.push(brain.tryDeliberativeThink(this));
    }
    // 戏剧引擎扫描（可能触发 LLM 生成事件）
    promises.push(this.dramaEngine.tick());
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

  // ======================== 攻击系统（委托 CombatSystem） ========================

  findAttackTargets(attackerId, dir) {
    return this.combat.findTargets(attackerId, dir);
  }

  applyAttack(attackerId, targets) {
    return this.combat.apply(attackerId, targets);
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

  // 玩家赠送礼物（委托 GiftSystem）
  handleNPCGift(npcId, playerId, itemKey) {
    return this.gift.give(npcId, playerId, itemKey);
  }

  // 玩家交易（委托 ShopManager）
  handleNPCTradeBuy(npcId, playerId, itemKey, quantity = 1) {
    return this.shop.buy(npcId, playerId, itemKey, quantity);
  }

  handleNPCTradeSell(npcId, playerId, itemKey, quantity = 1) {
    return this.shop.sell(npcId, playerId, itemKey, quantity);
  }

  getNPCShop(npcId) {
    return this.shop.getShop(npcId);
  }

  getPlayerGold(playerId) {
    return this.shop.getPlayerGold(playerId);
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
}

module.exports = GameWorld;
