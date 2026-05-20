// UI 管理器 —— 设置面板、玩家列表、角色自定义
const PLAYER_COLORS = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#2c3e50'];

class UIManager {
  constructor() {
    this.onUpdateAppearance = null; // 回调：通知游戏更新外观
    this.onDevCommand = null;       // 回调：通知游戏执行开发者指令
    this.panels = {};
    this._createPanels();
    this._bindKeys();
  }

  // ======================== 创建面板 DOM ========================
  _createPanels() {
    // ---- 设置面板 ----
    const overlay = this._createEl('div', 'ui-overlay', 'ui-overlay-settings');
    const panel = this._createEl('div', 'ui-panel', 'ui-panel-settings');
    panel.innerHTML = `
      <div class="ui-panel-title">⚙ 游戏设置</div>

      <div class="ui-section">
        <label class="ui-label">玩家名字</label>
        <input type="text" class="ui-input" id="ui-name-input" maxlength="12" placeholder="输入名字...">
      </div>

      <div class="ui-section">
        <label class="ui-label">角色颜色</label>
        <div class="ui-colors" id="ui-color-picker">
          ${PLAYER_COLORS.map(c => `<div class="ui-color-swatch" data-color="${c}" style="background:${c}"></div>`).join('')}
        </div>
      </div>

      <div class="ui-section">
        <label class="ui-label">操作提示</label>
        <div class="ui-hints">
          <div><kbd>W A S D</kbd> / <kbd>↑ ← ↓ →</kbd> 移动</div>
          <div><kbd>T</kbd> 聊天 &nbsp; <kbd>Tab</kbd> 玩家列表</div>
          <div><kbd>Esc</kbd> 设置</div>
        </div>
      </div>

      <button class="ui-btn" id="ui-save-btn">✓ 保存</button>
    `;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // ---- 玩家列表面板 ----
    const listOverlay = this._createEl('div', 'ui-overlay', 'ui-overlay-list');
    const listPanel = this._createEl('div', 'ui-panel', 'ui-panel-list');
    listPanel.innerHTML = `
      <div class="ui-panel-title">👥 在线玩家 <span class="ui-count" id="ui-player-count">0</span></div>
      <div class="ui-list" id="ui-player-list"></div>
      <div class="ui-panel-title" style="margin-top:8px">🤖 NPC <span class="ui-count" id="ui-npc-count">0</span></div>
      <div class="ui-list" id="ui-npc-list"></div>
    `;
    listOverlay.appendChild(listPanel);
    document.body.appendChild(listOverlay);

    // ---- 开发者模式面板 ----
    const devOverlay = this._createEl('div', 'ui-overlay', 'ui-overlay-dev');
    const devPanel = this._createEl('div', 'ui-panel', 'ui-panel-dev');
    devPanel.innerHTML = `
      <div class="ui-panel-title">🛠 开发者模式</div>

      <div class="ui-section">
        <label class="ui-label">移动速度: <span id="dev-speed-val">1.0</span></label>
        <input type="range" id="dev-speed" min="0.5" max="10" step="0.5" value="1">
      </div>

      <div class="ui-section">
        <label class="ui-label">血量: <span id="dev-hp-val">100</span></label>
        <input type="range" id="dev-hp" min="1" max="200" step="1" value="100">
      </div>

      <div class="ui-section">
        <label class="ui-label">攻击力: <span id="dev-dmg-val">15</span></label>
        <input type="range" id="dev-dmg" min="1" max="200" step="1" value="15">
      </div>

      <div class="ui-section">
        <div class="ui-hints">
          <button class="ui-btn" id="dev-heal-me" style="font-size:11px;padding:5px;margin-top:4px">❤️ 恢复自己</button>
          <button class="ui-btn" id="dev-heal-all" style="font-size:11px;padding:5px;margin-top:4px">❤️ 恢复所有玩家</button>
          <button class="ui-btn" id="dev-heal-npcs" style="font-size:11px;padding:5px;margin-top:4px">❤️ 恢复所有 NPC</button>
        </div>
      </div>
    `;
    devOverlay.appendChild(devPanel);
    document.body.appendChild(devOverlay);

    // ---- 角色自定义快捷按钮 ----
    const charBtn = this._createEl('div', 'ui-char-btn', 'ui-char-btn');
    charBtn.title = '自定义角色';
    document.body.appendChild(charBtn);

    this.panels = {
      overlay,
      listOverlay,
      devOverlay,
      charBtn,
      nameInput: panel.querySelector('#ui-name-input'),
      colorSwatches: panel.querySelectorAll('.ui-color-swatch'),
      saveBtn: panel.querySelector('#ui-save-btn'),
      playerList: listPanel.querySelector('#ui-player-list'),
      npcList: listPanel.querySelector('#ui-npc-list'),
      playerCount: listPanel.querySelector('#ui-player-count'),
      npcCount: listPanel.querySelector('#ui-npc-count'),
      devSpeed: devPanel.querySelector('#dev-speed'),
      devSpeedVal: devPanel.querySelector('#dev-speed-val'),
      devHp: devPanel.querySelector('#dev-hp'),
      devHpVal: devPanel.querySelector('#dev-hp-val'),
      devDmg: devPanel.querySelector('#dev-dmg'),
      devDmgVal: devPanel.querySelector('#dev-dmg-val'),
      devHealMe: devPanel.querySelector('#dev-heal-me'),
      devHealAll: devPanel.querySelector('#dev-heal-all'),
      devHealNpcs: devPanel.querySelector('#dev-heal-npcs'),
    };

    this._bindPanelEvents();
    this._bindDevEvents();
  }

