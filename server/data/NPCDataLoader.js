// NPC 数据加载器 — 从 npcs.json 读取 NPC 定义
// 自动合并默认值，支持缺省字段自动生成

const path = require('path');
const fs = require('fs');

// 旧 Personality 中的 hash 函数（抽取到这里独立使用）
function hash(seed, field, min, max) {
  const x = Math.sin(seed * 137.5 + field * 73.1) * 43758.5453;
  const v = x - Math.floor(x);
  return min + v * (max - min);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// 从大五人格推导初始情绪（JSON 未指定 mood 时使用）
function deriveMood(traits) {
  const N = traits.neuroticism || 0.5;
  const A = traits.agreeableness || 0.5;
  const E = traits.extraversion || 0.5;
  return {
    happiness: clamp(0.5 + E * 0.2 + A * 0.2 - N * 0.3, 0.1, 0.9),
    anger:     clamp(N * 0.4 - A * 0.25 + 0.05, 0, 0.5),
    fear:      clamp(N * 0.35 + 0.05, 0.05, 0.4),
    surprise:  0,
  };
}

// 生成大五人格 + 情绪 + 欲望 + 决策风格（基于 seed，确定性的）
function generateTraits(seed) {
  return {
    traits: {
      openness:           clamp(hash(seed, 0, 0.1, 0.9), 0, 1),
      conscientiousness:  clamp(hash(seed, 1, 0.1, 0.9), 0, 1),
      extraversion:       clamp(hash(seed, 2, 0.2, 0.8), 0, 1),
      agreeableness:      clamp(hash(seed, 3, 0.1, 0.9), 0, 1),
      neuroticism:        clamp(hash(seed, 4, 0.1, 0.9), 0, 1),
    },
    mood: {
      happiness: 0.5 + hash(seed, 5, -0.3, 0.3),
      anger:     hash(seed, 6, 0.1, 0.3),
      fear:      hash(seed, 7, 0.05, 0.3),
      surprise:  0,
    },
    needs: {
      safety: hash(seed, 8, 0.1, 0.8),
      social: hash(seed, 9, 0.1, 0.9),
      wealth: hash(seed, 10, 0.1, 0.9),
      power:  hash(seed, 11, 0.05, 0.6),
    },
    decisionStyle: {
      aggression: hash(seed, 12, 0.05, 0.7),
      greed:      hash(seed, 13, 0.05, 0.8),
      loyalty:    hash(seed, 14, 0.2, 0.9),
      curiosity:  hash(seed, 15, 0.1, 0.8),
    },
  };
}

// 从 JSON 文件加载并处理所有 NPC 定义
function loadNPCData() {
  const jsonPath = path.join(__dirname, 'npcs.json');
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('NPC 数据格式错误：需要非空数组');
  }

  return raw.map((entry, idx) => {
    // 必填字段校验
    if (!entry.id)    throw new Error(`第 ${idx} 个 NPC 缺少 id`);
    if (!entry.name)  throw new Error(`NPC ${entry.id || idx} 缺少 name`);
    if (!entry.job)   throw new Error(`NPC ${entry.id} 缺少 job`);
    if (!entry.backstory) throw new Error(`NPC ${entry.id} 缺少 backstory`);

    // 自动生成缺失的 traits/mood/needs/decisionStyle
    const gen = entry.traits ? null : generateTraits(idx);

    return {
      id: entry.id,
      name: entry.name,
      job: entry.job,
      backstory: entry.backstory,

      // 可选字段（有默认值）
      title: entry.title || '',
      gender: entry.gender || '',
      age: entry.age || 0,
      color: entry.color || '#3498db',

      // 人格相关（JSON 有的用 JSON，没有的自动生成）
      traits: entry.traits || gen.traits,
      mood: entry.mood || (gen ? gen.mood : deriveMood(entry.traits)),
      needs: entry.needs || (gen ? gen.needs : { safety: 0.5, social: 0.5, wealth: 0.5, power: 0.2 }),
      decisionStyle: entry.decisionStyle || (gen ? gen.decisionStyle : { aggression: 0.3, greed: 0.3, loyalty: 0.5, curiosity: 0.4 }),

      // 商店和关系
      shop: entry.shop || null,          // null → 由 NPC.js 用 getShopItems(job) 自动生成
      relationships: entry.relationships || {},

      // 切片人格系统
      slice: entry.slice || {
        archetype: '未定义切片',
        id: 'A',
        variable_dimensions: {},
      },
      speaking_style: entry.speaking_style || {
        tone: '普通',
        sentence_pattern: '普通陈述句',
        particles: [],
      },
      catchphrases: entry.catchphrases || [],
    };
  });
}

module.exports = { loadNPCData, generateTraits };
