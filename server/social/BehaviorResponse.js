// 行为响应系统 — 规则驱动的即刻行为决策
//
// 核心职责：事件发生后，决定 NPC "现在该做什么"
//   输入：事件 + Impact + NPC 人格 + 关系
//   输出：{ action, target, emotion, priority, scheduleOverride }
//
// 设计原则：
//   规则驱动（非 LLM），<1ms 响应，确定性匹配
//   优先级排序，首个完全匹配的规则胜出
//   LLM 深思可在 30s 后覆写非 critical 的决策
//
// 文献支撑：
//   - DESIGN.md 的 NPC 反应风格（爆发/隐忍/冷谋/回避/崩溃/直面）
//   - O'Connor 的 assumed knowledge 概念（NPC 基于主观认知行动）

// ======================== 响应优先级 ========================

const RESPONSE_PRIORITY = {
  CRITICAL: { order: 4, label: '危急',   desc: '不顾一切，立即执行，LLM 也无法覆写' },
  URGENT:   { order: 3, label: '紧急',   desc: '高度优先，LLM 深思后可覆写' },
  NORMAL:   { order: 2, label: '正常',   desc: '正常响应，LLM 可随时覆写' },
  LOW:      { order: 1, label: '低优先', desc: '后台执行，不打断当前行为' },
};

// ======================== 覆写类型 ========================

const OVERRIDE_TYPES = {
  HIDE_AT_HOME:     { label: '躲在家',       defaultDuration: '3_days' },
  FLEE_AREA:        { label: '逃离区域',     defaultDuration: '1_day' },
  AVOID_PERSON:     { label: '回避某人',     defaultDuration: '7_days' },
  GUARD_SOMEONE:    { label: '守护某人',     defaultDuration: '5_days' },
  STALK_TARGET:     { label: '跟踪目标',     defaultDuration: '3_days' },
  SEEK_REVENGE:     { label: '伺机报复',     defaultDuration: '14_days' },
  MOURN:            { label: '哀悼',         defaultDuration: '3_days' },
  CELEBRATE:        { label: '庆祝',         defaultDuration: '1_day' },
  REPORT_TO_AUTHORITY: { label: '报告守卫',  defaultDuration: 'temporary' },
  CONFRONT_PERSON:  { label: '找人对质',     defaultDuration: 'temporary' },
  PATROL_AREA:      { label: '巡逻区域',     defaultDuration: '1_day' },
  FOLLOW_ROUTINE:   { label: '照常生活',     defaultDuration: null },
};

// ======================== 规则定义 ========================

/**
 * 每条规则：
 *   id: 唯一标识
 *   priority: 匹配优先级（降序），数字越大越优先
 *   match: { eventType?, severityMin?, conditions[] }
 *     conditions 支持：
 *       { type: 'trait', trait: 'neuroticism', op: 'gte', value: 0.7 }
 *       { type: 'rel', rel: 'affection', to: 'target', op: 'gte', value: 0.5 }
 *       { type: 'rel', rel: 'fear', to: 'actor', op: 'gte', value: 0.6 }
 *       { type: 'reaction_style', value: 'EXPLOSIVE' }
 *       { type: 'psych_state', op: 'at_least', value: 'BREAKDOWN' }
 *       { type: 'role', value: 'target' }
 *       { type: 'event_category', value: 'violence' }
 *   response: { action, emotion, responsePriority, scheduleOverride }
 */
