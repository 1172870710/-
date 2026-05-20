// 送礼系统 — 玩家向 NPC 赠送物品，影响关系
const { ITEMS } = require('../../shared/items');

// 不同职业 NPC 对物品的偏好
const PREFERENCES = {
  '面包师':  { bread: 0.9, apple: 0.6, flower: 0.4 },
  '铁匠':    { gem: 0.9, meat: 0.7, ring: 0.8 },
  '猎人':    { meat: 0.9, fish: 0.8, cloth: 0.5 },
  '药师':    { potion: 0.9, scroll: 0.7, flower: 0.8 },
  '商人':    { gem: 0.9, ring: 0.9, scroll: 0.7 },
  '农民':    { bread: 0.8, apple: 0.9, flower: 0.7 },
  '守卫':    { meat: 0.8, bread: 0.7, gem: 0.3 },
  '酒馆老板': { meat: 0.9, bread: 0.8, apple: 0.6 },
};

class GiftSystem {
  /**
   * @param {object} opts
   * @param {Map} opts.players — GameWorld.players
   * @param {Map} opts.npcs    — GameWorld.npcs
   * @param {Map} opts.npcBrains — GameWorld.npcBrains
   */
  constructor({ players, npcs, npcBrains }) {
    this.players = players;
    this.npcs = npcs;
    this.npcBrains = npcBrains;
  }

  /**
   * 玩家赠送礼物给 NPC
   */
  give(npcId, playerId, itemKey) {
    const npc = this.npcs.get(npcId);
    const player = this.players.get(playerId);
    if (!npc || !player) return null;

    const item = ITEMS[itemKey];
    if (!item) return { ok: false, msg: '没有这个物品' };

    const brain = this.npcBrains.get(npcId);
    if (brain) brain.onReceivedGift(playerId, player.name, item.name);

    const likeScore = this._calcLike(npc.job, itemKey);
    let reaction;
    const moodChange = {};

    if (likeScore > 0.6) {
      reaction = `${npc.name}高兴地收下了${item.name}！${['谢谢你！', '太好了！', '我很喜欢！'][Math.floor(Math.random() * 3)]}`;
      moodChange.happiness = 0.2;
      moodChange.affection = 0.15;
    } else if (likeScore > 0.3) {
      reaction = `${npc.name}收下了${item.name}。${['嗯，谢谢。', '哦，好的。', '放那吧。'][Math.floor(Math.random() * 3)]}`;
      moodChange.happiness = 0.05;
    } else {
      reaction = `${npc.name}皱了皱眉：${['这个...不太需要。', '你留着自己用吧。', '呃，我不喜欢这个。'][Math.floor(Math.random() * 3)]}`;
      moodChange.happiness = -0.05;
      moodChange.affection = -0.05;
    }

    return { ok: true, reaction, moodChange, itemName: item.name };
  }

  _calcLike(job, itemKey) {
    const pref = PREFERENCES[job];
    if (pref && pref[itemKey] !== undefined) return pref[itemKey];
    return 0.5; // 默认中立
  }
}

module.exports = GiftSystem;
