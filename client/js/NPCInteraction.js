// NPC 交互 —— 对话、赠送、交易
class NPCInteraction {
  constructor(network) {
    this.network = network;
    this.currentNPC = null;   // 当前交互的 NPC 数据
    this.currentTab = 'talk'; // talk | gift | shop
    this._el = {};
    this._createUI();
    this._bindEvents();
  }

  _createUI() {
    // 主遮罩层
    const overlay = document.createElement('div');
    overlay.className = 'npc-overlay';
    overlay.innerHTML = `
      <div class="npc-panel">
        <div class="npc-header">
          <span class="npc-name"></span>
          <span class="npc-job"></span>
          <button class="npc-close">✕</button>
        </div>
        <div class="npc-tabs">
          <button class="npc-tab active" data-tab="talk">💬 对话</button>
          <button class="npc-tab" data-tab="gift">🎁 赠送</button>
          <button class="npc-tab" data-tab="shop">🏪 商店</button>
        </div>
        <div class="npc-body">
          <!-- 对话面板 -->
          <div class="npc-tab-content active" id="npc-talk">
            <div class="npc-chat-log" id="npc-chat-log">
              <div class="npc-chat-msg npc-msg">
                <span class="npc-msg-name"></span>
                <span class="npc-msg-text">你好，找我有什么事？</span>
              </div>
            </div>
            <div class="npc-chat-input-row">
              <input type="text" class="npc-chat-input" id="npc-chat-input" placeholder="输入想说的话..." maxlength="80">
              <button class="npc-chat-send" id="npc-chat-send">发送</button>
            </div>
          </div>

          <!-- 赠送面板 -->
          <div class="npc-tab-content" id="npc-gift">
            <div class="npc-gift-hint">选择要赠送的物品：</div>
            <div class="npc-gift-list" id="npc-gift-list"></div>
            <div class="npc-gift-result" id="npc-gift-result"></div>
          </div>

          <!-- 商店面板 -->
          <div class="npc-tab-content" id="npc-shop">
            <div class="npc-shop-header">金币: <span class="npc-gold" id="npc-gold">0</span> 🪙</div>
            <div class="npc-shop-list" id="npc-shop-list"></div>
            <div class="npc-shop-result" id="npc-shop-result"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    this._el = {
      overlay,
      panel: overlay.querySelector('.npc-panel'),
      name: overlay.querySelector('.npc-name'),
      job: overlay.querySelector('.npc-job'),
      close: overlay.querySelector('.npc-close'),
      tabs: overlay.querySelectorAll('.npc-tab'),
      chatLog: overlay.querySelector('#npc-chat-log'),
      chatInput: overlay.querySelector('#npc-chat-input'),
      chatSend: overlay.querySelector('#npc-chat-send'),
      giftList: overlay.querySelector('#npc-gift-list'),
      giftResult: overlay.querySelector('#npc-gift-result'),
      shopList: overlay.querySelector('#npc-shop-list'),
      shopResult: overlay.querySelector('#npc-shop-result'),
      gold: overlay.querySelector('#npc-gold'),
    };
  }

  _bindEvents() {
    // 关闭按钮
    this._el.close.addEventListener('click', () => this.close());
    this._el.overlay.addEventListener('click', (e) => {
      if (e.target === this._el.overlay) this.close();
    });

    // Tab 切换
    this._el.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this._switchTab(tab.dataset.tab);
      });
    });

    // 聊天发送
    this._el.chatSend.addEventListener('click', () => this._sendTalk());
    this._el.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._sendTalk();
    });

    // 网络回调
    this.network.onNPCInteractResponse = (data) => this._handleResponse(data);
  }

  // ======================== 打开 / 关闭 ========================
  open(npcData) {
    this.currentNPC = npcData;
    this.currentTab = 'talk';

    this._el.name.textContent = npcData.name || '???';
    this._el.job.textContent = npcData.job ? `(${npcData.job})` : '';
    this._el.chatLog.innerHTML = '';
    this._el.chatInput.value = '';
    this._el.giftResult.textContent = '';
    this._el.shopResult.textContent = '';

    // 重置到对话面板
    this._switchTab('talk');

    // 第一次打开时发送打招呼
    this._sendTalk('你好');

    this._el.overlay.classList.add('show');
    setTimeout(() => this._el.chatInput.focus(), 300);
  }

  close() {
    this._el.overlay.classList.remove('show');
    this.currentNPC = null;
  }

  // ======================== Tab 切换 ========================
  _switchTab(tabName) {
    this.currentTab = tabName;
    this._el.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    document.querySelectorAll('.npc-tab-content').forEach(c => c.classList.remove('active'));
    const target = document.getElementById(`npc-${tabName}`);
    if (target) target.classList.add('active');

    // 切到商店时加载商品
    if (tabName === 'shop' && this.currentNPC) {
      this._loadShop();
    }
    // 切到赠送时加载物品
    if (tabName === 'gift' && this.currentNPC) {
      this._loadGiftList();
    }
  }

  // ======================== 对话 ========================
  _sendTalk(text) {
    const msg = text || this._el.chatInput.value.trim();
    if (!msg || !this.currentNPC) return;

    if (!text) this._el.chatInput.value = '';

    // 显示玩家说的话
    this._addChatMsg('你', msg, 'player-msg');

    // 发送给服务器
    this.network.sendNPCInteract({
      npcId: this.currentNPC.id,
      type: 'talk',
      text: msg,
    });
  }

  _addChatMsg(name, text, className = '') {
    const div = document.createElement('div');
    div.className = `npc-chat-msg ${className}`;
    div.innerHTML = `<span class="npc-msg-name">${name}:</span> <span class="npc-msg-text">${this._escape(text)}</span>`;
    this._el.chatLog.appendChild(div);
    this._el.chatLog.scrollTop = this._el.chatLog.scrollHeight;
  }

  // ======================== 赠送 ========================
  _loadGiftList() {
    // 玩家目前可赠送的物品（硬编码，后续扩展）
    const gifts = [
      { key: 'flower', name: '🌸 花束', desc: '美丽的花束' },
      { key: 'bread', name: '🍞 面包', desc: '香喷喷的面包' },
      { key: 'apple', name: '🍎 苹果', desc: '新鲜的红苹果' },
      { key: 'gem', name: '💎 宝石', desc: '闪亮的宝石' },
      { key: 'potion', name: '🧪 药水', desc: '治疗药水' },
      { key: 'ring', name: '💍 戒指', desc: '精致的银戒指' },
    ];

    this._el.giftList.innerHTML = gifts.map(g => `
      <button class="npc-gift-btn" data-item="${g.key}">
        ${g.name}
        <small>${g.desc}</small>
      </button>
    `).join('');

    this._el.giftList.querySelectorAll('.npc-gift-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!this.currentNPC) return;
        this._el.giftResult.innerHTML = '发送中...';
        this.network.sendNPCInteract({
          npcId: this.currentNPC.id,
          type: 'gift',
          itemKey: btn.dataset.item,
        });
      });
    });
  }

  // ======================== 商店 ========================
  _loadShop() {
    if (!this.currentNPC) return;
    this._el.shopList.innerHTML = '<div class="npc-loading">加载中...</div>';
    this.network.sendNPCInteract({
      npcId: this.currentNPC.id,
      type: 'shop',
    });
  }

  _renderShop(shop, gold) {
    this._el.gold.textContent = gold;

    if (!shop || Object.keys(shop).length === 0) {
      this._el.shopList.innerHTML = '<div class="npc-empty">今天没有货物</div>';
      return;
    }

    this._el.shopList.innerHTML = Object.entries(shop).map(([key, item]) => `
      <div class="npc-shop-item">
        <div class="npc-item-info">
          <span class="npc-shop-emoji">${item.emoji}</span>
          <span class="npc-shop-name">${item.name}</span>
          <span class="npc-shop-price">${item.price}🪙</span>
          <span class="npc-shop-stock">库存: ${item.stock}</span>
        </div>
        <button class="npc-buy-btn" data-item="${key}" ${item.stock <= 0 ? 'disabled' : ''}>
          ${item.stock > 0 ? '购买' : '售罄'}
        </button>
      </div>
    `).join('');

    this._el.shopList.querySelectorAll('.npc-buy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!this.currentNPC) return;
        this._el.shopResult.innerHTML = '处理中...';
        this.network.sendNPCInteract({
          npcId: this.currentNPC.id,
          type: 'buy',
          itemKey: btn.dataset.item,
          quantity: 1,
        });
      });
    });
  }

  // ======================== 回复处理 ========================
  _handleResponse(data) {
    if (!data || !this.currentNPC) return;

    switch (data.type) {
      case 'talk':
        const npcName = data.npcName || this.currentNPC.name || 'NPC';
        this._addChatMsg(npcName, data.text);
        this._el.chatInput.focus();
        break;

      case 'gift':
        if (data.reaction) {
          this._el.giftResult.innerHTML = `<div class="npc-gift-reaction">${data.reaction}</div>`;
        } else {
          this._el.giftResult.innerHTML = `<div class="npc-gift-reaction npc-error">${data.msg || '赠送失败'}</div>`;
        }
        break;

      case 'shop':
        this._renderShop(data.shop, data.gold);
        break;

      case 'buy':
      case 'sell':
        this._el.shopResult.innerHTML = `<div class="${data.ok ? 'npc-ok' : 'npc-error'}">${data.msg}</div>`;
        if (data.gold !== undefined) this._el.gold.textContent = data.gold;
        // 刷新商店
        if (data.ok) setTimeout(() => this._loadShop(), 800);
        break;
    }
  }

  _escape(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
}

export default NPCInteraction;
