// 日程系统 — 三层日程模型 + 覆写 + 永久改变
//
// Layer 1 (最低优先): 正常日程 — 基于游戏时间的日常行程
// Layer 2 (中等优先): 异常覆写 — 有 duration + decay，事件触发
// Layer 3 (最高优先): 永久改变 — life_changing 事件触发，不 decay
//
// 设计原则：
//   骨架先于内容 — 正常日程初期全员默认"在家附近活动"
//   覆写可叠加 — 同一 NPC 可有多个活跃覆写
//   存档兼容 — 支持 toSnapshot/fromSnapshot

const { bus, EVENTS } = require('../core/EventBus');

// ======================== 日程动作类型 ========================

const SCHEDULE_ACTION = {
  WANDER_NEAR_HOME:  { label: '在家附近活动', defaultAction: 'wander' },
  STAY_AT_HOME:      { label: '待在家',       defaultAction: 'wander' },
  GO_TO_LOCATION:    { label: '去往某地',     defaultAction: 'approach' },
  AVOID_LOCATION:    { label: '避开某地',     defaultAction: 'wander' },
  AVOID_PERSON:      { label: '避开某人',     defaultAction: 'flee' },
  FOLLOW_PERSON:     { label: '跟随某人',     defaultAction: 'approach' },
  PATROL_AREA:       { label: '巡逻区域',     defaultAction: 'wander' },
  REPORT_TO:         { label: '向某人报告',   defaultAction: 'approach' },
  MOURN_AT:          { label: '哀悼',         defaultAction: 'wander' },
  CELEBRATE_AT:      { label: '庆祝',         defaultAction: 'approach' },
};

// ======================== Duration 解析 ========================

const DURATION_TO_TICKS = {
  temporary: 0,        // 即刻，但不过期（需手动移除）
  '1_day': 24 * 60,     // 1 游戏天 = 24 游戏时 × 60 真实秒
  '2_days': 48 * 60,
  '3_days': 72 * 60,
  '5_days': 120 * 60,
  '7_days': 168 * 60,
  '14_days': 336 * 60,
  '30_days': 720 * 60,
  permanent: -1,        // 永不过期
};

/**
 * 解析 duration 字符串为游戏分钟数
 */
function parseDuration(durationStr) {
  return DURATION_TO_TICKS[durationStr] ?? DURATION_TO_TICKS['3_days'];
}

// ======================== 主类 ========================

class ScheduleSystem {
  constructor() {
    // 每个 NPC 的三层日程
    // Map<npcId, {
    //   normalSchedule: [{ hour, action, location?, target? }],
    //   overrides: [{ id, type, priority, startedAt, expiresAt, location, targetId, reason }],
    //   permanentChanges: [{ id, type, startedAt, location, targetId, reason }],
    //   homePosition: { x, y },
    // }>
    this.schedules = new Map();
    this._overrideCounter = 0;
  }

  // ======================== NPC 注册 ========================

  /**
   * 注册 NPC 到日程系统
   * @param {string} npcId
   * @param {object} homePosition { x, y }
   * @param {Array} [normalSchedule] — 可选的正常日程，默认全天闲逛
   */
  registerNPC(npcId, homePosition, normalSchedule) {
    this.schedules.set(npcId, {
      normalSchedule: normalSchedule || this._defaultSchedule(),
      overrides: [],
      permanentChanges: [],
      homePosition: { ...homePosition },
    });
  }

  /** 默认日程：全天在家附近闲逛 */
  _defaultSchedule() {
    return [
      { hour: 0, action: 'WANDER_NEAR_HOME' },
    ];
  }

  /** 移除 NPC */
  unregisterNPC(npcId) {
    this.schedules.delete(npcId);
  }

  // ======================== 日程覆写 ========================

  /**
   * 添加覆写（Layer 2）
   * @param {string} npcId
   * @param {object} override
   *   type: string        — OVERRIDE_TYPE key
   *   priority: number    — 越高越优先
   *   duration: string    — '3_days' | 'permanent' | ...
   *   location?: { x, y }
   *   targetId?: string
   *   reason?: string
   * @returns {string} override id
   */
  addOverride(npcId, override) {
    const sched = this.schedules.get(npcId);
    if (!sched) return null;

    const id = `ovr_${++this._overrideCounter}_${npcId}`;
    const now = Date.now();
    const durationTicks = parseDuration(override.duration || '3_days');

    const entry = {
      id,
      type: override.type || 'HIDE_AT_HOME',
      priority: override.priority || 50,
      startedAt: now,
      expiresAt: durationTicks === -1 ? null : now + durationTicks * 1000, // 转换为毫秒
      location: override.location || null,
      targetId: override.targetId || null,
      reason: override.reason || '',
    };

    sched.overrides.push(entry);
    // 按 priority 降序排列
    sched.overrides.sort((a, b) => b.priority - a.priority);

    console.log(`  📅 ${npcId}: 日程覆写 [${entry.type}] priority=${entry.priority} expires=${override.duration}`);

    return id;
  }

