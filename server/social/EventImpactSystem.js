// 事件冲击计算系统 — 统一的"事件→影响"管道
//
// 核心职责：计算一个事件对某个 NPC 的冲击
//   输入：事件定义 + NPC 身份 + 人格 + 关系 + 心理状态
//   输出：Impact 对象 { severity, duration, stressDelta, desireChanges, ... }
//
// 设计原则：
//   确定性计算（无随机），LLM 不参与
//   同一事件 × 同一 NPC × 同一状态 → 永远产生同一 Impact
//
// 文献支撑：
//   - Ochs et al. 情感一致性（OCC emotion congruence）
//   - DESIGN.md 的 NPC 内心系统 + 八维关系

// ======================== 常量 ========================

const SEVERITY = {
  TRIVIAL:       { order: 0, label: '微不足道',  desc: '不留下印象的小事' },
  MINOR:         { order: 1, label: '轻微',      desc: '有情绪波动但不持久' },
  SIGNIFICANT:   { order: 2, label: '显著',      desc: '留下清晰记忆' },
  MAJOR:         { order: 3, label: '重大',      desc: '可能改变行为模式' },
  TRAUMATIC:     { order: 4, label: '创伤性',    desc: '触发心理防线崩溃' },
  LIFE_CHANGING: { order: 5, label: '改变人生',   desc: '永久改变人格/信念/人生轨迹' },
};

const DURATION = {
  MOMENTARY: { label: '瞬间', decayRate: 0 },        // 不需要 decay，瞬间消逝
  TEMPORARY: { label: '暂时', decayRate: 0.002 },     // 30s 游戏时间 ≈ 500 ticks
  PROLONGED: { label: '持续', decayRate: 0.0005 },    // 持续多天
  PERMANENT: { label: '永久', decayRate: 0 },          // 不 decay
};

const MEMORY_QUALITY = {
  FLEETING:   { label: '转瞬即逝', importanceFloor: 0,   importanceCeil: 0.2 },
  REMEMBERED: { label: '记得',     importanceFloor: 0.2, importanceCeil: 0.5 },
  HAUNTING:   { label: '萦绕',     importanceFloor: 0.5, importanceCeil: 0.8 },
  DEFINING:   { label: '刻骨铭心', importanceFloor: 0.8, importanceCeil: 1.0 },
};

// OCC 情感对（来自 Ochs et al.）
const OCC_EMOTION_PAIRS = {
  joy:       { opposite: 'distress',  valence: +1 },
  distress:  { opposite: 'joy',       valence: -1 },
  hope:      { opposite: 'fear',      valence: +1 },
  fear:      { opposite: 'hope',      valence: -1 },
  admiration:{ opposite: 'reproach',  valence: +1 },
  reproach:  { opposite: 'admiration',valence: -1 },
  pride:     { opposite: 'shame',     valence: +1 },
  shame:     { opposite: 'pride',     valence: -1 },
};

// ======================== 事件类型目录 ========================

