// NPC 内心系统 — 压力/欲望/信念/心理防线/心理状态
//
// 层次：
//   人格（固定）     → npcs.json traits
//   信念（几乎不变）  → this.beliefs（极端事件下可被打破）
//   欲望（中期变）    → this.desires（随时间+事件动态切换）
//   情绪（短期变）    → personality.mood（快速波动）
//   压力值（累积型）  → this.stress（高→心理崩坏）
//   心理防线（底线）  → this.defenses（被突破→极端行为）
//   心理状态（衍生）   → 正常→焦虑→偏执→崩溃→狂暴

// ======================== 常量定义 ========================

// 心理状态机
const PSYCH_STATES = {
  NORMAL:    { name: '正常',   min: 0,   max: 0.3,  desc: '心态平稳，理性决策' },
  ANXIOUS:   { name: '焦虑',   min: 0.3, max: 0.5,  desc: '心神不宁，易受刺激' },
  PARANOID:  { name: '偏执',   min: 0.5, max: 0.7,  desc: '疑神疑鬼，攻击性上升' },
  BREAKDOWN: { name: '崩溃',   min: 0.7, max: 0.9,  desc: '心理防线碎裂，可能做出极端行为' },
  FRENZY:    { name: '狂暴',   min: 0.9, max: 1,    desc: '完全失控，不择手段' },
};

// 欲望维度定义
const DESIRE_DEFS = {
  safety:    { label: '安全',   desc: '人身和财产安全', volatility: 0.3 },
  social:    { label: '社交',   desc: '与人交往的需求', volatility: 0.4 },
  wealth:    { label: '财富',   desc: '对金钱的渴望',   volatility: 0.5 },
  power:     { label: '权力',   desc: '支配他人的欲望', volatility: 0.3 },
  revenge:   { label: '复仇',   desc: '对特定人的报复欲', volatility: 0.7 },
  freedom:   { label: '自由',   desc: '不受约束的渴望', volatility: 0.4 },
  protection:{ label: '守护',   desc: '保护重要之人的冲动', volatility: 0.5 },
  honor:     { label: '名誉',   desc: '维护名声的渴望', volatility: 0.4 },
  lust:      { label: '爱欲',   desc: '对特定人的情欲', volatility: 0.6 },
};

// 信念库（每个 NPC 生成时随机选取 1~3 条）
const BELIEF_POOL = [
  { id: 'family_first',    label: '家人至上',     desc: '家人的安全高于一切',           breaksOn: '家人受到死亡威胁' },
  { id: 'might_right',     label: '弱肉强食',     desc: '强者活该统治弱者',             breaksOn: '被弱者击败或拯救' },
  { id: 'forgiveness',     label: '以德报怨',     desc: '原谅比复仇更有力量',           breaksOn: '被反复背叛至无法忍受' },
  { id: 'vengeance',       label: '有仇必报',     desc: '受的伤害必须加倍奉还',         breaksOn: '复仇后感到空虚或忏悔' },
  { id: 'money_above_all', label: '金钱万能',     desc: '有钱能使鬼推磨',               breaksOn: '金钱无法解决生死攸关的事' },
  { id: 'loyalty_above',   label: '忠诚至上',     desc: '对主人/朋友必须绝对忠诚',      breaksOn: '被忠诚对象背叛' },
  { id: 'freedom_priceless',label:'自由无价',     desc: '宁可死也不愿被束缚',           breaksOn: '为了守护他人自愿牺牲自由' },
  { id: 'honor_before_life',label:'名誉重于生命', desc: '丢了面子不如死了',             breaksOn: '亲眼见到名誉被践踏且无力挽回' },
];

