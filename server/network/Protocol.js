// 消息协议定义 — 服务端和 Godot 客户端共用
// 所有消息格式：{ type: string, data: object }

const MSG = {
  // === 客户端 → 服务端 ===
  PLAYER_JOIN:      'player-join',      // { name, color }
  PLAYER_MOVE:      'player-move',       // { x, y, dir, moving }
  PLAYER_UPDATE:    'player-update',     // { name?, color? }
  NPC_INTERACT:     'npc-interact',      // { npcId, type, text?, itemKey?, quantity? }
  PLAYER_ATTACK:    'player-attack',     // { dir }
  DEV_COMMAND:      'dev-command',       // { cmd, value? }
  CHAT_SEND:        'chat-send',         // { text }

  // === 服务端 → 客户端 ===
  INIT_DONE:        'init-done',         // { yourId, world, gold }
  ENTITIES_UPDATE:  'entities-update',   // { players, npcs }
  PLAYER_JOINED:    'player-joined',     // { id, name, x, y, ... }
  PLAYER_LEFT:      'player-left',       // { id }
  PLAYER_UPDATED:   'player-updated',    // { id, name, color }
  NPC_INTERACT_RESP: 'npc-interact-response', // { ok, type, ... }
  ATTACK_RESULT:    'attack-result',     // { hit, damage, targetId, msg?, ... }
  ATTACKED:         'attacked',          // { attackerId, attackerName, damage, myHp, myMaxHp }
  NPC_DIALOGUE:     'npc-dialogue',      // { npcId, npcName, npcX, npcY, text }
  CHAT_BROADCAST:   'chat-broadcast',    // { fromId, fromName, text, time }
  DEV_UPDATE:       'dev-update',        // { hp?, customSpeed?, customDamage?, msg? }
  ERROR:            'error',             // { msg }
};

module.exports = { MSG };