const RULES = [
  // ========== 暴力类响应 ==========

  // 被攻击 + 爱攻击者 → 崩溃/逃避
  {
    id: 'attacked_by_loved_one',
    priority: 95,
    match: {
      eventType: 'attacked',
      conditions: [
        { type: 'rel', rel: 'affection', to: 'actor', op: 'gte', value: 0.6 },
        { type: 'trait', trait: 'neuroticism', op: 'gte', value: 0.5 },
      ],
    },
    response: {
      action: 'flee',
      emotion: 'sad',
      responsePriority: 'CRITICAL',
      scheduleOverride: { type: 'HIDE_AT_HOME', duration: '3_days' },
    },
  },

  // 被攻击 + 恨攻击者 + 高外向 → 反击
  {
    id: 'attacked_by_enemy_fight_back',
    priority: 93,
    match: {
      eventType: 'attacked',
      conditions: [
        { type: 'rel', rel: 'resentment', to: 'actor', op: 'gte', value: 0.4 },
        { type: 'trait', trait: 'extraversion', op: 'gte', value: 0.5 },
        { type: 'reaction_style', op: 'in', value: ['EXPLOSIVE', 'CONFRONT'] },
      ],
    },
    response: {
      action: 'attack',
      emotion: 'angry',
      responsePriority: 'CRITICAL',
      scheduleOverride: null,
    },
  },

  // 被攻击 + 高恐惧 → 逃跑
  {
    id: 'attacked_fear_flee',
    priority: 90,
    match: {
      eventType: 'attacked',
      conditions: [
        { type: 'trait', trait: 'neuroticism', op: 'gte', value: 0.6 },
      ],
    },
    response: {
      action: 'flee',
      emotion: 'terrified',
      responsePriority: 'CRITICAL',
      scheduleOverride: { type: 'FLEE_AREA', duration: '1_day' },
    },
  },

  // 目睹暴力 + 与受害者关系亲密 + 高神经质 → 尖叫逃跑
  {
    id: 'witness_violence_loved_target',
    priority: 85,
    match: {
      eventType: 'witnessed_violence',
      conditions: [
        { type: 'role', value: 'witness' },
        { type: 'rel', rel: 'affection', to: 'target', op: 'gte', value: 0.6 },
        { type: 'trait', trait: 'neuroticism', op: 'gte', value: 0.5 },
      ],
    },
    response: {
      action: 'flee',
      emotion: 'terrified',
      responsePriority: 'URGENT',
      scheduleOverride: { type: 'HIDE_AT_HOME', duration: '2_days' },
    },
  },

  // 目睹暴力 + 与受害者关系亲密 + 冷谋/直面型 → 冲上去帮
  {
    id: 'witness_violence_loved_target_intervene',
    priority: 84,
    match: {
      eventType: 'witnessed_violence',
      conditions: [
        { type: 'role', value: 'witness' },
        { type: 'rel', rel: 'affection', to: 'target', op: 'gte', value: 0.7 },
        { type: 'reaction_style', op: 'in', value: ['CONFRONT', 'EXPLOSIVE', 'COLD'] },
      ],
    },
    response: {
      action: 'attack',
      emotion: 'angry',
      responsePriority: 'URGENT',
      scheduleOverride: null, // 先处理眼前的
    },
  },

  // 目睹暴力 + 高恐惧 + 回避型 → 悄悄离开
  {
    id: 'witness_violence_sneak_away',
    priority: 82,
    match: {
      eventType: 'witnessed_violence',
      conditions: [
        { type: 'role', value: 'witness' },
        { type: 'reaction_style', value: 'AVOIDANT' },
      ],
    },
    response: {
      action: 'flee',
      emotion: 'fearful',
      responsePriority: 'URGENT',
      scheduleOverride: { type: 'HIDE_AT_HOME', duration: '3_days' },
    },
  },

  // 目睹死亡 → 报告守卫
  {
    id: 'witness_death_report',
    priority: 95,
    match: {
      eventType: 'witnessed_death',
      conditions: [
        { type: 'role', value: 'witness' },
      ],
    },
    response: {
      action: 'flee',
      emotion: 'terrified',
      responsePriority: 'CRITICAL',
      scheduleOverride: { type: 'REPORT_TO_AUTHORITY', duration: 'temporary' },
    },
  },

  // ========== 侠义行为类响应 ==========

  // 目睹侠义 + 与义士关系好 + 与恶霸关系差 → 拍手叫好
  {
    id: 'righteous_violence_cheer',
    priority: 88,
    match: {
      eventType: 'righteous_violence',
      conditions: [
        { type: 'role', value: 'witness' },
        { type: 'rel', rel: 'affection', to: 'actor', op: 'gte', value: 0.5 },
        { type: 'rel', rel: 'resentment', to: 'target', op: 'gte', value: 0.3 },
        { type: 'trait', trait: 'extraversion', op: 'gte', value: 0.5 },
      ],
    },
    response: {
      action: 'celebrate',
      emotion: 'excited',
      responsePriority: 'NORMAL',
      scheduleOverride: null,
    },
  },

  // 目睹侠义 + 恶霸是朋友 → 冲上去帮恶霸
  {
    id: 'righteous_violence_defend_bully',
    priority: 85,
    match: {
      eventType: 'righteous_violence',
      conditions: [
        { type: 'role', value: 'witness' },
        { type: 'rel', rel: 'affection', to: 'target', op: 'gte', value: 0.5 },
        { type: 'reaction_style', op: 'in', value: ['CONFRONT', 'EXPLOSIVE'] },
      ],
    },
    response: {
      action: 'attack',
      emotion: 'angry',
      responsePriority: 'URGENT',
      scheduleOverride: null,
    },
  },

  // 目睹侠义 + 高神经质 → 害怕暴力，逃离
  {
    id: 'righteous_violence_flee',
    priority: 82,
    match: {
      eventType: 'righteous_violence',
      conditions: [
        { type: 'role', value: 'witness' },
        { type: 'trait', trait: 'neuroticism', op: 'gte', value: 0.6 },
      ],
    },
    response: {
      action: 'flee',
      emotion: 'fearful',
      responsePriority: 'URGENT',
      scheduleOverride: { type: 'HIDE_AT_HOME', duration: '2_days' },
    },
  },

  // 目睹侠义 + 行为者被欺负的人 → 靠近道谢
  {
    id: 'righteous_violence_thank',
    priority: 80,
    match: {
      eventType: 'righteous_violence',
      conditions: [
        { type: 'role', value: 'target' },
        { type: 'rel', rel: 'affection', to: 'target', op: 'lt', value: 0 }, // 自己是受害者（讨厌恶霸）
      ],
    },
    response: {
      action: 'approach',
      emotion: 'grateful',
      responsePriority: 'URGENT',
      scheduleOverride: null,
    },
  },

  // 目睹侠义 + 默认（无特殊匹配） → 围观
  {
    id: 'righteous_violence_watch',
    priority: 60,
    match: {
      eventType: 'righteous_violence',
      conditions: [
        { type: 'role', value: 'witness' },
      ],
    },
    response: {
      action: 'wander',
      emotion: 'surprised',
      responsePriority: 'LOW',
      scheduleOverride: null,
    },
  },

  // ========== 背叛/羞辱类响应 ==========

  // 被背叛 + 高复仇欲 → 谋划报复
  {
    id: 'betrayed_seek_revenge',
    priority: 88,
    match: {
      eventType: 'betrayed',
      conditions: [
        { type: 'reaction_style', op: 'in', value: ['COLD', 'EXPLOSIVE'] },
      ],
    },
    response: {
      action: 'ignore', // 表面上不理，内心在谋划
      emotion: 'angry',
      responsePriority: 'URGENT',
      scheduleOverride: { type: 'SEEK_REVENGE', duration: '14_days' },
    },
  },

  // 被背叛 + 隐忍型 → 表面接受，暗中记恨
  {
    id: 'betrayed_stoic',
    priority: 85,
    match: {
      eventType: 'betrayed',
      conditions: [
        { type: 'reaction_style', value: 'STOIC' },
      ],
    },
    response: {
      action: 'wander', // 表面如常
      emotion: 'sad',    // 内心痛苦但不外露
      responsePriority: 'NORMAL',
      scheduleOverride: { type: 'AVOID_PERSON', duration: '7_days' },
    },
  },

  // 被公开羞辱 + 爆发型 → 当场暴怒
  {
    id: 'humiliated_explosive',
    priority: 90,
    match: {
      eventType: 'publicly_humiliated',
      conditions: [
        { type: 'reaction_style', value: 'EXPLOSIVE' },
      ],
    },
    response: {
      action: 'attack',
      emotion: 'angry',
      responsePriority: 'CRITICAL',
      scheduleOverride: null,
    },
  },

  // 被公开羞辱 + 回避/崩溃型 → 羞愤离场
  {
    id: 'humiliated_avoidant',
    priority: 88,
    match: {
      eventType: 'publicly_humiliated',
      conditions: [
        { type: 'reaction_style', op: 'in', value: ['AVOIDANT', 'COLLAPSE'] },
      ],
    },
    response: {
      action: 'flee',
      emotion: 'sad',
      responsePriority: 'CRITICAL',
      scheduleOverride: { type: 'HIDE_AT_HOME', duration: '5_days' },
    },
  },

  // 被公开指控 + 直面型 → 当面对质
  {
    id: 'accused_confront',
    priority: 88,
    match: {
      eventType: 'publicly_accused',
      conditions: [
        { type: 'reaction_style', value: 'CONFRONT' },
      ],
    },
    response: {
      action: 'approach',
      emotion: 'angry',
      responsePriority: 'URGENT',
      scheduleOverride: { type: 'CONFRONT_PERSON', duration: 'temporary' },
    },
  },

  // 被公开指控 + 冷谋型 → 沉默以对，暗中准备反制
  {
    id: 'accused_cold',
    priority: 86,
    match: {
      eventType: 'publicly_accused',
      conditions: [
        { type: 'reaction_style', value: 'COLD' },
      ],
    },
    response: {
      action: 'ignore',
      emotion: 'neutral',
      responsePriority: 'NORMAL',
      scheduleOverride: { type: 'SEEK_REVENGE', duration: '7_days' },
    },
  },

  // ========== 社交类响应 ==========

  // 收到礼物 + 喜欢送礼者 → 靠近互动
  {
    id: 'gift_from_liked',
    priority: 70,
    match: {
      eventType: 'received_gift',
      conditions: [
        { type: 'rel', rel: 'affection', to: 'actor', op: 'gte', value: 0.4 },
      ],
    },
    response: {
      action: 'approach',
      emotion: 'happy',
      responsePriority: 'NORMAL',
      scheduleOverride: null,
    },
  },

  // 收到礼物 + 不喜欢送礼者 → 冷淡
  {
    id: 'gift_from_disliked',
    priority: 68,
    match: {
      eventType: 'received_gift',
      conditions: [
        { type: 'rel', rel: 'affection', to: 'actor', op: 'lte', value: -0.2 },
      ],
    },
    response: {
      action: 'ignore',
      emotion: 'neutral',
      responsePriority: 'LOW',
      scheduleOverride: null,
    },
  },

  // ========== 知识/秘密类响应 ==========

  // 得知秘密 + 高权力欲 → 记住并可能利用
  {
    id: 'secret_learned_power',
    priority: 75,
    match: {
      eventType: 'secret_learned',
      conditions: [
        { type: 'trait', trait: 'agreeableness', op: 'lte', value: 0.4 },
      ],
    },
    response: {
      action: 'wander', // 如常，但内心在盘算
      emotion: 'surprised',
      responsePriority: 'LOW',
      scheduleOverride: null,
    },
  },

  // 得知秘密 + 高神经质 → 焦虑不安
  {
    id: 'secret_learned_anxious',
    priority: 73,
    match: {
      eventType: 'secret_learned',
      conditions: [
        { type: 'trait', trait: 'neuroticism', op: 'gte', value: 0.7 },
      ],
    },
    response: {
      action: 'wander',
      emotion: 'surprised',
      responsePriority: 'LOW',
      scheduleOverride: null, // 压力自然在 tick 中累积
    },
  },

  // 自己的秘密被公开 + 爆发型 → 灭口
  {
    id: 'secret_exposed_explosive',
    priority: 95,
    match: {
      eventType: 'secret_exposed_self',
      conditions: [
        { type: 'reaction_style', value: 'EXPLOSIVE' },
      ],
    },
    response: {
      action: 'attack',
      emotion: 'angry',
      responsePriority: 'CRITICAL',
      scheduleOverride: { type: 'SEEK_REVENGE', duration: '14_days' },
    },
  },

  // 自己的秘密被公开 + 回避型 → 逃离
  {
    id: 'secret_exposed_avoidant',
    priority: 93,
    match: {
      eventType: 'secret_exposed_self',
      conditions: [
        { type: 'reaction_style', op: 'in', value: ['AVOIDANT', 'COLLAPSE'] },
      ],
    },
    response: {
      action: 'flee',
      emotion: 'sad',
      responsePriority: 'CRITICAL',
      scheduleOverride: { type: 'HIDE_AT_HOME', duration: '7_days' },
    },
  },

  // ========== 生死类响应 ==========

  // 挚爱离世 → 哀悼
  {
    id: 'loved_one_died_mourn',
    priority: 95,
    match: {
      eventType: 'loved_one_died',
      conditions: [],
    },
    response: {
      action: 'wander',
      emotion: 'sad',
      responsePriority: 'CRITICAL',
      scheduleOverride: { type: 'MOURN', duration: '3_days' },
    },
  },

  // 死里逃生 + 高安全欲 → 躲藏
  {
    id: 'near_death_hide',
    priority: 90,
    match: {
      eventType: 'near_death_experience',
      conditions: [],
    },
    response: {
      action: 'flee',
      emotion: 'terrified',
      responsePriority: 'CRITICAL',
      scheduleOverride: { type: 'HIDE_AT_HOME', duration: '3_days' },
    },
  },

  // ========== 温暖类响应 ==========

  // 陌生人的善意 → 靠近
  {
    id: 'kind_stranger_approach',
    priority: 65,
    match: {
      eventType: 'kind_stranger',
      conditions: [
        { type: 'trait', trait: 'extraversion', op: 'gte', value: 0.4 },
      ],
    },
    response: {
      action: 'approach',
      emotion: 'happy',
      responsePriority: 'NORMAL',
      scheduleOverride: null,
    },
  },

  // 共享秘密时刻 + 高外向 → 庆祝
  {
    id: 'shared_secret_celebrate',
    priority: 68,
    match: {
      eventType: 'shared_secret_moment',
      conditions: [],
    },
    response: {
      action: 'approach',
      emotion: 'happy',
      responsePriority: 'NORMAL',
      scheduleOverride: { type: 'CELEBRATE', duration: '1_day' },
    },
  },

  // ========== 经济类响应 ==========

  // 财物被盗 + 高尽责 → 调查/巡逻
  {
    id: 'stolen_investigate',
    priority: 78,
    match: {
      eventType: 'item_stolen',
      conditions: [
        { type: 'trait', trait: 'conscientiousness', op: 'gte', value: 0.6 },
      ],
    },
    response: {
      action: 'wander', // 四处查看
      emotion: 'angry',
      responsePriority: 'URGENT',
      scheduleOverride: { type: 'PATROL_AREA', duration: '1_day' },
    },
  },

  // 收到贵重礼物 → 靠近 + 亏欠感
  {
    id: 'valuable_gift_approach',
    priority: 72,
    match: {
      eventType: 'gift_received_valuable',
      conditions: [],
    },
    response: {
      action: 'approach',
      emotion: 'happy',
      responsePriority: 'NORMAL',
      scheduleOverride: null,
    },
  },
];

