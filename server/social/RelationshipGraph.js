// 8 维关系图谱 —— 记录所有实体对之间的深度关系
// 每个维度有独立的分层机制、交叉影响、行为后果
//
// 维度：
//   trust     信任   (-1~1)   被背叛←→深信不疑
//   affection 爱慕   (-1~1)   厌恶←→深爱
//   fear      恐惧   (0~1)    无畏←→魂飞魄散
//   respect   尊敬   (-1~1)   蔑视←→崇拜
//   jealousy  嫉妒   (0~1)    满足←→病态嫉妒
//   resentment怨恨  (0~1)    释怀←→血海深仇
//   debt      亏欠   (-1~1)   对方欠我←→我欠对方
//   suspicion 怀疑   (0~1)    信任←→疑神疑鬼

// ======================== 维度分层定义 ========================

const DIMENSION_TIERS = {
  trust: [
    { min: -1,   max: -0.6, name: 'betrayed',    label: '被背叛',   desc: '彻底失信，会主动回避或背叛对方' },
    { min: -0.6, max: -0.2, name: 'suspicious',  label: '不信任',   desc: '半信半疑，重要信息不会分享' },
    { min: -0.2, max: 0.2,  name: 'neutral',     label: '中立',     desc: '没有特别信任或不信任' },
    { min: 0.2,  max: 0.6,  name: 'trusting',    label: '信任',     desc: '愿意分享部分信息，接受帮助' },
    { min: 0.6,  max: 1,    name: 'devoted',     label: '深信不疑', desc: '完全信任，愿为对方担保' },
  ],
  affection: [
    { min: -1,   max: -0.6, name: 'hatred',      label: '憎恨',     desc: '恨不得对方消失' },
    { min: -0.6, max: -0.2, name: 'dislike',     label: '厌恶',     desc: '不想见到对方' },
    { min: -0.2, max: 0.2,  name: 'neutral',     label: '无感',     desc: '没有特别好感' },
    { min: 0.2,  max: 0.6,  name: 'fond',        label: '喜欢',     desc: '愿意相处' },
    { min: 0.6,  max: 1,    name: 'love',        label: '深爱',     desc: '无法离开对方' },
  ],
  fear: [
    { min: 0,    max: 0.2,  name: 'fearless',    label: '无畏',     desc: '不害怕对方' },
    { min: 0.2,  max: 0.4,  name: 'wary',        label: '警惕',     desc: '保持距离，注意安全' },
    { min: 0.4,  max: 0.6,  name: 'afraid',      label: '害怕',     desc: '会主动回避冲突' },
    { min: 0.6,  max: 0.8,  name: 'terrified',   label: '恐惧',     desc: '可能因恐惧而服从或背叛' },
    { min: 0.8,  max: 1,    name: 'paralyzed',   label: '魂飞魄散', desc: '完全被恐惧支配' },
  ],
  respect: [
    { min: -1,   max: -0.6, name: 'contempt',    label: '蔑视',     desc: '认为对方毫无价值' },
    { min: -0.6, max: -0.2, name: 'disrespect',  label: '轻视',     desc: '不太看得起对方' },
    { min: -0.2, max: 0.2,  name: 'neutral',     label: '普通',     desc: '没有特别看法' },
    { min: 0.2,  max: 0.6,  name: 'respectful',  label: '尊敬',     desc: '认可对方的能力或地位' },
    { min: 0.6,  max: 1,    name: 'reverence',   label: '崇拜',     desc: '视对方为偶像或导师' },
  ],
  jealousy: [
    { min: 0,    max: 0.2,  name: 'content',     label: '满足',     desc: '不羡慕对方' },
    { min: 0.2,  max: 0.4,  name: 'envious',     label: '羡慕',     desc: '有点向往对方拥有的东西' },
    { min: 0.4,  max: 0.6,  name: 'jealous',     label: '嫉妒',     desc: '心里不平衡' },
    { min: 0.6,  max: 0.8,  name: 'resentful',   label: '仇妒',     desc: '嫉妒驱使下可能做出破坏行为' },
    { min: 0.8,  max: 1,    name: 'obsessed',    label: '病态',     desc: '被嫉妒吞没，不择手段' },
  ],
  resentment: [
    { min: 0,    max: 0.2,  name: 'forgiven',    label: '释怀',     desc: '过去的伤害已经过去' },
    { min: 0.2,  max: 0.4,  name: 'bitter',      label: '苦涩',     desc: '心里有点疙瘩' },
    { min: 0.4,  max: 0.6,  name: 'grudge',      label: '积怨',     desc: '记仇，有机会会报复' },
    { min: 0.6,  max: 0.8,  name: 'vengeful',    label: '复仇心',   desc: '主动寻找报复机会' },
    { min: 0.8,  max: 1,    name: 'bloodthirsty',label: '血仇',     desc: '不死不休' },
  ],
  debt: [
    { min: -1,   max: -0.5, name: 'heavilyOwed', label: '被大欠',   desc: '对方欠我很多，我会催讨' },
    { min: -0.5, max: -0.1, name: 'slightlyOwed',label: '被小欠',   desc: '对方欠我一点' },
    { min: -0.1, max: 0.1,  name: 'even',        label: '两清',     desc: '互不相欠' },
    { min: 0.1,  max: 0.5,  name: 'slightDebt',  label: '小欠',     desc: '欠对方一点人情' },
    { min: 0.5,  max: 1,    name: 'heavyDebt',   label: '大欠',     desc: '欠对方很多，会有亏欠感' },
  ],
  suspicion: [
    { min: 0,    max: 0.2,  name: 'trusting',    label: '信赖',     desc: '不会多想对方的话' },
    { min: 0.2,  max: 0.4,  name: 'curious',     label: '好奇',     desc: '对对方行为有点在意' },
    { min: 0.4,  max: 0.6,  name: 'suspicious',  label: '怀疑',     desc: '觉得对方可能有所隐瞒' },
    { min: 0.6,  max: 0.8,  name: 'paranoid',    label: '疑心重',   desc: '认为对方一定有问题' },
    { min: 0.8,  max: 1,    name: 'conspiratorial', label: '阴谋论', desc: '坚信对方在策划什么' },
  ],
};

