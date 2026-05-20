// 共享常量 —— 服务端和客户端使用同一份
module.exports = {
  // 画面尺寸（内部像素分辨率）
  CANVAS_WIDTH: 640,
  CANVAS_HEIGHT: 480,

  // CSS 放大倍数（让像素清晰可见）
  SCALE: 2,

  // 每个瓦片的像素大小
  TILE_SIZE: 32,

  // 实体尺寸
  PLAYER_SIZE: 28,
  NPC_SIZE: 28,

  // 移动速度（像素/帧，30fps）
  PLAYER_SPEED: 1,
  NPC_SPEED: 1,

  // 地图（由 mapData.js 生成后覆盖）
  MAP_WIDTH: 40,
  MAP_HEIGHT: 30,

  // 服务端游戏循环
  TICK_RATE: 30,

  // 网络同步间隔（毫秒）
  SYNC_INTERVAL: 50,

  // Socket.IO 事件名
  EVENTS: {
    PLAYER_JOIN: 'player-join',
    PLAYER_LEAVE: 'player-leave',
    PLAYER_MOVE: 'player-move',
    GAME_STATE: 'game-state',
    ENTITIES_UPDATE: 'entities-update',
    CHAT_SEND: 'chat-send',
    CHAT_BROADCAST: 'chat-broadcast',
    NPC_DIALOGUE: 'npc-dialogue',
    INIT_DONE: 'init-done',
    PLAYER_UPDATE: 'player-update',
    PLAYER_UPDATED: 'player-updated',
  },
};
