// 纯 WebSocket 传输层 — Godot / 浏览器 通用
// 职责：连接管理、JSON 编解码、消息收发。业务逻辑在 MessageRouter。

const { WebSocketServer: WSServer } = require('ws');

class WebSocketServer {
  /**
   * @param {MessageRouter} router  消息路由器
   * @param {number}        port    监听端口
   */
  constructor(router, port = 3001) {
    this.router = router;
    this.wss = new WSServer({ port });

    // ws → playerId 映射
    this.socketMap = new Map();

    // 注入回调：MessageRouter 通过这两个函数发送和广播
    router.onSend      = (playerId, msg) => this.send(playerId, msg);
    router.onBroadcast = (msg, excludeId) => this.broadcast(msg, excludeId);

    this.wss.on('connection', (ws) => {
      // 暂用临时 ID，Join 后再绑定正式 ID
      const tempId = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      ws._tempId = tempId;

      console.log(`  WebSocket 客户端连接`);

      ws.on('message', (raw) => {
        let msg;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          this._sendRaw(ws, { type: 'error', data: { msg: '无效的 JSON' } });
          return;
        }

        // Join 消息特殊处理：需要建立 ws ↔ playerId 映射
        if (msg.type === 'player-join') {
          const name  = (msg.data && msg.data.name)  || '无名';
          const color = (msg.data && msg.data.color) || null;
          const player = this.router.handlePlayerJoin(tempId, name, color);

          // 建立映射
          this.socketMap.set(ws, player.id);
          delete ws._tempId;

          // 处理 Join
          this.router.handle(player.id, msg);
          return;
        }

        // 非 Join 消息：找到对应的 playerId
        const playerId = this.socketMap.get(ws);
        if (!playerId) {
          this._sendRaw(ws, { type: 'error', data: { msg: '请先发送 player-join' } });
          return;
        }
        this.router.handle(playerId, msg);
      });

      ws.on('close', () => {
        const playerId = this.socketMap.get(ws);
        const tempId   = ws._tempId;
        const id       = playerId || tempId;
        if (id) {
          this.router.handleDisconnect(id);
          this.socketMap.delete(ws);
        }
      });

      ws.on('error', () => {
        // 静默处理
      });
    });

    console.log(`  WebSocket 服务已启动: ws://localhost:${port}`);
  }

  // ======================== 发送 ========================

  /** 向指定玩家发送消息 */
  send(playerId, msg) {
    for (const [ws, pid] of this.socketMap) {
      if (pid === playerId && ws.readyState === 1) {
        ws.send(JSON.stringify(msg));
        return;
      }
    }
  }

  /** 向所有玩家广播消息 */
  broadcast(msg, excludePlayerId) {
    const str = JSON.stringify(msg);
    for (const [ws, pid] of this.socketMap) {
      if (pid === excludePlayerId) continue;
      if (ws.readyState === 1) ws.send(str);
    }
  }

  /** 获取当前连接数 */
  get connectionCount() {
    return this.socketMap.size;
  }

  // ======================== 内部 ========================

  _sendRaw(ws, msg) {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  }
}

module.exports = WebSocketServer;