const EVENT_TYPES = {
  // === 暴力类 ===
  attacked: {
    label: '被攻击',
    category: 'violence',
    stressBase: 0.15,
    desireDeltas: { safety: 0.15, revenge: 0.12 },
    relationDeltas: { trust: -0.4, affection: -0.5, fear: 0.4, resentment: 0.3, suspicion: 0.1 },
    baseSeverity: 'MINOR',
    baseMemoryImportance: 0.9,
    baseMemoryQuality: 'HAUNTING',
    occEmotion: 'distress',
  },
  righteous_violence: {
    label: '侠义行为',
    category: 'violence',
    stressBase: 0.03,
    desireDeltas: { social: 0.03, safety: -0.02 },
    // 目标（被揍的恶霸）对行为者的关系变化
    relationDeltas: { trust: -0.3, affection: -0.3, fear: 0.3, resentment: 0.4 },
    // 旁观者对义士（actor）的关系变化 — 感激/敬佩
    actorRelationDeltas: { trust: 0.25, affection: 0.3, respect: 0.25, debt: 0.15 },
    // 旁观者对恶霸（target）的关系变化 — 恐惧/怨恨
    targetRelationDeltas: { fear: 0.2, resentment: 0.3, suspicion: 0.15 },
    baseSeverity: 'TRIVIAL',
    baseMemoryImportance: 0.35,
    baseMemoryQuality: 'REMEMBERED',
    occEmotion: 'admiration',
  },
  witnessed_violence: {
    label: '目睹暴力',
    category: 'violence',
    stressBase: 0.08,
    desireDeltas: { safety: 0.08 },
    relationDeltas: {}, // 取决于 NPC 与施暴者/受害者的关系
    baseSeverity: 'TRIVIAL',
    baseMemoryImportance: 0.5,
    baseMemoryQuality: 'REMEMBERED',
    occEmotion: 'fear',
  },
  witnessed_death: {
    label: '目睹死亡',
    category: 'violence',
    stressBase: 0.25,
    desireDeltas: { safety: 0.15, revenge: 0.10 },
    relationDeltas: { trust: -0.15, affection: -0.1, fear: 0.2 },
    baseSeverity: 'MAJOR',
    baseMemoryImportance: 0.95,
    baseMemoryQuality: 'DEFINING',
    occEmotion: 'distress',
  },

  // === 社交类 ===
  received_gift: {
    label: '收到礼物',
    category: 'social',
    stressBase: -0.08, // 正数 = 缓解压力
    desireDeltas: { social: -0.05 },
    relationDeltas: { trust: 0.2, affection: 0.3, debt: 0.15 },
    baseSeverity: 'TRIVIAL',
    baseMemoryImportance: 0.35,
    baseMemoryQuality: 'REMEMBERED',
    occEmotion: 'joy',
  },
  helped_by_other: {
    label: '被帮助',
    category: 'social',
    stressBase: -0.07,
    desireDeltas: { social: -0.03 },
    relationDeltas: { trust: 0.15, affection: 0.2, debt: 0.25 },
    baseSeverity: 'TRIVIAL',
    baseMemoryImportance: 0.3,
    baseMemoryQuality: 'REMEMBERED',
    occEmotion: 'joy',
  },
  spoken_to: {
    label: '被搭话',
    category: 'social',
    stressBase: 0,
    desireDeltas: { social: -0.03 },
    relationDeltas: {},
    baseSeverity: 'TRIVIAL',
    baseMemoryImportance: 0.1,
    baseMemoryQuality: 'FLEETING',
    occEmotion: 'hope',
  },

  // === 背叛/羞辱类 ===
  betrayed: {
    label: '被背叛',
    category: 'betrayal',
    stressBase: 0.20,
    desireDeltas: { revenge: 0.25, safety: 0.10 },
    relationDeltas: { trust: -0.6, affection: -0.4, resentment: 0.5, suspicion: 0.2, debt: -0.3 },
    baseSeverity: 'MAJOR',
    baseMemoryImportance: 0.85,
    baseMemoryQuality: 'DEFINING',
    occEmotion: 'distress',
  },
  publicly_humiliated: {
    label: '被公开羞辱',
    category: 'betrayal',
    stressBase: 0.18,
    desireDeltas: { revenge: 0.20, honor: 0.15 },
    relationDeltas: { trust: -0.3, affection: -0.3, resentment: 0.4, fear: 0.1 },
    baseSeverity: 'SIGNIFICANT',
    baseMemoryImportance: 0.8,
    baseMemoryQuality: 'HAUNTING',
    occEmotion: 'shame',
  },
  publicly_accused: {
    label: '被公开指控',
    category: 'betrayal',
    stressBase: 0.15,
    desireDeltas: { honor: 0.18, revenge: 0.15 },
    relationDeltas: { trust: -0.3, resentment: 0.3, suspicion: 0.15 },
    baseSeverity: 'SIGNIFICANT',
    baseMemoryImportance: 0.7,
    baseMemoryQuality: 'HAUNTING',
    occEmotion: 'fear',
  },

  // === 知识/秘密类 ===
  secret_learned: {
    label: '得知秘密',
    category: 'knowledge',
    stressBase: 0.06,
    desireDeltas: { power: 0.08 },
    relationDeltas: {},
    baseSeverity: 'TRIVIAL',
    baseMemoryImportance: 0.55,
    baseMemoryQuality: 'REMEMBERED',
    occEmotion: 'hope',
  },
  secret_exposed_self: {
    label: '自己的秘密被公开',
    category: 'knowledge',
    stressBase: 0.22,
    desireDeltas: { honor: 0.2, revenge: 0.18, safety: 0.12 },
    relationDeltas: { trust: -0.3, affection: -0.2, resentment: 0.35, suspicion: 0.25 },
    baseSeverity: 'MAJOR',
    baseMemoryImportance: 0.9,
    baseMemoryQuality: 'DEFINING',
    occEmotion: 'shame',
  },
  rumor_heard: {
    label: '听到传闻',
    category: 'knowledge',
    stressBase: 0.02,
    desireDeltas: {},
    relationDeltas: {},
    baseSeverity: 'TRIVIAL',
    baseMemoryImportance: 0.15,
    baseMemoryQuality: 'FLEETING',
    occEmotion: 'admiration',
  },

  // === 生死类 ===
  loved_one_died: {
    label: '挚爱离世',
    category: 'life_death',
    stressBase: 0.35,
    desireDeltas: { revenge: 0.25, safety: 0.2, protection: 0.3 },
    relationDeltas: {},
    baseSeverity: 'TRAUMATIC',
    baseMemoryImportance: 1.0,
    baseMemoryQuality: 'DEFINING',
    occEmotion: 'distress',
  },
  near_death_experience: {
    label: '死里逃生',
    category: 'life_death',
    stressBase: 0.3,
    desireDeltas: { safety: 0.3, freedom: -0.15 },
    relationDeltas: {},
    baseSeverity: 'TRAUMATIC',
    baseMemoryImportance: 0.95,
    baseMemoryQuality: 'DEFINING',
    occEmotion: 'fear',
  },

  // === 温暖类 ===
  kind_stranger: {
    label: '陌生人的善意',
    category: 'warmth',
    stressBase: -0.05,
    desireDeltas: { social: 0.05 },
    relationDeltas: { trust: 0.1, affection: 0.1 },
    baseSeverity: 'TRIVIAL',
    baseMemoryImportance: 0.2,
    baseMemoryQuality: 'FLEETING',
    occEmotion: 'joy',
  },
  shared_secret_moment: {
    label: '共享秘密时刻',
    category: 'warmth',
    stressBase: -0.03,
    desireDeltas: { social: -0.05, lust: 0.1 },
    relationDeltas: { trust: 0.25, affection: 0.2 },
    baseSeverity: 'TRIVIAL',
    baseMemoryImportance: 0.45,
    baseMemoryQuality: 'REMEMBERED',
    occEmotion: 'joy',
  },

  // === 经济类 ===
  item_stolen: {
    label: '财物被盗',
    category: 'economy',
    stressBase: 0.1,
    desireDeltas: { wealth: 0.12, safety: 0.08, revenge: 0.15 },
    relationDeltas: { trust: -0.25, resentment: 0.25, suspicion: 0.15 },
    baseSeverity: 'MINOR',
    baseMemoryImportance: 0.55,
    baseMemoryQuality: 'REMEMBERED',
    occEmotion: 'distress',
  },
  gift_received_valuable: {
    label: '收到贵重礼物',
    category: 'economy',
    stressBase: -0.05,
    desireDeltas: { wealth: -0.05, social: -0.03 },
    relationDeltas: { trust: 0.3, affection: 0.3, debt: 0.3 },
    baseSeverity: 'MINOR',
    baseMemoryImportance: 0.5,
    baseMemoryQuality: 'REMEMBERED',
    occEmotion: 'joy',
  },

  // === 目标/成就类 ===
  goal_achieved: {
    label: '目标达成',
    category: 'achievement',
    stressBase: -0.1,
    desireDeltas: { power: -0.05 },
    relationDeltas: {},
    baseSeverity: 'TRIVIAL',
    baseMemoryImportance: 0.4,
    baseMemoryQuality: 'REMEMBERED',
    occEmotion: 'pride',
  },
  goal_blocked: {
    label: '目标受阻',
    category: 'achievement',
    stressBase: 0.08,
    desireDeltas: { revenge: 0.1, power: 0.08 },
    relationDeltas: { resentment: 0.15, suspicion: 0.1 },
    baseSeverity: 'MINOR',
    baseMemoryImportance: 0.4,
    baseMemoryQuality: 'REMEMBERED',
    occEmotion: 'distress',
  },
};

