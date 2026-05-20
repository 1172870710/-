// NPC 大脑 —— 双层决策调度器
// 反应层（高频，500ms）：规则驱动，保证 NPC 一直在动
// 深思层（低频，30s+）：调用 LLM 制定战略方向

class NPCBrain {
  constructor(npc, personality, memory, ctx, internalState) {
    this.npc = npc;
    this.personality = personality;   // NPC 数据（从 NPCDataLoader）
    this.memory = memory;             // MemorySystem 实例
    // 服务上下文（从 GameWorld.serviceContext 注入）
    this.graph = ctx.graph;           // RelationshipGraph
    this.llm = ctx.llm;               // LLMClient
    this.promptBuilder = ctx.prompt;  // PromptBuilder
    this.parser = ctx.parser;         // DecisionParser
    this.executor = ctx.executor;     // BehaviorExecutor
    this.internalState = internalState || null; // NPCInternalState 实例

    this.lastReactiveTick = 0;
    this.reactiveInterval = 500;      // 500ms
    this.lastThinkTick = 0;
    this.thinkInterval = 30000;       // 30 秒基础（首次加随机偏移）
    this.lastSummaryCheck = 0;
    this.summaryCheckInterval = 60000; // 60s 检查一次是否需要压缩记忆

    // 当前 LLM 决策（初始为闲逛）
    this.currentDecision = {
      goal: null,
      action: 'wander',
      target: null,
      dialogue: '',
      emotion: 'neutral',
      reasoning: '初始状态',
    };

    // 随机偏移首次深思时间
    this.lastThinkTick = Date.now() - 15000 + Math.random() * 20000;
  }

  // ========== 反应层：每 500ms ==========
  reactiveUpdate(world) {
    const now = Date.now();
    if (now - this.lastReactiveTick < this.reactiveInterval) return;
    this.lastReactiveTick = now;

    // 0. 内心状态更新（压力、欲望等）
    if (this.internalState) {
      const ctx = this._buildSocialContext(world);
      this.internalState.tick(ctx);
    }

    // 1. 紧急避险：附近有人 attack 且 fear > 0.6
    const threat = this._findNearbyAttacker(world);
    if (threat && this.personality.mood.fear > 0.6) {
      this.currentDecision = {
        goal: '逃离危险',
        action: 'flee',
        target: threat.id,
        dialogue: '',
        emotion: 'angry',
        reasoning: '有攻击者靠近，紧急逃跑',
      };
    }

    // 2. 心理状态影响决策：高压下更激进
    if (this.internalState && this.internalState.isAtLeast('BREAKDOWN')) {
      // 崩溃状态：可能随机切换为攻击
      if (Math.random() < 0.1 && this.currentDecision.target) {
        this.currentDecision.action = 'attack';
        this.currentDecision.reasoning = '心理崩溃，失控攻击';
      }
    }

    // 3. 执行当前决策
    this.executor.execute(this.npc, this.currentDecision, world);

    // 4. 简单的情绪衰减
    this._decayMood();
  }

  // ========== 深思层：每 30s+，调用 LLM ==========
  async tryDeliberativeThink(world) {
    const now = Date.now();
    if (now - this.lastThinkTick < this.thinkInterval) return;
    this.lastThinkTick = now;

    // 构建 prompt
    const prompt = this.promptBuilder.build(
      this.npc,
      this.personality,
      this.memory,
      this.graph,
      world,
      this.internalState
    );

    console.log(`  🧠 ${this.npc.name} 正在深思...`);

    // 调用 LLM
    const result = await this.llm.think(this.npc.id, prompt);

    if (result.skipped) {
      console.log(`    ⏭ ${this.npc.name}: ${result.reason}`);
      if (result.fallback && !this.npc.goal) {
        // 降级：如果没有目标，随机闲逛
        this.currentDecision = {
          goal: null,
          action: 'wander',
          target: null,
          dialogue: '',
          emotion: 'neutral',
          reasoning: '（降级：默认闲逛）',
        };
      }
      return;
    }

    // 解析 LLM 返回
    const decision = this.parser.parse(result.content, this.npc.id);

    if (decision) {
      this.currentDecision = decision;
      console.log(`    ✓ ${this.npc.name}: ${decision.action} → ${decision.target || '无目标'} | ${decision.reasoning}`);

      // 如果 LLM 决定说话，记录为记忆
      if (decision.dialogue) {
        this.memory.addEvent(
          'said',
          decision.target,
          `我对 ${decision.target || '附近的人'} 说："${decision.dialogue}"`,
          0.2
        );
      }
    }

    // 检查是否需要压缩记忆
    await this.trySummarizeMemory();
  }

