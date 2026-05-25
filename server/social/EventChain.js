// 事件涟漪传播系统 — BFS 逐层扩散事件影响
//
// 核心职责：事件发生后，将其影响从直接参与者向外逐层传播
//   Round 0: 直接参与者 — 100% impact（已在 processEvent 中处理）
//   Round 1: 一度邻居 — 以衰减后的 impact 影响旁观者
//   Round 2+: 继续衰减传播至 cutoff
//
// 文献支撑：
//   - Strander: 分层传播阈值 — 关系强度影响传播概率
//   - 独立级联模型（ICM）/ 线性阈值模型（LTM）
//   - 统计验证：intensity < 0.6 的事件不触发自发传播

const { bus, EVENTS } = require('../core/EventBus');

// ======================== 传播参数 ========================

const PROPAGATION_CONFIG = {
  // 逐层衰减系数
  layerDecay: { 1: 0.6, 2: 0.3, 3: 0.1 },

  // 按关系强度分层的传播概率（来自 Strander）
  tieredProbability: [
    { minStrength: 0.7, probability: 0.9, decay: 0.8 },
    { minStrength: 0.4, probability: 0.6, decay: 0.5 },
    { minStrength: 0.1, probability: 0.3, decay: 0.2 },
  ],

  // 最小事件强度阈值（低于此值不触发自发传播）
  minIntensityForPropagation: 0.6,

  // 最大传播层数
  maxLayers: 3,

  // 最小 impact 值（低于此值停止传播）
  minImpactCutoff: 0.02,
};

// ======================== 主类 ========================

class EventChain {
  /**
   * @param {object} deps
   * @param {RelationshipGraph} deps.graph
   * @param {EventImpactSystem} deps.impactSystem
   * @param {Map<string, NPCBrain>} deps.npcBrains
   */
  constructor({ graph, impactSystem, npcBrains }) {
    this.graph = graph;
    this.impactSystem = impactSystem;
    this.npcBrains = npcBrains;
  }

  /**
   * 从事件中心开始 BFS 涟漪传播
   *
   * @param {object} event — 原始事件对象
   * @param {object} directImpact — 对直接参与者计算的 Impact
   * @returns {object} { layers, totalAffected, spreadSummary }
   */
  propagate(event, directImpact) {
    const intensity = event.intensity || 0.5;

    // 强度不足 → 不触发自动传播
    if (intensity < PROPAGATION_CONFIG.minIntensityForPropagation) {
      return { layers: [], totalAffected: 0, spreadSummary: 'intensity below threshold' };
    }

    // 无关系图 → 无法传播
    if (!this.graph) {
      return { layers: [], totalAffected: 0, spreadSummary: 'no graph available' };
    }

    const centerNodes = this._getCenterNodes(event);
    if (centerNodes.length === 0) {
      return { layers: [], totalAffected: 0, spreadSummary: 'no center nodes' };
    }

    const visited = new Set(centerNodes);
    const layers = [];
    let totalAffected = 0;

    // BFS 队列：[{ npcId, layer, intensityDecay }]
    let queue = centerNodes.map(id => ({ npcId: id, layer: 0, intensityDecay: 1.0 }));

    for (let layer = 1; layer <= PROPAGATION_CONFIG.maxLayers; layer++) {
      const nextQueue = [];
      const layerResults = [];

      for (const { npcId } of queue) {
        // 获取当前节点的所有邻居
        const relations = this.graph.getRelationsSummary(npcId);
        if (!relations) continue;

        for (const [neighborId, rel] of Object.entries(relations)) {
          if (visited.has(neighborId)) continue;

          // 根据关系强度计算传播概率
          const absStrength = Math.max(
            Math.abs(rel.scores?.affection || 0),
            Math.abs(rel.scores?.trust || 0),
            Math.abs(rel.scores?.resentment || 0)
          );

          const tier = this._getTier(absStrength);
          if (!tier) continue; // 关系太弱 → 不传播

          // 概率判定
          if (Math.random() > tier.probability) continue;

          visited.add(neighborId);
          const decay = PROPAGATION_CONFIG.layerDecay[layer] || 0.1;

          // 为该邻居计算衰减后的 Impact
          const neighborEvent = {
            ...event,
            eventType: this._deriveEventType(event.eventType, layer),
            intensity: intensity * decay,
            participants: {
              ...event.participants,
              // 邻居不是直接目击者，但作为"听说者"
              witnesses: undefined,
            },
          };

          const brain = this.npcBrains?.get(neighborId);
          const traits = brain?.personality?.traits || {
            openness: 0.5, conscientiousness: 0.5,
            extraversion: 0.5, agreeableness: 0.5, neuroticism: 0.5,
          };

          const rippleImpact = this.impactSystem
            ? this.impactSystem.calculateImpact(neighborEvent, neighborId, traits)
            : null;

          if (rippleImpact && Math.abs(rippleImpact.stressDelta) > PROPAGATION_CONFIG.minImpactCutoff) {
            // 应用涟漪 Impact 到 NPC
            if (brain) {
              // 降级严重度（听说的事情冲击较小）
              const severityDowngrade = { 1: 0, 2: 1, 3: 2 };
              const downgrade = severityDowngrade[layer] || 2;
              for (let d = 0; d < downgrade; d++) {
                rippleImpact.severity = this._downgradeSeverity(rippleImpact.severity);
              }

              this.impactSystem.applyImpact(rippleImpact, brain);
            }

            layerResults.push({
              npcId: neighborId,
              fromNpcId: npcId,
              stressDelta: rippleImpact.stressDelta,
              severity: rippleImpact.severity?.label || 'unknown',
              memoryQuality: rippleImpact.memoryQuality?.label || 'unknown',
              relationshipStrength: absStrength,
            });

            nextQueue.push({ npcId: neighborId, layer, intensityDecay: decay });
            totalAffected++;
          }
        }
      }

      if (layerResults.length > 0) {
        layers.push({ layer, count: layerResults.length, results: layerResults });
        console.log(
          `  🌊 涟漪 Layer ${layer}: ${layerResults.length} NPCs affected ` +
          `(e.g. ${layerResults[0].npcId}: stress=${layerResults[0].stressDelta.toFixed(3)})`
        );
      }

      if (nextQueue.length === 0) break; // 传播停止
      queue = nextQueue;
    }

    if (bus && totalAffected > 0) {
      bus.emit('event-chain-propagated', {
        eventType: event.eventType,
        centerNodes,
        layers: layers.map(l => ({ layer: l.layer, count: l.count })),
        totalAffected,
      });
    }

    return {
      layers,
      totalAffected,
      spreadSummary: totalAffected > 0
        ? `ripple propagated to ${totalAffected} NPCs across ${layers.length} layers`
        : 'no propagation',
    };
  }