// ======================== 辅助函数 ========================

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * 计算大五人格对事件冲击的修正系数
 * @returns {number} multiplier (0.5 ~ 1.5)
 */
function personalityModifier(traits, eventType, role) {
  const def = EVENT_TYPES[eventType];
  if (!def) return 1.0;

  const T = traits;
  let mod = 1.0;

  // 神经质：放大所有负面冲击
  if (def.stressBase > 0) {
    mod += T.neuroticism * 0.5;  // 高神经质 → 冲击放大最多 +50%
  }

  // 宜人性：缓冲暴力类冲击（对 target 角色更明显）
  if (def.category === 'violence' && role === 'target') {
    mod -= T.agreeableness * 0.3; // 高宜人 → 更受伤害，但反应更内化
  }

  // 外向性：放大社交类事件
  if (def.category === 'social') {
    mod += (T.extraversion - 0.5) * 0.4; // 高外向 → 社交事件影响更大
  }

  // 尽责性：降低 betrayal 类事件的信任损失
  if (def.category === 'betrayal') {
    mod += (T.conscientiousness - 0.5) * 0.2;
  }

  return clamp(mod, 0.5, 1.5);
}

/**
 * 计算关系对事件冲击的修正系数
 * @param {object} relToActor - NPC 对施事者的 8 维态度
 * @param {object} relToTarget - NPC 对受害者的 8 维态度
 * @param {string} role - NPC 在事件中的角色
 * @returns {number} multiplier (0.5 ~ 1.5)
 */
