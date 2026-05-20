import Network from '../Network.js';
import UI from '../UI.js';
import MobileControls from '../MobileControls.js';
import UIManager from '../UIManager.js';
import NPCInteraction from '../NPCInteraction.js';
import { DECO_TYPES, generateDecoTextures, placeDecorations } from '../Decorations.js';

// ============================================================
// 地图数据（与 shared/mapData.js 同步）
// ============================================================
const MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,2,2,2,2,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,2,2,2,2,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

// ============================================================
// 常量
// ============================================================
const TILE_SIZE = 32;
const ENTITY_SIZE = 28;
const HP_BAR_W = 24;
const HP_BAR_H = 3;
let PLAYER_SPEED = 1; // 可被开发者模式修改
const WALKABLE = new Set([0, 3, 4]);

// 瓦片颜色
const TILE_COLORS = {
  0: '#4a8c3f', 1: '#6b6b6b', 2: '#2980b9',
  3: '#c4a56e', 4: '#8b7355',
};

// 玩家颜色（与服务器端 Player.randomColor 一致）
const PLAYER_COLORS = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#2c3e50'];

// ============================================================
// 碰撞检测
// ============================================================
function isWalkable(x, y) {
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  if (col < 0 || col >= MAP[0].length || row < 0 || row >= MAP.length) return false;
  return WALKABLE.has(MAP[row][col]);
}

function canMoveTo(x, y) {
  const R = ENTITY_SIZE / 2;
  const pts = [
    {x:x-R,y:y-R},{x:x+R,y:y-R},{x:x-R,y:y+R},{x:x+R,y:y+R},
    {x:x,y:y-R},{x:x,y:y+R},{x:x-R,y:y},{x:x+R,y:y},
  ];
  return pts.every(p => isWalkable(p.x, p.y));
}

