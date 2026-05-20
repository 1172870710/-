// 瓦片地图渲染器
const TILE_SIZE = 32;

// 每个瓦片类型的颜色
const TILE_COLORS = {
  0: '#4a8c3f',  // 草地 - 绿色
  1: '#6b6b6b',  // 墙壁 - 深灰
  2: '#2980b9',  // 水 - 蓝色
  3: '#c4a56e',  // 道路 - 土黄
  4: '#8b7355',  // 房屋地板 - 棕色
};

class MapRenderer {
  constructor(renderer) {
    this.renderer = renderer;
  }

  // 根据摄像机视野绘制可见的瓦片
  draw(map, camera) {
    const { ctx } = this.renderer;

    // 计算可见区域的瓦片范围
    const startCol = Math.max(0, Math.floor(camera.x / TILE_SIZE));
    const startRow = Math.max(0, Math.floor(camera.y / TILE_SIZE));
    const endCol = Math.min(map[0].length, Math.ceil((camera.x + camera.width) / TILE_SIZE));
    const endRow = Math.min(map.length, Math.ceil((camera.y + camera.height) / TILE_SIZE));

    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const tile = map[row][col];
        const color = TILE_COLORS[tile] || '#000';

        const screenX = col * TILE_SIZE - camera.x;
        const screenY = row * TILE_SIZE - camera.y;

        ctx.fillStyle = color;
        ctx.fillRect(Math.round(screenX), Math.round(screenY), TILE_SIZE, TILE_SIZE);

        // 给墙壁和房子画一点像素细节（高光边）
        if (tile === 1) {
          ctx.fillStyle = '#8a8a8a';
          ctx.fillRect(Math.round(screenX), Math.round(screenY), TILE_SIZE, 1);
          ctx.fillRect(Math.round(screenX), Math.round(screenY), 1, TILE_SIZE);
        }
        if (tile === 4) {
          ctx.fillStyle = '#a0886a';
          ctx.fillRect(Math.round(screenX), Math.round(screenY), TILE_SIZE, 2);
        }
      }
    }
  }
}

export default MapRenderer;
