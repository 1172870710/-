// 场景装饰物 —— 树、花、石头、围栏等像素风装饰
// 纯视觉，无碰撞，让世界更生动

const TILE_SIZE = 32;

// ============================================================
// 装饰物类型配置
// ============================================================
const DECO_TYPES = {
  tree:    { w: 48, h: 56, tall: true,  label: '树' },
  pine:    { w: 40, h: 52, tall: true,  label: '松树' },
  bush:    { w: 32, h: 24, tall: false, label: '灌木' },
  flowers_pink: { w: 16, h: 14, tall: false, label: '花' },
  flowers_yellow:{ w: 16, h: 14, tall: false, label: '花' },
  rock:    { w: 20, h: 16, tall: false, label: '石头' },
  rock_big:{ w: 28, h: 20, tall: false, label: '大石头' },
  lamp:    { w: 18, h: 48, tall: true,  label: '路灯' },
  stump:   { w: 22, h: 16, tall: false, label: '树桩' },
  grave:   { w: 20, h: 26, tall: false, label: '墓碑' },
};

// ============================================================
// 合成装饰物纹理（在 Canvas 上画像素风图案）
// ============================================================
function generateDecoTextures(scene) {
  for (const [type, cfg] of Object.entries(DECO_TYPES)) {
    if (scene.textures.exists(`deco_${type}`)) continue;
    const canvas = scene.textures.createCanvas(`deco_${type}`, cfg.w, cfg.h);
    const ctx = canvas.getContext();
    drawDeco(ctx, type, cfg.w, cfg.h);
    canvas.refresh();
  }
}

function drawDeco(ctx, type, w, h) {
  switch (type) {
    case 'tree': drawTree(ctx, w, h); break;
    case 'pine': drawPine(ctx, w, h); break;
    case 'bush': drawBush(ctx, w, h); break;
    case 'flowers_pink': drawFlowers(ctx, w, h, '#e74c8c'); break;
    case 'flowers_yellow':drawFlowers(ctx, w, h, '#f0c040'); break;
    case 'rock': drawRock(ctx, w, h, '#888'); break;
    case 'rock_big': drawRock(ctx, w, h, '#777'); break;
    case 'lamp': drawLamp(ctx, w, h); break;
    case 'stump': drawStump(ctx, w, h); break;
    case 'grave': drawGrave(ctx, w, h); break;
  }
}

// ---------- 各绘制函数 ----------

function drawTree(ctx, w, h) {
  // 树干
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(w/2-3, h-22, 6, 22);
  // 树冠（三层圆）
  const colors = ['#1a4a1a', '#2d5a1e', '#3a7a2a'];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = colors[i];
    const cy = 8 + i * 12;
    const r = 20 - i * 4;
    fillCircle(ctx, w/2, cy, r);
  }
  // 高光
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  fillCircle(ctx, w/2-4, 8, 6);
}

function drawPine(ctx, w, h) {
  // 树干
  ctx.fillStyle = '#4a3a1a';
  ctx.fillRect(w/2-2, h-20, 4, 20);
  // 树冠（三层三角）
  const colors = ['#0a3a0a', '#1a5a1a', '#2a7a2a'];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = colors[i];
    const y = 4 + i * 14;
    const width = 34 - i * 8;
    const half = width / 2;
    ctx.beginPath();
    ctx.moveTo(w/2, y);
    ctx.lineTo(w/2 + half, y + 14);
    ctx.lineTo(w/2 - half, y + 14);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBush(ctx, w, h) {
  ctx.fillStyle = '#3a7a2a';
  fillCircle(ctx, w/2-6, h-8, 10);
  fillCircle(ctx, w/2+6, h-8, 10);
  fillCircle(ctx, w/2, h-12, 11);
  ctx.fillStyle = '#4a9a3a';
  fillCircle(ctx, w/2-3, h-14, 5);
}

function drawFlowers(ctx, w, h, color) {
  // 茎
  ctx.fillStyle = '#4a8a3a';
  ctx.fillRect(w/2-1, h/2, 2, h/2);
  // 花
  ctx.fillStyle = color;
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const px = w/2 + Math.cos(angle) * 4;
    const py = h/2 + Math.sin(angle) * 4;
    ctx.fillRect(px-1, py-1, 3, 3);
  }
  ctx.fillStyle = '#ff0';
  ctx.fillRect(w/2-1, h/2-1, 3, 3);
}

function drawRock(ctx, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(2, h-8, w-4, 8);
  ctx.fillRect(4, h-12, w-8, 4);
  ctx.fillRect(6, h-14, w-12, 2);
  // 高光
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(6, h-10, w/3, 3);
}

function drawLamp(ctx, w, h) {
  // 柱子
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(w/2-2, 16, 4, h-16);
  // 横杆
  ctx.fillRect(2, 16, w-4, 3);
  // 灯罩
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(3, 8, w-6, 10);
  // 灯光
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(5, 10, w-10, 6);
  // 光晕
  ctx.fillStyle = 'rgba(255,215,0,0.12)';
  ctx.fillRect(1, 6, w-2, 14);
}