// ======================== 关系状态机 ========================

const RELATION_STATES = {
  STRANGER:      { name: '陌生人',   check: (d) => true }, // default / fallback
  ACQUAINTANCE:  { name: '认识',     check: (d) => Math.abs(d.affection) > 0.15 || Math.abs(d.trust) > 0.15 },
  FRIEND:        { name: '朋友',     check: (d) => d.trust > 0.4 && d.affection > 0.3 },
  CLOSE_FRIEND:  { name: '挚友',     check: (d) => d.trust > 0.6 && d.affection > 0.5 && d.resentment < 0.3 },
  LOVER:         { name: '爱人',     check: (d) => d.affection > 0.7 && d.trust > 0.5 },
  RIVAL:         { name: '竞争对手', check: (d) => d.jealousy > 0.5 },
  ENEMY:         { name: '敌人',     check: (d) => d.resentment > 0.5 && d.trust < 0 },
  MORTAL_ENEMY:  { name: '死敌',     check: (d) => d.resentment > 0.8 && d.trust < -0.5 },
  // 复合状态（由多个维度联合判定）
  OBSESSED_LOVER:{ name: '痴迷爱慕', check: (d) => d.affection > 0.6 && d.jealousy > 0.6 },
  TERRIFIED_SERVANT: { name: '恐惧仆从', check: (d) => d.fear > 0.7 && d.respect > 0.4 },
  GRUDGING_ALLY: { name: '勉强盟友', check: (d) => d.resentment > 0.3 && d.debt > 0.3 && d.trust > 0 },
  BITTER_RIVAL:  { name: '苦涩对手', check: (d) => d.jealousy > 0.4 && d.resentment > 0.4 },
};

// 状态优先级（越靠前越优先匹配，找到第一个匹配就返回）
const STATE_PRIORITY = [
  'OBSESSED_LOVER', 'TERRIFIED_SERVANT', 'MORTAL_ENEMY',
  'LOVER', 'CLOSE_FRIEND', 'FRIEND',
  'ENEMY', 'GRUDGING_ALLY', 'BITTER_RIVAL', 'RIVAL',
  'ACQUAINTANCE', 'STRANGER',
];

// ======================== 默认值 ========================