// 心理防线类型 — 触发因人格而异，不再有固定的 trigger
const DEFENSE_TYPES = {
  family_threat: {
    label: '家人受威胁', priority: 1,
    reactions: {
      EXPLOSIVE:  { behavior: '暴怒守护',  desc: '冲上前拼命保护家人，对威胁者下死手' },
      STOIC:      { behavior: '暗中转移',  desc: '面不改色，悄悄将家人送至安全之处' },
      COLD:       { behavior: '冷静清除',  desc: '不动声色，暗中计划消灭威胁源头' },
      AVOIDANT:   { behavior: '连夜逃离',  desc: '带着家人逃离这个地方，不再回来' },
      COLLAPSE:   { behavior: '跪地乞求',  desc: '彻底崩溃，愿意付出任何代价换取家人安全' },
      CONFRONT:   { behavior: '正面对质',  desc: '站出来直面威胁，据理力争或谈判' },
    },
  },
  public_humiliation: {
    label: '公开羞辱', priority: 2,
    reactions: {
      EXPLOSIVE:  { behavior: '当场暴怒',  desc: '当场发飙，可能动手打人' },
      STOIC:      { behavior: '一笑置之',  desc: '表面不在意，但压力暗中积累更深' },
      COLD:       { behavior: '记恨于心',  desc: '面不改色地离开，开始在心里策划报复' },
      AVOIDANT:   { behavior: '羞愤离场',  desc: '低头快步离开，长时间不敢再出现' },
      COLLAPSE:   { behavior: '当众崩溃',  desc: '泪水失控，在众人面前精神崩溃' },
      CONFRONT:   { behavior: '据理反驳',  desc: '不卑不亢地回击羞辱，维护尊严' },
    },
  },
  secret_exposed: {
    label: '秘密被揭发', priority: 3,
    reactions: {
      EXPLOSIVE:  { behavior: '杀人灭口',  desc: '不顾一切让知情人闭嘴' },
      STOIC:      { behavior: '沉默以对',  desc: '不承认不否认，用沉默承受一切' },
      COLD:       { behavior: '反制威胁',  desc: '收集揭发者的把柄，以牙还牙' },
      AVOIDANT:   { behavior: '远走他乡',  desc: '秘密被揭开后无颜留下，选择离开' },
      COLLAPSE:   { behavior: '彻底认罪',  desc: '跪地痛哭，供出一切，不再抵抗' },
      CONFRONT:   { behavior: '坦然面对',  desc: '承认秘密，但认为那不是自己的全部' },
    },
  },
  lover_taken: {
    label: '爱人被夺走', priority: 4,
    reactions: {
      EXPLOSIVE:  { behavior: '暴力争夺',  desc: '直接用暴力赶走情敌' },
      STOIC:      { behavior: '默默承受',  desc: '内心撕裂但表面平静，可能自我放逐' },
      COLD:       { behavior: '设局破坏',  desc: '精心设计让情敌身败名裂' },
      AVOIDANT:   { behavior: '独自离去',  desc: '心碎离开，不再打扰' },
      COLLAPSE:   { behavior: '心碎自毁',  desc: '失去活下去的动力，可能走向自我毁灭' },
      CONFRONT:   { behavior: '正面竞争',  desc: '堂堂正正地与情敌竞争' },
    },
  },
  dignity_crushed: {
    label: '尊严被践踏', priority: 5,
    reactions: {
      EXPLOSIVE:  { behavior: '以命相搏',  desc: '宁可同归于尽也不受辱' },
      STOIC:      { behavior: '咬牙隐忍',  desc: '忍住屈辱，但心里种下复仇的种子' },
      COLD:       { behavior: '隐忍待机',  desc: '默默积累力量，等待时机翻身' },
      AVOIDANT:   { behavior: '一蹶不振',  desc: '尊严破碎后自我封闭，难以振作' },
      COLLAPSE:   { behavior: '自我放逐',  desc: '认为自己不配做人，彻底放弃' },
      CONFRONT:   { behavior: '反抗到底',  desc: '宁死不屈，用最后的力量维护尊严' },
    },
  },
};

// ======================== 反应风格 ========================