function drawStump(ctx, w, h) {
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(3, h-10, w-6, 10);
  ctx.fillRect(2, h-12, w-4, 2);
  // 年轮
  ctx.fillStyle = '#7a5a3a';
  ctx.fillRect(w/2-4, h-10, 8, 2);
  ctx.fillRect(w/2-2, h-6, 4, 2);
  // 截面
  ctx.fillStyle = '#8a6a4a';
  ctx.fillRect(4, h-14, w-8, 2);
}

function drawGrave(ctx, w, h) {
  // 底座
  ctx.fillStyle = '#6a6a6a';
  ctx.fillRect(2, h-8, w-4, 8);
  // 墓碑
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(4, 4, w-8, h-10);
  // 圆顶
  ctx.fillRect(2, 2, w-4, 4);
  // 裂纹
  ctx.fillStyle = '#5a5a5a';
  ctx.fillRect(w/2, 10, 2, 8);
  ctx.fillRect(w/2-2, 16, 4, 2);
  // 碑文（模糊的十字）
  ctx.fillStyle = '#9a9a9a';
  ctx.fillRect(w/2-1, 6, 2, 6);
  ctx.fillRect(w/2-3, 8, 6, 2);
}

function fillCircle(ctx, cx, cy, r) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) {
        ctx.fillRect(cx + x, cy + y, 1, 1);
      }
    }
  }
}

// ============================================================
// 自动摆放装饰物（分析地图，把装饰放在合适位置）
// ============================================================
function placeDecorations(MAP) {
  const decos = [];
  const H = MAP.length;
  const W = MAP[0].length;

  function isTile(r, c, type) {
    if (r < 0 || r >= H || c < 0 || c >= W) return false;
    return MAP[r][c] === type;
  }

  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (MAP[r][c] !== 0) continue; // 只放草地上

      const x = c * TILE_SIZE + TILE_SIZE / 2;
      const y = r * TILE_SIZE + TILE_SIZE / 2;
      const nearWall = isTile(r-1, c, 1) || isTile(r+1, c, 1) ||
                       isTile(r, c-1, 1) || isTile(r, c+1, 1);
      const nearWater = isTile(r-1, c, 2) || isTile(r+1, c, 2) ||
                        isTile(r, c-1, 2) || isTile(r, c+1, 2);

      // 可装饰标记，防止同一格放多个
      let placed = false;

      if (nearWall) {
        // 建筑旁边：树 + 灌木
        const rnd = Math.random();
        if (rnd < 0.35) {
          decos.push({ x, y, type: Math.random() < 0.6 ? 'tree' : 'pine' });
          placed = true;
        } else if (rnd < 0.45) {
          decos.push({ x, y, type: 'bush' });
          placed = true;
        } else if (rnd < 0.50) {
          decos.push({ x, y, type: 'flowers_pink' });
          placed = true;
        }
      } else if (nearWater) {
        // 水边：石头 + 花 + 树
        const rnd = Math.random();
        if (rnd < 0.30) {
          decos.push({ x, y, type: Math.random() < 0.5 ? 'rock' : 'rock_big' });
          placed = true;
        } else if (rnd < 0.40) {
          decos.push({ x, y, type: Math.random() < 0.5 ? 'flowers_pink' : 'flowers_yellow' });
          placed = true;
        } else if (rnd < 0.50) {
          decos.push({ x, y, type: 'tree' });
          placed = true;
        }
      } else {
        // 开阔草地：随机撒点
        const rnd = Math.random();
        if (rnd < 0.04) {
          decos.push({ x, y, type: 'tree' });
          placed = true;
        } else if (rnd < 0.07) {
          decos.push({ x, y, type: 'pine' });
          placed = true;
        } else if (rnd < 0.10) {
          decos.push({ x, y, type: 'bush' });
          placed = true;
        } else if (rnd < 0.14) {
          decos.push({ x, y, type: Math.random() < 0.5 ? 'flowers_pink' : 'flowers_yellow' });
          placed = true;
        } else if (rnd < 0.17) {
          decos.push({ x, y, type: Math.random() < 0.5 ? 'rock' : 'rock_big' });
          placed = true;
        } else if (rnd < 0.18) {
          decos.push({ x, y, type: 'stump' });
          placed = true;
        }
      }

      // 角落偶发墓碑（神秘感）
      if (!placed && !nearWall && Math.random() < 0.005) {
        decos.push({ x, y, type: 'grave' });
      }
    }
  }

  // 在特定位置手动放置路灯
  placeLamp(decos, MAP, 10, 15);
  placeLamp(decos, MAP, 20, 10);
  placeLamp(decos, MAP, 14, 20);
  placeLamp(decos, MAP, 28, 8);
  placeLamp(decos, MAP, 35, 25);

  return decos;
}

function placeLamp(decos, MAP, c, r) {
  if (r < 0 || r >= MAP.length || c < 0 || c >= MAP[0].length) return;
  if (MAP[r][c] !== 0) return;
  // 检查是否已被占用
  const x = c * TILE_SIZE + TILE_SIZE / 2;
  const y = r * TILE_SIZE + TILE_SIZE / 2;
  const taken = decos.some(d => Math.abs(d.x - x) < TILE_SIZE && Math.abs(d.y - y) < TILE_SIZE);
  if (!taken) decos.push({ x, y, type: 'lamp' });
}

export { DECO_TYPES, generateDecoTextures, placeDecorations };
