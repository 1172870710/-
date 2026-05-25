// 秘密系统 — 秘密持有、传播与揭发状态机
//
// 核心职责：
//   1. 管理秘密的创建与持有（谁知道了什么、知道多少）
//   2. 计算传播动机（基于人格 + 压力 + 关系）
//   3. 周期性传播扫描（秘密在社交网络中扩散）
//   4. 秘密揭发与后果
//
// 文献支撑：
//   - O'Connor: "assumed knowledge" — NPC 对社会关系的主观认知
//   - Strander: 分层传播阈值 — 关系强度影响传播概率
//   - 信息扩散模型（ICM/LTM）

// ======================== 常量 ========================

const KNOWLEDGE_LEVEL = {
  FULL:     { order: 4, label: '全知',     desc: '知道全部真相',           spreadWeight: 1.0 },
  PARTIAL:  { order: 3, label: '部分知情', desc: '知道关键细节',           spreadWeight: 0.8 },
  FRAGMENT: { order: 2, label: '碎片信息', desc: '只知道某个片段',         spreadWeight: 0.5 },
  RUMOR:    { order: 1, label: '传闻',     desc: '道听途说，可能不准确',   spreadWeight: 0.3 },
};

const SPREAD_TRIGGER_THRESHOLD = 0.5; // spreadMotivation > 0.5 → 可能传播

// ======================== 主类 ========================

class SecretSystem {
  /**
   * @param {object} [deps]
   * @param {RelationshipGraph} [deps.graph]
   * @param {Map<string, NPCInternalState>} [deps.internalStates]
   */
  constructor({ graph, internalStates } = {}) {
    this.graph = graph || null;
    this.internalStates = internalStates || null;

    // Map<secretId, Secret>
    this.secrets = new Map();
    this._secretCounter = 0;

    // 上次传播扫描时间
    this._lastPropagationTick = 0;
    this._propagationInterval = 60000; // 每 60 秒扫描一次
  }

  // ======================== 秘密创建 ========================

  /**
   * 创建一个新秘密
   * @param {object} opts
   *   content: string      — 秘密内容描述
   *   creatorId: string    — 创建者/事件源头
   *   initialHolders: Array<{ npcId, knowledgeLevel }> — 初始知情者
   *   relatedEventId: string — 关联事件
   * @returns {string} secretId
   */
  create({ content, creatorId, initialHolders, relatedEventId }) {
    const id = `secret_${++this._secretCounter}`;
    const now = Date.now();

    const holders = new Map();
    if (initialHolders) {
      for (const h of initialHolders) {
        holders.set(h.npcId, {
          knowledgeLevel: h.knowledgeLevel || 'FULL',
          learnedAt: now,
          learnedFrom: h.learnedFrom || creatorId,
          spreadMotivation: 0,
          hasSpread: false,
          spreadTo: [],
        });
      }
    }

    this.secrets.set(id, {
      id,
      content,
      creatorId,
      createdAt: now,
      isRevealed: false,
      revealedAt: null,
      revealedBy: null,
      holders,
      spreadHistory: [],
      relatedEventIds: relatedEventId ? [relatedEventId] : [],
    });

    console.log(`  🔒 秘密创建 [${id}]: ${content.substring(0, 40)}... (${holders.size} 知情者)`);
    return id;
  }

  /**
   * 向秘密添加新的知情者
   * @param {string} secretId
   * @param {string} npcId
   * @param {string} knowledgeLevel — FULL|PARTIAL|FRAGMENT|RUMOR
   * @param {string} learnedFrom — 从谁那里得知
   */
  addHolder(secretId, npcId, knowledgeLevel, learnedFrom) {
    const secret = this.secrets.get(secretId);
    if (!secret) return false;

    if (secret.holders.has(npcId)) {
      // 已知情 → 可能升级知情程度
      const existing = secret.holders.get(npcId);
      if (KNOWLEDGE_LEVEL[knowledgeLevel]?.order > KNOWLEDGE_LEVEL[existing.knowledgeLevel]?.order) {
        existing.knowledgeLevel = knowledgeLevel;
        existing.learnedFrom = learnedFrom;
        existing.learnedAt = Date.now();
      }
      return true;
    }

    secret.holders.set(npcId, {
      knowledgeLevel: knowledgeLevel || 'FRAGMENT',
      learnedAt: Date.now(),
      learnedFrom: learnedFrom || 'unknown',
      spreadMotivation: 0,
      hasSpread: false,
      spreadTo: [],
    });

    secret.spreadHistory.push({
      from: learnedFrom,
      to: npcId,
      when: Date.now(),
      level: knowledgeLevel || 'FRAGMENT',
    });

    return true;
  }

  // ======================== 传播动机计算 ========================

