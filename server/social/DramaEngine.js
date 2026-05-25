// 戏剧引擎 — AI 导演编排中心
//
// 核心职责：定期扫描社会状态 → 发现戏剧潜力 → 生成事件 → 落地执行 → 广播
//
// 工作循环（每 5-10 分钟）：
//   1. 扫描：RelationshipGraph 冲突 + SecretSystem 易泄露秘密 + ScheduleSystem 汇聚点
//   2. 决策：根据"戏剧温度"决定介入策略
//   3. 生成：构造 LLM Prompt → 获取事件种子 → 解析 JSON（无 LLM 时规则生成）
//   4. 落地：事件种子 → EventImpactSystem + BehaviorResponse + Schedule + Secret + EventChain
//   5. 广播：EventBus 通知客户端
//
// 文献支撑：
//   - DESIGN.md 戏剧引擎工作流
//   - Mateas: "AI Director" 宏观叙事引导
//   - 文献 Ch4: LLM 事件种子 + Grounding 模式

const { bus, EVENTS } = require('../core/EventBus');

// ======================== 常量 ========================

// 戏剧温度等级
const DRAMA_TEMP = {
  COLD:    { label: '平静',     desc: '长期无大事发生，需要注入冲突' },
  WARM:    { label: '微澜',     desc: '有一些小摩擦，保持观察' },
  HOT:     { label: '活跃',     desc: '正在进行的事件链，适度干预' },
  BOILING: { label: '沸腾',     desc: '重大事件刚发生，引入平静期让发酵' },
};

// 扫描结果中的戏剧潜力类型
const DRAMA_TRIGGER = {
  HIGH_CONFLICT:     'high_conflict',      // 高冲突关系对
  LOVE_TRIANGLE:     'love_triangle',       // 三角恋
  SECRET_ABOUT_TO_LEAK: 'secret_leak',     // 秘密即将泄露
  CONVERGENCE:       'convergence',         // NPC 汇聚点
  ISOLATED_NPC:      'isolated',            // 孤立 NPC
  STRESS_BREAKDOWN:  'stress_breakdown',    // NPC 接近崩溃
};

// ======================== 主类 ========================

class DramaEngine {
  /**
   * @param {object} deps
   * @param {RelationshipGraph} deps.graph
   * @param {Map<string, NPCInternalState>} deps.internalStates
   * @param {SecretSystem} deps.secretSystem
   * @param {ScheduleSystem} deps.scheduleSystem
   * @param {EventImpactSystem} deps.impactSystem
   * @param {BehaviorResponse} deps.behaviorResponse
   * @param {EventChain} deps.eventChain
   * @param {Map<string, NPCBrain>} deps.npcBrains
   * @param {Map<string, object>} deps.npcs — NPC 实体 Map (for name lookup)
   * @param {LLMClient} [deps.llmClient]
   * @param {number} [deps.intervalMs=300000] — 扫描间隔（默认 5 分钟）
   */
  constructor({ graph, internalStates, secretSystem, scheduleSystem,
                impactSystem, behaviorResponse, eventChain,
                npcBrains, npcs, llmClient, intervalMs }) {
    this.graph = graph;
    this.internalStates = internalStates;
    this.secretSystem = secretSystem;
    this.scheduleSystem = scheduleSystem;
    this.impactSystem = impactSystem;
    this.behaviorResponse = behaviorResponse;
    this.eventChain = eventChain;
    this.npcBrains = npcBrains;
    this.npcs = npcs;
    this.llm = llmClient || null;

    this.intervalMs = intervalMs || 300000; // 默认 5 分钟
    this._lastScanTime = 0;
    this._lastEventTime = 0;

    // 戏剧温度追踪
    this.dramaTemp = 'COLD';
    this._tempTimer = 0;          // 处于当前温度的持续时间（tick 数）
    this._recentEvents = [];       // 最近事件记录 [{ time, type, intensity }]
    this._maxRecentEvents = 20;

    console.log(`  🎭 DramaEngine 已初始化（扫描间隔: ${this.intervalMs / 1000}s）${this.llm ? ' [LLM enabled]' : ' [Rule-based]'}`);
  }

