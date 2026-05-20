// 像素渲染器 —— 核心绘制入口
class Renderer {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // 关闭抗锯齿 = 像素风关键设置
    ctx.imageSmoothingEnabled = false;
  }

  // 清空画布
  clear(color = '#2d5a27') {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // 绘制实心矩形（像素精确）
  fillRect(x, y, w, h, color) {
    // 像素对齐：取整避免模糊
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  // 绘制文字
  drawText(text, x, y, color = '#fff', size = 8) {
    this.ctx.font = `${size}px monospace`;
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, Math.round(x), Math.round(y));
  }
}

export default Renderer;