const REACTION_STYLES = {
  EXPLOSIVE: { name: '爆发型', desc: '遇压即爆，直接动手不掩饰' },
  STOIC:     { name: '隐忍型', desc: '表面如常，内伤自愈或暗中积累' },
  COLD:      { name: '冷谋型', desc: '不立刻反应，冷静策划反击' },
  AVOIDANT:  { name: '回避型', desc: '逃避冲突，远离危险' },
  COLLAPSE:  { name: '崩溃型', desc: '被压垮后无法行动，可能自毁' },
  CONFRONT:  { name: '直面型', desc: '正面对抗但不极端，据理力争' },
};

/**
 * 根据大五人格计算反应风格
 * @param {object} traits   大五人格对象 { openness, conscientiousness, extraversion, agreeableness, neuroticism }
 * @returns {string} 反应风格 key
 */
function calcReactionStyle(traits) {
  const N = traits.neuroticism;      // 高 → 情绪不稳定
  const A = traits.agreeableness;    // 高 → 温和
  const E = traits.extraversion;     // 高 → 外向
  const C = traits.conscientiousness; // 高 → 自律
  // openness 不直接用于反应风格判定

  if (N > 0.6 && A < 0.4) return 'EXPLOSIVE';  // 高神经质 + 低宜人 → 一点就炸
  if (N > 0.6 && E < 0.35) return 'COLLAPSE';  // 高神经质 + 低外向 → 内向崩溃
  if (N > 0.5 && A > 0.5) return 'AVOIDANT';   // 高神经质 + 高宜人 → 怕冲突回避
  if (N < 0.35 && A < 0.4) return 'COLD';      // 低神经质 + 低宜人 → 冷静暗算
  if (C > 0.6 && N < 0.45) return 'STOIC';     // 高尽责 + 低神经 → 隐忍克制
  if (E > 0.5 && N < 0.45) return 'CONFRONT';  // 高外向 + 低神经 → 正面刚

  // 兜底：中庸性格偏向隐忍
  return 'STOIC';
}

// 压力来源（delta 值）
const STRESS_FACTORS = {
  attacked:           0.15,
  witnessed_attack:   0.08,
  betrayed:           0.20,
  publicly_humiliated:0.18,
  socially_isolated:  0.05,  // per tick when no social contact
  near_enemy:         0.03,  // per tick when enemy is nearby
  goal_blocked:       0.08,
  rumor_heard:        0.06,
  debt_high:          0.04,  // per tick when heavily in debt (>0.5)
  poverty:            0.04,  // per tick when wealth low and desire high
};

const STRESS_RELIEF = {
  positive_social:    0.05,  // per positive interaction
  gift_received:      0.08,
  goal_achieved:      0.10,
  aided_by_ally:      0.07,
  time_recovery:      0.01,  // per tick when no stressors
  trustful_company:   0.02,  // per tick when near trusted NPC
};

// 欲望随时间回归中性
const DESIRE_DECAY_RATE = 0.005; // per tick

// ======================== 工具 ========================

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function pickRandom(arr, count) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ======================== NPC 内心状态类 ========================