  /**
   * 计算某个知情者对某个秘密的传播动机
   * 高 → 容易说出去（主动或无意）
   *
   * @param {string} npcId
   * @param {string} secretId
   * @returns {number} 0~1
   */
  calculateSpreadMotivation(npcId, secretId) {
    const secret = this.secrets.get(secretId);
    if (!secret) return 0;

    const holder = secret.holders.get(npcId);
    if (!holder) return 0;

    const internalState = this.internalStates?.get(npcId);
    const traits = internalState ? null : null; // traits 从 internalState 间接获取

    let motivation = 0.3; // 基线

    // 因素 1: 人格（通过 internalState 的反应风格推断）
    if (internalState) {
      const style = internalState.reactionStyle;
      if (style === 'EXPLOSIVE') motivation += 0.15; // 藏不住话
      if (style === 'COLD') motivation -= 0.1;       // 能守住秘密
      if (style === 'STOIC') motivation -= 0.15;     // 嘴很严
    }

    // 因素 2: 压力 → 高压下容易说漏嘴
    if (internalState) {
      motivation += internalState.stress * 0.3;
      if (internalState.psychState === 'PARANOID' || internalState.psychState === 'BREAKDOWN') {
        motivation += 0.15;
      }
    }

    // 因素 3: 知情程度
    motivation += (KNOWLEDGE_LEVEL[holder.knowledgeLevel]?.spreadWeight || 0.5) * 0.15;

    // 因素 4: 是否已经传播过（说过一次的人更容易再说）
    if (holder.hasSpread) motivation += 0.1;

    // 因素 5: 社交需求（高社交需求 → 更爱分享信息）
    if (internalState?.desires?.social > 0.6) motivation += 0.1;

    return Math.min(1, Math.max(0, motivation));
  }

  // ======================== 传播选择 ========================

