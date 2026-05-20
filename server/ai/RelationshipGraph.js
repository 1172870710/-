// 关系图谱 —— 记录所有实体对之间的关系

class RelationshipGraph {
  constructor() {
    // Map<"entityId1->entityId2", RelationshipData>
    this.edges = new Map();
  }

  // 标准化键（双向排序，保证 A->B 和 B->A 同一条边，但数据相反）
  _key(a, b) {
    return [a, b].sort().join('->');
  }

  // 获取关系数据 a 对 b 的态度 [trust, affection, respect, fear]
  get(aId, bId) {
    return this.edges.get(this._key(aId, bId));
  }

  // 初始化中性关系
  init(aId, bId) {
    const key = this._key(aId, bId);
    if (!this.edges.has(key)) {
      this.edges.set(key, {
        pair: [aId, bId],
        // a 对 b, b 对 a（分别存储）
        [aId]: { trust: 0.3, affection: 0.3, respect: 0.3, fear: 0.1 },
        [bId]: { trust: 0.3, affection: 0.3, respect: 0.3, fear: 0.1 },
        history: [],
      });
    }
  }

  // 获取 from 对 to 的态度分
  getAttitude(fromId, toId) {
    const data = this.get(fromId, toId);
    if (!data) return { trust: 0.3, affection: 0.3, respect: 0.3, fear: 0.1 };
    return data[fromId] || { trust: 0.3, affection: 0.3, respect: 0.3, fear: 0.1 };
  }

  // 调整关系分
  adjust(fromId, toId, changes, event) {
    this.init(fromId, toId);
    const data = this.get(fromId, toId);

    const scores = data[fromId];
    scores.trust     = clamp(scores.trust + (changes.trust || 0), -1, 1);
    scores.affection = clamp(scores.affection + (changes.affection || 0), -1, 1);
    scores.respect   = clamp(scores.respect + (changes.respect || 0), -1, 1);
    scores.fear      = clamp(scores.fear + (changes.fear || 0), 0, 1);

    if (event) {
      data.history.push({ time: Date.now(), from: fromId, to: toId, event, changes });
      // 保留最近 20 条
      if (data.history.length > 20) data.history.shift();
    }
  }

  // 获取所有与 entityId 相关的关系摘要
  getRelationsSummary(entityId) {
    const summary = {};
    for (const [, data] of this.edges) {
      const other = data.pair[0] === entityId ? data.pair[1] : data.pair[0];
      if (data[entityId]) {
        summary[other] = data[entityId];
      }
    }
    return summary;
  }

  // 获取某人对其他人的态度列表（按好感排序）
  getTopRelations(entityId, n = 5) {
    const rels = [];
    for (const [, data] of this.edges) {
      const other = data.pair[0] === entityId ? data.pair[1] : data.pair[0];
      if (data[entityId]) {
        rels.push({ targetId: other, scores: data[entityId] });
      }
    }
    rels.sort((a, b) => b.scores.affection - a.scores.affection);
    return rels.slice(0, n);
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

module.exports = RelationshipGraph;