function relationModifier(relToActor, relToTarget, role) {
  let mod = 1.0;

  if (role === 'target' && relToActor) {
    // NPC 是事件的受害者 → 与施事者的关系影响冲击
    if (relToActor.affection > 0.5) mod += 0.3;  // 被爱的人伤害 → 更痛
    if (relToActor.trust > 0.5) mod += 0.2;       // 被信任的人伤害 → 更痛
    if (relToActor.fear > 0.5) mod += 0.2;        // 本来就害怕 → 冲击更大
  }

  if (role === 'witness' && relToTarget) {
    // NPC 是目击者 → 与受害者的关系影响冲击
    if (relToTarget.affection > 0.5) mod += 0.3;  // 目睹爱的人受害 → 更痛
    if (relToTarget.trust > 0.4) mod += 0.15;
    if (relToTarget.fear > 0.5) mod -= 0.1;       // 怕受害者 → 可能幸灾乐祸
  }

  if (role === 'related') {
    // NPC 通过社交网络间接关联
    // 与受害者和施事者都有微弱联系 → 轻微修正
    if (relToTarget && relToTarget.affection > 0.3) mod += 0.1;
    if (relToActor && relToActor.resentment > 0.5) mod -= 0.1;
  }

  return clamp(mod, 0.5, 1.5);
}

/**
 * 计算 OCC 情感一致性修正
 * 来自 Ochs et al. 的核心机制：旁观者的情绪反应取决于
 * 旁观者与参与者之间的情感是否同步
 *
 * @param {string} eventOccEmotion - 事件触发的 OCC 情感
 * @param {object} relToActor - 旁观者对施事者的关系
 * @param {object} relToTarget - 旁观者对受害者的关系
 * @param {object} traits - 旁观者的人格
 * @returns {object} { congruenceTarget: -1~1, solidarityShift: -1~1, stressMod: -0.5~0.5 }
 */
function emotionCongruence(eventOccEmotion, relToActor, relToTarget, traits) {
  const occ = OCC_EMOTION_PAIRS[eventOccEmotion];
  if (!occ) return { congruenceTarget: 0, solidarityShift: 0, stressMod: 0 };

  let congruenceTarget = 0;   // 正 = 与受害者情感同步，负 = 与施事者情感同步
  let solidarityShift = 0;

  // 判断 NPC 的情感倾向：更认同受害者还是施事者
  if (relToTarget && relToActor) {
    const targetBond = relToTarget.affection + relToTarget.trust;
    const actorBond = relToActor.affection + relToActor.trust;
    congruenceTarget = clamp((targetBond - actorBond) * 0.5, -1, 1);
  } else if (relToTarget) {
    congruenceTarget = clamp((relToTarget.affection + relToTarget.trust) * 0.5, 0, 1);
  } else if (relToActor) {
    congruenceTarget = clamp(-(relToActor.affection + relToActor.trust) * 0.5, -1, 0);
  }

  // 宜人性高 → 更容易与受害者情感同步
  congruenceTarget += (traits.agreeableness - 0.5) * 0.3;

  // 情感同步程度影响团结感
  if (Math.abs(congruenceTarget) > 0.3) {
    solidarityShift = congruenceTarget * 0.2;
  }

  // 情感不同步 → 额外心理压力（认知失调）
  const stressMod = Math.abs(congruenceTarget) < 0.1 ? 0.03 : 0;

  return {
    congruenceTarget: clamp(congruenceTarget, -1, 1),
    solidarityShift: clamp(solidarityShift, -0.3, 0.3),
    stressMod,
  };
}

/**
 * 心理状态对冲击的修正
 */
function psychStateModifier(psychState) {
  const map = {
    NORMAL: 1.0,
    ANXIOUS: 1.15,
    PARANOID: 1.3,
    BREAKDOWN: 1.5,
    FRENZY: 1.7,
  };
  return map[psychState] || 1.0;
}

// ======================== 主类 ========================

class EventImpactSystem {
  /**
   * @param {object} deps
   * @param {RelationshipGraph} deps.graph
   * @param {Map<string, NPCInternalState>} deps.internalStates
   */
  constructor({ graph, internalStates }) {
    this.graph = graph;
    this.internalStates = internalStates;
  }

