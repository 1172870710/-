require('dotenv').config();
const express   = require('express');
const http      = require('http');
const path      = require('path');
const TileMap   = require('./world/TileMap');
const GameWorld = require('./world/GameWorld');
const WorldState = require('./world/WorldState');
const { bus, EVENTS }  = require('./core/EventBus');
const TimeManager      = require('./core/TimeManager');
const SaveManager      = require('./core/SaveManager');
const GameLoop         = require('./core/GameLoop');
const MessageRouter    = require('./network/MessageRouter');
const WebSocketServer  = require('./network/WebSocketServer');

const HTTP_PORT = parseInt(process.env.PORT)      || 3001;
const WS_PORT   = parseInt(process.env.WS_PORT)    || 3002;

// ======================== 游戏世界 ========================
const tileMap    = new TileMap();
const gameWorld  = new GameWorld(tileMap);
const worldState = new WorldState(gameWorld);

// ======================== 时间系统 ========================
const timeManager = new TimeManager(bus, {
  speed: parseFloat(process.env.TIME_SPEED) || 1,
});

// ======================== 存档系统 ========================
const saveManager = new SaveManager();
saveManager.init(gameWorld, timeManager);
saveManager.enableAutoSave(bus, EVENTS);

// ======================== WebSocket ========================
const router   = new MessageRouter(gameWorld);
const wsServer = new WebSocketServer(router, WS_PORT);

// ======================== 时间事件 ========================
// （未来 NPCScheduler / DramaEngine 会接管这些监听）

bus.on(EVENTS.TIME_HOUR_CHANGED, (data) => {
  router.broadcast('time-update', timeManager.toSnapshot());
});

bus.on(EVENTS.TIME_DAY_CHANGED, (data) => {
  console.log(`  📅 ${timeManager.dateString}`);
});

bus.on(EVENTS.TIME_SEASON_CHANGED, (data) => {
  const seasonCn = data.season === 'spring' ? '春' : data.season === 'summer' ? '夏' : data.season === 'fall' ? '秋' : '冬';
  console.log(`  🍂 进入${seasonCn}季`);
  router.broadcast('season-changed', { season: data.season, day: data.day, year: data.year });
});

bus.on(EVENTS.PLAYER_LEFT, (data) => {
  saveManager.savePlayer(data.playerId);
});

// ======================== 游戏循环 ========================
const gameLoop = new GameLoop({
  world: gameWorld, timeManager, router,
});
gameLoop.start();

// ======================== HTTP ========================
const app    = express();
const server = http.createServer(app);

app.use(express.static(path.join(__dirname, '..', 'client')));
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));
app.use('/lib/phaser', express.static(path.join(__dirname, '..', 'node_modules', 'phaser', 'dist')));

app.get('/debug', (req, res) => {
  res.json({
    players:     worldState.getPlayerSnapshots(),
    playerCount: worldState.getPlayerCount(),
    npcs:        worldState.getNPCSnapshots(),
    npcCount:    worldState.getNPCCount(),
    map:         { width: tileMap.width, height: tileMap.height, tileSize: tileMap.tileSize },
    connections: wsServer.connectionCount,
    time:        timeManager.toSnapshot(),
    llm:         worldState.getLLMStats(),
  });
});

// ======================== 启动 ========================
server.listen(HTTP_PORT, () => {
  console.log(`\n  像素沙盒 服务已启动`);
  console.log(`  HTTP:       http://localhost:${HTTP_PORT}`);
  console.log(`  WebSocket:  ws://localhost:${WS_PORT}`);
  console.log(`  调试页面:   http://localhost:${HTTP_PORT}/debug`);
  console.log(`  ${timeManager.dateString} ${timeManager.timeString}（${timeManager.speed}x 流速）`);
  console.log(`  已加载 ${gameWorld.npcs.size} 个 NPC\n`);
});
