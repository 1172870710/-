// Prompt 构造器 —— 将 NPC 状态组装成 LLM prompt

class PromptBuilder {
  build(npc, personality, memory, graph, world, internalState) {
    const visible = this._visibleEntities(npc, world);
    const mem = memory.getRecentForPrompt(5);
    const innerText = this._formatInternalState(internalState);
    const psychGuidance = this._formatPsychGuidance(internalState);

    return '你是一个游戏 NPC，请根据你的性格、记忆和当前处境做出决策。\n' +
      '\n' +
      '【你的身份】\n' +
      '姓名：' + personality.name + '（ID: ' + npc.id + '）\n' +
      '职业：' + personality.job + '\n' +
      '性格：开放性 ' + f(personality.traits.openness) + '，尽责性 ' + f(personality.traits.conscientiousness) + '，外向性 ' + f(personality.traits.extraversion) + '，宜人性 ' + f(personality.traits.agreeableness) + '，神经质 ' + f(personality.traits.neuroticism) + '\n' +
      '攻击性 ' + f(personality.decisionStyle.aggression) + '，贪婪度 ' + f(personality.decisionStyle.greed) + '，忠诚度 ' + f(personality.decisionStyle.loyalty) + '，好奇心 ' + f(personality.decisionStyle.curiosity) + '\n' +
      '背景：' + personality.backstory + '\n' +
      '\n' +
      '【你的当前状态】\n' +
      '情绪：快乐 ' + f(personality.mood.happiness) + '，愤怒 ' + f(personality.mood.anger) + '，恐惧 ' + f(personality.mood.fear) + '，惊讶 ' + f(personality.mood.surprise) + '\n' +
      '需求：安全 ' + f(personality.needs.safety) + '，社交 ' + f(personality.needs.social) + '，财富 ' + f(personality.needs.wealth) + '，权力 ' + f(personality.needs.power) + '\n' +
      innerText +
      '\n' +
      '【你附近的实体】\n' +
      this._formatVisible(visible, npc.id, graph) + '\n' +
      '\n' +
      '【你的人生经历】\n' +
      (mem.story || '暂无特别经历') + '\n' +
      '\n' +
      '【最近的记忆】\n' +
      this._formatRecentEvents(mem.events) + '\n' +
      '\n' +
      '【你当前的目标】\n' +
      (npc.goal ? npc.goal : '无特定目标') + '\n' +
      '\n' +
      '【关于重要人物的记忆】\n' +
      this._formatTargetedMemories(memory, npc.currentTarget) + '\n' +
      '\n' +
      '请在以下选项中做出决定，以 JSON 格式回复（只回复 JSON，不要其他内容）：\n' +
      '\n' +
      '{\n' +
      '  "goal": "你接下来 30 秒想达成的目标，用一句话描述",\n' +
      '  "action": "wander|approach|flee|talk|gift|insult|attack|ignore|guard",\n' +
      '  "target": "目标实体ID，无目标则为 null",\n' +
      '  "dialogue": "如果要说话，说什么（1-2句话），否则为空字符串 \'\'",\n' +
      '  "emotion": "happy|angry|sad|surprised|neutral",\n' +
      '  "reasoning": "简要说明你的决策理由（1句话）"\n' +
      '}\n' +
      '\n' +
      '【决策指导】\n' +
      '- 你每次只能选择一个动作\n' +
      '- 如果你对某人的 trust 很低(<0.3)，不会和 ta 交易\n' +
      '- 如果你的 anger 很高(>0.7)，可能 insult 或 attack\n' +
      '- 如果你 fear 很高(>0.7)且对方 aggression 高，你会 flee\n' +
      psychGuidance +
      '- 你的行为要符合身份和性格，不要说出现代词汇\n' +
      '- 这是一个中世纪奇幻世界，没有现代科技';
  }