  /**
   * 计算事件对某个 NPC 的冲击
   *
   * @param {object} event
   *   eventType: string        — EVENT_TYPES 的 key
   *   participants: object     — { actor?: id, target?: id, witnesses?: id[] }
   *   intensity: number        — 0~1，事件本身的严重程度
   *   location: object         — { id, narrativeTags[] } (可选)
   *   isPlayerAction: boolean  — 是否玩家触发（可选）
   * @param {string} npcId      — 受影响的 NPC ID
   * @param {object} traits     — NPC 的大五人格
   *   { openness, conscientiousness, extraversion, agreeableness, neuroticism }
   * @returns {object} Impact
   */
  calculateImpact(event, npcId, traits) {
    const template = EVENT_TYPES[event.eventType];
    // 事件可携带 inline 冲击参数（用于 LLM 生成的自定义事件类型，无需模板）
    // 优先级: event.inline > template
    const def = template ? {
      ...template,
      stressBase:        event.stressBase ?? template.stressBase,
      desireDeltas:     event.desireDeltas ?? template.desireDeltas,
      baseSeverity:     event.baseSeverity ?? template.baseSeverity,
      baseMemoryImportance: event.baseMemoryImportance ?? template.baseMemoryImportance,
      baseMemoryQuality:    event.baseMemoryQuality ?? template.baseMemoryQuality,
      occEmotion:       event.occEmotion ?? template.occEmotion,
      category:         event.category ?? template.category,
    } : (event.stressBase ? { // 无模板但有自携带参数 → 用 event 本身 + 默认值
      label: event.eventType,
      category: event.category || 'social',
      occEmotion: event.occEmotion || 'distress',
      stressBase: event.stressBase || 0.1,
      desireDeltas: event.desireDeltas || {},
      baseSeverity: event.baseSeverity || 'MINOR',
      baseMemoryImportance: event.baseMemoryImportance ?? 0.5,
      baseMemoryQuality: event.baseMemoryQuality || 'REMEMBERED',
      relationDeltas: event.relationDeltas || {},
      actorRelationDeltas: event.actorRelationDeltas,
      targetRelationDeltas: event.targetRelationDeltas,
    } : null);

    if (!def) {
      return this._nullImpact(event, npcId);
    }

    const { participants, intensity = 0.5 } = event;
    const internalState = this.internalStates?.get(npcId);

    // 1. 确定 NPC 在事件中的角色
    const role = this._determineRole(npcId, participants);

    // 2. 获取 NPC 与参与者的关系
    const relToActor = participants.actor
      ? this.graph?.getAttitude(npcId, participants.actor) || null
      : null;
    const relToTarget = participants.target
      ? this.graph?.getAttitude(npcId, participants.target) || null
      : null;

    // 3. 计算各项修正系数
    const pMod = personalityModifier(traits, event.eventType, role);
    const rMod = relationModifier(relToActor, relToTarget, role);
    const psychState = internalState?.psychState || 'NORMAL';
    const psyMod = psychStateModifier(psychState);
    const intensityMod = 0.5 + intensity * 0.5; // intensity 0→0.5x, 0.5→0.75x, 1→1x

    const totalMod = pMod * rMod * psyMod * intensityMod;

    // 4. OCC 情感一致性（仅对非直接参与者）
    let occResult = { congruenceTarget: 0, solidarityShift: 0, stressMod: 0 };
    if (role === 'witness' || role === 'related') {
      occResult = emotionCongruence(def.occEmotion, relToActor, relToTarget, traits);
    }

    // 5. 计算 stressDelta
    let stressDelta = def.stressBase * totalMod + occResult.stressMod;
    // 隐忍型 → 实际冲击比表面大（内化）
    if (internalState?.reactionStyle === 'STOIC' && stressDelta > 0) {
      stressDelta *= 1.2;
    }
    stressDelta = clamp(Math.round(stressDelta * 1000) / 1000, -0.5, 0.5);

    // 6. 计算 severity
    let severity = this._calcSeverity(def, stressDelta, role, internalState, event);

    // 7. 根据 severity 计算 duration
    const duration = this._calcDuration(severity);

    // 8. 构建 desireDeltas
    const desireChanges = {};
    for (const [key, base] of Object.entries(def.desireDeltas)) {
      let delta = base * totalMod;
      // 隐忍型 → 复仇欲内化更强
      if (key === 'revenge' && internalState?.reactionStyle === 'STOIC' && delta > 0) {
        delta *= 1.3;
      }
      // 爆发型 → 复仇欲释放得极端
      if (key === 'revenge' && internalState?.reactionStyle === 'EXPLOSIVE' && delta > 0) {
        delta *= 1.5;
      }
      desireChanges[key] = clamp(Math.round(delta * 1000) / 1000, -0.5, 0.5);
    }

    // 9. 构建 relationChanges
    const relationChanges = this._buildRelationChanges(
      def, event, participants, npcId, relToActor, relToTarget, role, totalMod, occResult
    );

    // 10. 检查防线触发
    const defenseTriggers = this._checkDefenseTriggers(event, def, severity, internalState);

    // 11. 检查信念风险
    const beliefRisk = this._checkBeliefRisk(def, severity, internalState);

    // 12. 计算记忆参数
    const memoryImportance = clamp(
      def.baseMemoryImportance * totalMod + (intensity * 0.2),
      0, 1
    );
    const memoryQuality = this._calcMemoryQuality(memoryImportance);

    // 13. 声誉影响
    const reputationDelta = clamp(def.stressBase * 0.5 * totalMod, -0.5, 0.5);

    // 14. 构建 Impact
    return {
      eventType: event.eventType,
      npcId,
      role,
      severity: SEVERITY[severity],
      duration: DURATION[duration],
      stressDelta,
      desireChanges,
      beliefRisk,
      defenseTriggers,
      relationChanges,
      reputationDelta,
      memoryImportance: Math.round(memoryImportance * 1000) / 1000,
      memoryQuality: MEMORY_QUALITY[memoryQuality],
      occCongruence: occResult,
      modifiers: { personality: pMod, relation: rMod, psychState: psyMod, intensity: intensityMod },
      // 诊断用（调试时可以查看中间值）
      _debug: { def, totalMod, role },
    };
  }

