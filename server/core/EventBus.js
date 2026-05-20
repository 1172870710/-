// 全局事件总线 — 模块解耦的核心
// 模块之间不直接引用，只通过事件名通信

class EventBus {
  constructor() {
    this._listeners = new Map();  // eventName → Set<callback>
  }

  /**
   * 订阅事件
   * @param {string}   eventName
   * @param {Function} callback  (data) => void
   * @returns {Function} 取消订阅的函数
   */
  on(eventName, callback) {
    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, new Set());
    }
    this._listeners.get(eventName).add(callback);

    // 返回取消订阅函数，方便组件销毁时清理
    return () => this.off(eventName, callback);
  }

  /**
   * 取消订阅
   */
  off(eventName, callback) {
    const set = this._listeners.get(eventName);
    if (set) set.delete(callback);
  }

  /**
   * 订阅一次（触发后自动取消）
   */
  once(eventName, callback) {
    const wrapper = (data) => {
      callback(data);
      this.off(eventName, wrapper);
    };
    return this.on(eventName, wrapper);
  }

  /**
   * 发布事件
   * @param {string} eventName
   * @param {*}      data 事件数据
   */
  emit(eventName, data) {
    const set = this._listeners.get(eventName);
    if (!set || set.size === 0) return;
    for (const cb of set) {
      try { cb(data); } catch (e) {
        console.error(`[EventBus] ${eventName} 回调出错:`, e.message);
      }
    }
  }

  /**
   * 获取某事件的监听者数量（调试用）
   */
  listenerCount(eventName) {
    const set = this._listeners.get(eventName);
    return set ? set.size : 0;
  }

  /**
   * 列出所有已注册的事件名（调试用）
   */
  eventNames() {
    return [...this._listeners.keys()];
  }
}

/** 全局单例 */
const bus = new EventBus();

// ======================== 标准事件类型 ========================
// 文档参考，代码中不需要直接引号写，但建议用此常量避免打字错误
const EVENTS = {
  // 时间
  TIME_TICK:          'time-tick',            // 每次时间推进 { tick }
  TIME_HOUR_CHANGED:  'time-hour-changed',     // 小时变化 { hour, day, season, year }
  TIME_DAY_CHANGED:   'time-day-changed',      // 日期变化
  TIME_SEASON_CHANGED: 'time-season-changed',  // 季节变化
  TIME_YEAR_CHANGED:  'time-year-changed',     // 年份变化
  TIME_OF_DAY:        'time-of-day',           // 时段变化 { period: 'morning'|'noon'|'afternoon'|'night' }

  // 玩家
  PLAYER_JOINED:      'player-joined',         // { playerId, player }
  PLAYER_LEFT:        'player-left',           // { playerId }

  // NPC
  NPC_SPOKE:          'npc-spoke',             // { npcId, targetId, text }
  NPC_MOOD_CHANGED:   'npc-mood-changed',      // { npcId, emotion, oldEmotion }
  NPC_RELATION_CHANGED: 'npc-relation-changed', // { aId, bId, dimension, oldValue, newValue }
  NPC_STRESS_ALERT:   'npc-stress-alert',      // { npcId, stressLevel } 压力超过阈值

  // 戏剧
  DRAMA_SEED_GENERATED: 'drama-seed-generated',  // { patternId, participants, score }
  DRAMA_EVENT_TRIGGERED: 'drama-event-triggered', // { event } DramaticEvent 实例
  DRAMA_EVENT_RESOLVED: 'drama-event-resolved',   // { eventId, resolution }
  EVIDENCE_FOUND:       'evidence-found',         // { itemId, finderId, location }
  SECRET_REVEALED:      'secret-revealed',        // { secretId, revealerId, targetId }

  // 世界
  WORLD_SAVED:        'world-saved',           // { timestamp }
  WORLD_LOADED:       'world-loaded',          // { timestamp }
  ITEM_CREATED:       'item-created',          // { itemId, location }
};

module.exports = { EventBus, bus, EVENTS };
