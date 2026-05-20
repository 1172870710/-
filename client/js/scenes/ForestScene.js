// ============================================================
// ForestScene —— 绿色森林场景
// 60% 森林 + 40% 草原 + 一小片湖泊
// ============================================================

const TILE_SIZE = 32;
const ENTITY_SIZE = 28;
let PLAYER_SPEED = 1.2;

// ============================================================
// 地图（40x30）
// 0=草原 1=森林 2=湖水 3=花甸 4=小径
// ============================================================
const MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,1,1,1,1,1,1],
  [1,1,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1],
  [1,1,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,1,1,1,1,1],
  [1,0,0,0,0,0,0,3,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,3,3,3,3,3,0,0,0,0,0,1,1,1,1],
  [1,1,0,0,0,0,3,3,3,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,3,3,3,3,3,3,3,3,0,0,0,0,0,1,1,1],
  [1,1,0,0,0,3,3,3,3,3,0,0,0,0,0,1,0,0,0,0,0,0,0,3,3,3,3,3,3,3,3,3,0,0,0,0,0,1,1,1],
  [1,1,1,0,0,0,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,3,3,3,3,0,0,0,0,0,0,0,1,1],
  [1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,3,0,0,0,0,0,0,0,0,1,1],
  [1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,4,4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
  [1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,4,4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1],
  [1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,4,4,4,4,4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1],
  [1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,4,4,4,2,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1],
  [1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,4,2,2,2,2,2,2,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1],
  [1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,4,2,2,2,2,2,2,2,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,2,2,2,2,2,2,2,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,2,2,2,2,2,2,2,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,4,2,2,2,2,2,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,4,4,2,2,2,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

// ============================================================
// 可通行瓦片
// ============================================================
const WALKABLE = new Set([0, 1, 3, 4]);

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
// 森林装饰物配置
// ============================================================
const FOREST_DECO_TYPES = {
  oak:       { w: 56, h: 64, tall: true  },
  pine:      { w: 44, h: 56, tall: true  },
  willow:    { w: 60, h: 68, tall: true  },
  mushroom:  { w: 16, h: 18, tall: false },
  mushroom_b:{ w: 20, h: 22, tall: false },
  fern:      { w: 20, h: 18, tall: false },
  flowers:   { w: 16, h: 14, tall: false },
  bush:      { w: 32, h: 24, tall: false },
  rock:      { w: 22, h: 16, tall: false },
  log:       { w: 28, h: 16, tall: false },
  stump:     { w: 20, h: 16, tall: false },
  lilypad:   { w: 18, h: 14, tall: false },
  firefly:   { w: 8,  h: 8,  tall: false },
  bamboo:    { w: 20, h: 48, tall: true  },
};

function generateForestTextures(scene) {
  for (const [type, cfg] of Object.entries(FOREST_DECO_TYPES)) {
    if (scene.textures.exists(`fdeco_${type}`)) continue;
    const canvas = scene.textures.createCanvas(`fdeco_${type}`, cfg.w, cfg.h);
    const ctx = canvas.getContext();
    drawForestDeco(ctx, type, cfg.w, cfg.h);
    canvas.refresh();
  }
}

function drawForestDeco(ctx, type, w, h) {
  switch (type) {
    case 'oak': drawOak(ctx, w, h); break;
    case 'pine': drawForestPine(ctx, w, h); break;
    case 'willow': drawWillow(ctx, w, h); break;
    case 'mushroom': drawMushroom(ctx, w, h, '#e04040', '#f0c0c0'); break;
    case 'mushroom_b': drawMushroom(ctx, w, h, '#8B6B4A', '#c4a882'); break;
    case 'fern': drawFern(ctx, w, h); break;
    case 'flowers': drawWildflowers(ctx, w, h); break;
    case 'bush': drawForestBush(ctx, w, h); break;
    case 'rock': drawForestRock(ctx, w, h); break;
    case 'log': drawLog(ctx, w, h); break;
    case 'stump': drawForestStump(ctx, w, h); break;
    case 'lilypad': drawLilypad(ctx, w, h); break;
    case 'firefly': drawFirefly(ctx, w, h); break;
    case 'bamboo': drawBamboo(ctx, w, h); break;
  }
}

// ---------- 各绘制函数 ----------
function fillCircle(ctx, cx, cy, r) {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++)
      if (x * x + y * y <= r * r) ctx.fillRect(cx + x, cy + y, 1, 1);
}

function drawOak(ctx, w, h) {
  ctx.fillStyle = '#4a2a10'; // 树干
  ctx.fillRect(w/2-4, h-24, 8, 24);
  ctx.fillStyle = '#1a4a1a';
  fillCircle(ctx, w/2, 12, 22);
  ctx.fillStyle = '#2d6a1e';
  fillCircle(ctx, w/2-8, 22, 16);
  fillCircle(ctx, w/2+8, 22, 16);
  ctx.fillStyle = '#3a8a2a';
  fillCircle(ctx, w/2-5, 18, 10);
  fillCircle(ctx, w/2+5, 18, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  fillCircle(ctx, w/2-6, 6, 5);
}

function drawForestPine(ctx, w, h) {
  ctx.fillStyle = '#3a2a10';
  ctx.fillRect(w/2-2, h-22, 4, 22);
  const colors = ['#0a3a0a', '#1a5a1a', '#2a7a2a', '#3a8a2a'];
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = colors[i];
    const y = 2 + i * 12;
    const width = 36 - i * 6;
    const half = width / 2;
    ctx.beginPath();
    ctx.moveTo(w/2, y);
    ctx.lineTo(w/2 + half, y + 12);
    ctx.lineTo(w/2 - half, y + 12);
    ctx.closePath();
    ctx.fill();
  }
}

function drawWillow(ctx, w, h) {
  ctx.fillStyle = '#3a2a0a';
  ctx.fillRect(w/2-4, h-28, 8, 28);
  ctx.fillStyle = '#1a5a2a';
  fillCircle(ctx, w/2, 10, 24);
  ctx.fillStyle = '#2a7a3a';
  fillCircle(ctx, w/2-6, 20, 16);
  fillCircle(ctx, w/2+6, 20, 16);
  // 垂枝
  ctx.fillStyle = '#3a8a4a';
  for (let i = -3; i <= 3; i++) {
    const bx = w/2 + i * 6;
    const len = 20 + Math.abs(i) * 4;
    ctx.fillRect(bx, 24, 2, len);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  fillCircle(ctx, w/2-8, 4, 4);
}

function drawMushroom(ctx, w, h, capColor, spotColor) {
  // 菌柄
  ctx.fillStyle = '#e8dcc8';
  ctx.fillRect(w/2-2, h-8, 4, 8);
  // 菌盖
  ctx.fillStyle = capColor;
  fillCircle(ctx, w/2, h-10, 7);
  // 斑点
  ctx.fillStyle = spotColor;
  fillCircle(ctx, w/2-2, h-12, 2);
  fillCircle(ctx, w/2+3, h-10, 1.5);
}

function drawFern(ctx, w, h) {
  ctx.fillStyle = '#3a7a2a';
  ctx.fillRect(w/2-1, h-8, 2, 8);
  const green = '#4a9a3a';
  for (let i = 0; i < 4; i++) {
    const lx = w/2 - 3 - i * 2;
    const ly = h - 12 + i * 3;
    ctx.fillStyle = green;
    ctx.fillRect(lx, ly, 6, 2);
    ctx.fillRect(lx + 2, ly - 2, 2, 2);
  }
  for (let i = 0; i < 4; i++) {
    const lx = w/2 + 1 + i * 2;
    const ly = h - 14 + i * 3;
    ctx.fillStyle = green;
    ctx.fillRect(lx, ly, 6, 2);
  }
}

function drawWildflowers(ctx, w, h) {
  ctx.fillStyle = '#4a8a3a';
  ctx.fillRect(w/2-1, h/2, 2, h/2);
  const colors = ['#e74c8c', '#f0c040', '#8a5acc', '#e04040'];
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const px = w/2 + Math.cos(angle) * 4;
    const py = h/2 + Math.sin(angle) * 4;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(px-1, py-1, 3, 3);
  }
  ctx.fillStyle = '#ff0';
  ctx.fillRect(w/2-1, h/2-1, 3, 3);
}

function drawForestBush(ctx, w, h) {
  ctx.fillStyle = '#2a5a1a';
  fillCircle(ctx, w/2-7, h-8, 11);
  fillCircle(ctx, w/2+7, h-8, 11);
  fillCircle(ctx, w/2, h-14, 12);
  ctx.fillStyle = '#3a8a2a';
  fillCircle(ctx, w/2-4, h-16, 6);
  fillCircle(ctx, w/2+4, h-14, 5);
  // 小浆果
  ctx.fillStyle = '#cc4444';
  fillCircle(ctx, w/2-6, h-10, 2);
  fillCircle(ctx, w/2+5, h-8, 2);
}

function drawForestRock(ctx, w, h) {
  ctx.fillStyle = '#6a6a6a';
  ctx.fillRect(2, h-8, w-4, 8);
  ctx.fillRect(4, h-12, w-8, 4);
  ctx.fillRect(6, h-14, w-12, 2);
  ctx.fillStyle = '#7a7a7a';
  ctx.fillRect(4, h-8, 6, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(6, h-10, w/3, 2);
  // 青苔
  ctx.fillStyle = '#4a7a3a';
  ctx.fillRect(2, h-4, 4, 2);
  ctx.fillRect(w-6, h-6, 4, 2);
}

function drawLog(ctx, w, h) {
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(2, h-8, w-4, 8);
  ctx.fillStyle = '#6a4a2a';
  ctx.fillRect(2, h-8, w-4, 2);
  // 截面
  ctx.fillStyle = '#8a6a4a';
  fillCircle(ctx, 5, h-4, 5);
  ctx.fillStyle = '#7a5a3a';
  fillCircle(ctx, 5, h-4, 3);
  // 蘑菇
  ctx.fillStyle = '#d06060';
  fillCircle(ctx, w-6, h-6, 3);
}

function drawForestStump(ctx, w, h) {
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(2, h-10, w-4, 10);
  ctx.fillRect(2, h-12, w-4, 2);
  ctx.fillStyle = '#7a5a3a';
  ctx.fillRect(4, h-4, w-8, 2);
  // 年轮
  ctx.fillStyle = '#6a4a2a';
  fillCircle(ctx, w/2, h-6, 4);
  ctx.fillStyle = '#8a6a4a';
  fillCircle(ctx, w/2, h-6, 2);
  // 苔藓
  ctx.fillStyle = '#4a8a3a';
  ctx.fillRect(2, h-2, 6, 2);
}

function drawLilypad(ctx, w, h) {
  ctx.fillStyle = '#3a8a3a';
  fillCircle(ctx, w/2, h-3, 8);
  ctx.fillStyle = '#4aaa4a';
  fillCircle(ctx, w/2-1, h-5, 5);
  // 缺口
  ctx.fillStyle = '#2980b9';
  ctx.fillRect(w/2+1, h-6, 3, 4);
  // 花
  ctx.fillStyle = '#f0a0c0';
  ctx.fillRect(w/2-1, h-10, 3, 4);
  ctx.fillStyle = '#ffd0e0';
  ctx.fillRect(w/2, h-12, 2, 3);
}

function drawFirefly(ctx, w, h) {
  ctx.fillStyle = 'rgba(255,255,150,0)';
  ctx.fillRect(0, 0, w, h);
}

function drawBamboo(ctx, w, h) {
  // 竹竿
  ctx.fillStyle = '#4a8a3a';
  ctx.fillRect(w/2-3, 0, 6, h);
  ctx.fillStyle = '#5aaa4a';
  ctx.fillRect(w/2-1, 0, 2, h);
  // 竹节
  ctx.fillStyle = '#3a7a2a';
  for (let i = 0; i < h; i += 12) {
    ctx.fillRect(w/2-4, i, 8, 2);
  }
  // 竹叶
  ctx.fillStyle = '#3a9a2a';
  ctx.fillRect(w/2-8, 2, 6, 2);
  ctx.fillRect(w/2+2, 2, 6, 2);
  ctx.fillRect(w/2-6, 10, 5, 2);
  ctx.fillRect(w/2+1, 10, 5, 2);
  ctx.fillRect(w/2-8, 18, 6, 2);
  ctx.fillRect(w/2+2, 18, 6, 2);
}

// ============================================================
// 自动摆放森林装饰物
// ============================================================
function placeForestDecorations(MAP) {
  const decos = [];
  const H = MAP.length;
  const W = MAP[0].length;
  const cx = W * TILE_SIZE / 2;

  function isTile(r, c, type) {
    if (r < 0 || r >= H || c < 0 || c >= W) return false;
    return MAP[r][c] === type;
  }

  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const tile = MAP[r][c];
      const x = c * TILE_SIZE + TILE_SIZE / 2;
      const y = r * TILE_SIZE + TILE_SIZE / 2;
      const rnd = Math.random();

      // ---- 森林地面（type 1） ----
      if (tile === 1) {
        if (rnd < 0.30) {
          decos.push({ x, y, type: rnd < 0.18 ? 'oak' : 'pine' });
        } else if (rnd < 0.35) {
          decos.push({ x, y, type: 'bush' });
        } else if (rnd < 0.38) {
          decos.push({ x, y, type: 'fern' });
        } else if (rnd < 0.40) {
          decos.push({ x, y, type: rnd < 0.39 ? 'mushroom' : 'mushroom_b' });
        } else if (rnd < 0.42) {
          decos.push({ x, y, type: 'rock' });
        } else if (rnd < 0.43) {
          decos.push({ x, y, type: 'log' });
        } else if (rnd < 0.44) {
          decos.push({ x, y, type: 'stump' });
        }
      }

      // ---- 草原（type 0） ----
      if (tile === 0) {
        if (rnd < 0.06) {
          decos.push({ x, y, type: 'oak' });
        } else if (rnd < 0.10) {
          decos.push({ x, y, type: 'bush' });
        } else if (rnd < 0.14) {
          decos.push({ x, y, type: 'flowers' });
        } else if (rnd < 0.16) {
          decos.push({ x, y, type: 'rock' });
        } else if (rnd < 0.17) {
          decos.push({ x, y, type: 'stump' });
        } else if (rnd < 0.18) {
          decos.push({ x, y, type: 'fern' });
        }
      }

      // ---- 水边（type 2 相邻） ----
      if (tile === 0 || tile === 1) {
        const nearWater = isTile(r-1,c,2)||isTile(r+1,c,2)||isTile(r,c-1,2)||isTile(r,c+1,2);
        if (nearWater && rnd < 0.35) {
          decos.push({ x, y, type: 'willow' });
        } else if (nearWater && rnd < 0.50) {
          decos.push({ x, y, type: 'bush' });
        }
      }

      // ---- 湖面浮萍 ----
      if (tile === 2 && rnd < 0.25) {
        decos.push({ x, y, type: 'lilypad' });
      }

      // ---- 花甸（type 3） ----
      if (tile === 3) {
        if (rnd < 0.20) {
          decos.push({ x, y, type: 'flowers' });
        } else if (rnd < 0.28) {
          decos.push({ x, y, type: 'fern' });
        } else if (rnd < 0.32) {
          decos.push({ x, y, type: 'bush' });
        }
      }
    }
  }

  // 手动放一些柳树在湖边
  const lakeShore = [
    {r:14,c:19}, {r:14,c:22}, {r:16,c:14}, {r:19,c:22}, {r:20,c:20}
  ];
  for (const {r,c} of lakeShore) {
    const x = c * TILE_SIZE + TILE_SIZE / 2;
    const y = r * TILE_SIZE + TILE_SIZE / 2;
    if (!decos.some(d => Math.abs(d.x-x)<20 && Math.abs(d.y-y)<20)) {
      decos.push({ x, y, type: 'willow' });
    }
  }

  // 竹子区（特定位置）
  const bambooSpots = [{r:3,c:28},{r:4,c:28},{r:3,c:29},{r:4,c:29},{r:26,c:8},{r:26,c:9}];
  for (const {r,c} of bambooSpots) {
    const x = c * TILE_SIZE + TILE_SIZE / 2;
    const y = r * TILE_SIZE + TILE_SIZE / 2;
    decos.push({ x, y, type: 'bamboo' });
  }

  return decos;
}