  // ======================== Phase 1: 扫描 ========================

  /**
   * 扫描世界状态，寻找戏剧潜力
   * @returns {object} scanResult
   */
  scan() {
    const triggers = [];

    // 1. 关系图冲突扫描
    if (this.graph) {
      const globalDrama = this.graph.scanGlobalDrama();
      for (const drama of (globalDrama || [])) {
        if (drama.dramaScore > 20) {
          triggers.push({
            type: DRAMA_TRIGGER.HIGH_CONFLICT,
            score: drama.dramaScore,
            aId: drama.aId, bId: drama.bId,
            state: drama.stateLabel,
            triggers: drama.triggers,
          });
        }
      }
    }

    // 2. 易泄露秘密
    if (this.secretSystem) {
      const volatile = this.secretSystem.getVolatileSecrets();
      for (const v of (volatile || []).slice(0, 5)) {
        triggers.push({
          type: DRAMA_TRIGGER.SECRET_ABOUT_TO_LEAK,
          secretId: v.secretId,
          content: v.content,
          topHolder: v.holders[0],
        });
      }
    }

    // 3. NPC 汇聚点
    if (this.scheduleSystem) {
      const conv = this.scheduleSystem.getConvergencePoints(12); // noon as default
      for (const c of (conv || []).slice(0, 3)) {
        triggers.push({
          type: DRAMA_TRIGGER.CONVERGENCE,
          location: c.location,
          npcIds: c.npcIds,
        });
      }
    }

    // 4. 高压力 NPC
    if (this.internalStates) {
      for (const [npcId, state] of this.internalStates) {
        if (state.psychState === 'BREAKDOWN' || state.psychState === 'FRENZY') {
          triggers.push({
            type: DRAMA_TRIGGER.STRESS_BREAKDOWN,
            npcId,
            stress: state.stress,
            psychState: state.getPsychStateLabel(),
          });
        }
      }
    }

    return {
      timestamp: Date.now(),
      dramaTemp: this.dramaTemp,
      triggers,
      // 综合戏剧张力评分
      tensionScore: this._calcTensionScore(triggers),
    };
  }

  _calcTensionScore(triggers) {
    let score = triggers.length * 5;
    for (const t of triggers) {
      if (t.type === DRAMA_TRIGGER.HIGH_CONFLICT) score += (t.score || 20) * 2;
      if (t.type === DRAMA_TRIGGER.STRESS_BREAKDOWN) score += 40;
      if (t.type === DRAMA_TRIGGER.SECRET_ABOUT_TO_LEAK) score += 25;
    }
    return Math.min(100, score);
  }

  // ======================== Phase 2: 决策 ========================

  /**
   * 根据扫描结果决定是否介入以及介入方式
   * @returns {object|null} decision or null
   */
  decide(scanResult) {
    const { triggers, tensionScore } = scanResult;

    // 更新戏剧温度
    this._updateDramaTemp(tensionScore);

    // 决策逻辑
    if (triggers.length === 0) {
      // 无戏剧潜力 → 无需介入
      return null;
    }

    // 优先选择：高冲突关系对 > 压力崩溃 > 秘密泄露 > 汇聚点
    const priorityOrder = [
      DRAMA_TRIGGER.HIGH_CONFLICT,
      DRAMA_TRIGGER.STRESS_BREAKDOWN,
      DRAMA_TRIGGER.SECRET_ABOUT_TO_LEAK,
      DRAMA_TRIGGER.CONVERGENCE,
    ];

    for (const priType of priorityOrder) {
      const match = triggers.find(t => t.type === priType);
      if (match) {
        return this._buildDecision(match, scanResult);
      }
    }

    return null;
  }