class NPCInternalState {
  /**
   * @param {string} npcId
   * @param {object} personality  NPCDataLoader.loadNPCData 返回的 NPC 数据对象，含 traits/mood/needs 等
   * @param {EventBus} [eventBus]
   */
  constructor(npcId, personality, eventBus) {
    this.npcId = npcId;
    this.bus = eventBus || null;

    // ---- 人格驱动的反应风格 ----
    this.reactionStyle = calcReactionStyle(personality.traits);
    this.reactionStyleLabel = REACTION_STYLES[this.reactionStyle]?.name || '隐忍型';

    // ---- 压力值 ----
    // 神经质高 → 初始压力高；隐忍型 → 初始压力略高（长期内耗）
    this.stress = personality.traits.neuroticism * 0.3;
    if (this.reactionStyle === 'STOIC') this.stress += 0.05;

    // ---- 心理状态 ----
    this.psychState = this._calcPsychState();

    // ---- 欲望系统 ----
    // 从 personality.needs 迁移前 4 个 + 新增 5 个
    const needs = personality.needs || {};
    this.desires = {
      safety:     needs.safety ?? 0.3 + Math.random() * 0.3,
      social:     needs.social ?? 0.2 + Math.random() * 0.4,
      wealth:     needs.wealth ?? 0.2 + Math.random() * 0.4,
      power:      needs.power  ?? 0.1 + Math.random() * 0.3,
      revenge:    0.05 + Math.random() * 0.15,
      freedom:    0.2 + Math.random() * 0.4,
      protection: 0.2 + Math.random() * 0.4,
      honor:      0.1 + Math.random() * 0.3,
      lust:       0.05 + Math.random() * 0.2,
    };

    // ---- 信念系统 ----
    // 选取 1~3 条信念
    this.beliefs = pickRandom(BELIEF_POOL, 1 + Math.floor(Math.random() * 3));

    // ---- 心理防线 ----
    // 每个 NPC 有全部 5 种防线，但阈值因性格不同
    this.defenses = {};
    for (const [key, def] of Object.entries(DEFENSE_TYPES)) {
      this.defenses[key] = {
        ...def,
        threshold: this._calcDefenseThreshold(key, personality),
        breached: false,
        breachedAt: null,
        breachEvent: null,
      };
    }

    // ---- 近期压力事件 ----
    this.recentStressors = []; // [{ time, source, delta, desc }]

    // ---- 上次更新 ----
    this.lastTickTime = Date.now();
  }

  // ======================== 心理状态 ========================

  _calcPsychState() {
    for (const [key, state] of Object.entries(PSYCH_STATES)) {
      if (this.stress >= state.min && this.stress <= state.max) return key;
    }
    return 'FRENZY';
  }

  _calcDefenseThreshold(key, personality) {
    const traits = personality.traits || {};
    const base = {
      family_threat:      0.6,
      public_humiliation: 0.5 + traits.neuroticism * 0.3,
      secret_exposed:     0.5,
      lover_taken:        0.55 + (1 - traits.agreeableness) * 0.3,
      dignity_crushed:    0.4 + (1 - traits.openness) * 0.2,
    };
    return clamp(base[key] || 0.55, 0.3, 0.85);
  }

  /** 获取当前心理状态标签 */
  getPsychStateLabel() {
    return PSYCH_STATES[this.psychState]?.name || '未知';
  }

  /** 心理状态是否满足某阈值（用于行为判断） */
  isAtLeast(stateName) {
    const thresholds = { NORMAL: 0, ANXIOUS: 1, PARANOID: 2, BREAKDOWN: 3, FRENZY: 4 };
    const current = thresholds[this.psychState] ?? 0;
    const target = thresholds[stateName] ?? 0;
    return current >= target;
  }

  // ======================== 压力管理 ========================

  /**
   * 增加压力
   * @param {string} factor  STRESS_FACTORS 的 key 或自定义数值
   * @param {string} [desc] 事件描述
   */
  addStress(factor, desc) {
    const delta = typeof factor === 'number' ? factor : (STRESS_FACTORS[factor] || 0.05);
    const oldStress = this.stress;
    const oldState = this.psychState;

    this.stress = clamp(this.stress + delta, 0, 1);
    this.psychState = this._calcPsychState();

    if (desc) {
      this.recentStressors.push({ time: Date.now(), source: factor, delta, desc });
      if (this.recentStressors.length > 20) this.recentStressors.shift();
    }

    // 状态变化时发出事件
    if (this.bus && oldState !== this.psychState) {
      this.bus.emit('npc-stress-state-changed', {
        npcId: this.npcId,
        oldState, newState: this.psychState,
        oldLabel: PSYCH_STATES[oldState]?.name,
        newLabel: PSYCH_STATES[this.psychState]?.name,
        stress: this.stress,
      });
    }

    // 超过阈值时发出警告
    if (this.bus && this.stress >= 0.7 && oldStress < 0.7) {
      this.bus.emit('npc-stress-alert', {
        npcId: this.npcId,
        stressLevel: this.stress,
        psychState: this.psychState,
      });
    }

    return { oldStress, newStress: this.stress, oldState, newState: this.psychState };
  }

