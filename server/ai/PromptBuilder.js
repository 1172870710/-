// Prompt 构造器 —— 将 NPC 状态组装成 LLM prompt

class PromptBuilder {
  build(npc, personality, memory, graph, world) {
    const visible = this._visibleEntities(npc, world);
    const mem = memory.getRecentForPrompt(5);

    return `你是一个游戏 NPC，请根据你的性格、记忆和当前处境做出决策。

【你的身份】
姓名：${personality.name}（ID: ${npc.id}）
职业：${personality.job}
性格：开放性 ${f(personality.traits.openness)}，尽责性 ${f(personality.traits.conscientiousness)}，外向性 ${f(personality.traits.extraversion)}，宜人性 ${f(personality.traits.agreeableness)}，神经质 ${f(personality.traits.neuroticism)}
攻击性 ${f(personality.decisionStyle.aggression)}，贪婪度 ${f(personality.decisionStyle.greed)}，忠诚度 ${f(personality.decisionStyle.loyalty)}，好奇心 ${f(personality.decisionStyle.curiosity)}
背景：${personality.backstory}

【你的当前状态】
情绪：快乐 ${f(personality.mood.happiness)}，愤怒 ${f(personality.mood.anger)}，恐惧 ${f(personality.mood.fear)}，惊讶 ${f(personality.mood.surprise)}
需求：安全 ${f(personality.needs.safety)}，社交 ${f(personality.needs.social)}，财富 ${f(personality.needs.wealth)}，权力 ${f(personality.needs.power)}

【你附近的实体】
${this._formatVisible(visible, npc.id, graph)}

【你的人生经历】
${mem.story || '暂无特别经历'}

【最近的记忆】
${this._formatRecentEvents(mem.events)}

【你当前的目标】
${npc.goal ? npc.goal : '无特定目标'}

【关于重要人物的记忆】
${this._formatTargetedMemories(memory, npc.currentTarget)}

请在以下选项中做出决定，以 JSON 格式回复（只回复 JSON，不要其他内容）：

{
  "goal": "你接下来 30 秒想达成的目标，用一句话描述",
  "action": "wander|approach|flee|talk|gift|insult|attack|ignore|guard",
  "target": "目标实体ID，无目标则为 null",
  "dialogue": "如果要说话，说什么（1-2句话），否则为空字符串 ''",
  "emotion": "happy|angry|sad|surprised|neutral",
  "reasoning": "简要说明你的决策理由（1句话）"
}

【决策指导】
- 你每次只能选择一个动作
- 如果你对某人的 trust 很低(<0.3)，不会和 ta 交易
- 如果你的 anger 很高(>0.7)，可能 insult 或 attack
- 如果你 fear 很高(>0.7)且对方 aggression 高，你会 flee
- 你的行为要符合身份和性格，不要说出现代词汇
- 这是一个中世纪奇幻世界，没有现代科技`;
  }

  // 能看到谁
  _visibleEntities(npc, world) {
    const visible = [];
    const check = (entity, type) => {
      const dx = entity.x - npc.x;
      const dy = entity.y - npc.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= 120) { // 可见范围 120 像素
        visible.push({ id: entity.id, name: entity.name, type, dist: Math.round(dist) });
      }
    };

    for (const p of world.players.values()) check(p, 'player');
    for (const n of world.npcs.values()) {
      if (n.id !== npc.id) check(n, 'npc');
    }
    return visible;
  }

  _formatVisible(visible, npcId, graph) {
    if (visible.length === 0) return '  附近没有人';
    return visible.map(v => {
      const relScores = graph.getAttitude(npcId, v.id);
      return `  - ${v.name}（ID:${v.id}, ${v.type}, 距离 ${v.dist}px），你对ta: 信任${f(relScores.trust)} 好感${f(relScores.affection)} 尊敬${f(relScores.respect)} 恐惧${f(relScores.fear)}`;
    }).join('\n');
  }

  _formatRecentEvents(events) {
    if (!events || events.length === 0) return '  暂无最近记忆';
    return events.map(m =>
      `  - ${new Date(m.time).toLocaleTimeString()} ${m.content}`
    ).join('\n');
  }

  _formatTargetedMemories(memory, targetId) {
    if (!targetId) return '  无特定关注对象';
    const rels = memory.getAbout(targetId, 3);
    if (rels.length === 0) return '  无相关记忆';
    return rels.map(m => `  - ${m.content}（重要性:${f(m.importance)}）`).join('\n');
  }
}

// 格式化 0-1 值为中文描述
function f(v) {
  if (v >= 0.8) return '很高';
  if (v >= 0.6) return '偏高';
  if (v >= 0.4) return '中等';
  if (v >= 0.2) return '偏低';
  return '很低';
}

module.exports = PromptBuilder;