  _createEl(tag, ...classes) {
    const el = document.createElement(tag);
    el.classList.add(...classes);
    return el;
  }

  // ======================== 面板事件 ========================
  _bindPanelEvents() {
    // 颜色选择
    this.panels.colorSwatches.forEach(el => {
      el.addEventListener('click', () => {
        this.panels.colorSwatches.forEach(s => s.classList.remove('selected'));
        el.classList.add('selected');
      });
    });

    // 保存按钮
    this.panels.saveBtn.addEventListener('click', () => this._saveSettings());

    // 回车保存
    this.panels.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._saveSettings();
    });

    // 关闭面板（点击背景）
    this.panels.overlay.addEventListener('click', (e) => {
      if (e.target === this.panels.overlay) this.closeSettings();
    });

    // 关闭玩家列表（点击背景）
    this.panels.listOverlay.addEventListener('click', (e) => {
      if (e.target === this.panels.listOverlay) this.closePlayerList();
    });

    // 关闭开发者模式面板（点击背景）
    this.panels.devOverlay.addEventListener('click', (e) => {
      if (e.target === this.panels.devOverlay) this.closeDevMode();
    });
    this.panels.charBtn.addEventListener('click', () => this.openSettings());
  }

  // ======================== 键盘快捷键 ========================
  _bindKeys() {
    document.addEventListener('keydown', (e) => {
      // Esc：切换设置面板
      if (e.key === 'Escape') {
        // 如果输入框有焦点则不触发
        if (document.activeElement?.tagName === 'INPUT') {
          document.activeElement.blur();
          return;
        }
        if (this.panels.overlay.classList.contains('show')) {
          this.closeSettings();
        } else {
          this.openSettings();
        }
        e.preventDefault();
      }

      // Tab：切换玩家列表
      if (e.key === 'Tab') {
        if (document.activeElement?.tagName === 'INPUT') return;
        e.preventDefault();
        if (this.panels.listOverlay.classList.contains('show')) {
          this.closePlayerList();
        } else {
          this.openPlayerList();
        }
      }

      // F1：切换开发者模式
      if (e.key === 'F1') {
        if (document.activeElement?.tagName === 'INPUT') return;
        e.preventDefault();
        if (this.panels.devOverlay.classList.contains('show')) {
          this.closeDevMode();
        } else {
          this.openDevMode();
        }
      }
    });
  }

  // ======================== 开发者模式事件 ========================
  _bindDevEvents() {
    // 速度滑块
    this.panels.devSpeed.addEventListener('input', () => {
      const val = parseFloat(this.panels.devSpeed.value);
      this.panels.devSpeedVal.textContent = val.toFixed(1);
      if (this.onDevCommand) this.onDevCommand('set_speed', val);
    });

    // 血量滑块
    this.panels.devHp.addEventListener('input', () => {
      const val = parseInt(this.panels.devHp.value);
      this.panels.devHpVal.textContent = val;
      if (this.onDevCommand) this.onDevCommand('set_hp', val);
    });

    // 攻击力滑块
    this.panels.devDmg.addEventListener('input', () => {
      const val = parseInt(this.panels.devDmg.value);
      this.panels.devDmgVal.textContent = val;
      if (this.onDevCommand) this.onDevCommand('set_damage', val);
    });

    // 按钮
    this.panels.devHealMe.addEventListener('click', () => {
      if (this.onDevCommand) this.onDevCommand('set_hp', 10000); // 发大数 = 回满
    });
    this.panels.devHealAll.addEventListener('click', () => {
      if (this.onDevCommand) this.onDevCommand('heal_all');
    });
    this.panels.devHealNpcs.addEventListener('click', () => {
      if (this.onDevCommand) this.onDevCommand('hp_all_npcs');
    });
  }

  // ======================== 开发者模式面板 ========================
  openDevMode() {
    this.panels.devOverlay.classList.add('show');
  }

  closeDevMode() {
    this.panels.devOverlay.classList.remove('show');
  }

  // ======================== 设置面板 ========================
  openSettings() {
    // 填充当前数据
    this.panels.nameInput.value = this._currentName || '';

    // 选中当前颜色
    this.panels.colorSwatches.forEach(el => {
      el.classList.toggle('selected', el.dataset.color === this._currentColor);
    });

    this.panels.overlay.classList.add('show');
  }

  closeSettings() {
    this.panels.overlay.classList.remove('show');
  }

  _saveSettings() {
    const name = this.panels.nameInput.value.trim();
    const selected = this.panels.overlay.querySelector('.ui-color-swatch.selected');
    const color = selected ? selected.dataset.color : null;

    const update = {};
    if (name && name !== this._currentName) update.name = name;
    if (color && color !== this._currentColor) update.color = color;

    if (Object.keys(update).length > 0) {
      // 本地先更新
      if (update.name) {
        this._currentName = update.name;
        localStorage.setItem('pixel-sandbox-name', update.name);
      }
      if (update.color) {
        this._currentColor = update.color;
        localStorage.setItem('pixel-sandbox-color', update.color);
      }
      // 通知游戏和网络更新
      if (this.onUpdateAppearance) this.onUpdateAppearance(update);
    }

    this.closeSettings();
  }

  // ======================== 玩家列表 ========================
  openPlayerList() {
    this._refreshPlayerList();
    this.panels.listOverlay.classList.add('show');
  }

  closePlayerList() {
    this.panels.listOverlay.classList.remove('show');
  }

  _refreshPlayerList() {
    if (!this._players && !this._npcs) return;
    // 由外部调用 refresh() 更新数据
  }

  // ======================== 外部接口 ========================

  // 初始化：从 localStorage 读取保存的名字和颜色
  init(name, color) {
    this._currentName = name || localStorage.getItem('pixel-sandbox-name') || '';
    this._currentColor = color || localStorage.getItem('pixel-sandbox-color') || PLAYER_COLORS[0];
    if (!localStorage.getItem('pixel-sandbox-color')) {
      this._currentColor = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
      localStorage.setItem('pixel-sandbox-color', this._currentColor);
    }
    return { name: this._currentName, color: this._currentColor };
  }

  // 更新本地玩家信息（网络加入后确认的名字）
  setLocal(name, color) {
    if (name) this._currentName = name;
    if (color) this._currentColor = color;
  }

  // 更新玩家列表数据
  refresh(players, npcs, localId) {
    this._players = players;
    this._npcs = npcs;

    // 玩家列表（remote players + 自己）
    const playerEntries = [];
    let playerCount = players.size + 1; // +1 表示自己

    // 把自己放在第一位
    if (this._currentName) {
      playerEntries.push(`
        <div class="ui-list-item">
          <span class="ui-dot" style="background:${this._currentColor}"></span>
          <span class="ui-list-name">${this._escape(this._currentName)}</span>
          <span class="ui-list-tag">你</span>
        </div>
      `);
    }

    for (const [id, p] of players) {
      playerEntries.push(`
        <div class="ui-list-item">
          <span class="ui-dot" style="background:${p.color}"></span>
          <span class="ui-list-name">${this._escape(p.name)}</span>
        </div>
      `);
    }
    this.panels.playerList.innerHTML = playerEntries.join('');
    this.panels.playerCount.textContent = playerCount;

    // NPC 列表
    const npcEntries = (npcs || []).map(n => `
      <div class="ui-list-item">
        <span class="ui-dot" style="background:${n.color || '#3498db'}"></span>
        <span class="ui-list-name">${this._escape(n.name)}</span>
        <span class="ui-list-npc">NPC</span>
      </div>
    `);
    this.panels.npcList.innerHTML = npcEntries.join('');
    this.panels.npcCount.textContent = (npcs || []).length;

    // 如果列表已打开，刷新显示
    if (this.panels.listOverlay.classList.contains('show')) {
      // 内容已更新
    }
  }

  _escape(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
}

export default UIManager;
