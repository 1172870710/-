// 客户端网络模块 —— 封装 Socket.IO 连接
class Network {
  constructor() {
    // 远程玩家: Map<id, {x, y, dir, moving, name, color}>
    this.remotePlayers = new Map();
    this.localId = null;

    // NPC 数据
    this.npcs = [];             // NPC 快照列表

    // 回调用以解耦（由 main.js 设置）
    this.onChat = null;          // 收到聊天消息
    this.onPlayerJoined = null;  // 有新玩家加入
    this.onPlayerLeft = null;    // 有玩家离开
    this.onInit = null;          // 初始化完成
    this.onNPCDialogue = null;   // NPC 说话了
    this.onPlayerUpdated = null; // 玩家外观更新
    this.onNPCInteractResponse = null; // NPC 交互回复
    this.onAttackResult = null;   // 攻击结果
    this.onAttacked = null;      // 被攻击
    this.onDevUpdate = null;    // 开发者更新

    this._connect();
  }

  _connect() {
    this.socket = io(); // 使用默认 transports

    this.socket.on('connect', () => {
      console.log('已连接到服务器:', this.socket.id);
    });

    // 初始化完成 —— 获取完整世界状态
    this.socket.on('init-done', (data) => {
      this.localId = data.yourId;
      for (const p of data.world.players) {
        if (p.id !== this.localId) {
          this.remotePlayers.set(p.id, p);
        }
      }
      // 加载 NPC 列表
      this.npcs = data.world.npcs || [];
      console.log(`初始化完成，${data.world.players.length} 人在线，${this.npcs.length} 个 NPC`);
      if (this.onInit) this.onInit(data);
    });

    // 新玩家加入
    this.socket.on('player-joined', (player) => {
      this.remotePlayers.set(player.id, player);
      console.log(`玩家加入: ${player.name}`);
      if (this.onPlayerJoined) this.onPlayerJoined(player);
    });

    // 玩家离开
    this.socket.on('player-left', (data) => {
      this.remotePlayers.delete(data.id);
      console.log(`玩家离开: ${data.id}`);
      if (this.onPlayerLeft) this.onPlayerLeft(data);
    });

    // 实体状态更新
    this.socket.on('entities-update', (data) => {
      for (const snapshot of data.players) {
        if (snapshot.id === this.localId) {
          // 保存本地玩家 HP（供 GameScene 读取）
          this._localHp = snapshot.hp;
          this._localMaxHp = snapshot.maxHp;
          continue;
        }
        this.remotePlayers.set(snapshot.id, snapshot);
      }
      // 更新 NPC
      if (data.npcs) {
        this.npcs = data.npcs;
      }
    });

    // 聊天广播
    this.socket.on('chat-broadcast', (msg) => {
      if (this.onChat) this.onChat(msg);
    });

    // NPC 对话
    this.socket.on('npc-dialogue', (data) => {
      if (this.onNPCDialogue) this.onNPCDialogue(data);
    });

    // 玩家外观更新（颜色/名字变化）
    // NPC 交互回复
    this.socket.on('npc-interact-response', (data) => {
      if (this.onNPCInteractResponse) this.onNPCInteractResponse(data);
    });

    this.socket.on('player-updated', (data) => {
      // 更新本地记录
      if (data.id === this.localId) return; // 自己发起的不用处理
      const remote = this.remotePlayers.get(data.id);
      if (remote) {
        if (data.name) remote.name = data.name;
        if (data.color) remote.color = data.color;
      }
      if (this.onPlayerUpdated) this.onPlayerUpdated(data);
    });

    // 攻击结果
    this.socket.on('attack-result', (data) => {
      if (this.onAttackResult) this.onAttackResult(data);
    });

    // 被攻击
    this.socket.on('attacked', (data) => {
      if (this.onAttacked) this.onAttacked(data);
    });

    // 开发者模式更新
    this.socket.on('dev-update', (data) => {
      if (this.onDevUpdate) this.onDevUpdate(data);
    });
  }

  // 发送自己加入
  sendJoin(name, color) {
    this.socket.emit('player-join', { name, color });
  }

  // 发送位置更新
  sendMove(x, y, dir, moving) {
    this.socket.emit('player-move', { x, y, dir, moving });
  }

  // 发送聊天消息
  sendChat(text) {
    this.socket.emit('chat-send', { text });
  }

  // 发送外观更新（颜色/名字）
  sendUpdate(data) {
    this.socket.emit('player-update', data);
  }

  // 发送 NPC 交互
  sendNPCInteract(data) {
    this.socket.emit('npc-interact', data);
  }

  // 发送攻击
  sendAttack(dir) {
    this.socket.emit('player-attack', { dir });
  }

  // 发送开发者指令
  sendDevCommand(cmd, value) {
    this.socket.emit('dev-command', { cmd, value });
  }
}

export default Network;