  // 能看到谁
  _visibleEntities(npc, world) {
    const visible = [];
    const check = (entity, type) => {
      const dx = entity.x - npc.x;
      const dy = entity.y - npc.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= 120) {
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
      const relState = graph.getRelationState(npcId, v.id);
      let extra = '';
      if (relScores.jealousy > 0.3)   extra += ' 嫉妒' + f(relScores.jealousy);
      if (relScores.resentment > 0.3) extra += ' 怨恨' + f(relScores.resentment);
      if (Math.abs(relScores.debt) > 0.3) extra += ' 亏欠' + f(relScores.debt);
      if (relScores.suspicion > 0.4)  extra += ' 怀疑' + f(relScores.suspicion);
      return '  - ' + v.name + '（ID:' + v.id + ', ' + v.type + ', 距离 ' + v.dist + 'px, ' + relState.label + '），你对ta: 信任' + f(relScores.trust) + ' 好感' + f(relScores.affection) + ' 尊敬' + f(relScores.respect) + ' 恐惧' + f(relScores.fear) + extra;
    }).join('\n');
  }

  _formatRecentEvents(events) {
    if (!events || events.length === 0) return '  暂无最近记忆';
    return events.map(m =>
      '  - ' + new Date(m.time).toLocaleTimeString() + ' ' + m.content
    ).join('\n');
  }

  _formatTargetedMemories(memory, targetId) {
    if (!targetId) return '  无特定关注对象';
    const rels = memory.getAbout(targetId, 3);
    if (rels.length === 0) return '  无相关记忆';
    return rels.map(m => '  - ' + m.content + '（重要性:' + f(m.importance) + '）').join('\n');
  }

  /** 格式化内心状态为 prompt 片段 */
  _formatInternalState(internalState) {
    if (!internalState) return '';
    const s = internalState.getSummary();
    const lines = [];
    lines.push('心理状态：' + s.psychStateLabel + '（压力 ' + pct(s.stress) + '）');
    if (s.reactionStyleLabel) lines.push('反应风格：' + s.reactionStyleLabel);
    lines.push('当前最渴望：' + (s.topDesires || '无特别渴望'));
    if (s.activeBeliefs && s.activeBeliefs.length > 0) {
      lines.push('信念：' + s.activeBeliefs.map(function(b) { return b.label; }).join('、'));
    }
    if (s.brokenBeliefs && s.brokenBeliefs.length > 0) {
      lines.push('已破灭信念：' + s.brokenBeliefs.map(function(b) { return b.label; }).join('、'));
    }
    if (s.breachedDefenses && s.breachedDefenses.length > 0) {
      lines.push('已被突破的心理防线：' + s.breachedDefenses.join('、'));
    }
    return lines.join('\n') + '\n';
  }

  /** 根据心理状态生成额外的决策指导 */
  _formatPsychGuidance(internalState) {
    if (!internalState) return '';
    const summary = internalState.getSummary();
    const lines = [];
    if (summary.psychState === 'ANXIOUS') {
      lines.push('- 你当前很焦虑，更容易过度反应');
    } else if (summary.psychState === 'PARANOID') {
      lines.push('- 你疑心很重，容易认为别人在密谋害你');
      lines.push('- 你更可能主动攻击或先发制人');
    } else if (summary.psychState === 'BREAKDOWN') {
      lines.push('- 你濒临崩溃，可能做出不理智的极端行为');
      lines.push('- 你可能攻击无辜的人、说出心里的秘密、或逃跑躲藏');
    } else if (summary.psychState === 'FRENZY') {
      lines.push('- 你已经失控，会不惜一切代价达成目的');
      lines.push('- 你完全可能杀人、自毁、或做出任何人无法理解的事');
    }
    // 反应风格指导
    if (summary.reactionStyle === 'EXPLOSIVE') {
      lines.push('- 你是爆发型人格，遇压即炸，可能直接动手');
    } else if (summary.reactionStyle === 'STOIC') {
      lines.push('- 你是隐忍型人格，表面平静但心里暗涌，不轻易表露真实情绪');
    } else if (summary.reactionStyle === 'COLD') {
      lines.push('- 你是冷谋型人格，报复不是现在——你会在最合适的时机出手');
    } else if (summary.reactionStyle === 'AVOIDANT') {
      lines.push('- 你是回避型人格，遇到冲突优先选择逃离或沉默');
    } else if (summary.reactionStyle === 'COLLAPSE') {
      lines.push('- 你是崩溃型人格，压力过大会让你精神崩溃，无法理性行动');
    } else if (summary.reactionStyle === 'CONFRONT') {
      lines.push('- 你是直面型人格，遇事正面应对，但不走极端');
    }
    if (summary.breachedDefenses && summary.breachedDefenses.length > 0) {
      lines.push('- 你的心理防线已崩溃（' + summary.breachedDefenses.join('、') + '），行为不再受道德约束');
    }
    return lines.length > 0 ? lines.join('\n') + '\n' : '';
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

function pct(v) {
  return Math.round(v * 100) + '%';
}

module.exports = PromptBuilder;