  // ======================== 内部方法 ========================

  _determineRole(npcId, participants) {
    if (participants.actor === npcId) return 'actor';
    if (participants.target === npcId) return 'target';
    if (participants.witnesses && participants.witnesses.includes(npcId)) return 'witness';
    return 'related';
  }

  _calcSeverity(def, stressDelta, role, internalState, event) {
    // 从 baseSeverity 开始
    let severity = def.baseSeverity;

    // stressDelta 超过阈值 → 升级
    const absStress = Math.abs(stressDelta);
    if (absStress > 0.3) severity = this._upgradeSeverity(severity, 3);
    else if (absStress > 0.2) severity = this._upgradeSeverity(severity, 2);
    else if (absStress > 0.1) severity = this._upgradeSeverity(severity, 1);

    // 检查是否有相关防线会在本事件中被突破 → 至少 MAJOR
    const defenseMap = {
      betrayed: 'public_humiliation',
      publicly_humiliated: 'public_humiliation',
      publicly_accused: 'public_humiliation',
      secret_exposed_self: 'secret_exposed',
      attacked: 'dignity_crushed',
      loved_one_died: 'family_threat',
    };
    const relevantDefense = defenseMap[def.eventType] || defenseMap[event.eventType];
    if (relevantDefense && internalState && internalState.stress >= (internalState.defenses?.[relevantDefense]?.threshold || 1)) {
      severity = this._ensureMinSeverity(severity, 'MAJOR');
    }

    // 直接参与者（actor/target）→ 比旁观者高一级
    if (role === 'target' || role === 'actor') {
      severity = this._upgradeSeverity(severity, 1);
    }

    // intensity 极高 → 再升一级
    if (event.intensity > 0.8) {
      severity = this._upgradeSeverity(severity, 1);
    }

    return severity;
  }

  _upgradeSeverity(current, steps) {
    const order = SEVERITY[current]?.order || 0;
    const newOrder = Math.min(order + steps, 5);
    for (const [key, val] of Object.entries(SEVERITY)) {
      if (val.order === newOrder) return key;
    }
    return current;
  }

  _ensureMinSeverity(current, minLevel) {
    const currentOrder = SEVERITY[current]?.order || 0;
    const minOrder = SEVERITY[minLevel]?.order || 0;
    if (currentOrder >= minOrder) return current;
    return minLevel;
  }

  _calcDuration(severity) {
    const map = {
      TRIVIAL: 'MOMENTARY',
      MINOR: 'TEMPORARY',
      SIGNIFICANT: 'TEMPORARY',
      MAJOR: 'PROLONGED',
      TRAUMATIC: 'PROLONGED',
      LIFE_CHANGING: 'PERMANENT',
    };
    return map[severity] || 'TEMPORARY';
  }

