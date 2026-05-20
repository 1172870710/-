// GameLoop — 游戏主循环
// 管理 30fps Tick + NPC 深思循环

class GameLoop {
  /**
   * @param {object}   deps
   * @param {GameWorld}    deps.world       — 游戏世界
   * @param {TimeManager}  deps.timeManager — 时间系统
   * @param {MessageRouter} deps.router     — 消息路由
   */
  constructor({ world, timeManager, router }) {
    this.world = world;
    this.time  = timeManager;
    this.router = router;

    this._tickTimer = null;
    this._thinkTimer = null;
  }

  /** 启动游戏循环 */
  start() {
    const TICK_MS = 1000 / 30; // 30 tick/秒

    // 主 Tick：时间推进 + NPC 反应 + 状态广播
    this._tickTimer = setInterval(() => {
      this.time.tick(TICK_MS);
      this.world.tickNPCs();
      this.router.broadcastState();

      const dialogues = this.world.collectNPCDialogues();
      for (const d of dialogues) {
        this.router.broadcastNPCDialogue(d);
      }
    }, TICK_MS);

    // NPC 深思循环（独立，避免阻塞游戏 Tick）
    this._thinkTimer = setInterval(() => {
      this.world.tickNPCThink();
    }, 3000);
  }

  /** 停止循环（用于热重启或测试） */
  stop() {
    if (this._tickTimer) { clearInterval(this._tickTimer); this._tickTimer = null; }
    if (this._thinkTimer) { clearInterval(this._thinkTimer); this._thinkTimer = null; }
  }
}

module.exports = GameLoop;
