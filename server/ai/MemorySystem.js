// 记忆系统 —— 每个 NPC 维护短期/长期记忆
// 支持 LLM 压缩：当短期记忆积累到一定数量后，调用 API 压缩成"人生故事"

class MemorySystem {
  constructor(npcId) {
    this.npcId = npcId;
    this.shortTerm = [];      // 最近 100 条，FIFO
    this.longTerm = [];       // 高重要性事件永久保留
    this.lifeStory = '';      // LLM 压缩后的人生故事
    this.maxShortTerm = 100;
    this.eventsSinceSummary = 0;  // 上次压缩后新增的事件数
  }

  // 添加一条记忆
  addEvent(type, target, content, importance = 0.3) {
    const event = {
      time: Date.now(),
      type,        // 'player_said', 'saw_player', 'was_attacked', 'npc_betrayed' 等
      target,      // 目标实体 ID
      content,     // 自然语言描述
      importance,
    };

    // 加入短期
    this.shortTerm.push(event);
    if (this.shortTerm.length > this.maxShortTerm) {
      this.shortTerm.shift();
    }
    this.eventsSinceSummary++;

    // 高重要性 → 同时写入长期
    if (importance >= 0.6) {
      this.longTerm.push(event);
    }
  }

  // 获取最近 N 条记忆（用于 prompt，旧接口）
  getRecent(n = 5) {
    return this.shortTerm.slice(-n);
  }

  // 获取完整 prompt 记忆信息（人生故事 + 最近事件）
  getRecentForPrompt(n = 10) {
    return {
      story: this.lifeStory,
      events: this.shortTerm.slice(-n),
    };
  }

  // 是否需要压缩
  needsSummarize() {
    return this.shortTerm.length >= 50 && this.eventsSinceSummary >= 20;
  }

  // 调用 LLM 压缩短期记忆为人生故事
  async summarize(llmClient) {
    if (!llmClient) return;

    const events = this.shortTerm.slice(0, 40); // 压缩较早的事件
    const eventText = events.map((e, i) =>
      `${i + 1}. ${e.content}`
    ).join('\n');

    const prompt = `你现在是一个 NPC 的"记忆管理模块"。下面是一个 NPC 最近经历的事件列表。

${eventText}

${this.lifeStory ? '这个 NPC 之前的人生经历：\n' + this.lifeStory + '\n\n' : ''}
请用 2-3 句中文概括这个 NPC 的完整人生经历（包含过去的和最近的），重点关注：
- 和其他人的重要关系（友善/敌对）
- 发生过的重要事件（被攻击、收到礼物、对话等）
- 对其他人或事物的态度变化

直接输出概括内容，不要加前缀。`;

    const result = await llmClient.talk(this.npcId, prompt);
    if (!result.skipped && result.content) {
      this.lifeStory = result.content;
      // 清理已被压缩的事件，保留最近 20 条
      const keep = this.shortTerm.slice(-20);
      this.shortTerm = keep;
      this.eventsSinceSummary = 0;

      // 高重要性事件也保留在 longTerm
      for (const e of keep) {
        if (e.importance >= 0.6 && !this.longTerm.some(le => le.time === e.time)) {
          this.longTerm.push(e);
        }
      }

      console.log(`  📝 ${this.npcId} 记忆已压缩: "${this.lifeStory.slice(0, 60)}..."`);
      return true;
    }
    return false;
  }

  // 获取与某个实体相关的记忆
  getAbout(entityId, n = 3) {
    const all = [...this.shortTerm, ...this.longTerm]
      .filter(e => e.target === entityId)
      .sort((a, b) => b.time - a.time);
    return all.slice(0, n);
  }

  // 获取所有长期记忆
  getLongTerm() {
    return this.longTerm;
  }

  // 根据类型获取记忆
  getByType(type, n = 5) {
    const all = [...this.shortTerm.slice().reverse(), ...this.longTerm]
      .filter(e => e.type === type)
      .sort((a, b) => b.time - a.time);
    return all.slice(0, n);
  }

  // 形成个人信念（从长期记忆中总结）
  getBeliefs() {
    const beliefs = [];
    for (const e of this.longTerm) {
      if (e.type === 'player_stole' || e.type === 'was_attacked') {
        if (!beliefs.some(b => b.includes('背叛') || b.includes('偷窃'))) {
          beliefs.push('被人伤害过，对陌生人心存戒备');
        }
      }
      if (e.type === 'received_gift' || e.type === 'was_helped') {
        if (!beliefs.some(b => b.includes('友善') || b.includes('帮助'))) {
          beliefs.push('接受过他人的善意，相信世界上有好人');
        }
      }
    }
    return beliefs;
  }
}

module.exports = MemorySystem;