// ======================== 条件匹配引擎 ========================

function matchCondition(condition, context) {
  const { traits, relations, reactionStyle, psychState, role, eventCategory } = context;

  switch (condition.type) {
    case 'trait': {
      const val = traits[condition.trait];
      if (val === undefined) return false;
      return compareOp(val, condition.op, condition.value);
    }

    case 'rel': {
      const relTarget = condition.to === 'actor' ? relations.toActor : relations.toTarget;
      if (!relTarget) {
        // 如果没有关系数据（如目击者与施事者无直接关系），条件不满足
        return condition.op === 'lte' ? true : false; // lte 默认满足（无关系≈关系值为0≤阈值）
      }
      const val = relTarget[condition.rel];
      if (val === undefined) return false;
      return compareOp(val, condition.op, condition.value);
    }

    case 'reaction_style': {
      if (condition.op === 'in') {
        return condition.value.includes(reactionStyle);
      }
      return reactionStyle === condition.value;
    }

    case 'psych_state': {
      const stateOrder = { NORMAL: 0, ANXIOUS: 1, PARANOID: 2, BREAKDOWN: 3, FRENZY: 4 };
      const current = stateOrder[psychState] || 0;
      const target = stateOrder[condition.value] || 0;
      return compareOp(current, condition.op, target);
    }

    case 'role': {
      return role === condition.value;
    }

    case 'event_category': {
      return eventCategory === condition.value;
    }

    default:
      return false;
  }
}