const DEFAULTS = {
  trust: 0.3, affection: 0.3, fear: 0.1, respect: 0.3,
  jealousy: 0, resentment: 0, debt: 0, suspicion: 0.1,
};

// ======================== 交叉影响规则 ========================

// 某维度变化时，对其他维度的涟漪效应
// key: 变化的维度, value: (newValue, oldValue, allDims) => { dim: delta, ... }
const CROSS_EFFECTS = {
  trust: (newVal, oldVal, dims) => {
    const effects = {};
    // 信任大幅下降 → 怀疑自然上升
    if (newVal - oldVal < -0.2) {
      effects.suspicion = Math.min(0.3, (oldVal - newVal) * 0.5);
    }
    // 信任大幅上升 → 怀疑减弱
    if (newVal - oldVal > 0.3) {
      effects.suspicion = -(newVal - oldVal) * 0.3;
    }
    return effects;
  },
  affection: (newVal, oldVal, dims) => {
    const effects = {};
    // 爱慕大幅上升 → 嫉妒易感性增加（更容易吃醋）
    if (newVal > 0.6 && dims.jealousy < 0.3) {
      effects.jealousy = 0.05; // 爱得深，开始在意
    }
    // 爱慕变负 → 怨恨上升
    if (newVal < -0.3 && oldVal > 0) {
      effects.resentment = 0.15;
    }
    return effects;
  },
  fear: (newVal, oldVal, dims) => {
    const effects = {};
    // 恐惧上升 → 尊重可能上升（害怕所以服从）
    if (newVal > 0.5 && dims.respect < 0) {
      effects.respect = 0.1; // 表面顺从
    }
    // 极度恐惧 → 信任下降
    if (newVal > 0.7) {
      effects.trust = -0.05;
    }
    return effects;
  },
  resentment: (newVal, oldVal, dims) => {
    const effects = {};
    // 怨恨上升 → 信任/爱慕下降
    if (newVal - oldVal > 0.2) {
      effects.trust = -(newVal - oldVal) * 0.4;
      effects.affection = -(newVal - oldVal) * 0.3;
    }
    return effects;
  },
  jealousy: (newVal, oldVal, dims) => {
    const effects = {};
    // 嫉妒上升 → 怨恨可能上升
    if (newVal > 0.5 && oldVal < 0.5) {
      effects.resentment = 0.1;
    }
    // 极度嫉妒 → 爱慕走向扭曲
    if (newVal > 0.8 && dims.affection > 0.5) {
      effects.affection = 0.05; // 扭曲的执念加深
    }
    return effects;
  },
  suspicion: (newVal, oldVal, dims) => {
    const effects = {};
    // 怀疑上升 → 信任下降
    if (newVal - oldVal > 0.2) {
      effects.trust = -(newVal - oldVal) * 0.5;
    }
    return effects;
  },
  debt: (newVal, oldVal, dims) => {
    const effects = {};
    // 欠对方太多 → 可能有怨恨（不情愿）
    if (newVal > 0.6) {
      effects.resentment = Math.min(0.2, newVal * 0.15);
    }
    return effects;
  },
  respect: () => ({}), // 尊敬变化不直接触发涟漪
};

// ======================== 工具函数 ========================

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function getTier(dimension, value) {
  const tiers = DIMENSION_TIERS[dimension];
  if (!tiers) return null;
  return tiers.find(t => value >= t.min && value <= t.max) || tiers[0];
}

// ======================== 关系图谱类 ========================

class RelationshipGraph {
  /**
   * @param {EventBus} [eventBus] 可选 EventBus，用于发出关系变化事件
   */
  constructor(eventBus) {
    // Map<"entityId1->entityId2", RelationshipData>
    this.edges = new Map();
    this.bus = eventBus || null;

    // 记录位置变化的维度，用于检测状态转换
    this._stateSnapshots = new Map(); // key → 上次的状态名
  }

  // ======================== 基础操作 ========================

  /** 标准化键（双向排序） */
  _key(a, b) {
    return [a, b].sort().join('->');
  }

  /**
   * 获取一条边的完整数据
   * @returns {object|null}
   */
  get(aId, bId) {
    return this.edges.get(this._key(aId, bId)) || null;
  }