  _buildDecision(trigger, scanResult) {
    switch (trigger.type) {
      case DRAMA_TRIGGER.HIGH_CONFLICT:
        return {
          action: 'generate_event',
          eventDirection: 'conflict_escalation',
          participants: { actor: trigger.aId, target: trigger.bId },
          trigger,
          temperature: this.dramaTemp,
        };

      case DRAMA_TRIGGER.STRESS_BREAKDOWN:
        return {
          action: 'generate_event',
          eventDirection: 'breakdown_crisis',
          participants: { target: trigger.npcId },
          trigger,
          temperature: this.dramaTemp,
        };

      case DRAMA_TRIGGER.SECRET_ABOUT_TO_LEAK:
        return {
          action: 'accelerate_leak',
          secretId: trigger.secretId,
          trigger,
          temperature: this.dramaTemp,
        };

      case DRAMA_TRIGGER.CONVERGENCE:
        return {
          action: 'generate_event',
          eventDirection: 'social_encounter',
          participants: { witnesses: trigger.npcIds },
          location: trigger.location,
          trigger,
          temperature: this.dramaTemp,
        };

      default:
        return null;
    }
  }

  _updateDramaTemp(tensionScore) {
    const old = this.dramaTemp;

    if (tensionScore > 70) this.dramaTemp = 'BOILING';
    else if (tensionScore > 40) this.dramaTemp = 'HOT';
    else if (tensionScore > 10) this.dramaTemp = 'WARM';
    else this.dramaTemp = 'COLD';

    if (old !== this.dramaTemp) {
      this._tempTimer = 0;
      console.log(`  🎭 戏剧温度: ${DRAMA_TEMP[old]?.label} → ${DRAMA_TEMP[this.dramaTemp]?.label} (score=${tensionScore})`);
      if (bus) {
        bus.emit('drama-temperature-changed', { oldTemp: old, newTemp: this.dramaTemp, score: tensionScore });
      }
    }
    this._tempTimer++;
  }

  // ======================== Phase 3: 生成 ========================

  /**
   * 生成事件种子（LLM 优先，降级为规则生成）
   */
  async generate(decision) {
    if (!decision) return null;

    // 尝试 LLM 生成
    if (this.llm && decision.action === 'generate_event') {
      try {
        const prompt = this._buildPrompt(decision);
        const result = await this.llm.think('drama_engine', prompt);

        if (!result.skipped && result.content) {
          const parsed = this._parseLLMResponse(result.content);
          if (parsed) {
            console.log(`  🎭 LLM 生成事件: ${parsed.eventName} — ${parsed.description}`);
            return { ...parsed, source: 'llm', decision };
          }
        }
      } catch (e) {
        console.warn(`  🎭 LLM 事件生成失败: ${e.message}，降级为规则生成`);
      }
    }

    // 降级：规则生成
    return this._ruleBasedGenerate(decision);
  }