  // ========== 外部事件触发 ==========

  // 有人对 NPC 说话
  onSpokenTo(fromId, fromName, text) {
    this.memory.addEvent(
      'player_said',
      fromId,
      `${fromName} 对我说："${text}"`,
      0.5
    );
    // 提升社交需求
    this.personality.needs.social = Math.min(1, this.personality.needs.social + 0.1);
    // 增加惊讶
    this.personality.mood.surprise = Math.min(1, this.personality.mood.surprise + 0.3);

    if (this.internalState) this.internalState.onSocialInteraction(fromName, true);

    // 如果有 LLM API，立即触发一次深思（响应对话）
    // 但前提是距离上次深思已超过 15 秒
    // 此处标记为"想要立即思考"，由调度器判断
  }

  // 有人伤害了 NPC
  onAttacked(attackerId, attackerName) {
    this.memory.addEvent(
      'was_attacked',
      attackerId,
      `${attackerName} 攻击了我！`,
      0.9
    );
    this.personality.mood.anger = Math.min(1, this.personality.mood.anger + 0.5);
    this.personality.mood.fear = Math.min(1, this.personality.mood.fear + 0.3);
    this.personality.mood.happiness = Math.max(0, this.personality.mood.happiness - 0.4);

    this.graph.adjust(this.npc.id, attackerId,
      { trust: -0.4, affection: -0.5, fear: +0.4, resentment: +0.3, suspicion: +0.1 },
      `${attackerName} 攻击了我`
    );

    if (this.internalState) this.internalState.onAttacked(attackerName);
  }

  // 有人送礼物
  onReceivedGift(fromId, fromName, item) {
    this.memory.addEvent(
      'received_gift',
      fromId,
      `${fromName} 送了我 ${item}`,
      0.6
    );
    this.personality.mood.happiness = Math.min(1, this.personality.mood.happiness + 0.3);
    this.personality.mood.surprise = Math.min(1, this.personality.mood.surprise + 0.5);

    this.graph.adjust(this.npc.id, fromId,
      { trust: +0.2, affection: +0.3, debt: +0.15 },
      `送了我 ${item}`
    );

    if (this.internalState) this.internalState.onReceivedGift();
  }

  // ========== 内部辅助 ==========

  /** 构建社交上下文（用于压力计算） */
  _buildSocialContext(world) {
    let nearTrusted = false;
    let isolated = true;
    let nearEnemy = false;
    let maxDebt = 0;

    for (const [, other] of world.npcs) {
      if (other.id === this.npc.id) continue;
      const dx = other.x - this.npc.x;
      const dy = other.y - this.npc.y;
      if (Math.sqrt(dx * dx + dy * dy) < 80) {
        isolated = false;
        const rel = this.graph.getAttitude(this.npc.id, other.id);
        if (rel.trust > 0.5) nearTrusted = true;
        if (rel.resentment > 0.5 || rel.trust < -0.3) nearEnemy = true;
        if (rel.debt > maxDebt) maxDebt = rel.debt;
      }
    }

    // 也检查附近的玩家
    for (const [, player] of world.players) {
      const dx = player.x - this.npc.x;
      const dy = player.y - this.npc.y;
      if (Math.sqrt(dx * dx + dy * dy) < 80) {
        isolated = false;
        const rel = this.graph.getAttitude(this.npc.id, player.id);
        if (rel.trust > 0.5) nearTrusted = true;
        if (rel.resentment > 0.5) nearEnemy = true;
      }
    }

    return { nearTrusted, isolated, nearEnemy, debtLevel: maxDebt };
  }