function compareOp(val, op, expected) {
  switch (op) {
    case 'gte': return val >= expected;
    case 'lte': return val <= expected;
    case 'gt':  return val > expected;
    case 'lt':  return val < expected;
    case 'eq':  return val === expected;
    case 'neq': return val !== expected;
    case 'at_least': {
      const orders = { NORMAL: 0, ANXIOUS: 1, PARANOID: 2, BREAKDOWN: 3, FRENZY: 4 };
      return (orders[val] || 0) >= (orders[expected] || 0);
    }
    default: return false;
  }
}

// ======================== 默认回退响应 ========================

/**
 * 无规则匹配时的降级响应：基于人格和反应风格生成默认行为
 */
function fallbackResponse(traits, reactionStyle, psychState) {
  // 高压状态下 → 回避/逃跑倾向
  if (psychState === 'BREAKDOWN' || psychState === 'FRENZY') {
    return {
      action: Math.random() < 0.3 ? 'attack' : 'flee',
      emotion: psychState === 'FRENZY' ? 'angry' : 'sad',
      responsePriority: 'URGENT',
      scheduleOverride: { type: 'HIDE_AT_HOME', duration: '1_day' },
    };
  }

  // 基于反应风格
  const styleDefaults = {
    EXPLOSIVE: { action: 'wander', emotion: 'angry', priority: 'NORMAL' },
    STOIC:     { action: 'wander', emotion: 'neutral', priority: 'LOW' },
    COLD:      { action: 'ignore', emotion: 'neutral', priority: 'LOW' },
    AVOIDANT:  { action: 'flee', emotion: 'sad', priority: 'NORMAL' },
    COLLAPSE:  { action: 'wander', emotion: 'sad', priority: 'NORMAL' },
    CONFRONT:  { action: 'approach', emotion: 'angry', priority: 'NORMAL' },
  };

  const def = styleDefaults[reactionStyle] || styleDefaults.STOIC;
  return {
    action: def.action,
    emotion: def.emotion,
    responsePriority: def.priority,
    scheduleOverride: null,
  };
}