  /**
   * 添加永久改变（Layer 3）
   * 来自 life_changing 事件
   */
  addPermanentChange(npcId, change) {
    const sched = this.schedules.get(npcId);
    if (!sched) return null;

    const entry = {
      id: `perm_${++this._overrideCounter}_${npcId}`,
      type: change.type || 'AVOID_LOCATION',
      startedAt: Date.now(),
      location: change.location || null,
      targetId: change.targetId || null,
      reason: change.reason || 'life-changing event',
    };

    sched.permanentChanges.push(entry);

    if (bus) {
      bus.emit('schedule-permanent-change-added', { npcId, change: entry });
    }

    console.log(`  📅🔒 ${npcId}: 永久改变 [${entry.type}] — ${entry.reason}`);
    return entry.id;
  }

  /**
   * 手动移除覆写（例如：压力恢复后自动移除）
   */
  removeOverride(npcId, overrideId) {
    const sched = this.schedules.get(npcId);
    if (!sched) return false;
    const idx = sched.overrides.findIndex(o => o.id === overrideId);
    if (idx === -1) return false;
    sched.overrides.splice(idx, 1);
    return true;
  }

  // ======================== 当前日程查询 ========================

  /**
   * 获取 NPC 当前应该做什么
   * 解析顺序：Layer 3 (永久) → Layer 2 (覆写) → Layer 1 (正常)
   *
   * @param {string} npcId
   * @param {number} gameHour — 当前游戏时间（小时，0-23）
   * @returns {object} { action, targetId, location, source, sourceId }
   */
  getCurrentSchedule(npcId, gameHour) {
    const sched = this.schedules.get(npcId);
    if (!sched) return this._fallbackAction();

    // Layer 3: 永久改变（最高优先）
    // 按 type 决定行为
    for (const change of sched.permanentChanges) {
      const action = this._permanentChangeToAction(change);
      if (action) return { ...action, source: 'permanent', sourceId: change.id };
    }

    // Layer 2: 活跃覆写（按 priority 降序）
    for (const override of sched.overrides) {
      if (this._isExpired(override)) continue;
      const action = this._overrideToAction(override, sched);
      if (action) return { ...action, source: 'override', sourceId: override.id };
    }

    // Layer 1: 正常日程（基于时间）
    const normalEntry = this._findNormalEntry(sched.normalSchedule, gameHour);
    return {
      action: (normalEntry && SCHEDULE_ACTION[normalEntry.action])
        ? SCHEDULE_ACTION[normalEntry.action].defaultAction : 'wander',
      targetId: null,
      location: sched.homePosition,
      source: 'normal',
      sourceId: null,
    };
  }

  /**
   * 获取所有活跃覆写（用于检查某个 NPC 是否有特定类型的覆写）
   */
  getActiveOverrides(npcId) {
    const sched = this.schedules.get(npcId);
    if (!sched) return [];
    return sched.overrides.filter(o => !this._isExpired(o));
  }

  /**
   * 是否有某类型的活跃覆写
   */
  hasActiveOverride(npcId, type) {
    return this.getActiveOverrides(npcId).some(o => o.type === type);
  }

  // ======================== Tick / Decay ========================

  /**
   * 定期清理过期的覆写
   * 应在 GameLoop 中每 ~10s 调用一次
   */
  tick() {
    const now = Date.now();
    let removed = 0;

    for (const [npcId, sched] of this.schedules) {
      const before = sched.overrides.length;
      sched.overrides = sched.overrides.filter(o => {
        if (o.expiresAt !== null && now >= o.expiresAt) {
          console.log(`  📅 ${npcId}: 覆写过期 [${o.type}] — ${o.reason}`);
          return false;
        }
        return true;
      });
      removed += before - sched.overrides.length;
    }

    if (removed > 0) {
      console.log(`  📅 ScheduleSystem: 清理了 ${removed} 个过期覆写`);
    }
  }

  /**
   * 获取多个 NPC 在同一时间同一地点的汇聚点（用于 DramaEngine 扫描）
   */
  getConvergencePoints(gameHour) {
    const locationNPCs = new Map(); // key: "x,y" → npcIds[]

    for (const [npcId] of this.schedules) {
      const current = this.getCurrentSchedule(npcId, gameHour);
      if (current.location) {
        const key = `${current.location.x},${current.location.y}`;
        if (!locationNPCs.has(key)) locationNPCs.set(key, []);
        locationNPCs.get(key).push(npcId);
      }
    }

    // 返回 2 个以上 NPC 在同一个位置的情况
    const convergences = [];
    for (const [loc, npcIds] of locationNPCs) {
      if (npcIds.length >= 2) {
        const [x, y] = loc.split(',').map(Number);
        convergences.push({ location: { x, y }, npcIds });
      }
    }
    return convergences;
  }

