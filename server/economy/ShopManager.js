// 商店交易系统 — 玩家与 NPC 之间的买卖
const { ITEMS } = require('../../shared/items');

class ShopManager {
  /**
   * @param {object} opts
   * @param {Map} opts.players — GameWorld.players
   * @param {Map} opts.npcs    — GameWorld.npcs
   */
  constructor({ players, npcs }) {
    this.players = players;
    this.npcs = npcs;
  }

  /** 获取 NPC 商店（给客户端） */
  getShop(npcId) {
    const npc = this.npcs.get(npcId);
    return npc ? npc.getShopForClient() : null;
  }

  /** 获取玩家金币 */
  getPlayerGold(playerId) {
    const player = this.players.get(playerId);
    return player ? player.gold : 0;
  }

  /** 玩家从 NPC 购买 */
  buy(npcId, playerId, itemKey, quantity = 1) {
    const npc = this.npcs.get(npcId);
    const player = this.players.get(playerId);
    if (!npc || !player) return null;

    const item = npc.shop[itemKey];
    if (!item || item.stock < quantity) {
      return { ok: false, msg: `${item ? '库存不足' : '没有这个物品'}` };
    }

    const totalPrice = item.price * quantity;
    if (player.gold < totalPrice) {
      return { ok: false, msg: `金币不足（需要 ${totalPrice} 金币）` };
    }

    player.gold -= totalPrice;
    item.stock -= quantity;

    return {
      ok: true,
      msg: `购买了 ${item.name} ×${quantity}，花费 ${totalPrice} 金币`,
      itemName: item.name, quantity, cost: totalPrice,
    };
  }

  /** 玩家向 NPC 出售 */
  sell(npcId, playerId, itemKey, quantity = 1) {
    const npc = this.npcs.get(npcId);
    const player = this.players.get(playerId);
    if (!npc || !player) return null;

    const itemDef = ITEMS[itemKey];
    if (!itemDef) return { ok: false, msg: '无效物品' };

    const sellPrice = Math.floor(itemDef.price * 0.5) * quantity;
    if (sellPrice <= 0) return { ok: false, msg: '这个不值钱' };

    player.gold += sellPrice;

    return {
      ok: true,
      msg: `出售了 ${itemDef.name} ×${quantity}，获得 ${sellPrice} 金币`,
      itemName: itemDef.name, quantity, gain: sellPrice,
    };
  }
}

module.exports = ShopManager;