// ======================== 主类 ========================

class BehaviorResponse {
  /**
   * @param {object} [opts]
   * @param {Rule[]} [opts.rules] — 自定义规则（默认使用内置 RULES）
   */
  constructor(opts = {}) {
    this.rules = (opts.rules || RULES).slice().sort((a, b) => b.priority - a.priority);
  }

  /**
   * 根据事件和 NPC 状态匹配最佳响应
   *
   * @param {object} impact — EventImpactSystem.calculateImpact 的输出
   * @param {object} npcContext
   *   traits: 大五人格 { openness, conscientiousness, extraversion, agreeableness, neuroticism }
   *   relations: { toActor: object|null, toTarget: object|null }
   *   reactionStyle: string — EXPLOSIVE|STOIC|COLD|AVOIDANT|COLLAPSE|CONFRONT
   *   psychState: string — NORMAL|ANXIOUS|PARANOID|BREAKDOWN|FRENZY
   *   role: string — actor|target|witness|related
   * @returns {object} response
   *   { action, target, emotion, responsePriority, scheduleOverride, matchedRuleId }
   */
  match(impact, npcContext) {
    const context = {
      traits: npcContext.traits || {},
      relations: npcContext.relations || { toActor: null, toTarget: null },
      reactionStyle: npcContext.reactionStyle || 'STOIC',
      psychState: npcContext.psychState || 'NORMAL',
      role: npcContext.role || impact.role || 'related',
      eventCategory: EVENT_CATEGORY_MAP[impact.eventType] || 'unknown',
    };

    // 按优先级遍历规则
    for (const rule of this.rules) {
      // eventType 匹配
      if (rule.match.eventType && rule.match.eventType !== impact.eventType) {
        continue;
      }

      // severityMin 匹配
      if (rule.match.severityMin) {
        const sevOrder = impact.severity?.order || 0;
        const minOrder = SEVERITY_ORDER_MAP[rule.match.severityMin] || 0;
        if (sevOrder < minOrder) continue;
      }

      // conditions 全部匹配
      let allMatch = true;
      for (const cond of (rule.match.conditions || [])) {
        if (!matchCondition(cond, context)) {
          allMatch = false;
          break;
        }
      }

      if (allMatch) {
        return {
          action: rule.response.action,
          target: npcContext.targetId || null,
          emotion: rule.response.emotion,
          responsePriority: rule.response.responsePriority,
          scheduleOverride: rule.response.scheduleOverride,
          matchedRuleId: rule.id,
        };
      }
    }

    // 无匹配 → 降级
    const fallback = fallbackResponse(context.traits, context.reactionStyle, context.psychState);
    return {
      action: fallback.action,
      target: null,
      emotion: fallback.emotion,
      responsePriority: fallback.responsePriority,
      scheduleOverride: fallback.scheduleOverride,
      matchedRuleId: 'fallback',
    };
  }

  /** 添加自定义规则 */
  addRule(rule) {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /** 移除规则 */
  removeRule(ruleId) {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }
}

// ======================== 辅助映射 ========================

const EVENT_CATEGORY_MAP = {
  attacked: 'violence', witnessed_violence: 'violence', witnessed_death: 'violence',
  received_gift: 'social', helped_by_other: 'social', spoken_to: 'social',
  betrayed: 'betrayal', publicly_humiliated: 'betrayal', publicly_accused: 'betrayal',
  secret_learned: 'knowledge', secret_exposed_self: 'knowledge', rumor_heard: 'knowledge',
  loved_one_died: 'life_death', near_death_experience: 'life_death',
  kind_stranger: 'warmth', shared_secret_moment: 'warmth',
  item_stolen: 'economy', gift_received_valuable: 'economy',
  goal_achieved: 'achievement', goal_blocked: 'achievement',
};

const SEVERITY_ORDER_MAP = {
  TRIVIAL: 0, MINOR: 1, SIGNIFICANT: 2, MAJOR: 3, TRAUMATIC: 4, LIFE_CHANGING: 5,
};

module.exports = { BehaviorResponse, RULES, RESPONSE_PRIORITY, OVERRIDE_TYPES };