// ============================================================
// GameScene
// ============================================================
export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  // ======================== CREATE ========================
  create() {
    // ---- 1. 生成地图纹理 ----
    this._generateMapTexture();

    // ---- 2. 生成实体纹理 ----
    this._generateEntityTextures();

    // ---- 2.5 生成装饰物纹理并摆放 ----
    generateDecoTextures(this);
    this.decorations = placeDecorations(MAP);
    this._createDecorations();

    // ---- 3. 添加地图精灵 ----
    const mapW = MAP[0].length * TILE_SIZE;
    const mapH = MAP.length * TILE_SIZE;
    this.add.image(mapW / 2, mapH / 2, 'map-texture');

    // ---- 4. 摄像机 ----
    this.cameras.main.setBounds(0, 0, mapW, mapH);

    // ---- 5. 网络 + UI ----
    this.network = new Network();
    this.ui = new UI();
    this.uiManager = new UIManager();
    this.npcInteraction = new NPCInteraction(this.network);

    // ---- 6. 本地玩家（从 localStorage 读取保存的设置） ----
    const saved = this.uiManager.init();
    this.localPlayer = {
      x: 5 * TILE_SIZE + TILE_SIZE / 2,
      y: 3 * TILE_SIZE + TILE_SIZE / 2,
      dir: 'down', moving: false,
      name: saved.name || ('玩家_' + Math.floor(Math.random() * 1000)),
      color: saved.color || '#e74c3c',
      hp: 100, maxHp: 100,
    };
    // 确保 UIManager 知道本地玩家的名字/颜色
    this.uiManager.setLocal(this.localPlayer.name, this.localPlayer.color);
    this._createPlayerSprite(this.localPlayer, true);

    // ---- 7. UIManager 回调 ----
    this.uiManager.onUpdateAppearance = (update) => {
      if (update.name) {
        this.localPlayer.name = update.name;
        if (this.localPlayer._nameTag) {
          this.localPlayer._nameTag.setText(update.name);
        }
      }
      if (update.color) {
        this.localPlayer.color = update.color;
        this._rebuildLocalSprite();
      }
      this.network.sendUpdate(update);
    };

    // 开发者模式命令
    this.uiManager.onDevCommand = (cmd, value) => {
      switch (cmd) {
        case 'set_speed':
          PLAYER_SPEED = value;
          this.network.sendDevCommand(cmd, value);
          break;
        case 'set_hp':
        case 'set_damage':
          this.network.sendDevCommand(cmd, value);
          break;
        case 'heal_all':
        case 'hp_all_npcs':
          this.network.sendDevCommand(cmd);
          break;
      }
    };

    // ---- 8. 远程玩家 / NPC 精灵容器 ----
    this.remoteSprites = new Map();
    this.npcSprites = new Map();

    // ---- 9. 聊天气泡 ----
    this.bubbles = [];

    // ---- 10. 键盘 ----
    this.keys = this.input.keyboard.addKeys({
      W: 'W', A: 'A', S: 'S', D: 'D', T: 'T', SPACE: 'SPACE',
      UP: 'UP', DOWN: 'DOWN', LEFT: 'LEFT', RIGHT: 'RIGHT',
      F: 'F',
    });

    // ---- 开发者模式标记 ----
    this.devMode = false;

    // ---- 攻击视觉容器 ----
    this.attackFlashes = [];
    this.hitTexts = [];

    // ---- 11. NPC 点击检测 ----
    this.input.on('pointerdown', (pointer) => {
      this._handleNPCClick(pointer.worldX, pointer.worldY);
    });

    // ---- 12. 触控 ----
    this.mobileControls = new MobileControls();

    // ---- 12. 同步定时器 ----
    this.lastSync = 0;
    this.syncInterval = 50;

    // ---- 13. 网络回调 ----
    this._setupNetwork();

    // ---- 14. 聊天 ----
    this.ui.onSend(text => this.network.sendChat(text));

    // ---- 15. 加入世界（带上保存的颜色） ----
    this.network.sendJoin(this.localPlayer.name, this.localPlayer.color);
  }

  // ======================== UPDATE ========================
  update(time) {
    // ---- 1. 本地玩家移动 ----
    this._handleInput();

    // ---- 2. 同步位置到服务器 ----
    if (time - this.lastSync > this.syncInterval) {
      this.network.sendMove(
        this.localPlayer.x, this.localPlayer.y,
        this.localPlayer.dir, this.localPlayer.moving
      );
      this.lastSync = time;
    }

    // ---- 3. 攻击（Space） ----
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      if (document.activeElement?.tagName !== 'INPUT' && !this._isPanelOpen()) {
        this._handleAttack();
      }
    }

    // ---- 4. 按 F 进入森林场景 ----
    if (Phaser.Input.Keyboard.JustDown(this.keys.F)) {
      if (document.activeElement?.tagName !== 'INPUT') {
        this.scene.start('ForestScene');
        return;
      }
    }

    // ---- 4. 按 T 聊天 ----
    if (Phaser.Input.Keyboard.JustDown(this.keys.T)) {
      const input = document.getElementById('chat-input');
      if (document.activeElement !== input) input.focus();
    }

    // ---- 5. 同步远程玩家 ----
    this._syncRemotePlayers();

    // ---- 6. 同步 NPC ----
    this._syncNPCs();

    // ---- 7. 更新名字标签 ----
    this._updateNameTags();

    // ---- 8. 同步本地玩家 HP（从网络数据） ----
    if (this.network._localHp !== undefined) {
      this.localPlayer.hp = this.network._localHp;
      this.localPlayer.maxHp = this.network._localMaxHp || 100;
    }

    // ---- 9. 更新血条 ----
    this._updateHPBars();

    // ---- 10. 清理气泡 ----
    this._updateBubbles();

    // ---- 10. 更新攻击视觉 ----
    this._updateAttackEffects();

    // ---- 11. 定时刷新 UI 数据（每 2 秒） ----
    if (time % 2000 < this.syncInterval) {
      this._refreshUI();
    }

    // ---- 12. 深度排序（让角色走树后面） ----
    this._sortDepths();
  }

  // ======================== 地图纹理生成 ========================
  _generateMapTexture() {
    const cols = MAP[0].length;
    const rows = MAP.length;
    const canvas = this.textures.createCanvas('map-texture', cols * TILE_SIZE, rows * TILE_SIZE);
    const ctx = canvas.getContext();

    // 用可重复的伪随机使种子一样的格子在每次渲染中图案一致
    let seed = 42;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tile = MAP[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        // ---------- 草地（type 0） ----------
        if (tile === 0) {
          // 基础色 + 小变化
          seed = (seed * 9301 + 49297) % 233280;
          const variation = (seed % 20) - 10; // -10 ~ +10
          const r2 = 74 + Math.floor(variation * 0.4);
          const g2 = 140 + Math.floor(variation * 0.6);
          const b2 = 63 + Math.floor(variation * 0.2);
          ctx.fillStyle = `rgb(${r2},${g2},${b2})`;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

          // 随机小草丛
          seed = (seed * 9301 + 49297) % 233280;
          if (seed % 5 < 2) {
            const grassShade = seed % 2 === 0 ? '#4a9a3a' : '#3a8a2a';
            ctx.fillStyle = grassShade;
            const gx = x + 4 + (seed % 20);
            const gy = y + 6 + ((seed >> 4) % 18);
            ctx.fillRect(gx, gy, 2, 4);
            ctx.fillRect(gx + 3, gy + 1, 2, 3);
          }
          continue;
        }

        // ---------- 墙壁（type 1） ----------
        if (tile === 1) {
          // 砖墙效果
          ctx.fillStyle = '#6b6b6b';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

          // 砖缝
          ctx.fillStyle = '#5a5a5a';
          ctx.fillRect(x, y, TILE_SIZE, 1);
          ctx.fillRect(x, y, 1, TILE_SIZE);

          // 半砖偏移
          ctx.fillStyle = '#5a5a5a';
          ctx.fillRect(x, y + 15, TILE_SIZE, 1);
          ctx.fillRect(x + 15, y, 1, TILE_SIZE);

          // 砖块高光
          ctx.fillStyle = '#8a8a8a';
          ctx.fillRect(x + 1, y + 1, 14, 14);
          ctx.fillRect(x + 16, y + 16, 14, 14);
          ctx.fillRect(x + 8, y + 16, 14, 14);
          ctx.fillRect(x + 1, y + 16, 6, 14);

          // 砖块阴影
          ctx.fillStyle = '#5a5a5a';
          ctx.fillRect(x + 15, y + 1, 1, 14);
          ctx.fillRect(x + 1, y + 15, 15, 1);

          // 用少量随机让砖墙有质感
          seed = (seed * 9301 + 49297) % 233280;
          if (seed % 3 === 0) {
            ctx.fillStyle = '#7a7a7a';
            ctx.fillRect(x + 3 + (seed % 12), y + 3 + ((seed >> 4) % 12), 2, 2);
          }

          // ===== 建筑窗户和门（只在某些墙壁上加） =====
          // 确定这是否是一个"立面墙"（朝向开放空间的）
          const isTopEdge = r > 0 && MAP[r-1][c] === 0;
          const isBottomEdge = r < rows-1 && MAP[r+1][c] === 0;
          const isLeftEdge = c > 0 && MAP[r][c-1] === 0;
          const isRightEdge = c < cols-1 && MAP[r][c+1] === 0;

          if (isTopEdge || isBottomEdge) {
            // 水平外墙 → 加窗户
            const winColor = '#4a6a8a';
            ctx.fillStyle = winColor;
            // 两个窗户
            ctx.fillRect(x + 4, y + 6, 10, 14);
            ctx.fillRect(x + 18, y + 6, 10, 14);
            // 窗框
            ctx.fillStyle = '#3a4a5a';
            ctx.fillRect(x + 4, y + 13, 10, 2);
            ctx.fillRect(x + 9, y + 6, 2, 14);
            ctx.fillRect(x + 18, y + 13, 10, 2);
            ctx.fillRect(x + 23, y + 6, 2, 14);
            // 窗光
            ctx.fillStyle = 'rgba(200,220,255,0.15)';
            ctx.fillRect(x + 5, y + 7, 3, 5);
            ctx.fillRect(x + 19, y + 7, 3, 5);

          } else if (isLeftEdge || isRightEdge) {
            // 垂直外墙 → 简单装饰
            ctx.fillStyle = '#7a7a7a';
            ctx.fillRect(x + 12, y + 4, 8, 24);
            ctx.fillStyle = '#6a6a6a';
            ctx.fillRect(x + 13, y + 5, 6, 22);
          }

          // 大门（特定位置的墙壁留出门洞）
          if ((r === 4 && c >= 4 && c <= 6) || (r === 16 && c >= 15 && c <= 16)) {
            if ((isLeftEdge || isRightEdge) && c === 5) {
              // 门口
              ctx.fillStyle = '#3a2a1a';
              ctx.fillRect(x + 8, y + 4, 16, 24);
              // 门把
              ctx.fillStyle = '#ffd700';
              ctx.fillRect(x + 20, y + 16, 3, 3);
            }
          }
          continue;
        }

        // ---------- 水（type 2） ----------
        if (tile === 2) {
          // 深蓝底色
          ctx.fillStyle = '#2980b9';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

          // 深浅交错波纹
          seed = (seed * 9301 + 49297) % 233280;
          for (let wy = 0; wy < TILE_SIZE; wy += 4) {
            const wave = Math.floor(Math.sin(c * 0.8 + r + wy * 0.3) * 2 + 2);
            ctx.fillStyle = wave > 2 ? '#3498db' : '#1a6a9a';
            ctx.fillRect(x, y + wy, TILE_SIZE, 2);
          }

          // 白色波光
          seed = (seed * 9301 + 49297) % 233280;
          if (seed % 4 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.fillRect(x + (seed % 20), y + ((seed >> 4) % 24), 3, 2);
          }

          // 岸边过渡（与草地交界处）
          if (r > 0 && MAP[r-1][c] === 0) {
            ctx.fillStyle = '#3a6a3a';
            ctx.fillRect(x, y, TILE_SIZE, 3);
          }
          if (r < rows-1 && MAP[r+1][c] === 0) {
            ctx.fillStyle = '#3a6a3a';
            ctx.fillRect(x, y + TILE_SIZE - 3, TILE_SIZE, 3);
          }
          if (c > 0 && MAP[r][c-1] === 0) {
            ctx.fillStyle = '#3a6a3a';
            ctx.fillRect(x, y, 3, TILE_SIZE);
          }
          if (c < cols-1 && MAP[r][c+1] === 0) {
            ctx.fillStyle = '#3a6a3a';
            ctx.fillRect(x + TILE_SIZE - 3, y, 3, TILE_SIZE);
          }
          continue;
        }

        // ---------- 道路（type 3） ----------
        if (tile === 3) {
          // 土路
          ctx.fillStyle = '#c4a56e';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          // 碎石
          seed = (seed * 9301 + 49297) % 233280;
          for (let i = 0; i < 3; i++) {
            seed = (seed * 9301 + 49297) % 233280;
            const sx = x + 3 + (seed % 26);
            const sy = y + 3 + ((seed >> 4) % 26);
            ctx.fillStyle = seed % 2 ? '#b4945e' : '#d4b57e';
            ctx.fillRect(sx, sy, 2, 2);
          }
          continue;
        }

        // ---------- 房屋地板（type 4） ----------
        if (tile === 4) {
          ctx.fillStyle = '#8b7355';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          // 木板条纹
          ctx.fillStyle = '#a0886a';
          ctx.fillRect(x, y, TILE_SIZE, 2);
          ctx.fillRect(x, y + 8, TILE_SIZE, 2);
          ctx.fillRect(x, y + 16, TILE_SIZE, 2);
          ctx.fillRect(x, y + 24, TILE_SIZE, 2);
          // 木板接缝
          seed = (seed * 9301 + 49297) % 233280;
          ctx.fillStyle = '#7a6345';
          ctx.fillRect(x + (seed % 28), y + 3, 2, 5);
          ctx.fillRect(x + ((seed >> 4) % 28), y + 11, 2, 5);
          ctx.fillRect(x + ((seed >> 8) % 28), y + 19, 2, 5);
          continue;
        }

        // 兜底
        ctx.fillStyle = TILE_COLORS[tile] || '#000';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    }
    canvas.refresh();
  }

  // ======================== 实体纹理生成 ========================
  _generateEntityTextures() {
    // 为每种颜色生成一个纹理
    for (const color of PLAYER_COLORS) {
      const key = `entity_${color}`;
      const canvas = this.textures.createCanvas(key, ENTITY_SIZE, ENTITY_SIZE);
      const ctx = canvas.getContext();

      // 身体
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, ENTITY_SIZE, ENTITY_SIZE);

      // 白色眼睛朝下（默认方向）
      ctx.fillStyle = '#fff';
      ctx.fillRect(6, 8, 6, 6);
      ctx.fillRect(16, 8, 6, 6);

      // 瞳孔
      ctx.fillStyle = '#000';
      ctx.fillRect(8, 10, 2, 2);
      ctx.fillRect(18, 10, 2, 2);

      canvas.refresh();
    }
  }

  // ======================== 创建装饰物精灵 ========================
  _createDecorations() {
    this.decoSprites = [];
    for (const deco of this.decorations) {
      const cfg = DECO_TYPES[deco.type];
      if (!cfg) continue;
      const sprite = this.add.image(deco.x, deco.y, `deco_${deco.type}`);
      if (!cfg.tall) {
        sprite.setDepth(1); // 地面装饰，在 map(0) 之上，实体之下
      }
      deco._sprite = sprite;
    }
  }

  // ======================== 深度排序（让角色走树后面） ========================
  _sortDepths() {
    // 动态实体按 y 坐标排序：越靠下的角色显示在越前面
    const baseDepth = 10; // 地面之上
    if (this.localPlayer._sprite) {
      this.localPlayer._sprite.setDepth(baseDepth + this.localPlayer.y);
    }
    for (const entry of this.remoteSprites.values()) {
      if (entry.sprite) {
        entry.sprite.setDepth(baseDepth + entry.sprite.y);
      }
    }
    for (const entry of this.npcSprites.values()) {
      if (entry.sprite) {
        entry.sprite.setDepth(baseDepth + entry.sprite.y);
      }
    }
    // 高大装饰（树、路灯等）与实体一起按 y 排序
    for (const deco of this.decorations || []) {
      const cfg = DECO_TYPES[deco.type];
      if (cfg && cfg.tall && deco._sprite) {
        deco._sprite.setDepth(baseDepth + deco.y);
      }
    }
    // 名字标签永远在最上层
    if (this.localPlayer._nameTag) {
      this.localPlayer._nameTag.setDepth(9999);
    }
    for (const entry of this.remoteSprites.values()) {
      if (entry.nameTag) entry.nameTag.setDepth(9999);
    }
    for (const entry of this.npcSprites.values()) {
      if (entry.nameTag) entry.nameTag.setDepth(9999);
    }
  }

  // ======================== 重建本地精灵（更换颜色后） ========================
  _rebuildLocalSprite() {
    const color = this.localPlayer.color;
    const eSize = ENTITY_SIZE;
    const texKey = `entity_${color}`;
    if (!this.textures.exists(texKey)) {
      const canvas = this.textures.createCanvas(texKey, eSize, eSize);
      const ctx = canvas.getContext();
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, eSize, eSize);
      ctx.fillStyle = '#fff';
      ctx.fillRect(6, 8, 6, 6);
      ctx.fillRect(16, 8, 6, 6);
      ctx.fillStyle = '#000';
      ctx.fillRect(8, 10, 2, 2);
      ctx.fillRect(18, 10, 2, 2);
      canvas.refresh();
    }
    if (this.localPlayer._sprite) {
      this.localPlayer._sprite.setTexture(texKey);
    }
  }

  // ======================== NPC 点击检测 ========================
  _handleNPCClick(worldX, worldY) {
    // 如果 NPC 交互面板已打开，不重复检测
    if (this.npcInteraction.currentNPC) return;

    // 检查是否点击到任何 NPC
    const clickDist = ENTITY_SIZE; // 点击容差
    for (const npc of this.network.npcs || []) {
      const dx = worldX - npc.x;
      const dy = worldY - npc.y;
      if (Math.abs(dx) < clickDist && Math.abs(dy) < clickDist) {
        // 检查与本地玩家的距离
        const pdx = this.localPlayer.x - npc.x;
        const pdy = this.localPlayer.y - npc.y;
        const dist = Math.sqrt(pdx * pdx + pdy * pdy);

        if (dist > 100) {
          this.ui.addMessage('系统', `${npc.name} 太远了，走近点`);
          return;
        }

        this.npcInteraction.open(npc);
        return;
      }
    }
  }

  // ======================== 刷新 UI 数据 ========================
  _refreshUI() {
    this.uiManager.refresh(
      this.network.remotePlayers,
      this.network.npcs,
      this.network.localId
    );
  }

  // ======================== 重建远程精灵纹理 ========================
  _rebuildRemoteSprite(entry, color) {
    const eSize = ENTITY_SIZE;
    const texKey = `entity_${color}`;
    if (!this.textures.exists(texKey)) {
      const canvas = this.textures.createCanvas(texKey, eSize, eSize);
      const ctx = canvas.getContext();
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, eSize, eSize);
      ctx.fillStyle = '#fff';
      ctx.fillRect(6, 8, 6, 6);
      ctx.fillRect(16, 8, 6, 6);
      ctx.fillStyle = '#000';
      ctx.fillRect(8, 10, 2, 2);
      ctx.fillRect(18, 10, 2, 2);
      canvas.refresh();
    }
  }

  // ======================== 创建精灵 ========================
  _createPlayerSprite(entity, isLocal = false) {
    const eSize = ENTITY_SIZE;
    const color = entity.color || '#e74c3c';
    const texKey = `entity_${color}`;

    // 检查纹理是否存在，如果没有则动态创建
    if (!this.textures.exists(texKey)) {
      const canvas = this.textures.createCanvas(texKey, eSize, eSize);
      const ctx = canvas.getContext();
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, eSize, eSize);
      ctx.fillStyle = '#fff';
      ctx.fillRect(6, 8, 6, 6);
      ctx.fillRect(16, 8, 6, 6);
      ctx.fillStyle = '#000';
      ctx.fillRect(8, 10, 2, 2);
      ctx.fillRect(18, 10, 2, 2);
      canvas.refresh();
    }

    const sprite = this.add.image(entity.x, entity.y, texKey);
    if (isLocal) {
      this.cameras.main.startFollow(sprite, true, 0.1, 0.1);
    }

    // 名字标签（Phaser Text，始终面向摄像机）
    const nameTag = this.add.text(entity.x, entity.y - 18, entity.name, {
      fontFamily: 'monospace', fontSize: '11px', color: '#ff0',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 0.5);

    // 血条
    const hpBar = this.add.graphics();
    hpBar.setDepth(9998);

    // 存储引用
    entity._sprite = sprite;
    entity._nameTag = nameTag;
    entity._hpBar = hpBar;

    return sprite;
  }

  // ======================== 输入处理 ========================
  _handleInput() {
    let dx = 0, dy = 0;

    // 键盘
    if (this.keys.W.isDown || this.keys.UP.isDown)   dy -= 1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) dy += 1;
    if (this.keys.A.isDown || this.keys.LEFT.isDown) dx -= 1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) dx += 1;

    // 触控（键盘无输入时生效）
    if (dx === 0 && dy === 0 && this.mobileControls) {
      dx = this.mobileControls.dx;
      dy = this.mobileControls.dy;
    }

    this.localPlayer.moving = dx !== 0 || dy !== 0;

    if (this.localPlayer.moving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = dx / len;
      const ny = dy / len;

      let newX = this.localPlayer.x + nx * PLAYER_SPEED;
      let newY = this.localPlayer.y + ny * PLAYER_SPEED;

      if (canMoveTo(newX, this.localPlayer.y)) this.localPlayer.x = newX;
      if (canMoveTo(this.localPlayer.x, newY)) this.localPlayer.y = newY;

      // 朝向
      if (Math.abs(nx) > Math.abs(ny)) {
        this.localPlayer.dir = nx > 0 ? 'right' : 'left';
      } else {
        this.localPlayer.dir = ny > 0 ? 'down' : 'up';
      }
    }

    // 更新精灵位置
    if (this.localPlayer._sprite) {
      this.localPlayer._sprite.setPosition(this.localPlayer.x, this.localPlayer.y);
    }
  }

  // ======================== 网络回调 ========================
  _setupNetwork() {
    this.network.onInit = (data) => {
      const me = data.world.players.find(p => p.id === this.network.localId);
      if (me) {
        this.localPlayer.x = me.x;
        this.localPlayer.y = me.y;
        if (!this.localPlayer.color || this.localPlayer.color === '#e74c3c') {
          this.localPlayer.color = me.color;
        }
        this.localPlayer.name = me.name;
        this.localPlayer.hp = me.hp || 100;
        this.localPlayer.maxHp = me.maxHp || 100;

        // 重新创建精灵（更新颜色）
        if (this.localPlayer._sprite) {
          this.localPlayer._sprite.destroy();
          this.localPlayer._nameTag.destroy();
        }
        this._createPlayerSprite(this.localPlayer, true);
      }

      // 同步 UIManager 的本地玩家信息
      this.uiManager.setLocal(this.localPlayer.name, this.localPlayer.color);

      // 初次加载 NPC
      this._syncNPCs();
      this._syncRemotePlayers();

      // 刷新 UIManager 数据
      this._refreshUI();
    };

    this.network.onPlayerUpdated = (data) => {
      // 更新远程玩家精灵颜色（如果有变化）
      const entry = this.remoteSprites.get(data.id);
      if (entry && data.color) {
        this._rebuildRemoteSprite(entry, data.color);
        // 重启精灵的纹理
        entry.sprite.setTexture(`entity_${data.color}`);
      }
      if (entry && data.name) {
        entry.nameTag.setText(data.name);
      }
    };

    this.network.onChat = (msg) => {
      this.ui.addMessage(msg.fromName, msg.text);
    };

    this.network.onNPCDialogue = (data) => {
      this.ui.addMessage(`[${data.npcName}]`, data.text);
      this._addBubble(data.text, data.npcX, data.npcY);
    };

    // 攻击结果
    this.network.onAttackResult = (result) => {
      if (result.hit) {
        this._showHitEffect(result.x, result.y, result.msg || '');
        if (result.died) {
          this._showHitEffect(result.x, result.y - 20, result.msg || '');
        }
        if (result.myHp !== undefined) {
          this.localPlayer.hp = result.myHp;
          this.localPlayer.maxHp = result.myMaxHp || 100;
        }
      }
    };

    // 被攻击
    this.network.onAttacked = (data) => {
      if (data.damage) {
        this._showHitEffect(
          this.localPlayer.x, this.localPlayer.y,
          `-${data.damage}`
        );
      }
      if (data.myHp !== undefined) {
        this.localPlayer.hp = data.myHp;
        this.localPlayer.maxHp = data.myMaxHp || 100;
      }
    };

    // 开发者更新
    this.network.onDevUpdate = (data) => {
      if (data.hp !== undefined) this.localPlayer.hp = data.hp;
      if (data.customSpeed !== undefined) PLAYER_SPEED = data.customSpeed;
      if (data.msg) this.ui.addMessage('开发', data.msg);
    };

    this.network.onPlayerJoined = () => {};
    this.network.onPlayerLeft = () => {
      // 清理已断线玩家的精灵
      for (const [id] of this.remoteSprites) {
        if (!this.network.remotePlayers.has(id)) {
          if (this.remoteSprites.get(id)) {
            this.remoteSprites.get(id).sprite.destroy();
            this.remoteSprites.get(id).nameTag.destroy();
            if (this.remoteSprites.get(id).hpBar) this.remoteSprites.get(id).hpBar.destroy();
          }
          this.remoteSprites.delete(id);
        }
      }
    };
  }

  // ======================== 远程玩家同步 ========================
  _syncRemotePlayers() {
    for (const [id, data] of this.network.remotePlayers) {
      let entry = this.remoteSprites.get(id);
      if (!entry) {
        // 创建新精灵
        const sprite = this._createPlayerSprite(data, false);
        entry = { sprite: data._sprite, nameTag: data._nameTag, hpBar: data._hpBar };
        // 清除 data 上的引用（我们存在 remoteSprites 里）
        delete data._sprite;
        delete data._nameTag;
        delete data._hpBar;
        this.remoteSprites.set(id, entry);
      }
      // 更新位置
      entry.sprite.setPosition(data.x, data.y);
      entry.nameTag.setPosition(data.x, data.y - 18);
    }
  }

  // ======================== NPC 同步 ========================
  _syncNPCs() {
    const npcs = this.network.npcs || [];

    // 先删除不存在的 NPC 精灵
    for (const [id] of this.npcSprites) {
      if (!npcs.find(n => n.id === id)) {
        this.npcSprites.get(id).sprite.destroy();
        this.npcSprites.get(id).nameTag.destroy();
        if (this.npcSprites.get(id).hpBar) this.npcSprites.get(id).hpBar.destroy();
        this.npcSprites.delete(id);
      }
    }

    for (const npcData of npcs) {
      let entry = this.npcSprites.get(npcData.id);
      if (!entry) {
        const sprite = this._createPlayerSprite(npcData, false);
        entry = { sprite: npcData._sprite, nameTag: npcData._nameTag, hpBar: npcData._hpBar };
        delete npcData._sprite;
        delete npcData._nameTag;
        delete npcData._hpBar;
        this.npcSprites.set(npcData.id, entry);
      }
      // 更新位置
      entry.sprite.setPosition(npcData.x, npcData.y);
      entry.nameTag.setPosition(npcData.x, npcData.y - 18);
    }
  }

  // ======================== 名字标签 ========================
  _updateNameTags() {
    // 本地玩家标签
    if (this.localPlayer._nameTag) {
      this.localPlayer._nameTag.setPosition(
        this.localPlayer.x - this.localPlayer.name.length * 3,
        this.localPlayer.y - 22
      );
    }
  }

  // ======================== 聊天气泡 ========================
  _addBubble(text, x, y) {
    const textObj = this.add.text(x, y - 30, text, {
      fontFamily: 'monospace', fontSize: '10px', color: '#fff',
      stroke: '#222', strokeThickness: 2,
    }).setOrigin(0.5, 0.5);

    this.bubbles.push({
      text, x, y, born: Date.now(), textObj,
    });
  }

  _updateBubbles() {
    const now = Date.now();
    this.bubbles = this.bubbles.filter(b => {
      const age = now - b.born;
      if (age > 4000) {
        b.textObj.destroy();
        return false;
      }
      // 淡出效果
      if (age > 3000) {
        b.textObj.setAlpha((4000 - age) / 1000);
      }
      // 缓慢上飘
      b.textObj.setPosition(b.x, b.y - 30 - (age / 1000) * 8);
      return true;
    });
  }

  // ======================== 攻击 ========================
  // 检查是否有面板打开
  _isPanelOpen() {
    return document.querySelector('.ui-overlay.show') !== null;
  }

  _handleAttack() {
    if (this.localPlayer.hp <= 0) return; // 死亡不能攻击
    this.network.sendAttack(this.localPlayer.dir);

    // 本地攻击动画：闪一下白色
    if (this.localPlayer._sprite) {
      const flash = this.add.rectangle(
        this.localPlayer.x, this.localPlayer.y,
        ENTITY_SIZE + 4, ENTITY_SIZE + 4,
        0xffffff, 0.4
      ).setDepth(this.localPlayer._sprite.depth + 1);
      this.attackFlashes.push({ obj: flash, born: Date.now(), duration: 120 });
    }
  }

  // ======================== 血条更新 ========================
  _updateHPBars() {
    // 本地玩家
    this._drawHPBar(
      this.localPlayer._hpBar,
      this.localPlayer.x,
      this.localPlayer.y - 26,
      this.localPlayer.hp !== undefined ? this.localPlayer.hp : 100,
      this.localPlayer.maxHp || 100
    );

    // 远程玩家
    for (const [id, entry] of this.remoteSprites) {
      const p = this.network.remotePlayers.get(id);
      if (!p || !entry.hpBar) continue;
      this._drawHPBar(entry.hpBar, p.x, p.y - 26, p.hp || 100, p.maxHp || 100);
    }

    // NPC
    for (const [id, entry] of this.npcSprites) {
      const npc = this.network.npcs.find(n => n.id === id);
      if (!npc || !entry.hpBar) continue;
      this._drawHPBar(entry.hpBar, npc.x, npc.y - 26, npc.hp || 50, npc.maxHp || 50);
    }
  }

  _drawHPBar(graphics, x, y, hp, maxHp) {
    if (!graphics) return;
    graphics.clear();

    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    const barX = x - HP_BAR_W / 2;
    const barY = y;

    // 背景
    graphics.fillStyle(0x222222, 0.8);
    graphics.fillRect(barX - 1, barY - 1, HP_BAR_W + 2, HP_BAR_H + 2);

    // 血条颜色
    let color = 0x44cc44; // 绿
    if (ratio < 0.6) color = 0xcccc44; // 黄
    if (ratio < 0.3) color = 0xcc4444; // 红

    const fillW = Math.max(0, Math.floor(HP_BAR_W * ratio));
    graphics.fillStyle(color, 1);
    graphics.fillRect(barX, barY, fillW, HP_BAR_H);

    // 边框
    graphics.lineStyle(1, 0x000000, 0.6);
    graphics.strokeRect(barX - 1, barY - 1, HP_BAR_W + 2, HP_BAR_H + 2);
  }

  // ======================== 攻击视觉特效 ========================
  _showHitEffect(x, y, text) {
    if (!text) return;
    const txt = this.add.text(x, y - 20, text, {
      fontFamily: 'monospace', fontSize: '10px', color: '#ff4444',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 0.5).setDepth(10000);

    this.hitTexts.push({
      obj: txt,
      born: Date.now(),
      duration: 800,
      startY: y - 20,
    });
  }

  _updateAttackEffects() {
    const now = Date.now();

    // 更新闪白
    this.attackFlashes = this.attackFlashes.filter(f => {
      const age = now - f.born;
      if (age > f.duration) { f.obj.destroy(); return false; }
      f.obj.setAlpha(0.4 * (1 - age / f.duration));
      return true;
    });

    // 更新伤害数字
    this.hitTexts = this.hitTexts.filter(h => {
      const age = now - h.born;
      if (age > h.duration) { h.obj.destroy(); return false; }
      const pct = age / h.duration;
      h.obj.setPosition(h.obj.x, h.startY - pct * 16);
      h.obj.setAlpha(1 - pct);
      return true;
    });
  }
}

export { MAP, TILE_SIZE, TILE_COLORS, WALKABLE, PLAYER_COLORS };