  /**
   * 初始化两个实体之间的中性关系
   */
  init(aId, bId) {
    if (aId === bId) return; // 不自反
    const key = this._key(aId, bId);
    if (!this.edges.has(key)) {
      this.edges.set(key, {
        pair: [aId, bId],
        [aId]: { ...DEFAULTS },
        [bId]: { ...DEFAULTS },
        history: [],
      });
    }
  }

  // ======================== 态度查询 ========================

  /**
   * 获取 from 对 to 的所有 8 维态度分
   * @returns {{ trust, affection, fear, respect, jealousy, resentment, debt, suspicion }}
   */
  getAttitude(fromId, toId) {
    if (fromId === toId) return { ...DEFAULTS };
    const data = this.get(fromId, toId);
    if (!data || !data[fromId]) return { ...DEFAULTS };
    return { ...data[fromId] };
  }

  /**
   * 获取某个维度的值
   */
  getDimension(fromId, toId, dimension) {
    const attitude = this.getAttitude(fromId, toId);
    return attitude[dimension] !== undefined ? attitude[dimension] : DEFAULTS[dimension];
  }

  /**
   * 获取某个维度的分层信息
   */
  getDimensionTier(fromId, toId, dimension) {
    const value = this.getDimension(fromId, toId, dimension);
    return getTier(dimension, value);
  }

  // ======================== 关系状态机 ========================

  /**
   * 计算 from 对 to 的关系状态
   * @returns {{ state: string, label: string, desc: string }}
   */
  getRelationState(fromId, toId) {
    if (fromId === toId) return { state: 'SELF', label: '自己', desc: '' };
    const dims = this.getAttitude(fromId, toId);
    // 按优先级匹配
    for (const stateName of STATE_PRIORITY) {
      const def = RELATION_STATES[stateName];
      if (def && def.check(dims)) {
        return { state: stateName, label: def.name, desc: '' };
      }
    }
    return { state: 'STRANGER', label: '陌生人', desc: '' };
  }

  // ======================== 关系调整（核心方法） ========================

  /**
   * 调整 from 对 to 的态度分
   * @param {string} fromId   感受者
   * @param {string} toId     被感受者
   * @param {object} changes  变化值 { trust?: number, affection?: number, ... }
   *                           正数为增加，负数为减少
   * @param {string} [event]  触发事件描述
   * @returns {object} { oldState, newState, oldAttitude, newAttitude, crossEffects }
   */
  adjust(fromId, toId, changes, event) {
    if (fromId === toId) return null;
    this.init(fromId, toId);

    const data = this.get(fromId, toId);
    const oldScores = { ...data[fromId] };
    const scores = data[fromId];

    // 1. 记录调整前的关系状态
    const oldState = this.getRelationState(fromId, toId).state;

    // 2. 应用直接变化
    const dimDefs = {
      trust:     { min: -1, max: 1, clamp: true },
      affection: { min: -1, max: 1, clamp: true },
      fear:      { min: 0,  max: 1, clamp: true },
      respect:   { min: -1, max: 1, clamp: true },
      jealousy:  { min: 0,  max: 1, clamp: true },
      resentment:{ min: 0,  max: 1, clamp: true },
      debt:      { min: -1, max: 1, clamp: true },
      suspicion: { min: 0,  max: 1, clamp: true },
    };

    for (const [dim, def] of Object.entries(dimDefs)) {
      if (changes[dim] !== undefined) {
        scores[dim] = clamp(scores[dim] + changes[dim], def.min, def.max);
      }
    }

    // 3. 计算交叉涟漪效应
    const allCrossEffects = {};
    for (const [dim, delta] of Object.entries(changes)) {
      const rule = CROSS_EFFECTS[dim];
      if (rule && delta !== 0) {
        const ripples = rule(scores[dim], oldScores[dim], scores);
        for (const [rippleDim, rippleDelta] of Object.entries(ripples)) {
          if (rippleDelta !== 0) {
            allCrossEffects[rippleDim] = (allCrossEffects[rippleDim] || 0) + rippleDelta;
          }
        }
      }
    }

    // 应用涟漪效应
    for (const [dim, delta] of Object.entries(allCrossEffects)) {
      const def = dimDefs[dim];
      if (def) {
        scores[dim] = clamp(scores[dim] + delta, def.min, def.max);
      }
    }

    // 4. 苦痛冲突：高信任+高怀疑 → 认知失调（不改变数值，但记录）
    let cognitiveDissonance = false;
    if (scores.trust > 0.5 && scores.suspicion > 0.6) {
      cognitiveDissonance = true;
    }

    // 5. 记录调整后的状态
    const newState = this.getRelationState(fromId, toId).state;
    const newScores = { ...scores };

    // 6. 保存历史
    if (event) {
      data.history.push({
        time: Date.now(),
        from: fromId,
        to: toId,
        event,
        changes: { ...changes },
        crossEffects: Object.keys(allCrossEffects).length > 0 ? { ...allCrossEffects } : undefined,
        oldState,
        newState,
        cognitiveDissonance: cognitiveDissonance || undefined,
      });
      // 保留最近 30 条（从 20 提升，8维需要更多历史）
      if (data.history.length > 30) data.history.shift();
    }

    // 7. 发出事件
    if (this.bus) {
      // 每个变化的维度发出单独事件
      for (const dim of Object.keys(changes)) {
        if (changes[dim] !== 0) {
          this.bus.emit('npc-relation-changed', {
            aId: fromId, bId: toId,
            dimension: dim,
            oldValue: oldScores[dim],
            newValue: newScores[dim],
            oldTier: getTier(dim, oldScores[dim]),
            newTier: getTier(dim, newScores[dim]),
            event,
          });
        }
      }
      // 状态切换事件（更有意义的粒度）
      if (oldState !== newState) {
        this.bus.emit('npc-relation-state-changed', {
          aId: fromId, bId: toId,
          oldState, newState,
          oldLabel: RELATION_STATES[oldState]?.name || oldState,
          newLabel: RELATION_STATES[newState]?.name || newState,
          scores: newScores,
          event,
        });
      }
    }

    return {
      oldState, newState,
      oldAttitude: oldScores,
      newAttitude: newScores,
      crossEffects: Object.keys(allCrossEffects).length > 0 ? allCrossEffects : null,
      cognitiveDissonance,
    };
  }