// ============================================================
// ForestScene
// ============================================================
export default class ForestScene extends Phaser.Scene {
  constructor() {
    super('ForestScene');
  }

  create() {
    this._generateMapTexture();
    generateForestTextures(this);
    this.decorations = placeForestDecorations(MAP);
    this._createDecorations();

    // 地图
    const mapW = MAP[0].length * TILE_SIZE;
    const mapH = MAP.length * TILE_SIZE;
    this.add.image(mapW / 2, mapH / 2, 'forest-map-texture');

    // 摄像机
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.cameras.main.setBackgroundColor('#1a2a1a');

    // 本地玩家
    this.player = {
      x: 5 * TILE_SIZE + TILE_SIZE / 2,
      y: 5 * TILE_SIZE + TILE_SIZE / 2,
      dir: 'down', moving: false,
    };
    this._createPlayerSprite();

    // 提示文字
    const tipText = this.add.text(mapW / 2, 20, '🌲 森林漫步 — WASD 移动', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8f8',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(9999);
    this.tipText = tipText;

    // 按 R 返回主场景提示
    const escText = this.add.text(mapW / 2, mapH - 20, '按 R 返回游戏主场景', {
      fontFamily: 'monospace', fontSize: '10px', color: '#aaa',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(9999);
    this.escText = escText;

    // 键盘
    this.keys = this.input.keyboard.addKeys({
      W: 'W', A: 'A', S: 'S', D: 'D',
      UP: 'UP', DOWN: 'DOWN', LEFT: 'LEFT', RIGHT: 'RIGHT',
      R: 'R',
    });

    // 萤火虫粒子
    this.fireflies = [];
    this._createFireflies();
  }

  update() {
    this._handleInput();
    this._updateFireflies();
    this._sortDepths();

    // 按 R 返回主场景
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) {
      this.scene.start('GameScene');
    }
  }

  // ======================== 地图纹理 ========================
  _generateMapTexture() {
    const cols = MAP[0].length;
    const rows = MAP.length;
    const canvas = this.textures.createCanvas('forest-map-texture', cols * TILE_SIZE, rows * TILE_SIZE);
    const ctx = canvas.getContext();
    let seed = 42;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tile = MAP[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        // ---------- 草原（type 0） ----------
        if (tile === 0) {
          seed = (seed * 9301 + 49297) % 233280;
          const v = (seed % 20) - 10;
          ctx.fillStyle = `rgb(${84+Math.floor(v*0.3)},${160+Math.floor(v*0.5)},${63+Math.floor(v*0.2)})`;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          seed = (seed * 9301 + 49297) % 233280;
          if (seed % 5 < 2) {
            ctx.fillStyle = seed % 2 ? '#5aaa3a' : '#4a9a2a';
            const gx = x + 4 + (seed % 20);
            const gy = y + 6 + ((seed >> 4) % 18);
            ctx.fillRect(gx, gy, 2, 4);
            ctx.fillRect(gx + 3, gy + 1, 2, 3);
          }
          continue;
        }

        // ---------- 森林地面（type 1） ----------
        if (tile === 1) {
          seed = (seed * 9301 + 49297) % 233280;
          const v = (seed % 20) - 10;
          ctx.fillStyle = `rgb(${50+Math.floor(v*0.3)},${110+Math.floor(v*0.5)},${42+Math.floor(v*0.2)})`;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          // 落叶
          seed = (seed * 9301 + 49297) % 233280;
          if (seed % 4 < 2) {
            ctx.fillStyle = seed % 2 ? '#4a3a1a' : '#3a2a0a';
            const lx = x + 2 + (seed % 26);
            const ly = y + 2 + ((seed >> 4) % 26);
            ctx.fillRect(lx, ly, 3, 2);
          }
          // 林间光斑
          seed = (seed * 9301 + 49297) % 233280;
          if (seed % 8 === 0) {
            ctx.fillStyle = 'rgba(200,255,150,0.06)';
            fillCircle(ctx, x + 8 + (seed % 16), y + 4 + ((seed >> 4) % 20), 6);
          }
          continue;
        }

        // ---------- 湖水（type 2） ----------
        if (tile === 2) {
          ctx.fillStyle = '#1a6a9a';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          // 波纹
          seed = (seed * 9301 + 49297) % 233280;
          for (let wy = 0; wy < TILE_SIZE; wy += 4) {
            const wave = Math.floor(Math.sin(c * 0.6 + r * 0.4 + wy * 0.25) * 2 + 2);
            ctx.fillStyle = wave > 2 ? '#2a8ac0' : '#1a5a8a';
            ctx.fillRect(x, y + wy, TILE_SIZE, 2);
          }
          // 波光
          seed = (seed * 9301 + 49297) % 233280;
          if (seed % 3 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.fillRect(x + (seed % 24), y + ((seed >> 4) % 24), 3, 2);
          }
          // 岸边的泥土过渡
          const shore = (r>0&&MAP[r-1][c]!==2)||(r<rows-1&&MAP[r+1][c]!==2)||
                       (c>0&&MAP[r][c-1]!==2)||(c<cols-1&&MAP[r][c+1]!==2);
          if (shore) {
            const edge = (r>0&&MAP[r-1][c]!==2) ? 'top' :
                        (r<rows-1&&MAP[r+1][c]!==2) ? 'bottom' :
                        (c>0&&MAP[r][c-1]!==2) ? 'left' : 'right';
            if (edge === 'top')    { ctx.fillStyle = '#4a7a3a'; ctx.fillRect(x,y,TILE_SIZE,3); }
            if (edge === 'bottom') { ctx.fillStyle = '#4a7a3a'; ctx.fillRect(x,y+TILE_SIZE-3,TILE_SIZE,3); }
            if (edge === 'left')   { ctx.fillStyle = '#4a7a3a'; ctx.fillRect(x,y,3,TILE_SIZE); }
            if (edge === 'right')  { ctx.fillStyle = '#4a7a3a'; ctx.fillRect(x+TILE_SIZE-3,y,3,TILE_SIZE); }
          }
          continue;
        }

        // ---------- 花甸（type 3） ----------
        if (tile === 3) {
          seed = (seed * 9301 + 49297) % 233280;
          const v = (seed % 20) - 10;
          ctx.fillStyle = `rgb(${90+Math.floor(v*0.3)},${170+Math.floor(v*0.5)},${70+Math.floor(v*0.2)})`;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          // 小野花
          seed = (seed * 9301 + 49297) % 233280;
          if (seed % 3 < 2) {
            const colors = ['#e74c8c','#f0c040','#8a5acc','#e87840'];
            ctx.fillStyle = colors[seed % 4];
            const fx = x + 4 + (seed % 20);
            const fy = y + 4 + ((seed >> 4) % 20);
            ctx.fillRect(fx, fy, 2, 2);
            ctx.fillRect(fx + 2, fy - 1, 2, 2);
          }
          continue;
        }

        // ---------- 小径（type 4） ----------
        if (tile === 4) {
          ctx.fillStyle = '#b8945e';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          seed = (seed * 9301 + 49297) % 233280;
          for (let i = 0; i < 4; i++) {
            seed = (seed * 9301 + 49297) % 233280;
            ctx.fillStyle = seed % 2 ? '#a8844e' : '#c8a46e';
            ctx.fillRect(x + 2 + (seed % 26), y + 2 + ((seed >> 4) % 26), 2, 2);
          }
          continue;
        }

        ctx.fillStyle = '#000';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    }
    canvas.refresh();
  }

  // ======================== 玩家精灵 ========================
  _createPlayerSprite() {
    const eSize = ENTITY_SIZE;
    const texKey = 'forest_player';
    if (!this.textures.exists(texKey)) {
      const canvas = this.textures.createCanvas(texKey, eSize, eSize);
      const ctx = canvas.getContext();
      // 绿色衣服
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(0, 0, eSize, eSize);
      // 深绿帽子
      ctx.fillStyle = '#1a5a2a';
      ctx.fillRect(0, 0, eSize, 6);
      ctx.fillRect(4, 6, eSize - 8, 2);
      // 白色眼睛
      ctx.fillStyle = '#fff';
      ctx.fillRect(6, 10, 6, 6);
      ctx.fillRect(16, 10, 6, 6);
      // 瞳孔
      ctx.fillStyle = '#000';
      ctx.fillRect(8, 12, 2, 2);
      ctx.fillRect(18, 12, 2, 2);
      canvas.refresh();
    }
    const sprite = this.add.image(this.player.x, this.player.y, texKey);
    this.cameras.main.startFollow(sprite, true, 0.1, 0.1);
    this.player._sprite = sprite;
  }

  // ======================== 创建装饰物 ========================
  _createDecorations() {
    this.decoSprites = [];
    for (const deco of this.decorations) {
      const cfg = FOREST_DECO_TYPES[deco.type];
      if (!cfg) continue;
      const sprite = this.add.image(deco.x, deco.y, `fdeco_${deco.type}`);
      if (!cfg.tall) {
        sprite.setDepth(1);
      }
      deco._sprite = sprite;
    }
  }

  // ======================== 深度排序 ========================
  _sortDepths() {
    const baseDepth = 10;
    if (this.player._sprite) {
      this.player._sprite.setDepth(baseDepth + this.player.y);
    }
    for (const deco of this.decorations || []) {
      const cfg = FOREST_DECO_TYPES[deco.type];
      if (cfg && cfg.tall && deco._sprite) {
        deco._sprite.setDepth(baseDepth + deco.y);
      }
    }
    if (this.tipText) this.tipText.setDepth(9999);
    if (this.escText) this.escText.setDepth(9999);
  }

  // ======================== 输入处理 ========================
  _handleInput() {
    let dx = 0, dy = 0;
    if (this.keys.W.isDown || this.keys.UP.isDown)   dy -= 1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) dy += 1;
    if (this.keys.A.isDown || this.keys.LEFT.isDown) dx -= 1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) dx += 1;

    this.player.moving = dx !== 0 || dy !== 0;
    if (this.player.moving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = dx / len;
      const ny = dy / len;
      let newX = this.player.x + nx * PLAYER_SPEED;
      let newY = this.player.y + ny * PLAYER_SPEED;
      if (canMoveTo(newX, this.player.y)) this.player.x = newX;
      if (canMoveTo(this.player.x, newY)) this.player.y = newY;
      if (Math.abs(nx) > Math.abs(ny)) {
        this.player.dir = nx > 0 ? 'right' : 'left';
      } else {
        this.player.dir = ny > 0 ? 'down' : 'up';
      }
    }
    if (this.player._sprite) {
      this.player._sprite.setPosition(this.player.x, this.player.y);
    }
  }

