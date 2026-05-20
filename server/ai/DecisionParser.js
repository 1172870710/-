// 决策解析器 —— 将 LLM 返回的 JSON 解析为游戏动作

class DecisionParser {
  // 默认决策（兜底：闲逛）
  static defaultDecision(npc) {
    return {
      goal: null,
      action: 'wander',
      target: null,
      dialogue: '',
      emotion: 'neutral',
      reasoning: '（默认行为：闲逛）',
    };
  }

  // 解析 LLM 返回内容
  parse(content, npcId) {
    if (!content || typeof content !== 'string') {
      return DecisionParser.defaultDecision({});
    }

    let json;

    // 第一层：直接 parse
    try {
      json = JSON.parse(content);
    } catch {
      // 第二层：正则提取花括号内容
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          json = JSON.parse(match[0]);
        } catch {
          // 第三层：尝试修复常见错误（缺少引号等）
          try {
            json = this._looseParse(match[0]);
          } catch {
            console.log(`  NPC ${npcId} LLM 返回无法解析，使用默认决策`);
            return DecisionParser.defaultDecision({});
          }
        }
      } else {
        console.log(`  NPC ${npcId} LLM 返回中找不到 JSON，使用默认决策`);
        return DecisionParser.defaultDecision({});
      }
    }

    // 验证并填充字段
    return this._validate(json, npcId);
  }

  // 宽松解析（容忍常见 JSON 错误）
  _looseParse(str) {
    // 用 Function 构造器（比 JSON.parse 容忍更多）
    const cleaned = str
      .replace(/'/g, '"')
      .replace(/(\w+):/g, '"$1":')
      .replace(/,\s*}/g, '}');
    return JSON.parse(cleaned);
  }

  // 验证决策字段合法性
  _validate(json, npcId) {
    const validActions = new Set(['wander','approach','flee','talk','gift','insult','attack','ignore','guard']);
    const validEmotions = new Set(['happy','angry','sad','surprised','neutral']);

    return {
      goal: typeof json.goal === 'string' ? json.goal.slice(0, 100) : null,
      action: validActions.has(json.action) ? json.action : 'wander',
      target: typeof json.target === 'string' ? json.target : null,
      dialogue: typeof json.dialogue === 'string' ? json.dialogue.slice(0, 120) : '',
      emotion: validEmotions.has(json.emotion) ? json.emotion : 'neutral',
      reasoning: typeof json.reasoning === 'string' ? json.reasoning.slice(0, 200) : '',
    };
  }
}

module.exports = DecisionParser;