  // ======================== 复合查询 ========================

  /**
   * 获取与 entityId 相关的所有关系摘要
   * 返回：{ [otherId]: { 8dims, state, stateLabel } }
   */
  getRelationsSummary(entityId) {
    const summary = {};
    for (const [, data] of this.edges) {
      const other = data.pair[0] === entityId ? data.pair[1] : data.pair[0];
      if (data[entityId]) {
        const state = this.getRelationState(entityId, other);
        summary[other] = {
          scores: { ...data[entityId] },
          state: state.state,
          stateLabel: state.label,
        };
      }
    }
    return summary;
  }

  /**
   * 获取某人对其他人的态度列表（按好感排序）
   */
  getTopRelations(entityId, n = 5) {
    const rels = [];
    for (const [, data] of this.edges) {
      const other = data.pair[0] === entityId ? data.pair[1] : data.pair[0];
      if (data[entityId]) {
        const state = this.getRelationState(entityId, other);
        rels.push({
          targetId: other,
          scores: { ...data[entityId] },
          state: state.state,
          stateLabel: state.label,
        });
      }
    }
    rels.sort((a, b) => b.scores.affection - a.scores.affection);
    return rels.slice(0, n);
  }

  // ======================== 戏剧潜力扫描 ========================

  /**
   * 扫描某个实体的所有关系，计算戏剧潜力得分
   * 返回 [{ targetId, dramaScore, triggers: string[], state }]
   */
  getDramaPotentials(entityId) {
    const potentials = [];
    for (const [, data] of this.edges) {
      const other = data.pair[0] === entityId ? data.pair[1] : data.pair[0];
      if (!data[entityId]) continue;
      const dims = data[entityId];
      const state = this.getRelationState(entityId, other);

      const triggers = [];
      let score = 0;

      // 高分维度检测
      if (dims.resentment > 0.6) { triggers.push('深仇'); score += 30; }
      if (dims.jealousy > 0.6)  { triggers.push('嫉妒'); score += 25; }
      if (dims.affection > 0.7 && dims.jealousy > 0.5) {
        triggers.push('痴恋'); score += 35;
      }
      if (dims.fear > 0.7)      { triggers.push('恐惧支配'); score += 20; }
      if (dims.suspicion > 0.6) { triggers.push('疑心'); score += 15; }
      if (dims.trust < -0.5 && dims.resentment > 0.4) {
        triggers.push('背弃'); score += 35;
      }
      if (dims.debt > 0.6)      { triggers.push('亏欠欲还'); score += 10; }
      if (dims.debt < -0.6)     { triggers.push('追讨'); score += 15; }
      if (dims.respect > 0.7 && dims.fear > 0.5) {
        triggers.push('恐惧崇拜'); score += 20;
      }
      // 苦痛冲突
      if (dims.trust > 0.5 && dims.suspicion > 0.6) {
        triggers.push('认知失调'); score += 25;
      }
      // 极端组合
      if (dims.affection > 0.7 && dims.resentment > 0.4) {
        triggers.push('爱恨交织'); score += 40;
      }

      if (triggers.length > 0) {
        potentials.push({
          targetId: other,
          dramaScore: score,
          triggers,
          state: state.state,
          stateLabel: state.label,
          dims: { ...dims },
        });
      }
    }

    potentials.sort((a, b) => b.dramaScore - a.dramaScore);
    return potentials;
  }

