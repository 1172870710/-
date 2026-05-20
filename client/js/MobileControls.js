// 手机触控 —— 虚拟摇杆
class MobileControls {
  constructor() {
    this.dx = 0;
    this.dy = 0;
    this.active = false;
    this.joystickId = null;
    this.joystickBase = { x: 0, y: 0 };

    this.baseEl = document.getElementById('joystick-base');
    this.thumbEl = document.getElementById('joystick-thumb');
    this.chatBtn = document.getElementById('mobile-chat-btn');

    if (!this.baseEl || !this.thumbEl || !this.chatBtn) return;
    if (!('ontouchstart' in window)) return;

    this.active = true;
    this.baseEl.style.display = 'block';
    this.thumbEl.style.display = 'block';
    this.chatBtn.style.display = 'flex';

    this._bindEvents();
  }

  _bindEvents() {
    const leftZone = document.getElementById('touch-left');
    if (!leftZone) return;

    leftZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      this.joystickId = touch.identifier;
      this.joystickBase.x = touch.clientX;
      this.joystickBase.y = touch.clientY;

      this.baseEl.style.left = (touch.clientX - 45) + 'px';
      this.baseEl.style.top = (touch.clientY - 45) + 'px';
      this.baseEl.style.opacity = '1';
      this.thumbEl.style.left = (touch.clientX - 20) + 'px';
      this.thumbEl.style.top = (touch.clientY - 20) + 'px';
      this.thumbEl.style.opacity = '1';

      this._update(touch.clientX, touch.clientY);
    });

    leftZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier === this.joystickId) {
          this._update(touch.clientX, touch.clientY);
        }
      }
    });

    leftZone.addEventListener('touchend', (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === this.joystickId) this._reset();
      }
    });

    leftZone.addEventListener('touchcancel', () => this._reset());

    this.chatBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const input = document.getElementById('chat-input');
      if (input) {
        if (document.activeElement === input) input.blur();
        else input.focus();
      }
    });
  }

  _update(clientX, clientY) {
    const dx = clientX - this.joystickBase.x;
    const dy = clientY - this.joystickBase.y;
    const maxDist = 40;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(dist, maxDist);
    const ratio = dist > 0 ? clamped / dist : 0;

    this.dx = dx * ratio / maxDist;
    this.dy = dy * ratio / maxDist;

    this.thumbEl.style.left = (this.joystickBase.x + dx * ratio - 20) + 'px';
    this.thumbEl.style.top = (this.joystickBase.y + dy * ratio - 20) + 'px';
  }

  _reset() {
    this.joystickId = null;
    this.dx = 0;
    this.dy = 0;
    this.baseEl.style.opacity = '0';
    this.thumbEl.style.opacity = '0';
  }
}

export default MobileControls;