  _buildRelationChanges(def, event, participants, npcId, relToActor, relToTarget, role, totalMod, occResult) {
    const changes = {};

    // 事件对象可携带 inline 参数覆盖类型定义（用于 LLM 生成的自定义事件）
    // 优先级：event.inline > def.* (类型模板) > def.relationDeltas (base)
    const actorRD = event.actorRelationDeltas || def.actorRelationDeltas;
    const targetRD = event.targetRelationDeltas || def.targetRelationDeltas;

    for (const [targetRole, targetId] of [
      ['actor', participants.actor],
      ['target', participants.target],
    ]) {
      if (!targetId || targetId === npcId) continue;

      let baseDeltas = event.relationDeltas || def.relationDeltas;
      if (actorRD && targetRole === 'actor' && role === 'witness') {
        baseDeltas = actorRD;
      } else if (targetRD && targetRole === 'target' && role !== 'target') {
        baseDeltas = targetRD;
      }

      const deltas = {};
      for (const [dim, base] of Object.entries(baseDeltas)) {
        let delta = base * totalMod;
        deltas[dim] = clamp(Math.round(delta * 1000) / 1000, -1, 1);
      }

      // OCC 团结感修正
      if (occResult.solidarityShift !== 0) {
        if (targetRole === 'target' && occResult.congruenceTarget > 0) {
          // 与受害者情感同步 → 对受害者好感上升
          deltas.affection = clamp((deltas.affection || 0) + occResult.solidarityShift, -1, 1);
        }
        if (targetRole === 'actor' && occResult.congruenceTarget < 0) {
          // 与施事者情感同步 → 对施事者好感上升
          deltas.affection = clamp((deltas.affection || 0) - occResult.solidarityShift, -1, 1);
        }
      }

      if (Object.keys(deltas).length > 0) {
        changes[targetId] = deltas;
      }
    }

    return changes;
  }

  _checkDefenseTriggers(event, def, severity, internalState) {
    if (!internalState) return [];

    const triggers = [];

    // 根据事件类型自动映射到防线
    const defenseMap = {
      betrayed: ['public_humiliation'],
      publicly_humiliated: ['public_humiliation'],
      publicly_accused: ['public_humiliation', 'dignity_crushed'],
      secret_exposed_self: ['secret_exposed'],
      attacked: ['dignity_crushed'],
      witnessed_death: ['dignity_crushed'],
      loved_one_died: ['family_threat', 'lover_taken'],
    };

    const relevantDefenses = defenseMap[event.eventType] || [];

    for (const defKey of relevantDefenses) {
      // 只有 severity >= MAJOR 才可能触发防线
      if (SEVERITY[severity]?.order >= 3) {
        triggers.push(defKey);
      }
    }

    return triggers;
  }

  _checkBeliefRisk(def, severity, internalState) {
    if (!internalState) return [];

    const risks = [];

    // severity >= TRAUMATIC → 检查与事件类型相关的信念
    if (SEVERITY[severity]?.order >= 4) {
      if (def.category === 'betrayal') {
        risks.push('forgiveness', 'loyalty_above');
      }
      if (def.category === 'violence') {
        risks.push('might_right', 'honor_before_life');
      }
      if (def.category === 'life_death') {
        risks.push('family_first', 'freedom_priceless');
      }
    }

    return risks;
  }

  _calcMemoryQuality(importance) {
    if (importance >= 0.8) return 'DEFINING';
    if (importance >= 0.5) return 'HAUNTING';
    if (importance >= 0.2) return 'REMEMBERED';
    return 'FLEETING';
  }

  _nullImpact(event, npcId) {
    return {
      eventType: event.eventType || 'unknown',
      npcId,
      role: 'related',
      severity: SEVERITY.TRIVIAL,
      duration: DURATION.MOMENTARY,
      stressDelta: 0,
      desireChanges: {},
      beliefRisk: [],
      defenseTriggers: [],
      relationChanges: {},
      reputationDelta: 0,
      memoryImportance: 0,
      memoryQuality: MEMORY_QUALITY.FLEETING,
      occCongruence: { congruenceTarget: 0, solidarityShift: 0, stressMod: 0 },
      modifiers: { personality: 1, relation: 1, psychState: 1, intensity: 1 },
      _debug: { def: null, totalMod: 1, role: 'related' },
    };
  }

