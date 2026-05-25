// 虚拟社会骨架 — 多场景叙事测试
//
// 运行: node test_scenario.js
//
// 5 个场景覆盖不同事件类型:
//   A: 三角恋 — betrayed + witnessed_violence + secret
//   B: 温暖邂逅 — kind_stranger + shared_secret_moment
//   C: 压力崩溃链 — 连续 stress 累积 → BREAKDOWN / FRENZY
//   D: 公开羞辱 — publicly_humiliated + publicly_accused
//   E: 死亡哀悼 — loved_one_died → 全镇哀悼

const { EventImpactSystem } = require('./server/social/EventImpactSystem');
const { BehaviorResponse } = require('./server/social/BehaviorResponse');
const { ScheduleSystem } = require('./server/social/ScheduleSystem');
const { SecretSystem } = require('./server/social/SecretSystem');
const { EventChain } = require('./server/social/EventChain');
const { DramaEngine } = require('./server/social/DramaEngine');
const { NPCInternalState } = require('./server/social/NPCInternalState');
const RelationshipGraph = require('./server/social/RelationshipGraph');
const MemorySystem = require('./server/ai/MemorySystem');

// ======================== 工具函数 ========================

function pf(v) { return (v * 100).toFixed(0).padStart(3) + '%'; }
function pad(s, len) {
  let width = 0;
  for (const c of s) width += /[一-鿿]/.test(c) ? 2 : 1;
  return s + ' '.repeat(Math.max(0, len - width));
}
function hr(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(60)}\n`);
}

// ======================== 通用世界构造函数 ========================

function buildWorld(npcDefs) {
  const graph = new RelationshipGraph(null);
  const internalStates = new Map();
  const brains = new Map();
  const npcs = new Map();
  const memories = new Map();

  for (const data of npcDefs) {
    npcs.set(data.id, { id: data.id, name: data.name, job: data.job, backstory: data.backstory });
    const traits = {
      openness: data.traits.o, conscientiousness: data.traits.c,
      extraversion: data.traits.e, agreeableness: data.traits.a, neuroticism: data.traits.n,
    };
    internalStates.set(data.id, new NPCInternalState(data.id, { traits, mood: { happiness: 0.5, anger: 0, fear: 0, surprise: 0 }, needs: {} }, null));
    memories.set(data.id, new MemorySystem(data.id));
  }

  // Init all relationships
  for (const [id] of npcs) {
    for (const [otherId] of npcs) {
      if (id !== otherId) graph.init(id, otherId);
    }
  }

  const eis = new EventImpactSystem({ graph, internalStates });
  const br = new BehaviorResponse();
  const schedule = new ScheduleSystem();
  for (const [id] of npcs) schedule.registerNPC(id, { x: 100 + Math.random() * 50, y: 200 + Math.random() * 50 });
  const secrets = new SecretSystem({ graph, internalStates });
  const chain = new EventChain({ graph, impactSystem: eis, npcBrains: brains });

  // Build brains
  for (const [id] of npcs) {
    const data = npcDefs.find(d => d.id === id);
    brains.set(id, makeBrain({
      id, data, npcs, graph, internalStates, memories,
      eis, br, schedule, secrets, chain,
    }));
  }

  return { graph, internalStates, brains, npcs, memories, eis, br, schedule, secrets, chain, npcDefs };
}

function makeBrain(ctx) {
  const { id, data, npcs, graph, internalStates, memories, eis, br, schedule, secrets, chain } = ctx;
  return {
    npc: { id, name: npcs.get(id).name },
    personality: {
      traits: {
        openness: data.traits.o, conscientiousness: data.traits.c,
        extraversion: data.traits.e, agreeableness: data.traits.a, neuroticism: data.traits.n,
      },
      mood: { happiness: 0.5, anger: 0, fear: 0, surprise: 0 },
    },
    memory: memories.get(id),
    graph,
    internalState: internalStates.get(id),
    impactSystem: eis,
    behaviorResponse: br,
    scheduleSystem: schedule,
    secretSystem: secrets,
    eventChain: chain,

    processEvent(event) {
      const traits = this.personality.traits;
      const impact = this.impactSystem.calculateImpact(event, this.npc.id, traits);

      // Apply impact
      if (impact.stressDelta > 0) this.internalState.addStress(impact.stressDelta, `${event.eventType}`);
      else if (impact.stressDelta < 0) this.internalState.relieveStress(-impact.stressDelta, `${event.eventType}`);

      for (const [key, delta] of Object.entries(impact.desireChanges)) {
        if (delta !== 0) this.internalState.adjustDesire(key, delta, event.eventType);
      }

      for (const [targetId, dims] of Object.entries(impact.relationChanges)) {
        this.graph.adjust(this.npc.id, targetId, dims, `${event.eventType}`);
      }

      if (impact.memoryImportance > 0.1) {
        this.memory.addEvent(event.eventType, this.npc.id,
          `${npcs.get(this.npc.id).name} 经历了 ${event.eventType}(${impact.severity.label})`, impact.memoryImportance);
      }

      // Behavior response
      const relToActor = event.participants?.actor ? this.graph.getAttitude(this.npc.id, event.participants.actor) : null;
      const relToTarget = event.participants?.target ? this.graph.getAttitude(this.npc.id, event.participants.target) : null;
      const response = this.behaviorResponse.match(impact, {
        traits,
        relations: { toActor: relToActor, toTarget: relToTarget },
        reactionStyle: this.internalState?.reactionStyle || 'STOIC',
        psychState: this.internalState?.psychState || 'NORMAL',
        role: impact.role,
        targetId: event.participants?.actor || event.participants?.target || null,
      });

      if (response.scheduleOverride && this.scheduleSystem) {
        this.scheduleSystem.addOverride(this.npc.id, {
          type: response.scheduleOverride.type,
          priority: { CRITICAL: 100, URGENT: 75, NORMAL: 50, LOW: 25 }[response.responsePriority] || 50,
          duration: response.scheduleOverride.duration || '3_days',
          targetId: response.target,
          reason: `[${response.matchedRuleId}] ${event.eventType}`,
        });
      }

      if (this.eventChain && (event.intensity || 0) >= 0.6) {
        this.eventChain.propagate(event, impact);
      }

      return { impact, summary: { response } };
    },
  };
}

// ======================== 打印报告 ========================

function printStateReport(w, title) {
  const { internalStates, schedule, graph, npcs, npcDefs } = w;
  console.log(`\n  📊 ${title || '状态报告'}:`);

  // Stress & psych state
  console.log('  ┌' + '─'.repeat(72) + '┐');
  console.log('  │ ' + pad('NPC', 8) + ' │ ' + pad('压力', 24) + ' │ ' + pad('心理状态', 10) + ' │ ' + pad('覆写', 22) + ' │');
  console.log('  ├' + '─'.repeat(72) + '┤');
  for (const data of npcDefs) {
    const state = internalStates.get(data.id);
    const overrides = schedule.getActiveOverrides(data.id);
    const ovrStr = overrides.length > 0 ? overrides.map(o => o.type).join(', ') : '无';
    const bar = '█'.repeat(Math.round(state.stress * 20)) + '░'.repeat(20 - Math.round(state.stress * 20));
    console.log(`  │ ${pad(data.name, 8)} │ ${bar} ${pf(state.stress)} │ ${pad(state.getPsychStateLabel(), 10)} │ ${pad(ovrStr, 22)} │`);
  }
  console.log('  └' + '─'.repeat(72) + '┘');
}

function printRelReport(w, pairs) {
  const { graph } = w;
  console.log('\n  📋 关键关系:');
  for (const [from, to, label] of pairs) {
    const rel = graph.getAttitude(from, to);
    console.log(`    ${pad(label, 16)} 好感${pf(rel.affection)} 信任${pf(rel.trust)} 怨恨${pf(rel.resentment)} 恐惧${pf(rel.fear)} 怀疑${pf(rel.suspicion)}`);
  }
}

function printSecrets(w) {
  const { secrets, npcs } = w;
  const known = secrets.getDebug();
  if (known.length === 0) { console.log('\n  📜 无活跃秘密'); return; }
  console.log('\n  📜 秘密状态:');
  for (const s of known) {
    const holders = secrets.secrets.get(s.id)?.holders;
    const holderNames = holders ? Array.from(holders.entries()).map(([id, h]) =>
      `${npcs.get(id)?.name || id}(${h.knowledgeLevel})`
    ) : [];
    console.log(`    "${s.content}"`);
    console.log(`    持有者(${s.holderCount}人): ${holderNames.join(' → ')}`);
    console.log(`    已公开: ${s.isRevealed ? '是' : '否'}`);
  }
}

function processParticipants(w, event, ids, label) {
  const { npcs, brains } = w;
  console.log(`\n  🎬 ${label || '事件处理'}:`);
  for (const npcId of ids) {
    console.log(`    ── ${npcs.get(npcId).name} (${npcs.get(npcId).job}) ──`);
    const brain = brains.get(npcId);
    const result = brain.processEvent(event);
    console.log(`       ⚡ ${result.impact.severity.label} stress${result.impact.stressDelta>=0?'+':''}${result.impact.stressDelta.toFixed(3)} role=${result.impact.role}`);
    if (result.summary.response?.matchedRuleId !== 'fallback') {
      console.log(`       ↪ ${result.summary.response.action} [${result.summary.response.matchedRuleId}] ${result.summary.response.responsePriority}`);
    }
    if (result.summary.response?.scheduleOverride) {
      console.log(`       📅 ${result.summary.response.scheduleOverride.type} / ${result.summary.response.scheduleOverride.duration}`);
    }
  }
}

// ====================================================================
//  场景 A: 三角恋 — 美爱涛，涛爱雪，美目睹两人在一起
// ====================================================================
// 测试: betrayed (actor/target/witness), witnessed_violence, secret_learned
//       情感一致性（OCC）: 美看到心爱的涛爱上雪 → 复杂的混合情绪
//       反应风格差异: 美的 EXPLOSIVE vs 涛的 CONFRONT vs 雪的 STOIC

function runScenarioA() {
  hr('场景 A: 三角恋 — 美目睹心爱的涛与雪约会');

  const npcDefs = [
    { id: 'mei',    name: '美',   job: '商人',   traits: { o: 0.5, c: 0.7, e: 0.8, a: 0.5, n: 0.7 }, backstory: '热情外向，敢爱敢恨，曾为爱奋不顾身' },
    { id: 'tao',    name: '涛',   job: '猎人',   traits: { o: 0.4, c: 0.5, e: 0.4, a: 0.3, n: 0.5 }, backstory: '沉默冷酷，不善表达感情' },
    { id: 'xue',    name: '雪',   job: '药师',   traits: { o: 0.6, c: 0.4, e: 0.3, a: 0.7, n: 0.3 }, backstory: '温柔善良，从不拒绝别人' },
    { id: 'laolong',name: '老龙', job: '酒馆老板', traits: { o: 0.3, c: 0.6, e: 0.8, a: 0.6, n: 0.4 }, backstory: '见多识广，镇上消息最灵通的人' },
    { id: 'xiaona', name: '小娜', job: '面包师', traits: { o: 0.5, c: 0.6, e: 0.3, a: 0.8, n: 0.5 }, backstory: '善解人意，总是默默关心朋友' },
  ];

  const w = buildWorld(npcDefs);

  // 种子关系: 美 → 涛 (深爱), 涛 → 雪 (迷恋), 雪 → 涛 (好感但犹豫)
  w.graph.adjust('mei', 'tao', { affection: 0.9, trust: 0.7, jealousy: 0.4 }, '美深爱着涛');
  w.graph.adjust('tao', 'xue', { affection: 0.85, trust: 0.6 }, '涛被雪的温柔吸引');
  w.graph.adjust('xue', 'tao', { affection: 0.5, trust: 0.4 }, '雪对涛有好感但不确定');
  w.graph.adjust('mei', 'xue', { affection: 0.3, jealousy: 0.3 }, '美隐约察觉雪与涛的关系');
  w.graph.adjust('xiaona', 'mei', { affection: 0.7, trust: 0.6 }, '小娜是美的好朋友');
  w.graph.adjust('laolong', 'mei', { affection: 0.3, trust: 0.4 }, '老龙常在酒馆看到美买醉');

  console.log('📖 美深爱着猎人涛，但涛的心早已被温柔的药师雪俘获。');
  console.log('   一天傍晚，美去森林采药，在湖边看到了涛和雪依偎在一起...\n');

  // 美目睹两人在一起 → betrayed (从美的视角: 心爱的人背叛了自己)
  const betrayalEvent = {
    eventType: 'betrayed',
    participants: { actor: 'tao', target: 'xue', witnesses: ['mei'] },
    intensity: 0.85,
    location: { id: 'lakeside', narrativeTags: ['romantic', 'secret', 'nature'] },
    isDramaEvent: true,
  };

  // 同时，对雪来说是被公开看到秘密关系（本质上也是 witnessed）
  const witnessedEvent = {
    eventType: 'secret_exposed_self',
    participants: { actor: 'mei', target: 'xue' },
    intensity: 0.6,
    location: { id: 'lakeside' },
  };

  processParticipants(w, betrayalEvent, ['mei', 'tao', 'xue'], '美看到涛和雪依偎在一起(intensity=0.85)');

  // 涟漪传播
  console.log('\n  🌊 涟漪传播...');
  w.chain.propagate(betrayalEvent, w.eis.calculateImpact(betrayalEvent, 'mei', npcDefs[0].traits));

  // 美去找小娜倾诉 → 秘密传播
  console.log('\n📖 美心碎地去找好友小娜倾诉...');
  const secretId = w.secrets.create({
    content: '涛和雪是秘密恋人',
    creatorId: 'mei',
    initialHolders: [
      { npcId: 'mei', knowledgeLevel: 'FULL' },
      { npcId: 'tao', knowledgeLevel: 'FULL' },
      { npcId: 'xue', knowledgeLevel: 'FULL' },
    ],
  });
  w.secrets.addHolder(secretId, 'xiaona', 'PARTIAL', 'mei');

  // 小娜在酒馆说漏嘴
  w.internalStates.get('xiaona').addStress(0.15, '朋友的心事');
  w.secrets._lastPropagationTick = 0;
  const spreads = w.secrets.propagateTick();
  for (const s of spreads) {
    console.log(`  🗣️ ${w.npcs.get(s.from).name} → ${w.npcs.get(s.to).name} [${s.level}]`);
  }

  printStateReport(w, '三角恋冲击后');

  const relPairs = [
    ['mei', 'tao', '美→涛(被背叛)'],
    ['mei', 'xue', '美→雪(情敌)'],
    ['tao', 'xue', '涛→雪(爱人)'],
    ['xue', 'mei', '雪→美(被发现)'],
  ];
  printRelReport(w, relPairs);
  printSecrets(w);

  return w;
}

// ====================================================================
//  场景 B: 温暖邂逅 — 从陌生到友谊
// ====================================================================
// 测试: kind_stranger + shared_secret_moment + received_gift
//       正面事件链 → 好感上升 → 信任建立

function runScenarioB() {
  hr('场景 B: 温暖邂逅 — 暴风雨夜的善意');

  const npcDefs = [
    { id: 'achao',   name: '阿超', job: '农民',   traits: { o: 0.5, c: 0.4, e: 0.7, a: 0.5, n: 0.4 }, backstory: '爱管闲事但心地不坏' },
    { id: 'mei',     name: '美',   job: '商人',   traits: { o: 0.4, c: 0.7, e: 0.6, a: 0.5, n: 0.6 }, backstory: '年轻时失去爱人，内心孤独' },
    { id: 'xiaojing',name: '小静', job: '守卫',   traits: { o: 0.3, c: 0.9, e: 0.5, a: 0.3, n: 0.5 }, backstory: '严肃认真但不乏人情味' },
  ];

  const w = buildWorld(npcDefs);

  // 初始: 阿超与美只是点头之交，阿超有点怕小静
  w.graph.adjust('achao', 'mei', { affection: 0.1, trust: 0.05 }, '偶尔在市场碰面');
  w.graph.adjust('achao', 'xiaojing', { fear: 0.3, respect: 0.4 }, '守卫总盯着我');

  console.log('📖 一个暴风雨的夜晚，阿超发现商人美在路边马车坏了，');
  console.log('   货物散落一地。阿超帮她把货物搬回店里，');
  console.log('   两人在避雨时聊了很多...\n');

  // 阿超帮美 → kind_stranger (从美的视角: 遇到好心人)
  const kindnessEvent = {
    eventType: 'kind_stranger',
    participants: { actor: 'achao', target: 'mei' },
    intensity: 0.3,
    location: { id: 'roadside', narrativeTags: ['storm', 'night', 'isolated'] },
    isDramaEvent: true,
  };

  processParticipants(w, kindnessEvent, ['achao', 'mei'], '阿超帮美搬货物');

  // 避雨时分享秘密 → shared_secret_moment
  console.log('\n📖 两人避雨时，美聊起了年轻时失去爱人的往事...');
  const sharedEvent = {
    eventType: 'shared_secret_moment',
    participants: { actor: 'mei', target: 'achao' },
    intensity: 0.4,
    location: { id: 'roadside' },
  };

  processParticipants(w, sharedEvent, ['achao', 'mei'], '美向阿超敞开心扉');

  // 几天后，美送阿超礼物感谢 → received_gift
  console.log('\n📖 几天后，美送了阿超一袋上好的种子作为感谢...');
  const giftEvent = {
    eventType: 'received_gift',
    participants: { actor: 'mei', target: 'achao' },
    intensity: 0.25,
    location: { id: 'market', narrativeTags: ['daytime', 'public'] },
  };

  processParticipants(w, giftEvent, ['achao', 'mei'], '美送阿超礼物');

  // 小静目睹了这一幕
  console.log('\n📖 守卫小静巡逻路过，看到阿超帮美...');
  const witnessKindness = {
    eventType: 'kind_stranger',
    participants: { actor: 'achao', target: 'mei', witnesses: ['xiaojing'] },
    intensity: 0.2,
    location: { id: 'market' },
  };
  w.brains.get('xiaojing').processEvent(witnessKindness);

  printStateReport(w, '温暖邂逅后');

  const relPairs = [
    ['mei', 'achao', '美→阿超(被帮助)'],
    ['achao', 'mei', '阿超→美(帮助者)'],
    ['xiaojing', 'achao', '小静→阿超(改观)'],
  ];
  printRelReport(w, relPairs);
  printSecrets(w);

  return w;
}

// ====================================================================
//  场景 C: 压力崩溃链 — 连续打击 → BREAKDOWN → FRENZY
// ====================================================================
// 测试: 连续 attacked + betrayed + item_stolen → 压力冲破阈值
//       防御机制触发 → BREAKDOWN → desireChanges 累积
//       反应风格: EXPLOSIVE(爆发) vs STOIC(隐忍)

function runScenarioC() {
  hr('场景 C: 压力崩溃 — 老强连续遭受打击');

  const npcDefs = [
    { id: 'laoqiang', name: '老强', job: '铁匠',   traits: { o: 0.3, c: 0.8, e: 0.4, a: 0.3, n: 0.8 }, backstory: '脾气暴躁，手艺精湛但内心脆弱' },
    { id: 'achao',    name: '阿超', job: '农民',   traits: { o: 0.6, c: 0.3, e: 0.7, a: 0.3, n: 0.4 }, backstory: '游手好闲，喜欢惹事生非' },
    { id: 'laolong',  name: '老龙', job: '酒馆老板', traits: { o: 0.3, c: 0.6, e: 0.8, a: 0.6, n: 0.4 }, backstory: '老强的多年好友' },
  ];

  const w = buildWorld(npcDefs);

  // 老龙是老强的朋友
  w.graph.adjust('laolong', 'laoqiang', { affection: 0.6, trust: 0.7 }, '多年好友');
  w.graph.adjust('laoqiang', 'laolong', { affection: 0.5, trust: 0.6 }, '酒馆老主顾');
  // 老强对阿超有戒心
  w.graph.adjust('laoqiang', 'achao', { suspicion: 0.5, resentment: 0.3 }, '阿超总在铁匠铺附近转悠');
  w.graph.adjust('achao', 'laoqiang', { affection: -0.3, resentment: 0.4 }, '老强总盯着我');

  let ls = w.internalStates.get('laoqiang');

  console.log('📖 老强（高神经质 0.8，易怒）连续遭遇不幸的一天...\n');

  // 打击 1: 铁锤被偷
  console.log('  打击 1: 心爱铁锤被偷');
  const stealEvent = {
    eventType: 'item_stolen',
    participants: { actor: 'achao', target: 'laoqiang' },
    intensity: 0.65,
    location: { id: 'blacksmith' },
  };
  w.brains.get('laoqiang').processEvent(stealEvent);
  console.log(`    老强压力: ${pf(ls.stress)} 状态: ${ls.getPsychStateLabel()}\n`);

  // 打击 2: 被阿超当众羞辱
  console.log('  打击 2: 阿超在广场羞辱老强');
  const humiliateEvent = {
    eventType: 'publicly_humiliated',
    participants: { actor: 'achao', target: 'laoqiang', witnesses: ['laolong'] },
    intensity: 0.7,
    location: { id: 'town_square', narrativeTags: ['public', 'witnessed'] },
  };
  processParticipants(w, humiliateEvent, ['laoqiang', 'achao', 'laolong'], '阿超当众羞辱老强');
  console.log(`    老强压力: ${pf(ls.stress)} 状态: ${ls.getPsychStateLabel()}\n`);

  // 打击 3: 老龙作为朋友没有帮他说话 → 背叛感
  console.log('  打击 3: 好友老龙袖手旁观（背叛感）');
  const betrayEvent = {
    eventType: 'betrayed',
    participants: { actor: 'laolong', target: 'laoqiang' },
    intensity: 0.6,
    location: { id: 'town_square' },
  };
  w.brains.get('laoqiang').processEvent(betrayEvent);
  console.log(`    老强压力: ${pf(ls.stress)} 状态: ${ls.getPsychStateLabel()}`);

  // 查看 desire 变化
  console.log('\n  📊 老强欲望变化:');
  const desires = ls.getAllDesires ? ls.getAllDesires() : {};
  for (const [k, v] of Object.entries(desires)) {
    if (v > 0.2) console.log(`    ${k}: ${pf(v)}`);
  }

  // 额外打击 4 — 推到 FRENZY
  if (ls.stress < 0.9) {
    console.log('\n  💥 打击 4: 阿超打碎了老强最后一个传家铁砧...');
    const finalBlow = {
      eventType: 'attacked',
      participants: { actor: 'achao', target: 'laoqiang' },
      intensity: 0.9,
      location: { id: 'blacksmith' },
    };
    w.brains.get('laoqiang').processEvent(finalBlow);
    console.log(`    老强压力: ${pf(ls.stress)} 状态: ${ls.getPsychStateLabel()}`);
    if (ls.psychState === 'FRENZY') {
      console.log('    ⚠️ 老强已进入 FRENZY 状态！可能出现极端行为...');
    }
  }

  // 涟漪传播
  console.log('\n  🌊 涟漪传播（高强度事件）...');
  const chainEvent = {
    eventType: 'attacked',
    participants: { actor: 'achao', target: 'laoqiang' },
    intensity: 0.9,
    location: { id: 'blacksmith' },
  };
  w.chain.propagate(chainEvent, w.eis.calculateImpact(chainEvent, 'laoqiang', npcDefs[0].traits));

  printStateReport(w, '压力崩溃后');

  const relPairs = [
    ['laoqiang', 'achao', '老强→阿超(复仇)'],
    ['laoqiang', 'laolong', '老强→老龙(被背叛)'],
    ['laolong', 'laoqiang', '老龙→老强(愧疚)'],
  ];
  printRelReport(w, relPairs);

  return w;
}

// ====================================================================
//  场景 D: 公开羞辱 + 防卫性反击
// ====================================================================
// 测试: publicly_humiliated + publicly_accused 交替
//       多种反应风格同时触发: EXPLOSIVE / COLD / CONFRONT
//       EventChain 涟漪传播分层

function runScenarioD() {
  hr('场景 D: 公开冲突 — 阿超和小静在广场对质');

  const npcDefs = [
    { id: 'achao',    name: '阿超', job: '农民',   traits: { o: 0.6, c: 0.3, e: 0.8, a: 0.2, n: 0.5 }, backstory: '嘴欠爱惹事，但不经打' },
    { id: 'xiaojing', name: '小静', job: '守卫',   traits: { o: 0.3, c: 0.9, e: 0.6, a: 0.2, n: 0.6 }, backstory: '严肃执法，最讨厌被挑战权威' },
    { id: 'laoqiang', name: '老强', job: '铁匠',   traits: { o: 0.3, c: 0.8, e: 0.4, a: 0.3, n: 0.7 }, backstory: '围观群众，心里暗爽' },
    { id: 'xue',      name: '雪',   job: '药师',   traits: { o: 0.7, c: 0.5, e: 0.4, a: 0.7, n: 0.3 }, backstory: '冷静理性的旁观者' },
    { id: 'xiaona',   name: '小娜', job: '面包师', traits: { o: 0.5, c: 0.6, e: 0.3, a: 0.8, n: 0.5 }, backstory: '不忍看到冲突' },
    { id: 'laolong',  name: '老龙', job: '酒馆老板', traits: { o: 0.3, c: 0.6, e: 0.8, a: 0.6, n: 0.4 }, backstory: '看热闹不嫌事大' },
    { id: 'mei',      name: '美',   job: '商人',   traits: { o: 0.4, c: 0.7, e: 0.6, a: 0.5, n: 0.6 }, backstory: '认识双方，左右为难' },
    { id: 'tao',      name: '涛',   job: '猎人',   traits: { o: 0.5, c: 0.4, e: 0.3, a: 0.3, n: 0.6 }, backstory: '冷眼旁观' },
  ];

  const w = buildWorld(npcDefs);

  // 种子关系: 阿超 vs 小静互相对立
  w.graph.adjust('achao', 'xiaojing', { resentment: 0.6, suspicion: 0.5, fear: 0.4 }, '小静总找阿超的茬');
  w.graph.adjust('xiaojing', 'achao', { resentment: 0.5, suspicion: 0.7, respect: -0.3 }, '阿超是镇上的麻烦精');
  w.graph.adjust('laoqiang', 'achao', { resentment: 0.4, affection: -0.2 }, '阿超偷过老强的铁锤');
  w.graph.adjust('xue', 'xiaojing', { respect: 0.5, trust: 0.4 }, '小静维护秩序');
  w.graph.adjust('xiaona', 'achao', { affection: 0.4 }, '小娜觉得阿超本性不坏');
  // 中立关系
  for (const id of ['laolong', 'mei', 'tao']) {
    w.graph.adjust(id, 'achao', { affection: -0.1, suspicion: 0.3 }, '阿超名声不太好');
    w.graph.adjust(id, 'xiaojing', { respect: 0.3, trust: 0.4 }, '守卫维护秩序');
  }

  console.log('📖 阿超在广场上大声嘲笑小静的执法能力，当着全镇人的面...');
  console.log('   "你当守卫这么多年，连个小偷都抓不住！"\n');

  // 第一步: 阿超公开羞辱小静
  const humiliateEvent = {
    eventType: 'publicly_humiliated',
    participants: {
      actor: 'achao',
      target: 'xiaojing',
      witnesses: ['laoqiang', 'xue', 'xiaona', 'laolong', 'mei', 'tao'],
    },
    intensity: 0.8,
    location: { id: 'town_square', narrativeTags: ['public', 'conflict', 'authority_challenged'] },
    isDramaEvent: true,
  };

  console.log('🎬 第一幕: 阿超公开羞辱守卫小静\n');
  const allIds = npcDefs.map(d => d.id);
  for (const npcId of allIds) {
    console.log(`  ── ${w.npcs.get(npcId).name} (${w.npcs.get(npcId).job}) ──`);
    const brain = w.brains.get(npcId);
    const result = brain.processEvent(humiliateEvent);
    console.log(`     ⚡ ${result.impact.severity.label} stress${result.impact.stressDelta>=0?'+':''}${result.impact.stressDelta.toFixed(3)} role=${result.impact.role}`);
    if (result.summary.response?.matchedRuleId !== 'fallback') {
      console.log(`     ↪ ${result.summary.response.action} [${result.summary.response.matchedRuleId}] ${result.summary.response.responsePriority}`);
    }
    if (result.summary.response?.scheduleOverride) {
      console.log(`     📅 ${result.summary.response.scheduleOverride.type} / ${result.summary.response.scheduleOverride.duration}`);
    }
  }

  // 涟漪
  console.log('\n  🌊 涟漪传播...');
  w.chain.propagate(humiliateEvent, w.eis.calculateImpact(humiliateEvent, 'xiaojing', npcDefs[1].traits));

  // 第二步: 小静反击——公开指控阿超偷东西
  console.log('\n📖 小静怒不可遏，当场指控阿超:"你以为我不知道你偷了老强的铁锤吗？！"\n');

  const accuseEvent = {
    eventType: 'publicly_accused',
    participants: {
      actor: 'xiaojing',
      target: 'achao',
      witnesses: ['laoqiang', 'xue', 'xiaona', 'laolong', 'mei', 'tao'],
    },
    intensity: 0.9,
    location: { id: 'town_square', narrativeTags: ['public', 'accusation', 'counter_attack'] },
  };

  console.log('🎬 第二幕: 小静当众指控阿超偷窃\n');
  for (const npcId of allIds) {
    console.log(`  ── ${w.npcs.get(npcId).name} (${w.npcs.get(npcId).job}) ──`);
    const brain = w.brains.get(npcId);
    const result = brain.processEvent(accuseEvent);
    console.log(`     ⚡ ${result.impact.severity.label} stress${result.impact.stressDelta>=0?'+':''}${result.impact.stressDelta.toFixed(3)} role=${result.impact.role}`);
    if (result.summary.response?.matchedRuleId !== 'fallback') {
      console.log(`     ↪ ${result.summary.response.action} [${result.summary.response.matchedRuleId}] ${result.summary.response.responsePriority}`);
    }
    if (result.summary.response?.scheduleOverride) {
      console.log(`     📅 ${result.summary.response.scheduleOverride.type} / ${result.summary.response.scheduleOverride.duration}`);
    }
  }

  console.log('\n  🌊 涟漪传播...');
  w.chain.propagate(accuseEvent, w.eis.calculateImpact(accuseEvent, 'achao', npcDefs[0].traits));

  // 秘密创建：阿超偷铁锤 → 全镇都知道了
  const secretId = w.secrets.create({
    content: '阿超偷了老强的铁锤',
    creatorId: 'xiaojing',
    initialHolders: [
      { npcId: 'achao', knowledgeLevel: 'FULL' },
      { npcId: 'xiaojing', knowledgeLevel: 'FULL' },
      { npcId: 'laoqiang', knowledgeLevel: 'FULL' },
    ],
  });
  for (const id of ['xue', 'xiaona', 'laolong', 'mei', 'tao']) {
    w.secrets.addHolder(secretId, id, 'FRAGMENT', 'public_accusation');
  }

  printStateReport(w, '公开冲突两轮后');

  const relPairs = [
    ['xiaojing', 'achao', '小静→阿超(被羞辱)'],
    ['achao', 'xiaojing', '阿超→小静(被指控)'],
    ['laoqiang', 'achao', '老强→阿超(旧仇)'],
    ['xue', 'xiaojing', '雪→小静(旁观)'],
    ['xiaona', 'achao', '小娜→阿超(同情)'],
  ];
  printRelReport(w, relPairs);
  printSecrets(w);

  return w;
}

// ====================================================================
//  场景 E: 死亡哀悼 — 全社区的连锁反应
// ====================================================================
// 测试: loved_one_died / near_death_experience / witnessed_death
//       多角色同时受影响 + OCC 情感一致性（朋友悲伤同步）
//       日程覆写: MOURN — 长时间哀悼行为
//       EventChain 涟漪: 悲伤从中心向社区扩散

function runScenarioE() {
  hr('场景 E: 死亡哀悼 — 猎人涛意外身亡');

  const npcDefs = [
    { id: 'tao',      name: '涛',   job: '猎人',   traits: { o: 0.5, c: 0.4, e: 0.3, a: 0.3, n: 0.5 }, backstory: '独自住在森林边缘，与危险为伴' },
    { id: 'mei',      name: '美',   job: '商人',   traits: { o: 0.4, c: 0.7, e: 0.6, a: 0.5, n: 0.7 }, backstory: '年轻时失去爱人，涛是她唯一的精神寄托' },
    { id: 'xue',      name: '雪',   job: '药师',   traits: { o: 0.7, c: 0.5, e: 0.4, a: 0.7, n: 0.4 }, backstory: '涛的救命恩人，一直默默关心涛' },
    { id: 'laolong',  name: '老龙', job: '酒馆老板', traits: { o: 0.3, c: 0.6, e: 0.8, a: 0.6, n: 0.5 }, backstory: '涛在镇里唯一喝酒的地方' },
    { id: 'laoqiang', name: '老强', job: '铁匠',   traits: { o: 0.3, c: 0.8, e: 0.4, a: 0.3, n: 0.6 }, backstory: '给涛打过最好的猎刀' },
    { id: 'xiaona',   name: '小娜', job: '面包师', traits: { o: 0.5, c: 0.6, e: 0.3, a: 0.8, n: 0.6 }, backstory: '为人善良，容易为他人的痛苦而难过' },
    { id: 'achao',    name: '阿超', job: '农民',   traits: { o: 0.6, c: 0.3, e: 0.7, a: 0.3, n: 0.4 }, backstory: '对死亡没什么感觉，但会利用机会' },
  ];

  const w = buildWorld(npcDefs);

  // 种子关系 — 涛是社区中心人物
  w.graph.adjust('mei', 'tao', { affection: 0.9, trust: 0.8, debt: -0.5 }, '涛是美失去爱人后唯一的心理支柱');
  w.graph.adjust('tao', 'mei', { affection: 0.7, trust: 0.6 }, '涛知道美依赖自己');
  w.graph.adjust('xue', 'tao', { affection: 0.6, trust: 0.5, debt: 0.3 }, '涛曾救过雪的命');
  w.graph.adjust('laolong', 'tao', { affection: 0.4, trust: 0.5 }, '涛常来酒馆');
  w.graph.adjust('laoqiang', 'tao', { affection: 0.3, trust: 0.5, respect: 0.4 }, '为涛打造武器');
  w.graph.adjust('tao', 'laoqiang', { trust: 0.6, respect: 0.5 }, '信任老强的工艺');

  console.log('📖 猎人涛在森林深处遭遇野猪群攻击，不幸身亡。');
  console.log('   当药师雪发现涛的遗体时，一切都晚了...');
  console.log('   消息像野火一样传遍了整个小镇。\n');

  // 事件 1: 雪目击了涛的死亡 → witnessed_death
  console.log('🎬 事件 1: 雪在森林发现涛的遗体 (witnessed_death)\n');
  const deathWitness = {
    eventType: 'witnessed_death',
    participants: { actor: 'wild_boar', target: 'tao', witnesses: ['xue'] },
    intensity: 1.0,
    location: { id: 'deep_forest', narrativeTags: ['dangerous', 'isolated', 'death'] },
  };
  processParticipants(w, deathWitness, ['xue'], '雪目睹涛的死亡');

  // 事件 2: 全镇得知涛的死讯 → loved_one_died（对关系紧密者）
  console.log('\n🎬 事件 2: 消息传到镇上 (loved_one_died)');
  const deathEvent = {
    eventType: 'loved_one_died',
    participants: { target: 'tao', witnesses: ['mei', 'laolong', 'laoqiang', 'xiaona', 'achao'] },
    intensity: 1.0,
    location: { id: 'town', narrativeTags: ['death', 'grief', 'community'] },
  };
  processParticipants(w, deathEvent, ['mei', 'laolong', 'laoqiang', 'xiaona', 'achao'], '涛的死讯传遍全镇');

  // 事件 3: 美受到巨大打击 → near_death_experience（心理上）
  console.log('\n📖 美在得知涛的死讯后，精神崩溃，闭门不出...');
  // 美已经有极高压力，再加一个事件触发防线
  const meiState = w.internalStates.get('mei');
  const griefEvent = {
    eventType: 'near_death_experience',
    participants: { target: 'mei' },
    intensity: 0.95,
    location: { id: 'mei_home' },
  };
  w.brains.get('mei').processEvent(griefEvent);
  console.log(`  美 压力: ${pf(meiState.stress)} 心理: ${meiState.getPsychStateLabel()}`);

  // 涟漪
  console.log('\n  🌊 涟漪传播...');
  w.chain.propagate(deathEvent, w.eis.calculateImpact(deathEvent, 'mei', npcDefs[1].traits));

  // 雪创建秘密记录
  const secretId = w.secrets.create({
    content: '涛死于野猪袭击',
    creatorId: 'xue',
    initialHolders: [
      { npcId: 'xue', knowledgeLevel: 'FULL' },
    ],
  });
  for (const id of ['mei', 'laolong', 'laoqiang', 'xiaona', 'achao']) {
    w.secrets.addHolder(secretId, id, 'FULL', 'town_gossip');
  }

  printStateReport(w, '死亡哀悼后');

  // 查看记忆：看谁留下了最深印象
  console.log('\n  🧠 关键记忆（Importance > 0.5）:');
  for (const [id, mem] of w.memories) {
    const recent = mem.getRecentForPrompt(5);
    for (const e of (recent?.events || []).slice(0, 2)) {
      if (e.importance > 0.5) {
        console.log(`    ${w.npcs.get(id).name}: "${e.content}" (importance=${e.importance.toFixed(2)})`);
      }
    }
  }

  const relPairs = [
    ['mei', 'tao', '美→涛(已故)'],
    ['xue', 'tao', '雪→涛(发现者)'],
  ];
  printRelReport(w, relPairs);
  printSecrets(w);

  return w;
}

// ====================================================================
//  场景 F: 玩家介入冲突 — 调解 / 站队 / 贿赂 / 攻击
// ====================================================================
// 测试: 玩家作为第三者介入 NPC 社会关系
//       玩家送礼影响 NPC 好感
//       玩家攻击 NPC → 社区连锁反应
//       玩家站队公开冲突 → NPC 关系分化
//
// 四种介入方式:
//   F1: 玩家调解三角恋 → 送美礼物 + 安慰 → 美好感回升
//   F2: 玩家贿赂小娜 → 探知秘密 → 决定是否揭发
//   F3: 玩家攻击欺凌者 → 目击者反应分化
//   F4: 玩家在公开冲突中选择站队 → NPC 结成"挺玩家"和"反玩家"阵营

function buildWorldWithPlayer(npcDefs) {
  const w = buildWorld(npcDefs);
  // 把玩家也注册为 NPC 以建立关系
  const playerState = new NPCInternalState('player', {
    traits: { openness: 0.5, conscientiousness: 0.5, extraversion: 0.6, agreeableness: 0.6, neuroticism: 0.4 },
    mood: { happiness: 0.5, anger: 0, fear: 0, surprise: 0 }, needs: {},
  }, null);
  w.internalStates.set('player', playerState);
  w.npcs.set('player', { id: 'player', name: '玩家', job: '冒险者', backstory: '外来者' });
  w.memories.set('player', new MemorySystem('player'));
  // 玩家与所有 NPC 初始化关系
  for (const [id] of w.npcs) {
    if (id !== 'player') {
      w.graph.init('player', id);
      w.graph.init(id, 'player');
    }
  }
  // 玩家也需要一个 brain（使用默认大五人格 + 中等偏善良）
  const playerData = {
    id: 'player', name: '玩家', job: '冒险者',
    traits: { o: 0.5, c: 0.5, e: 0.6, a: 0.6, n: 0.4 },
    backstory: '外来者',
  };
  const playerBrain = makeBrain({
    id: 'player', data: playerData, npcs: w.npcs, graph: w.graph,
    internalStates: w.internalStates, memories: w.memories,
    eis: w.eis, br: w.br, schedule: w.schedule, secrets: w.secrets, chain: w.chain,
  });
  w.brains.set('player', playerBrain);
  // 更详细的 players 引用
  w.players = new Map();
  w.players.set('player', { id: 'player', name: '玩家' });
  return w;
}

// ========== F1: 玩家调解三角恋 ==========

function runScenarioF1() {
  hr('场景 F1: 玩家介入 — 调解三角恋');

  const npcDefs = [
    { id: 'mei',    name: '美',   job: '商人',   traits: { o: 0.5, c: 0.7, e: 0.8, a: 0.5, n: 0.7 }, backstory: '敢爱敢恨' },
    { id: 'tao',    name: '涛',   job: '猎人',   traits: { o: 0.4, c: 0.5, e: 0.4, a: 0.3, n: 0.5 }, backstory: '沉默' },
    { id: 'xue',    name: '雪',   job: '药师',   traits: { o: 0.6, c: 0.4, e: 0.3, a: 0.7, n: 0.3 }, backstory: '温柔' },
  ];

  const w = buildWorldWithPlayer(npcDefs);

  w.graph.adjust('mei', 'tao', { affection: 0.9, trust: 0.7 }, '深爱');
  w.graph.adjust('tao', 'xue', { affection: 0.85, trust: 0.6 }, '喜欢');
  w.graph.adjust('xue', 'tao', { affection: 0.5, trust: 0.4 }, '有好感');
  w.graph.adjust('player', 'mei', { affection: 0.1, trust: 0.1 }, '初次见面');

  console.log('📖 美发现涛和雪在一起，心碎崩溃。');
  console.log('   玩家作为外来者，决定介入调解...\n');

  // Step 1: 三角恋冲击
  const betrayalEvent = {
    eventType: 'betrayed',
    participants: { actor: 'tao', target: 'xue', witnesses: ['mei'] },
    intensity: 0.85,
    location: { id: 'lakeside' },
    isPlayerAction: false,
  };
  w.brains.get('mei').processEvent(betrayalEvent);

  console.log(`  美初始压力: ${pf(w.internalStates.get('mei').stress)} 心理: ${w.internalStates.get('mei').getPsychStateLabel()}\n`);

  // Step 2: 玩家找美谈话 → kind_stranger
  console.log('🎬 Step 2: 玩家找到美，送上礼物安慰她 (kind_stranger)\n');
  const comfortEvent = {
    eventType: 'kind_stranger',
    participants: { actor: 'player', target: 'mei' },
    intensity: 0.4,
    location: { id: 'mei_home' },
    isPlayerAction: true,
  };
  processParticipants(w, comfortEvent, ['mei', 'player'], '玩家安慰美');

  // Step 3: 玩家送礼物 → received_gift
  console.log('\n🎬 Step 3: 玩家送美一条稀有项链 (received_gift)\n');
  const giftEvent = {
    eventType: 'received_gift',
    participants: { actor: 'player', target: 'mei' },
    intensity: 0.5,
    location: { id: 'mei_home' },
    isPlayerAction: true,
  };
  processParticipants(w, giftEvent, ['mei', 'player'], '玩家赠送项链');

  // Step 4: 玩家鼓励美倾诉心事 → shared_secret_moment
  console.log('\n🎬 Step 4: 美向玩家倾诉内心的痛苦 (shared_secret_moment)\n');
  const shareEvent = {
    eventType: 'shared_secret_moment',
    participants: { actor: 'mei', target: 'player' },
    intensity: 0.45,
    location: { id: 'mei_home' },
    isPlayerAction: false,
  };
  processParticipants(w, shareEvent, ['mei', 'player'], '美向玩家倾诉');

  printStateReport(w, '玩家调解后');
  printRelReport(w, [
    ['mei', 'player', '美→玩家(恩人)'],
    ['player', 'mei', '玩家→美(被信任)'],
    ['mei', 'tao', '美→涛(旧情)'],
  ]);
  printSecrets(w);

  return w;
}

// ========== F2: 玩家贿赂探秘 ==========

function runScenarioF2() {
  hr('场景 F2: 玩家介入 — 送礼探知秘密');

  const npcDefs = [
    { id: 'achao',   name: '阿超', job: '农民',   traits: { o: 0.6, c: 0.3, e: 0.7, a: 0.3, n: 0.4 }, backstory: '手脚不干净' },
    { id: 'xiaona',  name: '小娜', job: '面包师', traits: { o: 0.5, c: 0.6, e: 0.3, a: 0.8, n: 0.5 }, backstory: '知道很多秘密' },
    { id: 'laoqiang',name: '老强', job: '铁匠',   traits: { o: 0.3, c: 0.8, e: 0.4, a: 0.3, n: 0.7 }, backstory: '丢了东西' },
    { id: 'laolong', name: '老龙', job: '酒馆老板', traits: { o: 0.3, c: 0.6, e: 0.8, a: 0.6, n: 0.4 }, backstory: '消息灵通' },
  ];

  const w = buildWorldWithPlayer(npcDefs);

  w.graph.adjust('achao', 'laoqiang', { resentment: 0.4, suspicion: 0.3 }, '摩擦');
  w.graph.adjust('xiaona', 'achao', { affection: 0.5, trust: 0.4 }, '小娜是阿超朋友');
  w.graph.adjust('xiaona', 'player', { affection: 0.2, trust: 0.15 }, '不熟的陌生人');
  w.graph.adjust('laolong', 'xiaona', { affection: 0.4, trust: 0.5 }, '常来酒馆');

  // 已有秘密: 阿超偷了老强的铁锤
  const secretId = w.secrets.create({
    content: '阿超偷了老强的铁锤',
    creatorId: 'achao',
    initialHolders: [
      { npcId: 'achao', knowledgeLevel: 'FULL' },
      { npcId: 'xiaona', knowledgeLevel: 'FULL' }, // 小娜目击了
    ],
  });

  console.log('📖 玩家怀疑阿超偷了老强的东西，但没证据。');
  console.log('   小娜是唯一知情人，但不会轻易告诉陌生人...\n');

  // Step 1: 玩家先和小娜搞好关系——送礼物
  console.log('🎬 Step 1: 玩家买小娜的面包，送她稀有的香料 (received_gift)\n');
  const giftEvent = {
    eventType: 'received_gift',
    participants: { actor: 'player', target: 'xiaona' },
    intensity: 0.3,
    location: { id: 'bakery' },
    isPlayerAction: true,
  };
  processParticipants(w, giftEvent, ['xiaona', 'player'], '玩家送小娜香料');

  // Step 2: 帮小娜忙 → kind_stranger
  console.log('\n🎬 Step 2: 玩家帮小娜搬货 (kind_stranger)\n');
  const helpEvent = {
    eventType: 'kind_stranger',
    participants: { actor: 'player', target: 'xiaona' },
    intensity: 0.25,
    location: { id: 'bakery' },
    isPlayerAction: true,
  };
  processParticipants(w, helpEvent, ['xiaona', 'player'], '玩家帮忙搬货');

  // Step 3: 好感够了，小娜在酒馆说漏嘴 → 玩家得知秘密
  console.log('\n🎬 Step 3: 好感提升后，小娜在酒馆对玩家透露了秘密...\n');
  const shareEvent = {
    eventType: 'shared_secret_moment',
    participants: { actor: 'xiaona', target: 'player' },
    intensity: 0.4,
    location: { id: 'tavern' },
    isPlayerAction: false,
  };
  processParticipants(w, shareEvent, ['xiaona', 'player'], '小娜告诉玩家秘密');

  w.secrets.addHolder(secretId, 'player', 'PARTIAL', 'xiaona');
  w.secrets.addHolder(secretId, 'laolong', 'RUMOR', 'xiaona');

  // Step 4: 玩家有选择——揭发 or 保密？模拟揭发路径
  console.log('\n📖 玩家得到了秘密，决定告诉老强...\n');
  console.log('🎬 Step 4: 玩家向老强揭发阿超偷铁锤\n');
  const accuseEvent = {
    eventType: 'publicly_accused',
    participants: { actor: 'player', target: 'achao', witnesses: ['laoqiang'] },
    intensity: 0.7,
    location: { id: 'blacksmith' },
    isPlayerAction: true,
  };
  processParticipants(w, accuseEvent, ['player', 'achao', 'laoqiang'], '玩家揭发阿超');

  printStateReport(w, '玩家探秘后');
  printRelReport(w, [
    ['player', 'xiaona', '玩家→小娜(建立信任)'],
    ['xiaona', 'player', '小娜→玩家(新朋友)'],
    ['player', 'achao', '玩家→阿超(揭发者)'],
    ['achao', 'player', '阿超→玩家(仇人)'],
    ['laoqiang', 'player', '老强→玩家(恩人)'],
  ]);
  printSecrets(w);

  return w;
}

// ========== F3: 玩家攻击 NPC → 社区连锁反应 ==========

function runScenarioF3() {
  hr('场景 F3: 玩家介入 — 攻击欺凌者引发的连锁反应');

  const npcDefs = [
    { id: 'achao',    name: '阿超', job: '农民',   traits: { o: 0.6, c: 0.3, e: 0.8, a: 0.2, n: 0.4 }, backstory: '镇上恶霸，欺负弱小' },
    { id: 'xue',      name: '雪',   job: '药师',   traits: { o: 0.7, c: 0.5, e: 0.3, a: 0.7, n: 0.3 }, backstory: '被阿超欺负的弱女子' },
    { id: 'laoqiang', name: '老强', job: '铁匠',   traits: { o: 0.3, c: 0.8, e: 0.4, a: 0.3, n: 0.7 }, backstory: '早就看阿超不顺眼' },
    { id: 'laolong',  name: '老龙', job: '酒馆老板', traits: { o: 0.3, c: 0.6, e: 0.8, a: 0.6, n: 0.4 }, backstory: '主张和平解决' },
    { id: 'xiaojing', name: '小静', job: '守卫',   traits: { o: 0.3, c: 0.9, e: 0.5, a: 0.3, n: 0.5 }, backstory: '维护法律，无论对错' },
    { id: 'xiaona',   name: '小娜', job: '面包师', traits: { o: 0.5, c: 0.6, e: 0.3, a: 0.8, n: 0.5 }, backstory: '胆小怕事，但心地善良' },
    { id: 'mei',      name: '美',   job: '商人',   traits: { o: 0.4, c: 0.7, e: 0.6, a: 0.5, n: 0.6 }, backstory: '同情弱者' },
  ];

  const w = buildWorldWithPlayer(npcDefs);

  // 种子: 阿超是恶霸，欺负雪
  w.graph.adjust('achao', 'xue', { resentment: 0.5, affection: -0.4 }, '经常欺负雪');
  w.graph.adjust('xue', 'achao', { fear: 0.6, resentment: 0.5, trust: -0.3 }, '雪怕阿超');
  w.graph.adjust('laoqiang', 'achao', { resentment: 0.5, suspicion: 0.4, affection: -0.3 }, '老强看不惯');
  w.graph.adjust('laolong', 'achao', { affection: 0.1, resentment: 0.2 }, '不太喜欢但和气生财');
  w.graph.adjust('xiaojing', 'achao', { suspicion: 0.6, resentment: 0.4 }, '知道阿超不是好东西');
  w.graph.adjust('xiaona', 'achao', { affection: 0.2, fear: 0.3 }, '有点怕');
  w.graph.adjust('mei', 'achao', { affection: -0.1, suspicion: 0.3 }, '听过传闻');

  // 玩家是外来者
  w.graph.adjust('player', 'achao', { affection: -0.2, suspicion: 0.2 }, '第一印象不好');

  console.log('📖 阿超又在街上欺负雪，抢了她的药篮子。');
  console.log('   玩家目睹了这一幕，忍无可忍...');
  console.log('   玩家冲上去打了阿超一拳！\n');

  // Step 1: 阿超欺负雪
  const bullyEvent = {
    eventType: 'publicly_humiliated',
    participants: { actor: 'achao', target: 'xue', witnesses: ['player', 'laoqiang', 'laolong', 'xiaona'] },
    intensity: 0.6,
    location: { id: 'market', narrativeTags: ['public', 'bullying'] },
  };
  w.brains.get('xue').processEvent(bullyEvent);
  console.log(`  雪被羞辱后: 压力${pf(w.internalStates.get('xue').stress)} 心理:${w.internalStates.get('xue').getPsychStateLabel()}`);

  // Step 2: 玩家攻击阿超！(正义的侠义行为)
  console.log('\n🎬 Step 2: 玩家保护雪，出手教训阿超 (righteous_violence, intensity=0.7)\n');
  const attackEvent = {
    eventType: 'righteous_violence',
    participants: { actor: 'player', target: 'achao', witnesses: ['xue', 'laoqiang', 'laolong', 'xiaona', 'mei', 'xiaojing'] },
    intensity: 0.7,
    location: { id: 'market', narrativeTags: ['public', 'violence', 'player_action'] },
    isPlayerAction: true,
  };

  // 先处理直接受害者阿超
  const achaoBrain = w.brains.get('achao');
  const result = achaoBrain.processEvent(attackEvent);
  console.log(`  ── 阿超(农民) ──`);
  console.log(`     ⚡ ${result.impact.severity.label} stress+${result.impact.stressDelta.toFixed(3)} role=${result.impact.role}`);

  // 然后处理所有目击者——每种 NPC 反应应该不同！
  for (const npcId of ['xue', 'laoqiang', 'laolong', 'xiaona', 'mei', 'xiaojing', 'player']) {
    console.log(`  ── ${w.npcs.get(npcId).name} (${w.npcs.get(npcId).job}) ──`);
    const brain = w.brains.get(npcId);
    const r = brain.processEvent(attackEvent);
    console.log(`     ⚡ ${r.impact.severity.label} stress${r.impact.stressDelta>=0?'+':''}${r.impact.stressDelta.toFixed(3)} role=${r.impact.role}`);
    if (r.summary.response?.matchedRuleId !== 'fallback') {
      console.log(`     ↪ ${r.summary.response.action} [${r.summary.response.matchedRuleId}] ${r.summary.response.responsePriority}`);
    }
    if (r.summary.response?.scheduleOverride) {
      console.log(`     📅 ${r.summary.response.scheduleOverride.type} / ${r.summary.response.scheduleOverride.duration}`);
    }
  }

  // 看到没人不同反应：
  // - 雪（受害者）: 应该感激玩家 → 好感UP ✓（actorRelationDeltas: trust+0.25 affection+0.3）
  // - 老强（讨厌阿超）: 暗爽 → 对玩家好感UP, 对阿超幸灾乐祸 ✓
  // - 老龙（和平派）: 不安, 觉得暴力不对 → 好感中立或微负
  // - 小静（守卫）: 法律角度不应支持私刑 → 好感略降
  // - 小娜（胆小）: 害怕暴力, 但有 actorRelationDeltas 的正向修正 → 混合

  // 涟漪
  console.log('\n  🌊 涟漪传播...');
  w.chain.propagate(attackEvent, w.eis.calculateImpact(attackEvent, 'achao', npcDefs[0].traits));

  printStateReport(w, '玩家侠义行为后社区反应');
  printRelReport(w, [
    ['player', 'achao', '玩家→阿超(攻击者)'],
    ['xue', 'player', '雪→玩家(救命恩人)'],
    ['laoqiang', 'player', '老强→玩家(干得好!)'],
    ['laolong', 'player', '老龙→玩家(太暴力)'],
    ['xiaojing', 'player', '小静→玩家(罪犯!)'],
    ['xiaona', 'player', '小娜→玩家(害怕)'],
    ['achao', 'player', '阿超→玩家(死敌!)'],
  ]);

  return w;
}

// ========== F4: 玩家站队公开冲突 ==========

function runScenarioF4() {
  hr('场景 F4: 玩家介入 — 公开冲突中选择站队');

  const npcDefs = [
    { id: 'laoqiang', name: '老强', job: '铁匠',   traits: { o: 0.3, c: 0.8, e: 0.4, a: 0.3, n: 0.7 }, backstory: '被偷了东西，想讨回公道' },
    { id: 'achao',    name: '阿超', job: '农民',   traits: { o: 0.6, c: 0.3, e: 0.8, a: 0.2, n: 0.4 }, backstory: '死不认账' },
    { id: 'laolong',  name: '老龙', job: '酒馆老板', traits: { o: 0.3, c: 0.6, e: 0.8, a: 0.6, n: 0.4 }, backstory: '和事佬，两边不得罪' },
    { id: 'xiaojing', name: '小静', job: '守卫',   traits: { o: 0.3, c: 0.9, e: 0.5, a: 0.3, n: 0.5 }, backstory: '公事公办，等证据' },
    { id: 'xiaona',   name: '小娜', job: '面包师', traits: { o: 0.5, c: 0.6, e: 0.3, a: 0.8, n: 0.5 }, backstory: '知道真相但不敢说' },
    { id: 'mei',      name: '美',   job: '商人',   traits: { o: 0.4, c: 0.7, e: 0.6, a: 0.5, n: 0.6 }, backstory: '谁赢帮谁' },
    { id: 'tao',      name: '涛',   job: '猎人',   traits: { o: 0.5, c: 0.4, e: 0.3, a: 0.3, n: 0.6 }, backstory: '冷眼旁观' },
  ];

  const w = buildWorldWithPlayer(npcDefs);

  // 初始格局: 五五开
  w.graph.adjust('laoqiang', 'achao', { resentment: 0.6, suspicion: 0.5, affection: -0.3 }, '死对头');
  w.graph.adjust('achao', 'laoqiang', { resentment: 0.5, affection: -0.2 }, '互看不顺眼');
  w.graph.adjust('xiaona', 'achao', { affection: 0.4, trust: 0.3 }, '朋友但心虚');
  w.graph.adjust('laolong', 'laoqiang', { affection: 0.5, trust: 0.5 }, '老朋友');
  w.graph.adjust('laolong', 'achao', { affection: 0.2, trust: 0.2 }, '认识');
  w.graph.adjust('xiaojing', 'achao', { suspicion: 0.5, resentment: 0.3 }, '怀疑');
  w.graph.adjust('xiaojing', 'laoqiang', { trust: 0.4, respect: 0.3 }, '信任');
  w.graph.adjust('mei', 'laoqiang', { affection: 0.2, trust: 0.4 }, '生意伙伴');
  w.graph.adjust('mei', 'achao', { affection: 0.1, trust: 0.1 }, '不熟');
  w.graph.adjust('tao', 'achao', { suspicion: 0.3, affection: -0.1 }, '不喜欢');

  // 玩家中立, 谁都不认识
  w.graph.adjust('player', 'laoqiang', { affection: 0.1, trust: 0.1 }, '刚认识');
  w.graph.adjust('player', 'achao', { affection: 0.1, trust: 0.1 }, '刚认识');

  console.log('📖 镇广场上，老强公开指责阿超偷了他的传家宝铁锤。');
  console.log('   两派人马各自站队，气氛紧张。');
  console.log('   玩家作为外来者，站在中间...');
  console.log('   所有人都看着玩家——你站哪边？\n');

  // Step 1: 公开冲突
  console.log('🎬 Step 1: 老强公开指控阿超偷窃 (publicly_accused)\n');
  const accuseEvent = {
    eventType: 'publicly_accused',
    participants: { actor: 'laoqiang', target: 'achao', witnesses: ['laolong', 'xiaojing', 'xiaona', 'mei', 'tao', 'player'] },
    intensity: 0.8,
    location: { id: 'town_square', narrativeTags: ['public', 'accusation', 'standoff'] },
  };
  for (const npcId of ['laoqiang', 'achao', 'laolong', 'xiaojing', 'xiaona', 'mei', 'tao', 'player']) {
    const brain = w.brains.get(npcId);
    const r = brain.processEvent(accuseEvent);
    console.log(`  ${w.npcs.get(npcId).name}: ${r.impact.severity.label} stress${r.impact.stressDelta>=0?'+':''}${r.impact.stressDelta.toFixed(3)} role=${r.impact.role}`);
  }

  // Step 2: 玩家选择站队——支持老强！
  console.log('\n📖 玩家站出来说:"我相信老强，阿超你在撒谎！"\n');
  console.log('🎬 Step 2: 玩家公开支持老强 (公开表态)\n');

  // 模拟玩家的表态——这是一个公开表态行为, 用 publicly_accused 从玩家视角指向阿超
  const sideEvent = {
    eventType: 'publicly_humiliated', // 玩家公开羞辱阿超的谎言
    participants: { actor: 'player', target: 'achao', witnesses: ['laoqiang', 'laolong', 'xiaojing', 'xiaona', 'mei', 'tao'] },
    intensity: 0.6,
    location: { id: 'town_square', narrativeTags: ['public', 'taking_sides'] },
    isPlayerAction: true,
  };

  for (const npcId of ['player', 'achao', 'laoqiang', 'laolong', 'xiaojing', 'xiaona', 'mei', 'tao']) {
    const brain = w.brains.get(npcId);
    const r = brain.processEvent(sideEvent);
    console.log(`  ${w.npcs.get(npcId).name}: ${r.impact.severity.label} stress${r.impact.stressDelta>=0?'+':''}${r.impact.stressDelta.toFixed(3)} role=${r.impact.role}`);
    if (r.summary.response?.matchedRuleId !== 'fallback') {
      console.log(`         ↪ ${r.summary.response.action}`);
    }
  }

  // 各方反应预期:
  // 老强: 感激 → 对玩家好感巨幅上升
  // 阿超: 仇恨 → 对玩家好感暴跌
  // 老龙: 支持朋友老强 → 对玩家好感上升
  // 小静: 感谢有人站出来 → 好感上升
  // 小娜: 左右为难, 压力上升
  // 美: 谁赢帮谁 → 观望
  // 涛: 无所谓 → 但认可玩家有胆量 → 尊重上升

  // Step 3: 站队后, NPC 阵营分化
  console.log('\n📖 站队效果——社会关系重组...\n');

  // 涟漪
  console.log('  🌊 涟漪传播...');
  w.chain.propagate(sideEvent, w.eis.calculateImpact(sideEvent, 'achao', npcDefs[1].traits));

  printStateReport(w, '玩家站队后社会格局');

  const relPairs = [
    ['laoqiang', 'player', '老强→玩家(盟友)'],
    ['achao', 'player', '阿超→玩家(敌人)'],
    ['laolong', 'player', '老龙→玩家(赏识)'],
    ['xiaojing', 'player', '小静→玩家(欣赏)'],
    ['xiaona', 'player', '小娜→玩家(复杂)'],
    ['mei', 'player', '美→玩家(观望)'],
  ];
  printRelReport(w, relPairs);

  return w;
}

// ====================================================================
//  主入口
// ====================================================================

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║    虚拟社会骨架 — 多场景叙事测试                    ║');
console.log('║    A: 三角恋  B: 温暖邂逅  C: 压力崩溃              ║');
console.log('║    D: 公开冲突  E: 死亡哀悼                         ║');
console.log('║    F1:调解恋  F2:送礼探秘  F3:攻击反应  F4:站队    ║');
console.log('╚══════════════════════════════════════════════════════╝');

const scenarios = process.argv[2];

function runAll() {
  runScenarioA();
  runScenarioB();
  runScenarioC();
  runScenarioD();
  runScenarioE();
  runScenarioF1();
  runScenarioF2();
  runScenarioF3();
  runScenarioF4();
}

function runNamed(label) {
  const map = {
    A: runScenarioA, B: runScenarioB, C: runScenarioC,
    D: runScenarioD, E: runScenarioE,
    F1: runScenarioF1, F2: runScenarioF2, F3: runScenarioF3, F4: runScenarioF4,
  };
  if (map[label]) { map[label](); }
  else { console.log(`未知场景: ${label}。可选: A B C D E F1 F2 F3 F4`); }
}

if (!scenarios) {
  runAll();
} else {
  for (const ch of scenarios.toUpperCase().split(',')) {
    runNamed(ch.trim());
  }
}

console.log('\n' + '═'.repeat(60));
console.log('✅ 全部场景测试完成。');
console.log('═'.repeat(60) + '\n');
