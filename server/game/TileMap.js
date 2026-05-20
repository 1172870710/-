const { TILE_SIZE } = require('../../shared/constants');
const { MAP } = require('../../shared/mapData');

class TileMap {
  constructor() {
    this.map = MAP;
    this.width = MAP[0].length;
    this.height = MAP.length;
    this.tileSize = TILE_SIZE;

    // 可行走的地面类型（草地、道路、地板、花丛）
    this.walkable = new Set([0, 3, 4, 6]);
  }

  // 判断某个坐标是否可行走
  isWalkable(x, y) {
    const col = Math.floor(x / this.tileSize);
    const row = Math.floor(y / this.tileSize);

    if (col < 0 || col >= this.width || row < 0 || row >= this.height) {
      return false; // 地图外不可走
    }

    const tile = this.map[row][col];
    return this.walkable.has(tile);
  }

  // 根据坐标获取瓦片类型
  getTileAt(x, y) {
    const col = Math.floor(x / this.tileSize);
    const row = Math.floor(y / this.tileSize);
    if (col < 0 || col >= this.width || row < 0 || row >= this.height) {
      return 1; // 默认视为墙壁
    }
    return this.map[row][col];
  }

  // 获取地图像素总尺寸
  getPixelSize() {
    return {
      width: this.width * this.tileSize,
      height: this.height * this.tileSize,
    };
  }

  // 找到所有指定类型的瓦片坐标（用于生成出生点等）
  findTilesOfType(type) {
    const result = [];
    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        if (this.map[row][col] === type) {
          result.push({ col, row, x: col * this.tileSize, y: row * this.tileSize });
        }
      }
    }
    return result;
  }

  // 获取随机可行走的位置
  getRandomWalkable() {
    const grass = this.findTilesOfType(0);
    const roads = this.findTilesOfType(3);
    const all = [...grass, ...roads];
    if (all.length === 0) {
      // 兜底：返回地图中心
      return {
        x: (this.width * this.tileSize) / 2,
        y: (this.height * this.tileSize) / 2,
      };
    }
    const pick = all[Math.floor(Math.random() * all.length)];
    return {
      x: pick.col * this.tileSize + this.tileSize / 2,
      y: pick.row * this.tileSize + this.tileSize / 2,
    };
  }
}

module.exports = TileMap;
