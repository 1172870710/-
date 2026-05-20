// 性格生成器 —— 为每个 NPC 创建独特的性格档案

const FIRST_NAMES = ['老', '小', '阿', '', '', ''];
const LAST_NAMES = ['铁', '明', '芳', '强', '美', '龙', '凤', '刚', '丽', '勇',
  '娜', '涛', '静', '磊', '婷', '伟', '敏', '超', '雪', '辉'];

const JOBS = ['铁匠', '面包师', '农民', '商人', '猎人', '药师', '酒馆老板',
  '守卫', '矿工', '渔夫', '裁缝', '木匠', '学者', '吟游诗人', '流浪者'];

const BACKSTORIES = [
  '曾经是个士兵，战争结束后回乡谋生',
  '从小在镇子里长大，从未离开过',
  '年轻时周游世界，如今落根于此',
  '沉默寡言，有一段不为人知的过往',
  '嗜酒如命，总在酒馆待到深夜',
  '虔诚的信徒，每日清晨都会祈祷',
  '爱管闲事，镇子里没有他不知道的秘密',
  '负债累累，到处躲债',
  '手艺精湛，但脾气古怪',
  '年轻时失去爱人，至今未娶/未嫁',
  '曾经是个小偷，如今金盆洗手',
  '梦想发财，总在琢磨歪点子',
  '年轻时被背叛过，对人不信任',
  '热心肠，谁家有事他都帮忙',
  '表面和善，暗中斤斤计较',
];

// 大五人格 (0-1) + 欲望 + 决策风格
function generatePersonality(npcsCount) {
  const idx = npcsCount;
  const nameIdx1 = idx % FIRST_NAMES.length;
  const nameIdx2 = (idx * 7 + 3) % LAST_NAMES.length;
  const jobIdx = idx % JOBS.length;
  const storyIdx = (idx * 3) % BACKSTORIES.length;

  return {
    name: FIRST_NAMES[nameIdx1] + LAST_NAMES[nameIdx2],
    job: JOBS[jobIdx],
    backstory: BACKSTORIES[storyIdx],

    // 大五人格（伪随机）
    traits: {
      openness:       clamp(hash(idx, 0, 0.1, 0.9), 0, 1),
      conscientiousness: clamp(hash(idx, 1, 0.1, 0.9), 0, 1),
      extraversion:   clamp(hash(idx, 2, 0.2, 0.8), 0, 1),
      agreeableness:  clamp(hash(idx, 3, 0.1, 0.9), 0, 1),
      neuroticism:    clamp(hash(idx, 4, 0.1, 0.9), 0, 1),
    },

    // 动态情绪（动态变化）
    mood: {
      happiness: 0.5 + hash(idx, 5, -0.3, 0.3),
      anger:     hash(idx, 6, 0.1, 0.3),
      fear:      hash(idx, 7, 0.05, 0.3),
      surprise:  0,
    },

    // 欲望系统
    needs: {
      safety: hash(idx, 8, 0.1, 0.8),
      social: hash(idx, 9, 0.1, 0.9),
      wealth: hash(idx, 10, 0.1, 0.9),
      power:  hash(idx, 11, 0.05, 0.6),
    },

    // 决策风格
    decisionStyle: {
      aggression: hash(idx, 12, 0.05, 0.7),
      greed:      hash(idx, 13, 0.05, 0.8),
      loyalty:    hash(idx, 14, 0.2, 0.9),
      curiosity:  hash(idx, 15, 0.1, 0.8),
    },
  };
}

// 基于种子的确定性伪随机
function hash(seed, field, min, max) {
  const x = Math.sin(seed * 137.5 + field * 73.1) * 43758.5453;
  const v = x - Math.floor(x);
  return min + v * (max - min);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

module.exports = { generatePersonality };