  /**
   * 为某个知情者选择传播目标
   * 原则：最亲近的人 > 涉事者的敌人（如果 holder 恨涉事者）
   *
   * @param {string} npcId — 持有者
   * @param {string} secretId
   * @returns {string|null} 目标 NPC ID 或 null
   */
  selectSpreadTarget(npcId, secretId) {
    const secret = this.secrets.get(secretId);
    if (!secret || !this.graph) return null;

    // 收集所有可能的目标（NPC 和 玩家）
    const candidates = [];

    // 从关系图获取所有已建立的关系
    const relations = this.graph.getRelationsSummary(npcId);
    if (!relations) return null;

    for (const [targetId, rel] of Object.entries(relations)) {
      // 跳过自己
      if (targetId === npcId) continue;
      // 跳过已持有此秘密的人
      if (secret.holders.has(targetId)) continue;

      // 计算目标吸引力
      let score = 0;

      // 亲近度：高 affection + 高 trust → 首选倾诉对象
      const bondScore = (rel.scores?.affection || 0) + (rel.scores?.trust || 0);
      score += bondScore * 0.5; // 亲近的人传播概率高

      // 如果是涉事者的敌人，而 holder 也恨涉事者 → 传播倾向上升
      // 这里简化为：holder resentment 高 → 更愿向任何人传播
      const holderEntry = secret.holders.get(npcId);
      if (holderEntry && holderEntry.spreadMotivation > 0.6) {
        score += 0.2;
      }

      // 随机偏差（很小的随机量，打破全确定性行为）
      score += Math.random() * 0.2;

      if (score > 0.2) {
        candidates.push({ npcId: targetId, score });
      }
    }

    if (candidates.length === 0) return null;

    // 按分数降序排列，选择最高分的目标
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].npcId;
  }

  // ======================== 周期性传播 ========================

  /**
   * 传播扫描 — 遍历所有秘密的所有持有者，决定是否传播
   * 应在 DramaEngine 或 GameLoop 中定期调用
   *
   * @returns {Array} 本轮传播记录 [{ secretId, from, to, level }]
   */
  propagateTick() {
    const now = Date.now();
    if (now - this._lastPropagationTick < this._propagationInterval) return [];
    this._lastPropagationTick = now;

    const spreads = [];

    for (const [secretId, secret] of this.secrets) {
      if (secret.isRevealed) continue; // 已公开的秘密不需要传播

      for (const [holderId, holder] of secret.holders) {
        if (holder.hasSpread) continue; // 只传播一次（可改为可多次传播）

        // 重新计算传播动机
        holder.spreadMotivation = this.calculateSpreadMotivation(holderId, secretId);

        // 动机超过阈值 → 寻找传播目标
        if (holder.spreadMotivation > SPREAD_TRIGGER_THRESHOLD) {
          const target = this.selectSpreadTarget(holderId, secretId);
          if (target) {
            // 传播：目标获得 FRAGMENT 级知情
            const level = holder.spreadMotivation > 0.7 ? 'PARTIAL' : 'FRAGMENT';
            this.addHolder(secretId, target, level, holderId);
            holder.hasSpread = true;
            holder.spreadTo.push(target);

            spreads.push({
              secretId,
              secretContent: secret.content.substring(0, 30),
              from: holderId,
              to: target,
              level,
              motivation: holder.spreadMotivation.toFixed(2),
            });

            console.log(
              `  🗣️ 秘密传播: ${holderId} → ${target} ` +
              `[${level}] motivation=${holder.spreadMotivation.toFixed(2)}`
            );
          }
        }
      }
    }

    if (spreads.length > 0) {
      console.log(`  🗣️ SecretSystem: 本轮 ${spreads.length} 次传播`);
    }

    return spreads;
  }

  // ======================== 揭发 ========================

  /**
   * 公开揭发秘密
   * @param {string} secretId
   * @param {string} revealedBy — 揭发者 ID
   * @returns {object} { success, affectedNPCs[] }
   */
  reveal(secretId, revealedBy) {
    const secret = this.secrets.get(secretId);
    if (!secret || secret.isRevealed) return { success: false, affectedNPCs: [] };

    secret.isRevealed = true;
    secret.revealedAt = Date.now();
    secret.revealedBy = revealedBy;

    // 所有相关 NPC（持有者 + 关系图中与秘密参与者有关系的）
    const affected = Array.from(secret.holders.keys());

    console.log(
      `  📢 秘密被揭发 [${secretId}]: ${secret.content.substring(0, 40)}... ` +
      `揭发者=${revealedBy} 受影响=${affected.length}人`
    );

    return { success: true, affectedNPCs: affected, secret };
  }

  // ======================== 查询接口 ========================

  /** 获取某个 NPC 知道的所有秘密 */
  getKnownSecrets(npcId) {
    const known = [];
    for (const [id, secret] of this.secrets) {
      if (secret.holders.has(npcId)) {
        const holder = secret.holders.get(npcId);
        known.push({
          secretId: id,
          content: secret.content,
          knowledgeLevel: holder.knowledgeLevel,
          knowledgeLabel: KNOWLEDGE_LEVEL[holder.knowledgeLevel]?.label || '未知',
          learnedFrom: holder.learnedFrom,
          isRevealed: secret.isRevealed,
        });
      }
    }
    return known;
  }

  /** 获取即将泄露的秘密（持有者中 spreadMotivation 最高的） */
  getVolatileSecrets() {
    const volatile = [];
    for (const [id, secret] of this.secrets) {
      if (secret.isRevealed) continue;
      const holders = Array.from(secret.holders.entries())
        .filter(([, h]) => !h.hasSpread && h.spreadMotivation > 0.4)
        .map(([npcId, h]) => ({
          npcId,
          spreadMotivation: h.spreadMotivation,
          knowledgeLevel: h.knowledgeLevel,
        }))
        .sort((a, b) => b.spreadMotivation - a.spreadMotivation);

      if (holders.length > 0) {
        volatile.push({ secretId: id, content: secret.content, holders });
      }
    }
    return volatile.sort((a, b) => b.holders[0].spreadMotivation - a.holders[0].spreadMotivation);
  }

  /** 获取所有秘密的概要（调试用） */
  getDebug() {
    const summary = [];
    for (const [, secret] of this.secrets) {
      summary.push({
        id: secret.id,
        content: secret.content.substring(0, 50),
        holderCount: secret.holders.size,
        isRevealed: secret.isRevealed,
        spreadCount: secret.spreadHistory.length,
      });
    }
    return summary;
  }

  // ======================== 存档 ========================

  toSnapshot() {
    const data = {};
    for (const [id, secret] of this.secrets) {
      data[id] = {
        id: secret.id,
        content: secret.content,
        creatorId: secret.creatorId,
        createdAt: secret.createdAt,
        isRevealed: secret.isRevealed,
        revealedAt: secret.revealedAt,
        revealedBy: secret.revealedBy,
        holders: Array.from(secret.holders.entries()).map(([npcId, h]) => [
          npcId,
          {
            knowledgeLevel: h.knowledgeLevel,
            learnedAt: h.learnedAt,
            learnedFrom: h.learnedFrom,
            spreadMotivation: h.spreadMotivation,
            hasSpread: h.hasSpread,
            spreadTo: [...h.spreadTo],
          },
        ]),
        spreadHistory: secret.spreadHistory.map(h => ({ ...h })),
        relatedEventIds: [...secret.relatedEventIds],
      };
    }
    return data;
  }

  fromSnapshot(data) {
    if (!data) return;
    this.secrets.clear();
    for (const [id, snap] of Object.entries(data)) {
      const holders = new Map();
      for (const [npcId, h] of (snap.holders || [])) {
        holders.set(npcId, { ...h });
      }
      this.secrets.set(id, {
        ...snap,
        holders,
      });
    }
    // 恢复计数器
    const maxId = Object.keys(data)
      .map(k => parseInt(k.replace('secret_', '')))
      .filter(n => !isNaN(n))
      .reduce((max, n) => Math.max(max, n), 0);
    this._secretCounter = maxId;
  }
}

module.exports = { SecretSystem, KNOWLEDGE_LEVEL, SPREAD_TRIGGER_THRESHOLD };