  /**
   * 扫描全局所有关系中的高戏剧潜力边
   * @returns [{ aId, bId, dramaScore, triggers, state }]
   */
  scanGlobalDrama() {
    const results = [];
    const seen = new Set();
    for (const [key, data] of this.edges) {
      const [a, b] = data.pair;
      // 双向都扫描
      for (const fromId of [a, b]) {
        const toId = fromId === a ? b : a;
        const pairKey = `${fromId}->${toId}`;
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        const dims = data[fromId];
        if (!dims) continue;

        const triggers = [];
        let score = 0;

        if (dims.resentment > 0.5) { triggers.push('deep_resentment'); score += 30; }
        if (dims.jealousy > 0.5)  { triggers.push('jealousy'); score += 25; }
        if (dims.affection > 0.7 && dims.jealousy > 0.5) { triggers.push('obsessive_love'); score += 35; }
        if (dims.affection > 0.7 && dims.resentment > 0.4) { triggers.push('love_hate'); score += 40; }
        if (dims.fear > 0.7)      { triggers.push('terror'); score += 20; }
        if (dims.suspicion > 0.6) { triggers.push('paranoia'); score += 15; }
        if (dims.trust < -0.5 && dims.resentment > 0.3) { triggers.push('betrayal'); score += 35; }
        if (dims.trust > 0.5 && dims.suspicion > 0.6) { triggers.push('cognitive_dissonance'); score += 25; }

        if (triggers.length > 0) {
          const state = this.getRelationState(fromId, toId);
          results.push({
            aId: fromId, bId: toId,
            dramaScore: score,
            triggers,
            state: state.state,
            stateLabel: state.label,
          });
        }
      }
    }
    results.sort((a, b) => b.dramaScore - a.dramaScore);
    return results;
  }

  // ======================== 存档接口 ========================

  /**
   * 导出完整图谱快照
   */
  toSnapshot() {
    const edges = [];
    for (const [key, data] of this.edges) {
      edges.push({
        key,
        pair: data.pair,
        scores: { [data.pair[0]]: { ...data[data.pair[0]] }, [data.pair[1]]: { ...data[data.pair[1]] } },
        history: data.history.slice(-20), // 只保留最近 20 条历史
      });
    }
    return { edges, version: 2 };
  }

  /**
   * 从快照恢复图谱
   */
  fromSnapshot(snapshot) {
    this.edges.clear();
    if (!snapshot || !snapshot.edges) return;
    for (const edge of snapshot.edges) {
      const data = {
        pair: edge.pair,
        [edge.pair[0]]: { ...DEFAULTS, ...edge.scores[edge.pair[0]] },
        [edge.pair[1]]: { ...DEFAULTS, ...edge.scores[edge.pair[1]] },
        history: edge.history || [],
      };
      this.edges.set(edge.key, data);
    }
  }

  /**
   * 获取图谱中所有边的数量
   */
  get size() {
    return this.edges.size;
  }
}

module.exports = RelationshipGraph;