  _buildPrompt(decision) {
    const { participants, eventDirection, trigger } = decision;
    const actorId = participants?.actor;
    const targetId = participants?.target;

    // 构建参与者的角色档案
    const dramatisPersonae = [];
    for (const id of [actorId, targetId].filter(Boolean)) {
      const npc = this.npcs?.get(id);
      const brain = this.npcBrains?.get(id);
      const state = this.internalStates?.get(id);
      if (!npc) continue;

      const rels = [];
      if (actorId && targetId && id !== actorId) {
        const rel = this.graph?.getAttitude(id, actorId);
        if (rel) rels.push(`对${this._npcName(actorId)}: 信任${f(rel.trust)} 好感${f(rel.affection)} 怨恨${f(rel.resentment)}`);
      }
      if (actorId && targetId && id !== targetId) {
        const rel = this.graph?.getAttitude(id, targetId);
        if (rel) rels.push(`对${this._npcName(targetId)}: 信任${f(rel.trust)} 好感${f(rel.affection)} 怨恨${f(rel.resentment)}`);
      }

      const topDesires = state?.getTopDesires(2)?.map(d => d.label).join('、') || '无';

      dramatisPersonae.push(
        `[${npc.name}]: 职业${npc.job || '未知'}，${npc.backstory || ''}\n` +
        `  当前欲望: ${topDesires}，心理状态: ${state?.getPsychStateLabel() || '正常'}，压力: ${((state?.stress || 0) * 100).toFixed(0)}%` +
        (rels.length ? `\n  关系: ${rels.join(' | ')}` : '')
      );
    }

    const prompt = `你是一个像素风东方古镇沙盒游戏的戏剧编剧。

## 角色档案
${dramatisPersonae.join('\n\n')}

## 当前情境
- 戏剧触发: ${trigger.type} (score: ${trigger.score || 'N/A'})
- 事件方向: ${eventDirection}
- 全镇氛围: ${DRAMA_TEMP[this.dramaTemp]?.desc || '平静'}

## 任务
构思一个能推进剧情的事件种子。事件应微妙自然、符合角色性格、可在游戏中执行。

## 输出格式（JSON only）
{"eventName":"...","eventType":"...","actors":["id"],"targetID":"id","motivation":"...","description":"...","intensity":0.7,"location":"..."}

## 可选高级参数
你的事件会通过冲击引擎计算 NPC 的反应，但如果你想精确控制某些 NPC 的情感变化，可添加：
- "relationDeltas": {"trust":-0.3} — 旁观者对所有参与者的关系变化(对称)
- "actorRelationDeltas": {"trust":0.2,"affection":0.3} — 旁观者对行为者的关系(如侠义感激)
- "targetRelationDeltas": {"fear":0.2,"resentment":0.3} — 旁观者对目标的关系(如厌恶恶霸)
- "stressBase": 0.15 — 冲击基准值(默认0.1)，越大压力越大
- "desireDeltas": {"revenge":0.2,"safety":0.1} — 欲望变化
- "baseSeverity": "SIGNIFICANT" — TRIVIAL|MINOR|SIGNIFICANT|MAJOR|TRAUMATIC|LIFE_CHANGING
- "category": "violence" — 影响人格修正的计算分类

大多数事件不需要这些参数，系统会自动计算。仅当你觉得默认计算不符合你的叙事意图时使用。`;

    return prompt;
  }