  /**
   * 减少压力（恢复）
   */
  relieveStress(factor, desc) {
    const delta = typeof factor === 'number' ? factor : (STRESS_RELIEF[factor] || 0.03);
    const oldStress = this.stress;
    const oldState = this.psychState;

    this.stress = clamp(this.stress - delta, 0, 1);
    this.psychState = this._calcPsychState();

    // 从高压力恢复的事件
    if (this.bus && oldState !== this.psychState) {
      this.bus.emit('npc-stress-state-changed', {
        npcId: this.npcId,
        oldState, newState: this.psychState,
        oldLabel: PSYCH_STATES[oldState]?.name,
        newLabel: PSYCH_STATES[this.psychState]?.name,
        stress: this.stress,
        recovered: true,
      });
    }

    return { oldStress, newStress: this.stress };
  }

  /** 压力自然衰减（每个 tick 调用） */
  naturalDecay(socialContext) {
    // 社交环境决定恢复速度
    let decay = STRESS_RELIEF.time_recovery;
    if (socialContext.nearTrusted) decay += STRESS_RELIEF.trustful_company;

    // 隐忍型：压力恢复减半（内化伤害，不易释怀）
    if (this.reactionStyle === 'STOIC') decay *= 0.5;
    // 回避型：孤立时压力更大
    if (this.reactionStyle === 'AVOIDANT' && socialContext.isolated) {
      this.addStress(STRESS_FACTORS.socially_isolated + 0.02, '回避型人格在孤独中更加焦虑');
      return;
    }

    if (socialContext.isolated) {
      this.addStress(STRESS_FACTORS.socially_isolated, '感到孤独');
      return;
    }
    this.relieveStress(decay, null);
  }

  // ======================== 欲望管理 ========================

  /**
   * 调整某个欲望的强度
   * @param {string} desireKey
   * @param {number} delta
   * @param {string} [reason]
   */
  adjustDesire(desireKey, delta, reason) {
    if (this.desires[desireKey] === undefined) return;
    const old = this.desires[desireKey];
    this.desires[desireKey] = clamp(old + delta, 0, 1);

    if (this.bus && Math.abs(delta) > 0.2) {
      this.bus.emit('npc-desire-changed', {
        npcId: this.npcId,
        desire: desireKey,
        oldValue: old,
        newValue: this.desires[desireKey],
        reason,
      });
    }
  }

  /** 欲望自然衰减（每个 tick 调用） */
  decayDesires() {
    for (const key of Object.keys(this.desires)) {
      const def = DESIRE_DEFS[key];
      if (!def) continue;
      const rate = DESIRE_DECAY_RATE * def.volatility;
      this.desires[key] = clamp(this.desires[key] - rate, 0, 1);
    }
  }