  /**
   * 应用 Impact 到所有数据系统（副作用）
   * 这是从 Impact 对象到实际游戏状态的"落地"步骤
   *
   * @param {object} impact — calculateImpact 的返回
   * @param {object} brain  — NPCBrain 实例
   * @returns {object} 应用结果摘要
   */
  applyImpact(impact, brain) {
    const { npc } = brain;
    const summary = { applied: [], skipped: [] };

    // 1. 压力
    if (impact.stressDelta !== 0 && brain.internalState) {
      if (impact.stressDelta > 0) {
        brain.internalState.addStress(impact.stressDelta, `${impact.eventType} 事件`);
      } else {
        brain.internalState.relieveStress(Math.abs(impact.stressDelta), `${impact.eventType} 事件`);
      }
      summary.applied.push('stress');
    }

    // 2. 欲望
    for (const [key, delta] of Object.entries(impact.desireChanges)) {
      if (delta !== 0 && brain.internalState) {
        brain.internalState.adjustDesire(key, delta, `${impact.eventType} 事件`);
        summary.applied.push(`desire:${key}`);
      }
    }

    // 3. 关系
    for (const [targetId, dims] of Object.entries(impact.relationChanges)) {
      const reason = `${impact.eventType} 事件`;
      brain.graph.adjust(npc.id, targetId, dims, reason);
      summary.applied.push(`relation:${npc.id}→${targetId}`);
    }

    // 4. 记忆
    if (impact.memoryImportance > 0.1) {
      const content = EventImpactSystem._formatMemoryContent(impact, brain);
      brain.memory.addEvent(impact.eventType, impact.npcId, content, impact.memoryImportance);
      summary.applied.push('memory');
    }

    // 5. 情绪
    this._applyMood(impact, brain);

    // 6. 防线检查
    for (const defKey of impact.defenseTriggers) {
      if (brain.internalState) {
        const result = brain.internalState.checkDefense(defKey, {
          type: impact.eventType,
          impact,
        });
        if (result && result.breached) {
          summary.applied.push(`defense:${defKey}(BREACHED!)`);
        } else {
          summary.skipped.push(`defense:${defKey}(not breached)`);
        }
      }
    }

    // 7. 信念风险（只有 severity >= TRAUMATIC 才可能打破）
    if (impact.beliefRisk.length > 0 && impact.severity.order >= 4 && brain.internalState) {
      for (const beliefId of impact.beliefRisk) {
        const belief = brain.internalState.beliefs.find(b => b.id === beliefId && !b.broken);
        if (belief) {
          // 高压力下有小概率打破信念（NPCInternalState 内部会用 Math.random）
          // 这里只标记风险，实际打破由外部事件手动触发
          summary.applied.push(`beliefRisk:${beliefId}`);
        }
      }
    }

    return summary;
  }

  // 根据 Impact 调整 NPC 情绪
  _applyMood(impact, brain) {
    const mood = brain.personality.mood;
    if (!mood) return;

    const def = EVENT_TYPES[impact.eventType];
    if (!def) return;

    const absStress = Math.abs(impact.stressDelta);

    if (impact.stressDelta > 0.05) {
      // 负面事件
      mood.anger = clamp(mood.anger + absStress * 0.3, 0, 1);
      mood.fear = clamp(mood.fear + absStress * 0.2, 0, 1);
      mood.happiness = clamp(mood.happiness - absStress * 0.3, 0, 1);
    } else if (impact.stressDelta < -0.03) {
      // 正面事件
      mood.happiness = clamp(mood.happiness + absStress * 0.3, 0, 1);
      mood.surprise = clamp(mood.surprise + absStress * 0.2, 0, 1);
    }

    if (def.category === 'betrayal') {
      mood.anger = clamp(mood.anger + 0.1, 0, 1);
    }
    if (def.occEmotion === 'fear') {
      mood.fear = clamp(mood.fear + 0.1, 0, 1);
    }
  }

  static _formatMemoryContent(impact, brain) {
    const def = EVENT_TYPES[impact.eventType];
    const label = def?.label || impact.eventType;
    const sevLabel = impact.severity.label;

    switch (impact.role) {
      case 'target':
        return `我遭遇了${label}（${sevLabel}）`;
      case 'witness':
        return `我目睹了${label}（${sevLabel}）`;
      case 'actor':
        return `我对他人做了：${label}（${sevLabel}）`;
      default:
        return `我听说了${label}（${sevLabel}）`;
    }
  }

  // ======================== 诊断接口 ========================

  /** 列出所有支持的事件类型 */
  static getEventTypes() {
    return Object.keys(EVENT_TYPES).map(k => ({
      key: k,
      label: EVENT_TYPES[k].label,
      category: EVENT_TYPES[k].category,
    }));
  }
}

module.exports = { EventImpactSystem, EVENT_TYPES, SEVERITY, DURATION, MEMORY_QUALITY, OCC_EMOTION_PAIRS };