  _parseLLMResponse(content) {
    try {
      // 尝试直接解析 JSON
      const json = JSON.parse(content);
      if (json.eventName && json.eventType) return json;
    } catch {}

    // 尝试提取 JSON 块
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const json = JSON.parse(match[0]);
        if (json.eventName) return json;
      } catch {}
    }

    return null;
  }

  /** 基于规则的事件生成（无 LLM 时使用） */
  _ruleBasedGenerate(decision) {
    const { eventDirection, participants, trigger } = decision;

    const templates = {
      conflict_escalation: [
        { eventName: '公开争吵', eventType: 'publicly_humiliated',
          description: `${this._npcName(participants.actor)} 当众羞辱了 ${this._npcName(participants.target)}`,
          intensity: 0.7, location: 'town_square' },
        { eventName: '暗中破坏', eventType: 'item_stolen',
          description: `${this._npcName(participants.actor)} 破坏了 ${this._npcName(participants.target)} 的财物`,
          intensity: 0.5, location: 'market' },
        { eventName: '散布谣言', eventType: 'rumor_heard',
          description: `关于 ${this._npcName(participants.target)} 的恶意谣言开始在小镇流传`,
          intensity: 0.4, location: 'tavern' },
      ],
      breakdown_crisis: [
        { eventName: '当众崩溃', eventType: 'publicly_humiliated',
          description: `${this._npcName(participants.target)} 在众人面前情绪崩溃`,
          intensity: 0.8, location: 'town_square' },
        { eventName: '冲动攻击', eventType: 'attacked',
          description: `${this._npcName(participants.target)} 在压力下攻击了身边的人`,
          intensity: 0.6, location: 'tavern' },
      ],
      social_encounter: [
        { eventName: '意外相遇', eventType: 'spoken_to',
          description: `多人在 ${decision.location ? '某地' : '镇上'} 意外相遇，气氛微妙`,
          intensity: 0.3, location: 'market' },
        { eventName: '酒后真言', eventType: 'secret_learned',
          description: `在酒馆的聚会中，有人喝多了说出了不该说的话`,
          intensity: 0.4, location: 'tavern' },
      ],
    };

    const pool = templates[eventDirection] || templates.conflict_escalation;
    const template = pool[Math.floor(Math.random() * pool.length)];

    return {
      ...template,
      actors: participants.actor ? [participants.actor] : [],
      targetID: participants.target || null,
      source: 'rule',
      decision,
    };
  }

  // ======================== Phase 4: 落地 (Grounding) ========================

  /**
   * 将生成的事件种子落地为实际的游戏状态变更
   */
  ground(eventSeed) {
    if (!eventSeed) return { success: false, reason: 'no event seed' };

    const results = [];
    const {
      eventType, actors, targetID, intensity, description, location,
      // LLM 可自定义的冲击参数（可选，不设置则用 EVENT_TYPES 默认值）
      stressBase, desireDeltas, baseSeverity, category,
      relationDeltas, actorRelationDeltas, targetRelationDeltas,
    } = eventSeed;

    // 构建统一事件对象（LLM 自定义参数直接透传，calculateImpact 会优先使用）
    const event = {
      eventType: eventType || 'rumor_heard',
      participants: {
        actor: actors?.[0] || null,
        target: targetID || null,
        witnesses: eventSeed.witnesses || [],
      },
      intensity: intensity || 0.5,
      location: location ? { id: location, narrativeTags: [] } : null,
      isDramaEvent: true,
      // 透传 LLM 自定义冲击参数（可选）
      ...(stressBase !== undefined && { stressBase }),
      ...(desireDeltas && { desireDeltas }),
      ...(baseSeverity && { baseSeverity }),
      ...(category && { category }),
      ...(relationDeltas && { relationDeltas }),
      ...(actorRelationDeltas && { actorRelationDeltas }),
      ...(targetRelationDeltas && { targetRelationDeltas }),
    };

    console.log(`  🎬 落地事件: ${eventSeed.eventName} [${event.eventType}] intensity=${event.intensity}`);

    // 对每个直接参与者调用 processEvent
    const affectedIds = new Set([
      event.participants.actor,
      event.participants.target,
      ...event.participants.witnesses,
    ].filter(Boolean));

    for (const npcId of affectedIds) {
      const brain = this.npcBrains?.get(npcId);
      if (brain) {
        try {
          const result = brain.processEvent(event);
          results.push({ npcId, impact: result.impact, summary: result.summary });
        } catch (e) {
          console.warn(`  🎭 落地 ${npcId} 失败: ${e.message}`);
        }
      }
    }

    // 如果没有直接参与者（如 rumor 事件），选择一个随机 NPC 作为起始点
    if (affectedIds.size === 0 && this.npcBrains) {
      const allIds = Array.from(this.npcBrains.keys());
      if (allIds.length > 0) {
        const randomId = allIds[Math.floor(Math.random() * allIds.length)];
        const brain = this.npcBrains.get(randomId);
        if (brain) {
          const result = brain.processEvent(event);
          results.push({ npcId: randomId, impact: result.impact, summary: result.summary });
        }
      }
    }

    this._recordEvent(eventSeed);

    return {
      success: true,
      eventSeed,
      affectedCount: results.length,
      results,
    };
  }

  // ======================== Phase 5: 广播 ========================

  broadcast(eventSeed, groundResult) {
    if (!bus) return;

    bus.emit('drama-event-triggered', {
      eventName: eventSeed.eventName,
      eventType: eventSeed.eventType,
      description: eventSeed.description,
      intensity: eventSeed.intensity,
      affectedCount: groundResult.affectedCount,
      timestamp: Date.now(),
    });

    console.log(`  📡 广播戏剧事件: ${eventSeed.eventName} (${groundResult.affectedCount} 人受影响)`);
  }

  // ======================== 主循环 ========================

  /**
   * 尝试运行一次完整扫描→决策→生成→落地→广播循环
   * 由 GameLoop 定期调用
   */
  async tick() {
    const now = Date.now();
    if (now - this._lastScanTime < this.intervalMs) return null;
    this._lastScanTime = now;

    // 1. 扫描
    const scanResult = this.scan();
    if (scanResult.triggers.length === 0) {
      if (this._tempTimer % 10 === 0) { // 每 10 次无结果才输出一次
        console.log(`  🎭 扫描完成: 无戏剧潜力 (tension=${scanResult.tensionScore})`);
      }
      return null;
    }

    console.log(
      `  🎭 扫描完成: ${scanResult.triggers.length} 个触发点 ` +
      `(tension=${scanResult.tensionScore} temp=${this.dramaTemp})`
    );

    // 2. 决策
    const decision = this.decide(scanResult);
    if (!decision) return null;

    // 3. 生成
    const eventSeed = await this.generate(decision);
    if (!eventSeed) return null;

    // 4. 落地
    const groundResult = this.ground(eventSeed);
    if (!groundResult.success) return null;

    // 5. 广播
    this.broadcast(eventSeed, groundResult);

    return { scanResult, decision, eventSeed, groundResult };
  }

  // ======================== 加速泄露 ========================

  /**
   * 手动加速某个秘密的泄露（用于 Decision 的 accelerate_leak 动作）
   */
  accelerateLeak(secretId) {
    if (!this.secretSystem) return null;

    const secret = this.secretSystem.secrets.get(secretId);
    if (!secret) return null;

    // 找 motivation 最高的 holder 进行强制传播
    let bestHolder = null;
    let bestMotivation = 0;
    for (const [holderId, holder] of secret.holders) {
      const mot = this.secretSystem.calculateSpreadMotivation(holderId, secretId);
      if (mot > bestMotivation && !holder.hasSpread) {
        bestMotivation = mot;
        bestHolder = holderId;
      }
    }

    if (bestHolder) {
      const target = this.secretSystem.selectSpreadTarget(bestHolder, secretId);
      if (target) {
        this.secretSystem.addHolder(secretId, target, 'PARTIAL', bestHolder);
        console.log(`  🎭 加速秘密泄露: ${bestHolder} → ${target} [${secret.content?.substring(0, 30)}]`);
        return { success: true, from: bestHolder, to: target };
      }
    }

    return { success: false, reason: 'no valid spread target' };
  }

  // ======================== 辅助 ========================

  _npcName(id) {
    return this.npcs?.get(id)?.name || id || '???';
  }

  _recordEvent(eventSeed) {
    this._lastEventTime = Date.now();
    this._recentEvents.push({
      time: Date.now(),
      type: eventSeed.eventType,
      name: eventSeed.eventName,
      intensity: eventSeed.intensity || 0.5,
    });
    if (this._recentEvents.length > this._maxRecentEvents) {
      this._recentEvents.shift();
    }
  }

  /** 获取最近的戏剧事件 */
  getRecentEvents(n = 5) {
    return this._recentEvents.slice(-n).reverse();
  }

  /** 获取当前戏剧状态（调试/仪表盘用） */
  getStatus() {
    return {
      dramaTemp: this.dramaTemp,
      dramaTempLabel: DRAMA_TEMP[this.dramaTemp]?.label || '未知',
      lastScanTime: this._lastScanTime,
      lastEventTime: this._lastEventTime,
      recentEvents: this.getRecentEvents(5),
      tempTimer: this._tempTimer,
      intervalMs: this.intervalMs,
    };
  }
}

function f(v) { return (v * 100).toFixed(0) + '%'; }

module.exports = { DramaEngine, DRAMA_TEMP, DRAMA_TRIGGER };