  /** 获取当前最强烈的 3 个欲望 */
  getTopDesires(n = 3) {
    return Object.entries(this.desires)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key, value]) => ({ key, value, label: DESIRE_DEFS[key]?.label || key }));
  }

  // ======================== 信念管理 ========================

  /** 打破一条信念（极端事件触发） */
  breakBelief(beliefId, reason) {
    const idx = this.beliefs.findIndex(b => b.id === beliefId);
    if (idx === -1) return false;

    const broken = this.beliefs.splice(idx, 1)[0];
    this.beliefs.push({
      ...broken,
      broken: true,
      brokenAt: Date.now(),
      brokenReason: reason,
    });

    // 信念被打破 → 巨大压力 + 可能触发状态变化
    this.addStress(0.3, `信念「${broken.label}」被打破：${reason}`);

    if (this.bus) {
      this.bus.emit('npc-belief-broken', {
        npcId: this.npcId,
        belief: broken,
        reason,
      });
    }

    return true;
  }

  // ======================== 心理防线 ========================

  /**
   * 检查某条防线是否被突破
   * @returns {{ breached: boolean, defense: object, reaction: object } | null}
   */
  checkDefense(key, event) {
    const def = this.defenses[key];
    if (!def || def.breached) return null;

    // 压力超过该防线的阈值 → 防线被突破
    if (this.stress >= def.threshold && Math.random() < this.stress * 0.7) {
      const reaction = DEFENSE_TYPES[key]?.reactions[this.reactionStyle]
        || DEFENSE_TYPES[key]?.reactions['STOIC']; // 兜底

      def.breached = true;
      def.breachedAt = Date.now();
      def.breachEvent = event;
      def.breachReaction = reaction;

      // 隐忍型被突破 → 额外压力（内化伤害）
      // 爆发型被突破 → 释放一部分压力（发泄了）
      if (this.reactionStyle === 'STOIC') {
        this.addStress(0.15, `心理防线「${def.label}」被突破，但选择隐忍`);
      } else if (this.reactionStyle === 'COLLAPSE') {
        this.addStress(0.2, `心理防线「${def.label}」被突破，精神崩溃`);
      } else if (this.reactionStyle === 'EXPLOSIVE') {
        this.addStress(0.05, `心理防线「${def.label}」被突破，暴怒发泄`);
        this.relieveStress(0.05, '通过爆发释放了部分压力');
      } else {
        this.addStress(0.1, `心理防线「${def.label}」被突破`);
      }

      if (this.bus) {
        this.bus.emit('npc-defense-breached', {
          npcId: this.npcId,
          defense: { key, ...def },
          reactionStyle: this.reactionStyle,
          reactionStyleLabel: this.reactionStyleLabel,
          reaction,
          event,
        });
      }

      return { breached: true, defense: def, reaction };
    }
    return { breached: false, defense: def };
  }

  /** 检查所有防线 */
  checkAllDefenses(event) {
    const results = [];
    for (const key of Object.keys(this.defenses)) {
      const result = this.checkDefense(key, event);
      if (result && result.breached) {
        results.push(result);
      }
    }
    return results;
  }

  // ======================== 外部事件响应 ========================

  /** 被攻击 */
  onAttacked(attackerName) {
    this.addStress('attacked', `被 ${attackerName} 攻击`);
    this.adjustDesire('safety', +0.15, '被攻击后安全需求上升');
    this.adjustDesire('revenge', +0.12, '对攻击者产生复仇欲');
  }

  /** 收到礼物 */
  onReceivedGift() {
    this.relieveStress('gift_received', '收到礼物');
    this.adjustDesire('social', -0.05, '社交需求得到满足');
  }

  /** 被欺骗/背叛 */
  onBetrayed(betrayerName) {
    this.addStress('betrayed', `被 ${betrayerName} 背叛`);
    this.adjustDesire('revenge', +0.25, '被背叛后复仇欲飙升');
    this.adjustDesire('safety', +0.1, '背叛后安全感下降');
    // 检查是否触发"被背叛"相关防线
    this.checkDefense('public_humiliation', { type: 'betrayal', by: betrayerName });
  }

  /** 被公开羞辱 */
  onHumiliated(humiliatorName) {
    this.addStress('publicly_humiliated', `被 ${humiliatorName} 公开羞辱`);
    this.adjustDesire('revenge', +0.2, '羞辱引起的复仇欲');
    this.adjustDesire('honor', +0.15, '名誉受损');
    this.checkDefense('public_humiliation', { type: 'humiliation', by: humiliatorName });
  }

  /** 社交互动 */
  onSocialInteraction(otherName, positive) {
    if (positive) {
      this.relieveStress('positive_social', `与 ${otherName} 愉快交谈`);
      this.adjustDesire('social', -0.03, '社交需求得到满足');
    } else {
      this.addStress(0.03, `与 ${otherName} 不愉快的交谈`);
    }
  }

  /** 目标达成 */
  onGoalAchieved(goal) {
    this.relieveStress('goal_achieved', `达成目标：${goal}`);
    this.adjustDesire('power', -0.05, '目标达成后权力欲降低');
  }

  /** 得知秘密 */
  onSecretLearned() {
    this.addStress('rumor_heard', '得知了一个秘密');
    this.adjustDesire('power', +0.08, '掌握信息即权力');
    if (this.psychState === 'PARANOID' || this.psychState === 'BREAKDOWN') {
      this.checkDefense('secret_exposed', { type: 'learned_secret' });
    }
  }

  // ======================== 周期性更新 ========================

  /**
   * 每个 tick 调用
   * @param {object} socialContext { nearTrusted: bool, isolated: bool, nearEnemy: bool, debtLevel: number }
   */
  tick(socialContext = {}) {
    // 1. 压力自然衰减 / 环境压力累积
    this.naturalDecay(socialContext);

    // 2. 如果附近有敌人，额外压力
    if (socialContext.nearEnemy) {
      this.addStress('near_enemy', '附近有敌人');
    }

    // 3. 负债压力
    if (socialContext.debtLevel && socialContext.debtLevel > 0.5) {
      this.addStress('debt_high', '债务缠身');
    }

    // 4. 欲望自然衰减
    this.decayDesires();

    // 5. 更新心理状态
    const oldState = this.psychState;
    this.psychState = this._calcPsychState();

    this.lastTickTime = Date.now();

    return {
      stress: this.stress,
      psychState: this.psychState,
      stateChanged: oldState !== this.psychState,
    };
  }

  // ======================== 存档接口 ========================

  toSnapshot() {
    return {
      npcId: this.npcId,
      stress: this.stress,
      psychState: this.psychState,
      reactionStyle: this.reactionStyle,
      desires: { ...this.desires },
      beliefs: this.beliefs.map(b => ({ ...b })),
      defenses: Object.fromEntries(
        Object.entries(this.defenses).map(([k, v]) => [k, { ...v }])
      ),
      recentStressors: this.recentStressors.slice(-10),
    };
  }

  fromSnapshot(snapshot) {
    if (!snapshot) return;
    this.stress = snapshot.stress ?? 0;
    this.psychState = snapshot.psychState || this._calcPsychState();
    this.desires = { ...this.desires, ...(snapshot.desires || {}) };
    if (snapshot.beliefs) this.beliefs = snapshot.beliefs;
    if (snapshot.defenses) {
      for (const [k, v] of Object.entries(snapshot.defenses)) {
        if (this.defenses[k]) Object.assign(this.defenses[k], v);
      }
    }
    this.recentStressors = snapshot.recentStressors || [];
  }

  // ======================== 诊断接口 ========================

  /** 生成内心状态摘要（用于 LLM prompt） */
  getSummary() {
    const topDesires = this.getTopDesires(3);
    const activeBeliefs = this.beliefs.filter(b => !b.broken);
    const brokenBeliefs = this.beliefs.filter(b => b.broken);
    const breachedDefenses = Object.entries(this.defenses)
      .filter(([, d]) => d.breached)
      .map(([, d]) => d.label);

    return {
      stress: this.stress,
      psychState: this.psychState,
      psychStateLabel: this.getPsychStateLabel(),
      reactionStyle: this.reactionStyle,
      reactionStyleLabel: this.reactionStyleLabel,
      topDesires: topDesires.map(d => d.label).join('、'),
      activeBeliefs: activeBeliefs.map(b => b.label),
      brokenBeliefs: brokenBeliefs.map(b => b.label),
      breachedDefenses,
      isExtreme: this.psychState === 'BREAKDOWN' || this.psychState === 'FRENZY',
    };
  }
}

module.exports = { NPCInternalState, PSYCH_STATES, DESIRE_DEFS, BELIEF_POOL, DEFENSE_TYPES, REACTION_STYLES, calcReactionStyle, STRESS_FACTORS, STRESS_RELIEF };
