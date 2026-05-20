// 输入管理 —— 键盘 + 触控统一
class Input {
  constructor() {
    this.keys = {};       // 当前按下的键
    this.justPressed = {}; // 本帧刚按下的键（只维持一帧）
    this.touchDx = 0;     // 触控摇杆方向
    this.touchDy = 0;

    this._onDown = (e) => {
      if (!this.keys[e.key]) {
        this.justPressed[e.key.toLowerCase()] = true;
      }
      this.keys[e.key.toLowerCase()] = true;

      // 阻止方向键滚动页面
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
    };

    this._onUp = (e) => {
      this.keys[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', this._onDown);
    window.addEventListener('keyup', this._onUp);
  }

  // 设置触控方向（由 MobileControls 调用）
  setTouchDirection(dx, dy) {
    this.touchDx = dx;
    this.touchDy = dy;
  }

  // 获取合并后的移动方向（键盘 + 触控）
  getDirection() {
    let dx = 0, dy = 0;
    // 键盘
    if (this.keys['w'] || this.keys['arrowup'])    dy -= 1;
    if (this.keys['s'] || this.keys['arrowdown'])  dy += 1;
    if (this.keys['a'] || this.keys['arrowleft'])  dx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) dx += 1;
    // 触控（优先键盘，键盘松了才用触控）
    if (dx === 0 && dy === 0) {
      dx = this.touchDx;
      dy = this.touchDy;
    }
    return { dx, dy };
  }

  // 获取面朝方向字符串
  getFacingDir() {
    const { dx, dy } = this.getDirection();
    if (dx === 0 && dy === 0) return null;
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'down' : 'up';
  }

  // 消耗掉刚按下的键（防止重复触发）
  consumeJustPressed(key) {
    const val = this.justPressed[key];
    this.justPressed[key] = false;
    return val;
  }

  // 每帧结束时调用，清除 justPressed
  endFrame() {
    this.justPressed = {};
  }
}

export default Input;
