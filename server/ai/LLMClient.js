// DeepSeek API 客户端 —— 封装速率控制和降级逻辑

class LLMClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.deepseek.com/v1/chat/completions';
    this.queue = [];
    this.processing = false;

    // 速率控制
    this.lastCallTime = {};       // npcId → timestamp
    this.minInterval = 30000;     // 同一 NPC 30 秒内不重复调用
    this.globalLastCall = 0;
    this.globalMinInterval = 3000; // 全局 3 秒间隔

    // 统计
    this.totalCalls = 0;
    this.failedCalls = 0;
  }

  // NPC 深思请求
  async think(npcId, prompt) {
    // 频率检查
    const now = Date.now();
    if (this.lastCallTime[npcId] &&
        now - this.lastCallTime[npcId] < this.minInterval) {
      return { skipped: true, reason: '单个 NPC 冷却中' };
    }
    if (now - this.globalLastCall < this.globalMinInterval) {
      return { skipped: true, reason: '全局冷却中' };
    }

    this.lastCallTime[npcId] = now;
    this.globalLastCall = now;
    this.totalCalls++;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8 秒超时

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: '你是一个游戏 NPC 决策引擎。你只输出合法 JSON 对象，不要输出其他任何文字。'
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.8,
          max_tokens: 400,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        this.failedCalls++;
        console.error(`  LLM API 错误 ${response.status}: ${await response.text().catch(() => '')}`);
        return { skipped: true, reason: `HTTP ${response.status}`, fallback: true };
      }

      const data = await response.json();
      const content = data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : '';
      return { skipped: false, content };
    } catch (err) {
      clearTimeout(timeout);
      this.failedCalls++;
      if (err.name === 'AbortError') {
        console.error(`  LLM API 超时 (${npcId})`);
        return { skipped: true, reason: 'timeout', fallback: true };
      }
      console.error(`  LLM API 错误 (${npcId}):`, err.message);
      return { skipped: true, reason: err.message, fallback: true };
    }
  }

  // NPC 对话回复（玩家主动搭话时触发）
  async talk(npcId, prompt) {
    const now = Date.now();
    const talkKey = `talk_${npcId}`;
    if (this.lastCallTime[talkKey] &&
        now - this.lastCallTime[talkKey] < 5000) {
      return { skipped: true, reason: '对话冷却中' };
    }
    if (now - this.globalLastCall < 1000) {
      return { skipped: true, reason: '全局冷却中' };
    }

    this.lastCallTime[talkKey] = now;
    this.globalLastCall = now;
    this.totalCalls++;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: '你是一个中世纪奇幻世界的游戏 NPC。请用角色的身份和性格回复玩家。回复要简短（1-2句话），符合角色设定，像真人说话一样自然。直接输出对话内容，不要加引号或标注。',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.9,
          max_tokens: 150,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        this.failedCalls++;
        return { skipped: true, reason: `HTTP ${response.status}`, fallback: true };
      }

      const data = await response.json();
      const content = data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content.trim()
        : '';
      return { skipped: false, content };
    } catch (err) {
      clearTimeout(timeout);
      this.failedCalls++;
      if (err.name === 'AbortError') {
        return { skipped: true, reason: 'timeout', fallback: true };
      }
      return { skipped: true, reason: err.message, fallback: true };
    }
  }

  getStats() {
    const total = this.totalCalls || 1;
    return {
      totalCalls: this.totalCalls,
      failedCalls: this.failedCalls,
      successRate: Math.round((1 - this.failedCalls / total) * 100),
    };
  }
}

module.exports = LLMClient;
