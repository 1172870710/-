// 摄像机 —— 跟随目标，边界钳制
class Camera {
  constructor(canvasWidth, canvasHeight, mapPixelWidth, mapPixelHeight) {
    this.width = canvasWidth;
    this.height = canvasHeight;
    this.mapWidth = mapPixelWidth;
    this.mapHeight = mapPixelHeight;
    this.x = 0;
    this.y = 0;
  }

  // 跟随目标（玩家），保证不超出地图边界
  follow(targetX, targetY) {
    this.x = targetX - this.width / 2;
    this.y = targetY - this.height / 2;

    // 边界钳制
    if (this.x < 0) this.x = 0;
    if (this.y < 0) this.y = 0;
    if (this.x + this.width > this.mapWidth) {
      this.x = this.mapWidth - this.width;
    }
    if (this.y + this.height > this.mapHeight) {
      this.y = this.mapHeight - this.height;
    }
  }
}

export default Camera;