  // ======================== 内部方法 ========================

  /** 获取事件中心节点 */
  _getCenterNodes(event) {
    const nodes = new Set();
    const p = event.participants || {};
    if (p.actor) nodes.add(p.actor);
    if (p.target) nodes.add(p.target);
    if (p.witnesses) p.witnesses.forEach(w => nodes.add(w));
    return Array.from(nodes);
  }

  /** 根据关系强度确定传播层级 */
  _getTier(absStrength) {
    for (const tier of PROPAGATION_CONFIG.tieredProbability) {
      if (absStrength >= tier.minStrength) return tier;
    }
    return null;
  }

  /** 将直接事件类型转为间接事件类型 */
  _deriveEventType(originalType, layer) {
    const layerMapping = {
      1: {
        attacked: 'witnessed_violence',
        betrayed: 'rumor_heard',
        publicly_humiliated: 'rumor_heard',
        witnessed_violence: 'rumor_heard',
        witnessed_death: 'rumor_heard',
        secret_exposed_self: 'rumor_heard',
      },
      2: {
        attacked: 'rumor_heard',
        betrayed: 'rumor_heard',
        witnessed_violence: 'rumor_heard',
        witnessed_death: 'rumor_heard',
      },
    };

    const map = layerMapping[layer] || {};
    return map[originalType] || 'rumor_heard';
  }

  /** 降级 severity 一级 */
  _downgradeSeverity(severity) {
    const SEVERITY_ORDER = {
      TRIVIAL: 0, MINOR: 1, SIGNIFICANT: 2, MAJOR: 3, TRAUMATIC: 4, LIFE_CHANGING: 5,
    };
    const ORDER_TO_SEVERITY = ['TRIVIAL', 'MINOR', 'SIGNIFICANT', 'MAJOR', 'TRAUMATIC', 'LIFE_CHANGING'];

    const currentOrder = SEVERITY_ORDER[severity?.order !== undefined
      ? (ORDER_TO_SEVERITY[severity.order] ? severity.order : 0)
      : 0] ?? 0;
    const newOrder = Math.max(0, currentOrder - 1);
    const newKey = ORDER_TO_SEVERITY[newOrder] || 'TRIVIAL';

    // Return a simple object with the same interface as Impact.severity
    const map = {
      TRIVIAL: { order: 0, label: '微不足道' },
      MINOR: { order: 1, label: '轻微' },
      SIGNIFICANT: { order: 2, label: '显著' },
      MAJOR: { order: 3, label: '重大' },
      TRAUMATIC: { order: 4, label: '创伤性' },
      LIFE_CHANGING: { order: 5, label: '改变人生' },
    };
    return map[newKey] || map.TRIVIAL;
  }
}

module.exports = { EventChain, PROPAGATION_CONFIG };
