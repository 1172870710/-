// 存档系统 — 世界持久化
// 每天切换时自动存档 + 玩家离线时单独存档
// 存储格式：JSON 文件到 data/saves/

const fs   = require('fs');
const path = require('path');

class SaveManager {
  /**
   * @param {object} opts
   * @param {string} opts.dataDir     存档目录（默认 data/saves/）
   * @param {number} opts.autoIntervalMs 自动存档间隔（默认 60000 = 1 分钟）
   */
  constructor(opts = {}) {
    this.dataDir = opts.dataDir || path.join(__dirname, '..', '..', 'data', 'saves');
    this.autoInterval = opts.autoIntervalMs || 60000;
    this._autoTimer  = null;
    this._worldRef   = null;   // GameWorld 引用（由 index.js 注入）
    this._timeRef    = null;   // TimeManager 引用
  }

  /** 注入世界和时间引用（Set 后自动启用） */
  init(world, timeManager) {
    this._worldRef = world;
    this._timeRef  = timeManager;
    this._ensureDir();
    console.log(`  [存档] 目录: ${this.dataDir}`);
  }

  // ======================== 保存 ========================

  /** 完整存档整个世界 */
  save(slot = 'auto') {
    if (!this._worldRef) return false;
    try {
      const data = this._buildSaveData();
      const file = path.join(this.dataDir, `world_${slot}.json`);
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
      console.log(`  [存档] 已保存 → world_${slot}.json (${this._timeRef ? this._timeRef.dateString : ''} ${this._timeRef ? this._timeRef.timeString : ''})`);
      return true;
    } catch (e) {
      console.error('  [存档] 保存失败:', e.message);
      return false;
    }
  }

  /** 单独保存一个玩家的数据 */
  savePlayer(playerId) {
    if (!this._worldRef) return false;
    try {
      const player = this._worldRef.players.get(playerId);
      if (!player) return false;

      const data = {
        id: player.id, name: player.name,
        x: player.x, y: player.y,
        gold: player.gold, hp: player.hp, maxHp: player.maxHp,
        color: player.color,
        savedAt: Date.now(),
      };

      const dir = path.join(this.dataDir, 'players');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${playerId}.json`), JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error(`  [存档] 玩家 ${playerId} 保存失败:`, e.message);
      return false;
    }
  }

  // ======================== 读取 ========================

  /** 加载最近一次存档 */
  load(slot = 'auto') {
    const file = path.join(this.dataDir, `world_${slot}.json`);
    if (!fs.existsSync(file)) {
      console.log('  [存档] 没有找到存档，使用新世界');
      return null;
    }
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      console.log(`  [存档] 已加载 → world_${slot}.json`);
      return data;
    } catch (e) {
      console.error('  [存档] 加载失败:', e.message);
      return null;
    }
  }

  /** 加载玩家数据 */
  loadPlayer(playerId) {
    const file = path.join(this.dataDir, 'players', `${playerId}.json`);
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      return null;
    }
  }

  // ======================== 自动存档 ========================

  /** 启用自动存档（定时 + 每天触发） */
  enableAutoSave(bus, EVENTS) {
    // 定时存档
    this._autoTimer = setInterval(() => this.save('auto'), this.autoInterval);

    // 每天切换时存档
    if (bus && EVENTS) {
      bus.on(EVENTS.TIME_DAY_CHANGED, () => this.save('daily'));
    }

    console.log(`  [存档] 自动存档已启用（每${this.autoInterval / 1000}秒 + 每日存档）`);
  }

  /** 停用自动存档 */
  disableAutoSave() {
    if (this._autoTimer) { clearInterval(this._autoTimer); this._autoTimer = null; }
  }

  // ======================== 实用 ========================

  /** 列出所有存档文件 */
  listSaves() {
    try {
      return fs.readdirSync(this.dataDir)
        .filter(f => f.startsWith('world_') && f.endsWith('.json'))
        .map(f => ({ slot: f.replace(/^world_|\.json$/g, ''), file: f }));
    } catch { return []; }
  }

  /** 删除指定存档 */
  deleteSave(slot) {
    const file = path.join(this.dataDir, `world_${slot}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  // ======================== 内部 ========================

  _buildSaveData() {
    const w = this._worldRef;
    return {
      version: 2,
      time:    this._timeRef ? this._timeRef.toSnapshot() : null,
      players: w.getPlayerSnapshots(),
      npcs:    w.getNPCSnapshots(),
      relationships: w.relationshipGraph ? w.relationshipGraph.toSnapshot() : null,
      savedAt: Date.now(),
      savedAtStr: new Date().toISOString(),
    };
  }

  _ensureDir() {
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.mkdirSync(path.join(this.dataDir, 'players'), { recursive: true });
  }
}

module.exports = SaveManager;