  // ======================== 内部方法 ========================

  _isExpired(override) {
    if (override.expiresAt === null) return false; // permanent overrides
    return Date.now() >= override.expiresAt;
  }

  _findNormalEntry(schedule, gameHour) {
    // 找到当前时间适用的日程条目
    // 简单实现：找到 hour <= gameHour 的最大条目
    let best = null;
    for (const entry of schedule) {
      if (entry.hour <= gameHour) {
        if (!best || entry.hour > best.hour) best = entry;
      }
    }
    return best;
  }

  _overrideToAction(override, sched) {
    const actionMap = {
      HIDE_AT_HOME:        { action: 'wander',   location: sched.homePosition },
      FLEE_AREA:           { action: 'flee',     location: null },
      AVOID_PERSON:        { action: 'wander',   location: sched.homePosition, targetId: override.targetId },
      GUARD_SOMEONE:       { action: 'approach', targetId: override.targetId },
      STALK_TARGET:        { action: 'approach', targetId: override.targetId },
      SEEK_REVENGE:        { action: 'wander',   location: sched.homePosition }, // 内心谋划，表面如常
      MOURN:               { action: 'wander',   location: override.location || sched.homePosition },
      CELEBRATE:           { action: 'approach', location: override.location || sched.homePosition },
      REPORT_TO_AUTHORITY: { action: 'approach', targetId: override.targetId },
      CONFRONT_PERSON:     { action: 'approach', targetId: override.targetId },
      PATROL_AREA:         { action: 'wander',   location: override.location || sched.homePosition },
      FOLLOW_ROUTINE:      { action: 'wander',   location: sched.homePosition },
    };

    const mapped = actionMap[override.type] || actionMap.FOLLOW_ROUTINE;
    return {
      action: mapped.action,
      targetId: mapped.targetId || null,
      location: mapped.location || null,
    };
  }

  _permanentChangeToAction(change) {
    // 永久改变返回的是约束条件，不直接指定动作
    // 实际行为由正常日程 + 约束决定
    // 这里返回 null 表示"不直接干预，但存在约束"
    // 约束在 NPCBrain 层被检查（例如：avoidLocation, avoidPerson）
    if (change.type === 'HIDE_AT_HOME') {
      // 这是一个特殊的永久改变——NPC 永远不敢去某些地方
      return null; // 由正常日程决定，但约束层会过滤
    }
    return null; // 大多数永久改变是约束而非指令
  }

  _fallbackAction() {
    return { action: 'wander', targetId: null, location: null, source: 'fallback', sourceId: null };
  }

  // ======================== 诊断与存档 ========================

  /** 获取某 NPC 的完整日程状态（调试用） */
  getDebug(npcId) {
    const sched = this.schedules.get(npcId);
    if (!sched) return null;
    const now = Date.now();
    return {
      normalSchedule: sched.normalSchedule,
      activeOverrides: sched.overrides.filter(o => !this._isExpired(o)).map(o => ({
        type: o.type, priority: o.priority, reason: o.reason,
        remaining: o.expiresAt ? Math.max(0, Math.round((o.expiresAt - now) / 1000)) + 's' : 'permanent',
      })),
      permanentChanges: sched.permanentChanges.map(c => ({ type: c.type, reason: c.reason })),
      homePosition: sched.homePosition,
    };
  }

  toSnapshot() {
    const data = {};
    for (const [npcId, sched] of this.schedules) {
      data[npcId] = {
        normalSchedule: sched.normalSchedule,
        overrides: sched.overrides.map(o => ({ ...o })),
        permanentChanges: sched.permanentChanges.map(c => ({ ...c })),
        homePosition: { ...sched.homePosition },
      };
    }
    return data;
  }

  fromSnapshot(data) {
    if (!data) return;
    this.schedules.clear();
    for (const [npcId, sched] of Object.entries(data)) {
      this.schedules.set(npcId, {
        normalSchedule: sched.normalSchedule || this._defaultSchedule(),
        overrides: sched.overrides || [],
        permanentChanges: sched.permanentChanges || [],
        homePosition: sched.homePosition || { x: 0, y: 0 },
      });
    }
  }
}

module.exports = { ScheduleSystem, SCHEDULE_ACTION, DURATION_TO_TICKS };
