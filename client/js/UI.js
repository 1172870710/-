// UI 模块 —— 聊天消息列表（纯 HTML）
class UI {
  constructor() {
    this.chatMessages = [];
    this.maxChatMessages = 8;

    this.inputEl = document.getElementById('chat-input');
    this.messagesEl = document.getElementById('chat-messages');

    if (this.inputEl) {
      this.inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const text = this.inputEl.value.trim();
          if (text && this._onSend) this._onSend(text);
          this.inputEl.value = '';
          this.inputEl.blur();
          e.preventDefault();
        }
        if (e.key === 'Escape') this.inputEl.blur();
      });
    }

    this._onSend = null;
  }

  onSend(callback) { this._onSend = callback; }

  addMessage(fromName, text) {
    this.chatMessages.push({ fromName, text, time: Date.now() });
    if (this.chatMessages.length > this.maxChatMessages) {
      this.chatMessages.shift();
    }
    this._render();
  }

  _render() {
    if (!this.messagesEl) return;
    this.messagesEl.innerHTML = this.chatMessages
      .map(m => `<div><b>${this._escape(m.fromName)}:</b> ${this._escape(m.text)}</div>`)
      .join('');
  }

  _escape(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
}

export default UI;