  _findNearbyAttacker(world) {
    for (const [, npc] of world.npcs) {
      if (npc.id === this.npc.id) continue;
      if (npc.currentAction === 'attack') {
        const dx = npc.x - this.npc.x;
        const dy = npc.y - this.npc.y;
        if (Math.sqrt(dx * dx + dy * dy) < 60) return npc;
      }
    }
    return null;
  }

  _decayMood() {
    const mood = this.personality.mood;
    mood.anger = Math.max(0, mood.anger - 0.002);
    mood.fear = Math.max(0, mood.fear - 0.002);
    mood.surprise = Math.max(0, mood.surprise - 0.01);
    // happiness 缓慢回归中性
    if (mood.happiness > 0.5) mood.happiness -= 0.001;
    if (mood.happiness < 0.5) mood.happiness += 0.001;
  }

  // ========== 记忆压缩检查（每 60s） ==========
  async trySummarizeMemory() {
    const now = Date.now();
    if (now - this.lastSummaryCheck < this.summaryCheckInterval) return;
    this.lastSummaryCheck = now;

    if (this.memory.needsSummarize() && this.llm) {
      await this.memory.summarize(this.llm);
    }
  }

  // ========== LLM 对话回复（玩家搭话时触发） ==========
  async generateResponse(fromName, text) {
    if (!this.llm) return null;

    const mem = this.memory.getRecentForPrompt(10);
    const relScores = this.graph.getAttitude(this.npc.id, fromName);
    const relState = this.graph.getRelationState(this.npc.id, fromName);

    const prompt = `你叫${this.npc.name}，职业是${this.personality.job}。${this.personality.backstory}。

你的性格：开放性${f2(this.personality.traits.openness)}，尽责性${f2(this.personality.traits.conscientiousness)}，外向性${f2(this.personality.traits.extraversion)}，宜人性${f2(this.personality.traits.agreeableness)}，神经质${f2(this.personality.traits.neuroticism)}。

你现在的心情：${this.npc.emotion}（快乐${pct(this.personality.mood.happiness)}，愤怒${pct(this.personality.mood.anger)}，恐惧${pct(this.personality.mood.fear)}）。

${mem.story ? '你的人生经历：\n' + mem.story + '\n\n' : ''}${mem.events.length ? '最近发生的事：\n' + mem.events.map(m => '· ' + m.content).join('\n') + '\n\n' : ''}你对${fromName}的观感（${relState.label}）：信任${pct(relScores.trust)}，好感${pct(relScores.affection)}，尊敬${pct(relScores.respect)}，恐惧${pct(relScores.fear)}，嫉妒${pct(relScores.jealousy)}，怨恨${pct(relScores.resentment)}，亏欠${pct(relScores.debt)}，怀疑${pct(relScores.suspicion)}。

${fromName}对你说："${text}"
请用你的身份和当前心情回复ta。要简短自然，符合角色设定，不要加引号。`;

    const result = await this.llm.talk(this.npc.id, prompt);

    if (result.skipped) return null;

    // 记录对话到记忆
    this.memory.addEvent(
      'player_said',
      fromName,
      `${fromName} 对我说："${text}"，我回答："${result.content}"`,
      0.4
    );

    return result.content;
  }

  // 获取对话内容（如果有）
  getDialogue() {
    return this.currentDecision.dialogue || null;
  }

  // 消耗对话（广播后清空）
  consumeDialogue() {
    const d = this.currentDecision.dialogue;
    this.currentDecision.dialogue = '';
    return d;
  }
}

// 格式化 0-1 分数为中文描述
function f2(v) {
  if (v >= 0.8) return '很高';
  if (v >= 0.6) return '偏高';
  if (v >= 0.4) return '中等';
  if (v >= 0.2) return '偏低';
  return '很低';
}

function pct(v) {
  const p = Math.round(v * 100);
  return p + '%';
}

module.exports = NPCBrain;
