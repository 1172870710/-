// WorldState — 只读查询门面
// 外部模块通过此接口查询世界数据，不直接访问 GameWorld 内部
class WorldState {
  /**
   * @param {GameWorld} gameWorld
   */
  constructor(gameWorld) {
    this._w = gameWorld;
  }

  // ======================== 玩家查询 ========================

  getPlayer(id) {
    return this._w.players.get(id) || null;
  }

  getPlayerCount() {
    return this._w.players.size;
  }

  getPlayerGold(id) {
    const player = this._w.players.get(id);
    return player ? player.gold : 0;
  }

  getPlayerSnapshots() {
    const snapshots = [];
    for (const player of this._w.players.values()) {
      snapshots.push(player.toSnapshot());
    }
    return snapshots;
  }

  // ======================== NPC 查询 ========================

  getNPC(id) {
    return this._w.npcs.get(id) || null;
  }

  getNPCCount() {
    return this._w.npcs.size;
  }

  getNPCSnapshots() {
    const snapshots = [];
    for (const npc of this._w.npcs.values()) {
      snapshots.push(npc.toSnapshot());
    }
    return snapshots;
  }

  getNPCShop(npcId) {
    const npc = this._w.npcs.get(npcId);
    return npc ? npc.getShopForClient() : null;
  }

  getNPCBrain(npcId) {
    return this._w.npcBrains.get(npcId) || null;
  }

  // ======================== 世界查询 ========================

  getWorldSnapshot() {
    return {
      players: this.getPlayerSnapshots(),
      npcs: this.getNPCSnapshots(),
      map: {
        width: this._w.tileMap.width,
        height: this._w.tileMap.height,
        tileSize: this._w.tileMap.tileSize,
      },
      mapData: this._w.tileMap.map,
    };
  }

  getTileMap() {
    return this._w.tileMap;
  }

  // ======================== 关系查询 ========================

  getRelationshipGraph() {
    return this._w.relationshipGraph;
  }

  // ======================== LLM 查询 ========================

  getLLMStats() {
    if (!this._w.llmClient) return { enabled: false };
    return {
      enabled: true,
      ...this._w.llmClient.getStats(),
    };
  }

  // ======================== 邻近查询 ========================

  /**
   * 查找指定位置附近的实体
   * @param {number} x
   * @param {number} y
   * @param {number} range 搜索半径
   * @returns {{ players: Array, npcs: Array }}
   */
  findNearby(x, y, range) {
    const result = { players: [], npcs: [] };
    for (const [, player] of this._w.players) {
      if (!player.isAlive || player.isAlive()) {
        const dx = player.x - x;
        const dy = player.y - y;
        if (Math.sqrt(dx * dx + dy * dy) <= range) {
          result.players.push(player);
        }
      }
    }
    for (const [, npc] of this._w.npcs) {
      if (!npc.isAlive || npc.isAlive()) {
        const dx = npc.x - x;
        const dy = npc.y - y;
        if (Math.sqrt(dx * dx + dy * dy) <= range) {
          result.npcs.push(npc);
        }
      }
    }
    return result;
  }

  // ======================== 网络 ========================

  getConnectionCount() {
    // 由 index.js 注入（返回 wsServer.connectionCount）
    return this._connectionCount ? this._connectionCount() : 0;
  }

  /**
   * 注入连接数获取函数（在 index.js 中设为 wsServer 的引用）
   * @param {() => number} fn
   */
  setConnectionCountFn(fn) {
    this._connectionCount = fn;
  }
}

module.exports = WorldState;
