require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const TileMap = require('./game/TileMap');
const GameWorld = require('./game/GameWorld');
const SocketHandler = require('./network/SocketHandler');
const WebSocketHandler = require('./network/WebSocketHandler');

const PORT = process.env.PORT || 3000;
const WS_PORT = parseInt(process.env.WS_PORT) || 3002;
const NPC_COUNT = parseInt(process.env.NPC_COUNT) || 8;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  /* 保持默认 transports，允许 polling 降级 */
});

// 静态文件
app.use(express.static(path.join(__dirname, '..', 'client')));
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));
app.use('/lib/phaser', express.static(path.join(__dirname, '..', 'node_modules', 'phaser', 'dist')));

// 游戏世界初始化
const tileMap = new TileMap();
const gameWorld = new GameWorld(tileMap, NPC_COUNT);
const socketHandler = new SocketHandler(io, gameWorld);
const wsHandler = new WebSocketHandler(gameWorld, WS_PORT);

// 调试接口
app.get('/debug', (req, res) => {
  res.json({
    players: gameWorld.getPlayerSnapshots(),
    playerCount: gameWorld.players.size,
    npcs: gameWorld.getNPCSnapshots(),
    npcCount: gameWorld.npcs.size,
    map: {
      width: tileMap.width,
      height: tileMap.height,
      tileSize: tileMap.tileSize,
    },
    llm: gameWorld.getLLMStats(),
  });
});

// 游戏循环
const GAME_TICK = 1000 / 30; // 30 tick/秒
setInterval(() => {
  // 1. NPC 反应层更新
  gameWorld.tickNPCs();

  // 2. 广播世界状态（玩家 + NPC）
  socketHandler.broadcastState();
  wsHandler.broadcastState();

  // 3. 收集并广播 NPC 对话
  const dialogues = gameWorld.collectNPCDialogues();
  for (const d of dialogues) {
    socketHandler.broadcastNPCDialogue(d);
    wsHandler.broadcastNPCDialogue(d);
  }
}, GAME_TICK);

// NPC 深思循环（独立，不阻塞游戏 Tick）
setInterval(() => {
  gameWorld.tickNPCThink();
}, 3000); // 每 3 秒检查一次是否有 NPC 可以深思

server.listen(PORT, () => {
  console.log(`游戏服务已启动: http://localhost:${PORT}`);
  const ips = getLocalIPs();
  ips.forEach(ip => console.log(`  局域网: http://${ip}:${PORT}`));
  console.log(`  调试页面: http://localhost:${PORT}/debug`);
});

// 获取所有局域网 IP
function getLocalIPs() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  const addrs = [];
  for (const [name, ifs] of Object.entries(nets)) {
    for (const net of ifs) {
      if (net.family === 'IPv4' && !net.internal) {
        if (/radmin|vpn|virtual|vmware|hyper-v|loopback|bluetooth/i.test(name)) continue;
        addrs.push({ name, addr: net.address });
      }
    }
  }
  addrs.sort((a, b) => {
    const aWifi = /wlan|wi-?fi|无线/i.test(a.name);
    const bWifi = /wlan|wi-?fi|无线/i.test(b.name);
    if (aWifi && !bWifi) return -1;
    if (!aWifi && bWifi) return 1;
    return 0;
  });
  return addrs.map(a => a.addr);
}
