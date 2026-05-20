// 时间系统 — 驱动游戏世界的时间流动
// 真实时间 → 游戏时间：默认 1 秒 = 1 游戏分钟（可调速）
// 通过 EventBus 广播时间事件

const { EVENTS } = require('./EventBus');

// 季节顺序
const SEASONS = ['spring', 'summer', 'fall', 'winter'];
const DAYS_PER_SEASON = 30;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const START_HOUR = 6; // 一天从 06:00 开始

class TimeManager {
  /**
   * @param {EventBus} bus 事件总线实例
   * @param {object}   opts 可选配置
   * @param {number}   opts.speed    时间流速（默认 1，即 1 真实秒 = 1 游戏分钟）
   * @param {number}   opts.day      初始日子（默认 1）
   * @param {number}   opts.season   初始季节索引（默认 0 = 春）
   * @param {number}   opts.year     初始年份（默认 1）
   */
  constructor(bus, opts = {}) {
    this.bus = bus;

    this.day    = opts.day    || 1;
    this.seasonIdx = opts.seasonIdx !== undefined ? opts.seasonIdx : 0;
    this.year   = opts.year   || 1;
    this.hour   = opts.hour   || START_HOUR;  // 06:00
    this.minute = opts.minute || 0;
    this.speed  = opts.speed  || 1;

    // 每分钟需要多少真实毫秒：1000 / speed
    this._msPerGameMinute = 1000 / this.speed;

    // 累计毫秒，达到阈值便推进 1 游戏分钟
    this._accumulated = 0;

    // 缓存上一个值，用于检测变化
    this._lastHour    = this.hour;
    this._lastDay     = this.day;
    this._lastSeason  = this.season;
    this._lastYear    = this.year;
    this._lastPeriod  = this._getPeriod();
  }

  // ======================== 属性 ========================

  get season() {
    return SEASONS[this.seasonIdx];
  }

  /** 一个月有几天 */
  get daysPerSeason() { return DAYS_PER_SEASON; }

  /** 一天总游戏分钟数 */
  get minutesPerDay() { return HOURS_PER_DAY * MINUTES_PER_HOUR; }

  /** 格式化 HH:MM */
  get timeString() {
    const h = String(this.hour).padStart(2, '0');
    const m = String(this.minute).padStart(2, '0');
    return `${h}:${m}`;
  }

  /** 格式化 "春 第3天 第1年" */
  get dateString() {
    const names = { spring:'春', summer:'夏', fall:'秋', winter:'冬' };
    return `${names[this.season]} 第${this.day}天 第${this.year}年`;
  }

  // ======================== 主循环 ========================

  /**
   * 每帧调用
   * @param {number} deltaMs 本次帧的毫秒数
   */
  tick(deltaMs) {
    this._accumulated += deltaMs * this.speed;

    let changed = false;

    while (this._accumulated >= this._msPerGameMinute) {
      this._accumulated -= this._msPerGameMinute;
      this.minute++;
      changed = true;

      if (this.minute >= MINUTES_PER_HOUR) {
        this.minute = 0;
        this.hour++;

        if (this.hour >= HOURS_PER_DAY) {
          this.hour = 0;
          this.day++;

          if (this.day > DAYS_PER_SEASON) {
            this.day = 1;
            this.seasonIdx++;
            if (this.seasonIdx >= SEASONS.length) {
              this.seasonIdx = 0;
              this.year++;
              this._emitIfChanged('year-change');
            }
            this._emitIfChanged('season-change');
          }
          this._emitIfChanged('day-change');
        }
        this._emitIfChanged('hour-change');
      }
    }

    if (changed) {
      // 时段变化
      const period = this._getPeriod();
      if (period !== this._lastPeriod) {
        this.bus.emit(EVENTS.TIME_OF_DAY, {
          period, previous: this._lastPeriod,
          hour: this.hour, day: this.day, season: this.season, year: this.year,
        });
        this._lastPeriod = period;
      }

      // 帧级 tick（低频订阅者用）
      this.bus.emit(EVENTS.TIME_TICK, {
        hour: this.hour, minute: this.minute,
        day: this.day, season: this.season, year: this.year,
        timeString: this.timeString, dateString: this.dateString,
      });
    }
  }

  // ======================== 控制 ========================

  /** 设置时间流速 */
  setSpeed(speed) { this.speed = Math.max(0.1, speed); }

  /** 暂停 */
  pause()  { this._paused = true; }
  /** 恢复 */
  resume() { this._paused = false; }

  /** 跳跃到指定时间（用于调试/加载存档） */
  skipTo(hour, day, seasonIdx, year) {
    this.hour   = hour ?? this.hour;
    this.minute = 0;
    this.day    = day   ?? this.day;
    this.seasonIdx = seasonIdx !== undefined ? seasonIdx : this.seasonIdx;
    this.year   = year  ?? this.year;
    this._accumulated = 0;
    this._lastHour   = this.hour;
    this._lastDay    = this.day;
    this._lastSeason = this.season;
    this._lastYear   = this.year;
  }

  /** 导出快照（存档用） */
  toSnapshot() {
    return {
      hour: this.hour, minute: this.minute,
      day: this.day, season: this.season, year: this.year,
      speed: this.speed,
    };
  }

  /** 从快照恢复 */
  fromSnapshot(snap) {
    this.skipTo(snap.hour, snap.day,
      SEASONS.indexOf(snap.season), snap.year);
    this.speed = snap.speed || 1;
  }

  // ======================== 内部 ========================

  _getPeriod() {
    if (this.hour >= 5  && this.hour < 8)  return 'sunrise';
    if (this.hour >= 8  && this.hour < 12) return 'morning';
    if (this.hour >= 12 && this.hour < 14) return 'noon';
    if (this.hour >= 14 && this.hour < 18) return 'afternoon';
    if (this.hour >= 18 && this.hour < 21) return 'sunset';
    if (this.hour >= 21 || this.hour < 2)  return 'night';
    return 'midnight';
  }

  _emitIfChanged(type) {
    switch (type) {
      case 'hour-change':
        this.bus.emit(EVENTS.TIME_HOUR_CHANGED, {
          hour: this.hour, day: this.day, season: this.season, year: this.year,
        });
        break;
      case 'day-change':
        this.bus.emit(EVENTS.TIME_DAY_CHANGED, {
          day: this.day, season: this.season, year: this.year,
        });
        break;
      case 'season-change':
        this.bus.emit(EVENTS.TIME_SEASON_CHANGED, {
          season: this.season, day: this.day, year: this.year,
        });
        break;
      case 'year-change':
        this.bus.emit(EVENTS.TIME_YEAR_CHANGED, {
          year: this.year, season: this.season,
        });
        break;
    }
  }
}

module.exports = TimeManager;