  // ======================== 萤火虫 ========================
  _createFireflies() {
    const mapW = MAP[0].length * TILE_SIZE;
    const mapH = MAP.length * TILE_SIZE;
    for (let i = 0; i < 30; i++) {
      this.fireflies.push({
        x: 50 + Math.random() * (mapW - 100),
        y: 50 + Math.random() * (mapH - 100),
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        phase: Math.random() * Math.PI * 2,
        sprite: null,
      });
    }
  }

  _updateFireflies() {
    for (let i = this.fireflies.length - 1; i >= 0; i--) {
      const f = this.fireflies[i];
      // 往森林区域聚拢
      const col = Math.floor(f.x / TILE_SIZE);
      const row = Math.floor(f.y / TILE_SIZE);
      if (col >= 0 && col < MAP[0].length && row >= 0 && row < MAP.length) {
        const tile = MAP[row][col];
        if (tile === 2) {
          f.vy -= 0.01; // 飞离水面
        }
      }

      f.x += f.vx + Math.sin(Date.now() * 0.001 + f.phase) * 0.1;
      f.y += f.vy + Math.cos(Date.now() * 0.0013 + f.phase) * 0.1;

      // 边界反弹
      const mapW = MAP[0].length * TILE_SIZE;
      const mapH = MAP.length * TILE_SIZE;
      if (f.x < 30 || f.x > mapW - 30) f.vx *= -1;
      if (f.y < 30 || f.y > mapH - 30) f.vy *= -1;

      // 绘制或更新萤火虫
      if (!f.sprite) {
        f.sprite = this.add.circle(f.x, f.y, 2, 0xffff88, 0.8).setDepth(9998);
      } else {
        const alpha = 0.3 + Math.sin(Date.now() * 0.003 + f.phase) * 0.4;
        f.sprite.setPosition(f.x, f.y);
        f.sprite.setAlpha(Math.max(0, alpha));
        f.sprite.setScale(0.8 + Math.sin(Date.now() * 0.004 + f.phase) * 0.3);
      }
    }
  }
}
