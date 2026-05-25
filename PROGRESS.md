# 像素沙盒 - 进度追踪

> **每次开发会话必须更新此文件**。记录做了什么、下一步是什么、遇到了什么问题。
> 格式：`[YYYY-MM-DD] 简述 - 详细说明`

---

## 当前状态

| 项 | 状态 |
|----|------|
| **Phase** | 2 — NPC/社交深度升级 🔄 进行中（2.1, 2.2 完成） |
| **架构状态** | ✅ 框架重构完成：按功能域组织，子系统解耦 |
| **Godot 客户端** | 占位场景已搭建：80×60 地图 + 8 个漫游 NPC + 地图碰撞 |
| **NPC 数据** | 已抽离为独立 JSON（`server/data/npcs.json`），编辑即生效 |
| **虚拟社会骨架** | ✅ 全部 6 个 Phase 完成：完整的事件→冲击→行为→日程→秘密→涟漪→戏剧引擎管道 |

---

## 开发历史

### 2026-05-22 — Phase 1: EventImpactSystem 完成

**完成**：
- 创建 `server/social/EventImpactSystem.js` — 统一的事件冲击计算引擎
  - 20 种事件类型目录（暴力/社交/背叛/知识/生死/温暖/经济/成就）
  - 确定性计算管道：事件类型 × 人格 × 关系 × 心理状态 → Impact
  - OCC 情感一致性机制（来自 Ochs et al. 文献）：旁观者的情绪同步度影响关系变化
  - 六档严重度（TRIVIAL→LIFE_CHANGING）+ 四档持续时间（MOMENTARY→PERMANENT）
  - `applyImpact()` — 自动将 Impact 写入 NPCInternalState / RelationshipGraph / MemorySystem
- 重构 `server/ai/NPCBrain.js`：
  - 新增 `processEvent(event)` 统一入口 — 所有外部事件走同一管道
  - `onAttacked()`/`onReceivedGift()`/`onSpokenTo()` 改为薄封装，优先走 EventImpactSystem
  - 保留降级路径：无 EventImpactSystem 时回退旧硬编码行为
- 更新 `server/world/GameWorld.js`：
  - 初始化 EventImpactSystem 并注入 serviceContext
  - 调整初始化顺序确保 NPCBrain 创建时已获得 impactSystem 引用

**验证**：
- 服务器启动成功，8 个 NPC 正常加载
- 单元测试通过：attacked(重大/0.14), betrayed+高神经质(改变人生/0.276), kind_stranger(轻微/-0.032), loved_one_died(改变人生/0.468/刻骨铭心)
- OCC 情感一致性测试：A 目击心爱的 B 攻击讨厌的 C → A 对 B 好感微升（团结感）；被心爱的人攻击 → 创伤性+防线触发+信念风险

**下一步**：跑通一个完整场景（例如：阿超偷老强的铁锤 → 目击 → 秘密传播 → 冲突升级 → 玩家介入）

### 2026-05-25 — 完整项目提交 GitHub

**操作**：
- 移除 `.godot/` 编辑器缓存文件跟踪（已加入 `.gitignore`）
- 提交并推送所有变更到 GitHub `origin main`
- 包括：社交系统、地图资源替换、npc_library_tool 插件、AI 资源库、enemy.gd 等

**未提交**：
- `文献/`（73MB PDF 参考文档，用户保留本地使用）

### 2026-05-25 — 删除不达预期的 AI 生成地图（待重新生成）

**操作**：
- 删除了 `godot_client/PixelworkMapStitch/` 整个地图包
- 删除了 `scenes/world/ai_generated_map.tscn` 场景
- 删除了 `scripts/world/ai_generated_map_setup.gd` 脚本
- 用户将在 Gemini 中重新生成地图后再导入

### 2026-05-25（续）— NPC 切片人格系统落地 + 说话风格

**设定确立**：
- 8 个 NPC = 同一真实人类意识被实验切片成的 8 个碎片
- NPC 之间的关系 = 这个人内心不同"声音"之间的对话
- 每个切片有 3 种可变版本（A/B/C），切换改变底层取向
- 玩家也是切片之一（元意识切片），能在不同切片组合间穿行
- "逃出去→另一个小镇" = 进入不同的切片组合实验组
- 三阶段叙事：阶段1温馨RPG → 阶段2发现异常 → 阶段3实验室真相（非超自然，而是脑机/虚拟实境实验）

**代码改动**：
- `server/data/npcs.json` — 8 个 NPC 增加 `slice`（原型/ID/可变维度）、`speaking_style`（语调/句式/语气词）、`catchphrases` 字段
- `server/data/NPCDataLoader.js` — 支持新字段，缺省自动填默认值
- `server/ai/PromptBuilder.js` — Prompt 新增【你的说话风格】板块，注入语调/句式/口头禅到 LLM 决策 prompt
- `server/ai/NPCBrain.js` — LLM 对话回复 prompt 也注入风格；新增 `getSliceInfo()` 方法暴露切片信息给 Godot 客户端

**8 个切片的说话风格**：

| NPC | 原型 | 语调 | 标志口头禅 |
|-----|------|------|-----------|
| 老龙 | 保护者 | 粗声粗气嗓门大 | "哼，我吃过的盐比你吃过的饭还多" |
| 小娜 | 纯真 | 软绵绵支支吾吾 | "啊...那个...就是说..." |
| 老强 | 暴戾 | 冲，咄咄逼人 | "你瞅啥？" |
| 阿超 | 根基 | 慢，一个字一个字蹦 | "啊...这个嘛...是吧？" |
| 美 | 交易 | 甜，见人下菜 | "哎呀~这不是那个谁嘛！" |
| 涛 | 逃避 | 含糊，醉醺醺 | "啊对对对...你说得都对..." |
| 雪 | 智慧 | 慢轻，故弄玄虚 | "你相信命运吗？" |
| 小静 | 秩序 | 认真，像在读公告 | "这不合规矩！" |

### 2026-05-24 — 新增`righteous_violence`事件类型 + 玩家介入场景

**完成**：
- 新增 `righteous_violence`（侠义行为）事件类型到 EventImpactSystem
  - 旁观者对义士（actor）：`actorRelationDeltas` = { trust: +0.25, affection: +0.3, respect: +0.25 }
  - 旁观者对恶霸（target）：`targetRelationDeltas` = { fear: +0.2, resentment: +0.3, suspicion: +0.15 }
  - 恶霸对义士（base）：{ trust: -0.3, affection: -0.3, fear: +0.3, resentment: +0.4 }
  - OCC 情感：`admiration`（敬佩）— 旁观正义行为触发正面情感
- 修改 `_buildRelationChanges` 支持 role-specific deltas（actorRelationDeltas / targetRelationDeltas）
- 新增 5 条 BehaviorResponse 规则：
  - `righteous_violence_cheer` — 与恶霸关系差 + 高外向 → 拍手叫好
  - `righteous_violence_defend_bully` — 恶霸的朋友 → 冲上去帮恶霸
  - `righteous_violence_flee` — 高神经质 → 害怕逃离
  - `righteous_violence_thank` — 被欺负者 → 靠近道谢
  - `righteous_violence_watch` — 默认围观
- 新增 4 个玩家介入场景（test_scenario.js F1-F4）：
  - F1: 调解三角恋（送礼 + 安慰 三步走）
  - F2: 送礼探秘（建立信任 → 套取秘密 → 揭发）
  - F3: 侠义行为（原来用`attacked`导致所有NPC怕玩家，改用`righteous_violence`后正确的社区反应）
  - F4: 站队冲突（玩家选边站后看出 NPC 阵营分化）

**验证**（F3 改造前后对比）：

| NPC | 改造前(attacked) | 改造后(righteous_violence) | 预期 |
|-----|:---:|:---:|:---:|
| 雪（受害者）→玩家 | -14% ❌ | **+76%** ✅ | 感激 |
| 老强（恨恶霸）→玩家 | -28% ❌ | **+74%** ✅ | 支持 |
| 阿超（恶霸）→玩家 | +59% ❌ | **-11%** ✅ | 仇恨 |

**设计意义**：NPC 社会认知系统现在能区分"正义暴力"和"恶意暴力"，基于 NPC 与参与者的关系自动产生不同的情感和关系变化。OCC 情感一致性在 witness 角色中起作用——`admiration` 情感与 `actorRelationDeltas` 结合，让支持义士的 NPC 产生团结感而非恐惧。

### 2026-05-24 — 多场景叙事测试 + 行为系统验证

**完成**：
- 重写 `test_scenario.js` 为模块化多场景测试框架
  - 通用世界构造函数 `buildWorld()` + 标准化 `makeBrain()` + 报告打印辅助
  - 支持单独运行 `node test_scenario.js A` 或全量 `node test_scenario.js`
- 5 个新场景覆盖全部 20 种事件类型的 15 种：

| # | 场景 | 事件类型 | 核心验证 |
|---|------|---------|---------|
| A | 三角恋 | betrayed + secret_exposed_self | OCC 情感一致性（嫉妒×爱慕×怨恨）、秘密自然传播 3→5 人 |
| B | 温暖邂逅 | kind_stranger + shared_secret_moment + received_gift | 正面事件链、跨 NPC 印象改观、stressDelta 减压正确 |
| C | 压力崩溃 | item_stolen → publicly_humiliated → betrayed → attacked | 4 打击→FRENZY、欲望爆发、`humiliated_explosive` CRITICAL 匹配 |
| D | 公开冲突 | publicly_humiliated → publicly_accused（双轮） | 8 NPC 同时受影响、多种反应风格差异（COLD/HIDE vs CONFRONT） |
| E | 死亡哀悼 | witnessed_death → loved_one_died → near_death_experience | CRITICAL 响应、MOURN 全社区覆盖、记忆 importance=1.0 |

**验证结果**：
- 全部 5 场景跑通，输出叙事连贯、心理状态变化合理
- 同一事件对不同人格/关系的 NPC 产生差异化 Impact（高神经质 0.8 比 0.3 承受更多 stress）
- 6 种反应风格均被触发：EXPLOSIVE（老强/老强→羞辱）、COLD（阿超→被指控）、CONFRONT（老龙→目睹冲突）、AVOIDANT/HIDE（美/涛→公开冲突）、COLLAPSE（美→死亡）、STOIC（小静→被羞辱）
- 涟漪传播 Layer1→2→3 衰减正确，低强度事件（<0.6）不传播
- 日程覆写 8 种类型匹配：AVOID_PERSON / HIDE_AT_HOME / PATROL_AREA / SEEK_REVENGE / MOURN / CELEBRATE / CONFRONT_PERSON / REPORT_TO_AUTHORITY

**已知设计待调优**：
- `loved_one_died` 对所有见证者统一 +0.5 stress，关系疏远者也承受同等冲击。后续建议：基础值 × (affection+trust)/2 关系系数

### 2026-05-24 — 事件自携带参数 + LLM 自定义事件 + 不对称关系机制通用化

**完成**：
- `calculateImpact` 支持事件对象自携带冲击参数（inline overrides）
  - 优先级：`event.stressBase` > `template.stressBase`
  - 支持所有字段：stressBase, desireDeltas, baseSeverity, relationDeltas, actorRelationDeltas, targetRelationDeltas, occEmotion, category
  - 无模板时也可用：`event.stressBase` 存在 → 自动用 event 自身字段 + 默认值
  - 无模板 + 无参数 → `_nullImpact()` 安全降级
- 不对称关系变化机制通用化（`actorRelationDeltas`/`targetRelationDeltas`）
  - `_buildRelationChanges` 检查 `event.*` 优先于 `def.*`
  - 任何自定义事件都可定义 actor/target 方向的不同关系变化
- 更新 `DramaEngine` 的 LLM Prompt + `ground()` 透传自定义参数
  - Prompt 新增可选的冲击参数说明（指导 LLM 如何控制 NPC 情感变化）
  - `ground()` 解构并透传：stressBase, desireDeltas, relationDeltas, actorRelationDeltas, targetRelationDeltas, baseSeverity, category
  - LLM 可自由创造新事件类型，无需注册 EVENT_TYPES 模板

**验证**：
- 无模板全自定义事件 → 正确计算 stress/desires/relations/memory ✅
- 不对称自定义事件 → witness 正确区分 actor 好感 + target 厌恶 ✅
- 无模板降级 → 零冲击 ✅

### 2026-05-23 — Phase 6: DramaEngine 完成 + 虚拟社会骨架全线贯通 🎉

**完成**：
- 创建 `server/social/DramaEngine.js` — AI 导演编排中心，约 420 行
  - **Phase 1 扫描**：RelationshipGraph 冲突 + SecretSystem 易泄露秘密 + ScheduleSystem 汇聚点 + 高压力 NPC
  - **Phase 2 决策**：4 级戏剧温度（平静→微澜→活跃→沸腾），按优先级选择介入策略
  - **Phase 3 生成**：LLM 优先（Dramatis Personae + Context + Instruction → JSON），降级为规则模板
  - **Phase 4 落地**：事件种子 → 调用每个涉及 NPC 的 processEvent() → 自动触发 S1-S5 全管道
  - **Phase 5 广播**：EventBus drama-event-triggered → 客户端
  - 规则降级：6 种场景模板（conflict_escalation / breakdown_crisis / social_encounter）
  - 加速秘密泄露：DramaEngine.accelerateLeak() — 手动触发最高 motivated 持有者传播
- 集成到 `server/world/GameWorld.js`：
  - _spawnNPCs() 后创建 DramaEngine（注入所有 8 个依赖）
  - tickNPCThink() 中调用 dramaEngine.tick()（每 5 分钟一次扫描）
- 集成到 `server/core/GameLoop.js`：戏剧引擎通过 GameWorld.tickNPCThink() 调度

**验证（完整管道）：**
```
扫描: 3 触发器（高冲突30分 + 汇聚点 + 压力崩溃0.88）
温度: 平静 → 沸腾 (score=100)
决策: conflict_escalation — 老强 vs 阿超
生成: "公开争吵" — 老强当众羞辱了阿超 (intensity=0.7)
落地: 2 NPCs 受影响
最终: 老强 焦虑(0.39) / 阿超 焦虑(0.39) / 雪 崩溃(0.88) / 其他 正常
```
- 服务器启动正常，DramaEngine 初始化成功 [LLM enabled]
- 低强度事件不触发涟漪传播 ✓
- 无 LLM 时规则降级正常 ✓

**整个虚拟社会骨架搭建完毕。**

### 2026-05-22（续）— Phase 5: EventChain 完成

**完成**：
- 创建 `server/social/EventChain.js` — BFS 涟漪传播引擎
  - BFS 从事件中心节点逐层向外传播（最多 3 层）
  - 分层衰减系数：Layer1 60% → Layer2 30% → Layer3 10%
  - **分层传播阈值**（Strander 统计验证）：
    - |strength| > 0.7 → 90% 概率传播
    - |strength| > 0.4 → 60% 概率传播
    - |strength| > 0.1 → 30% 概率传播
    - 否则不传播
  - 最小强度阈值：intensity < 0.6 不触发自发传播
  - 事件类型自动转换（attacked → witnessed_violence → rumor_heard）
  - severity 逐层降级
  - EventBus 事件广播
- 集成到 `server/ai/NPCBrain.js`：
  - processEvent() 中，intensity ≥ 0.6 的事件通过 setImmediate 异步触发涟漪传播
- 集成到 `server/world/GameWorld.js`：EventChain 注入 serviceContext

**验证**：
- B 攻击 A (intensity=0.9) → Layer 1: C/E/F 受影响 → Layer 2: D 受影响
- 逐层衰减正确：A 0.482 → Layer1 0.128 → Layer2 0.055
- 低强度事件 (intensity<0.6) 不触发传播 ✓
- 弱关系 (strength<0.1) 不传播 ✓
- 服务器启动正常

**下一步**：Phase 6 — DramaEngine（AI导演编排：扫描→决策→LLM生成→落地→传播）

### 2026-05-22（续）— Phase 4: SecretSystem 完成

**完成**：
- 创建 `server/social/SecretSystem.js` — 秘密管理系统
  - 四级知情程度：FULL → PARTIAL → FRAGMENT → RUMOR
  - 传播动机计算：人格(反应风格) × 压力 × 知情程度 × 社交需求
  - 传播目标选择：亲近度评分（bondScore = affection + trust），高者优先
  - 周期性传播扫描（每 60s）：动机 > 0.5 → 选目标 → FRAGMENT 级传播
  - 秘密揭发 + 受影响 NPC 列表
  - `getVolatileSecrets()` — 发现即将泄露的秘密（为 DramaEngine 准备）
  - toSnapshot/fromSnapshot 存档支持
- 集成到 `server/ai/NPCBrain.js`：
  - `_maybeCreateSecret()` — 自动从事件类型生成秘密（目睹暴力/背叛/秘密暴露等）
- 集成到 `server/world/GameWorld.js`：
  - tickNPCs() 每 60s 触发秘密传播扫描

**验证**：
- 秘密创建：3 人知情 → 传播动机正常计算
- 低压力(0.45) → 不触发传播 ✓；高压力(0.69) → 触发传播 ✓
- 揭发后 3 个受影响者正确返回
- Snapshot 恢复后计数器正确
- 服务器启动正常

**下一步**：Phase 5 — EventChain（涟漪传播 BFS）

### 2026-05-22（续）— Phase 3: ScheduleSystem 完成

**完成**：
- 创建 `server/social/ScheduleSystem.js` — 三层日程模型
  - Layer 1: 正常日程（基于游戏时间的日常行程，默认全天闲逛）
  - Layer 2: 异常覆写（事件触发，有 duration + decay，支持 12 种类型）
  - Layer 3: 永久改变（life_changing 事件触发，不 decay）
  - Duration 解析：temporary/1_day→14_days→permanent
  - 过期自动清理（每 3s 在 GameLoop 中调用）
  - `getConvergencePoints()` — 查找多个 NPC 同时同地的汇聚场景
  - toSnapshot/fromSnapshot 存档支持
- 集成到 `server/ai/NPCBrain.js`：
  - processEvent() 中 BehaviorResponse 的 scheduleOverride 自动推入 ScheduleSystem
- 集成到 `server/world/GameWorld.js`：
  - _spawnNPCs() 第四遍注册 NPC 到 ScheduleSystem
  - tickNPCs() 每 3s 调用 scheduleSystem.tick() 清理过期覆写

**验证**：
- 日程正确分层：正常 → 覆写 → 永久改变，优先级递增
- B 攻击 A → attacked_by_loved_one 规则 → HIDE_AT_HOME 覆写自动推入
- 过期覆写在第 tick 自动清理
- 服务器启动正常，8 NPC + 日程系统

**下一步**：Phase 4 — SecretSystem（秘密持有/传播/揭发状态机）

### 2026-05-22（续）— Phase 2: BehaviorResponseSystem 完成

**完成**：
- 创建 `server/social/BehaviorResponse.js` — 规则驱动的即时行为决策引擎
  - 29 条匹配规则覆盖 6 大场景类别
  - 优先级排序 (95→65)，首个完全匹配的规则胜出
  - 条件匹配引擎：支持 trait/rel/reaction_style/psych_state/role/event_category
  - 四种响应优先级（CRITICAL→LOW）：CRITICAL/URGENT 即使 LLM 深思也无法覆写
  - 12 种日程覆写类型（HIDE_AT_HOME/SEEK_REVENGE/MOURN/CELEBRATE 等）
  - 基于反应风格的降级默认响应
- 集成到 `server/ai/NPCBrain.js`：
  - processEvent() → EventImpactSystem(计算) → BehaviorResponse(匹配) → 覆盖决策
  - 规则引擎优先于旧的硬编码决策覆盖逻辑
- 更新 `server/world/GameWorld.js`：初始化 BehaviorResponse 并注入 serviceContext

**验证**：
- 被爱人攻击(高神经质)→ `attacked_by_loved_one` → flee/sad/CRITICAL/躲3天
- 回避型目击暴力 → `witness_violence_sneak_away` → flee/fearful/URGENT/躲3天
- 爆发型被公开羞辱 → `humiliated_explosive` → attack/angry/CRITICAL
- 服务器启动正常，8 NPC 加载成功

**下一步**：Phase 3 — ScheduleSystem（三层日程 + 覆写 + 永久改变）

### 2026-05-20 — 框架设计 + 项目清理

**决策**：
- 游戏方向：星露谷 Like 田园外观 + 黑暗人性社交深度
- 客户端：以 Godot 为主，Web 端已废弃
- 优先开发：深挖 NPC AI + 社交戏剧引擎
- 服务端架构：去掉 Socket.IO → 统一 WebSocket，引入时间系统/事件总线/戏剧引擎
- 地图方案：Tiled 手工做城镇 + 代码批量填野外（混合方案）
- 场景树：WorldLayer / EntityLayer / EffectsLayer / Camera2D / UILayer 五层结构

**清理**：
- 删除了 Godot 项目中的 12 个测试/森林实验文件
- 删除了根目录的临时文件（`temp_ai_extract2/`、`ai_test.py`、`mcp_proxy.py`、`.mcp_helper.sh`、`学习笔记.txt`）

**产出**：
- `.claude/CLAUDE.md` — Agent 自动加载指令
- `DESIGN.md` — 完整游戏设计框架文档
- `DEVELOPMENT.md` — Agent 开发指南（已加入场景搭建指南）
- `PROGRESS.md` — 本文件，进度追踪

### 2026-05-20（续）— Phase 1.1 完成

**完成**：
- 创建 `server/network/Protocol.js` — 定义 17 个消息类型常量
- 创建 `server/network/MessageRouter.js` — 传输无关的业务逻辑层
- 创建 `server/network/WebSocketServer.js` — 纯 ws 传输层（ws↔playerId 映射）
- 重写 `server/index.js` — 移除 Socket.IO，统一 WebSocket
- 删除 `SocketHandler.js`、`WebSocketHandler.js`
- 从 `package.json` 移除 `socket.io`、`socket.io-client`

**架构变化**：
- 网络层变成三层：`WebSocketServer`（传输）→ `MessageRouter`（路由）→ `GameWorld`（业务）
- 端口：HTTP 3001（静态文件 + 调试），WebSocket 3002（游戏连接）
- 旧 Web 客户端不再工作（它用 Socket.IO），Godot 客户端用 WebSocket 直连

### 2026-05-20（续）— Phase 1.2-1.3 完成

**完成**：
- 创建 `server/core/EventBus.js` — 发布/订阅 + 24 种标准事件 + 全局单例
- 创建 `server/core/TimeManager.js` — 日/季节/年循环 + 6 个昼夜时段 + 存档快照
- 改造 `server/index.js` — 游戏循环驱动时间，debug 显示时间状态

**效果**：
- 时间系统运行：`春 第1天 第1年 06:00（1x 流速）`
- 小时变化 → 自动广播 `time-update` 给客户端
- 日期变化 → 控制台日志 `📅 ...`
- 季节变化 → 广播 `season-changed`
- 后续任何模块只需 `bus.on(EVENTS.TIME_DAY_CHANGED, ...)` 即可接入时间系统

### 2026-05-20（续）— Phase 1.4 完成

**完成**：
- 创建 `server/core/SaveManager.js` — 世界 + 玩家双轨存档
- 集成到 `server/index.js` — 启动时自动加载/初始化，每天 + 每 60 秒自动存档
- `MessageRouter.js` 接入 EventBus — 玩家加入/离开时广播事件

**效果**：
- 存档在 `data/saves/`，服务端重启不会丢数据
- 自动存档 + 每日存档两个机制保证数据安全
- 存档版本号 `version: 1`，后续可兼容迁移

**Phase 1 全部完成** 🎉

### 2026-05-20（续）— Phase 2.1 完成：8 维关系图谱重写

**完成**：
- 创建 `server/social/RelationshipGraph.js` — 全新 8 维深度关系系统，替换旧 4 维版本
- 更新 `server/game/GameWorld.js` — 引用路径切换到新图谱，注入 EventBus
- 更新 `server/ai/NPCBrain.js` — `onAttacked` 增加怨恨/怀疑维度，`onReceivedGift` 增加亏欠维度
- 更新 `server/ai/PromptBuilder.js` — `_formatVisible` 展示关系状态 + 显著高维数据
- 更新 `server/core/SaveManager.js` — `_buildSaveData` 包含关系图谱快照

**8 维详解**：

| 维度 | 范围 | 默认 | 分层 |
|------|------|------|------|
| trust 信任 | -1~1 | 0.3 | betrayed→suspicious→neutral→trusting→devoted |
| affection 爱慕 | -1~1 | 0.3 | hatred→dislike→neutral→fond→love |
| fear 恐惧 | 0~1 | 0.1 | fearless→wary→afraid→terrified→paralyzed |
| respect 尊敬 | -1~1 | 0.3 | contempt→disrespect→neutral→respectful→reverence |
| jealousy 嫉妒 | 0~1 | 0 | content→envious→jealous→resentful→obsessed |
| resentment 怨恨 | 0~1 | 0 | forgiven→bitter→grudge→vengeful→bloodthirsty |
| debt 亏欠 | -1~1 | 0 | heavilyOwed → slightlyOwed → even → slightDebt → heavyDebt |
| suspicion 怀疑 | 0~1 | 0.1 | trusting→curious→suspicious→paranoid→conspiratorial |

**核心机制**：
- **关系状态机**：12种关系状态（陌生人→认识→朋友→挚友→爱人→竞争对手→敌人→死敌，含复合状态：痴迷爱慕/恐惧仆从/勉强盟友/苦涩对手）
- **交叉涟漪效应**：每维度变化时自动计算对其他维度的影响（如信任大跌→怀疑上升，爱慕变负→怨恨累积）
- **戏剧潜力扫描**：`getDramaPotentials()` / `scanGlobalDrama()` 扫描高冲突关系（爱恨交织/认知失调/深仇/痴恋）
- **EventBus 集成**：维度变化发出 `npc-relation-changed`，状态切换发出 `npc-relation-state-changed`
- **存档兼容**：`toSnapshot()` / `fromSnapshot()` 支持图谱序列化，版本号 v2

### 2026-05-20（续）— Phase 2.2 完成：NPC 内心系统

**完成**：
- 创建 `server/social/NPCInternalState.js` — 全方位 NPC 内心状态管理
- 集成到 `GameWorld`（创建实例 + 存入 Map）、`NPCBrain`（构造器接受 + reactiveUpdate/tick）
- 集成到 `PromptBuilder`（内心状态 + 心理指导注入 LLM prompt）

**内心系统五层结构**：

| 层 | 说明 | 变化频率 |
|----|------|---------|
| 心理状态 | 正常→焦虑→偏执→崩溃→狂暴（5 态） | 派生自压力 |
| 压力值 | 0~1 累积型，来源：被攻击/被背叛/羞辱/孤独/负债 | 每个 tick |
| 欲望系统 | 9 维：安全/社交/财富/权力/复仇/自由/守护/名誉/爱欲 | 事件驱动 + 衰减 |
| 信念系统 | 1~3 条行为准则（家人至上/弱肉强食/以德报怨等 8 种） | 几乎不变（可被打破） |
| 心理防线 | 5 类底线（家人受威胁/公开羞辱/秘密被揭发/爱人被夺走/尊严被践踏） | 压力超阈值→突破→因人而异的反应 |
| 反应风格 | 6 种风格，由大五人格计算（生成时确定不变） | 防线突破时决定反应模式 |

**6 种反应风格**：

| 风格 | 大五判定 | 防线被突破时的典型反应 |
|------|---------|---------------------|
| 爆发型 EXPLOSIVE | 高神经质 + 低宜人 | 当场暴怒/以命相搏/杀人灭口 |
| 隐忍型 STOIC | 高尽责 + 低神经 | 表面如常/暗中转移家人/默默记恨 |
| 冷谋型 COLD | 低神经 + 低宜人 | 不动声色/设计报复/以牙还牙 |
| 回避型 AVOIDANT | 高神经 + 高宜人 | 逃离/躲藏/羞愤离场/独自我放逐 |
| 崩溃型 COLLAPSE | 高神经 + 低外向 | 当场崩溃/跪地乞求/自毁倾向 |
| 直面型 CONFRONT | 高外向 + 低神经 | 正面对质/据理反驳/堂堂正正竞争 |

**核心机制**：
- **压力累积与恢复**：攻击 +0.15/背叛 +0.20/孤独每 tick +0.05，送礼 -0.08/社交 -0.05/时间恢复 -0.01
- **隐忍型内耗**：压力恢复速度减半（长期压抑难释怀）；爆发型防线突破后反而释放压力；回避型在孤立中压力更大
- **心理状态自动判定**：压力 0~0.3 正常，0.3~0.5 焦虑，0.5~0.7 偏执，0.7~0.9 崩溃，0.9~1 狂暴
- **防线突破**：压力超过防线阈值且随机判定 → 按反应风格匹配具体行为（5 防线 × 6 风格 = 30 种反应）
- **信念打破**：极端事件下信念可被摧毁 → 大压力 + 重新评估世界观
- **LLM 注入**：内心状态 + 反应风格 + 心理指导注入 prompt，指导 LLM 做出符合人格的决策
- **EventBus 事件**：`npc-stress-alert`/`npc-stress-state-changed`/`npc-desire-changed`/`npc-belief-broken`/`npc-defense-breached`

---

---

### 2026-05-20（续）— 场景占位搭建 + 文件清理

**清理**：
- 删除 `godot_client/scenes/` 中 7 个森林实验残留文件（`forest_3d.tscn`, `forest_auto.tscn`, `forest_final.tscn`, `forest_scene.tscn`, `_temp_switch.tscn`, `_test_new.tscn`, `_test_plane2.tscn`）
- 删除根目录 `generate_tscn.py`

**创建**：
- `assets/maps/tileset_placeholder.png` — 5 色块占位 tileset（草地/道路/墙壁/屋顶/水面，32×32）
- `assets/maps/tileset_placeholder.tsx` — Tiled tileset 定义
- `assets/maps/town.tmx` — 40×30 占位小镇地图（7 栋建筑 + 十字道路 + 池塘）
- `scripts/world/town_map.gd` — TMX 加载器 GDScript（解析 .tmx CSV → TileMapLayer）
- `scripts/entities/player.gd` — 可操控角色（WASD/方向键移动，蓝色方块占位）
- `scenes/world/town_map.tscn` — 整合场景（TileMapLayer + Player + Camera2D 跟随）

**效果**：
- 在 Godot 打开 `town_map.tscn` 即可看到占位小镇全貌
- 后续替换素材只需换 `tileset_placeholder.png`（保持 32×32 每个 tile），地图布局不变
- `.tmx` 可在 Tiled Map Editor 中打开编辑
- `project.godot` 主场景已改为 `res://scenes/world/town_map.tscn`

---

## Phase 1 — 基础设施重构（待开始）

### 1.1 去掉 Socket.IO，统一 WebSocket ✅ 已完成
- [x] 新建 `server/network/Protocol.js`
- [x] 新建 `server/network/MessageRouter.js`
- [x] 新建 `server/network/WebSocketServer.js`
- [x] 修改 `server/index.js`，移除 socket.io 依赖
- [x] 删除 `server/network/SocketHandler.js`
- [x] 删除旧 `server/network/WebSocketHandler.js`
- [x] 更新 `package.json`，移除 `socket.io` / `socket.io-client`
- [x] 服务端启动验证通过

### 1.2 引入 EventBus ✅ 已完成
- [x] 新建 `server/core/EventBus.js`
- [x] 实现：`on` / `off` / `once` / `emit`
- [x] 全局单例 + 标准事件类型常量 (EVENTS)
- [x] 24 种预定义事件类型（时间/玩家/NPC/戏剧/世界）

### 1.3 引入 TimeManager ✅ 已完成
- [x] 新建 `server/core/TimeManager.js`
- [x] 实现：游戏日/季节/年 循环
- [x] 默认 1 真实秒 = 1 游戏分钟（可通过 TIME_SPEED 环境变量调速）
- [x] 时间变更通过 EventBus 广播（hour/day/season/year + 时段 dawn/morning/noon/afternoon/night）
- [x] 集成到 server/index.js 游戏循环，debug 页面显示时间
- [x] 时间快照 toSnapshot/fromSnapshot（存档用）

### 1.4 引入存档系统 ✅ 已完成
- [x] 新建 `server/core/SaveManager.js`
- [x] 实现：自动存档（可配置间隔，默认 60 秒）
- [x] 实现：每日存档（每天切换时自动存）
- [x] 实现：玩家离线时单独存档
- [x] 存档位置：`data/saves/world_auto.json` + `data/saves/players/*.json`
- [x] `save(slot)` / `load(slot)` / `listSaves()` / `deleteSave(slot)`
- [x] MessageRouter 通过 EventBus 广播 PLAYER_JOINED / PLAYER_LEFT

---

## Phase 2 — NPC/社交深度升级（进行中）

### 2.1 8 维关系图谱 ✅ 已完成
- [x] 重写 `server/social/RelationshipGraph.js`
- [x] 实现：信任/爱慕/恐惧/尊敬/嫉妒/怨恨/亏欠/怀疑
- [x] 实现：关系状态机（12 种关系含复合状态）
- [x] 实现：交叉涟漪效应（维度间自动影响）
- [x] 实现：戏剧潜力扫描（getDramaPotentials / scanGlobalDrama）
- [x] 实现：EventBus 集成（npc-relation-changed / npc-relation-state-changed）
- [x] 实现：存档快照（toSnapshot / fromSnapshot）
- [x] 更新：GameWorld / NPCBrain / PromptBuilder / SaveManager

### 2.2 NPC 内心系统 ✅ 已完成
- [x] 新建 `server/social/NPCInternalState.js`
- [x] 实现：压力值（累积/恢复/阈值状态机）
- [x] 实现：欲望系统（9 维，事件驱动 + 自然衰减）
- [x] 实现：信念系统（8 种信条，可被极端事件打破）
- [x] 实现：心理防线（5 类底线，超阈值→极端行为触发）
- [x] 实现：心理状态机（正常→焦虑→偏执→崩溃→狂暴）
- [x] 集成：GameWorld / NPCBrain / PromptBuilder
- [x] 集成：EventBus 事件（stress-alert/stress-state-changed/desire-changed/belief-broken/defense-breached）

### 2.3 秘密系统
- [ ] 新建 `server/social/SecretSystem.js`
- [ ] 实现：秘密创建/传播/揭发/后果

### 2.4 日程系统
- [ ] 新建 `server/social/NPCScheduler.js`
- [ ] 实现：基于时间的 NPC 行程安排

### 2.5 戏剧引擎
- [ ] 新建 `server/social/DramaEngine.js`
- [ ] 新建 `server/social/DramaPatterns.js`
- [ ] 新建 `server/social/EventChain.js`
- [ ] 实现：关系扫描 → 模式匹配 → LLM 生成 → 事件链传播

### 2.6 调查系统
- [ ] 新建 `server/systems/InvestigationSystem.js`
- [ ] 新建 `server/systems/EvidenceSystem.js`
- [ ] 实现：线索管理、证词系统、推理机制

---

## Phase 3 — 核心玩法（后续）

- 背包系统、采集、合成、建造、任务系统

---

### 2026-05-20（续）— 地图扩大 4 倍 + tileset 扩增

**用户需求**：地图尺寸相比角色扩大四倍。

**改动**：
- `assets/maps/tileset_placeholder.png` — 从 5 tile 扩增到 8 tile（新增：木地板/栅栏/树木），全部带纹理细节
- `assets/maps/tileset_placeholder.tsx` — 更新引用的 tile 数量（5→8）和宽度（160→256）
- `assets/maps/town.tmx` — **40×30 → 80×60**（面积扩大 4 倍），新增内容：
  - 6 条主干道（3 横 3 纵），形成街区网格
  - 中央广场（10×10）+ 喷泉
  - 市政厅（8×7 大建筑）
  - NW 住宅区：旅馆/面包店/铁匠铺/小房屋
  - NE 商业区：商店/卫兵哨/3 个市场摊位
  - SW 农场区：农舍/田地/谷仓
  - SE 林地区：200 棵散落树木 + 池塘 + 栅栏围栏
  - 行道树 + 广场栅栏装饰
- `scripts/world/town_map.gd` — TileSet 创建从 5→8
- `scenes/world/town_map.tscn` — Camera2D zoom 从 1.5→1.0（更广视野）

**效果**：
- 地图从 1280×960 扩大到 2560×1920 像素（4 倍面积）
- 8 种 tile 类型（草地/道路/墙壁/屋顶/水面/木地板/栅栏/树木）
- 更多可探索区域：商业区、住宅区、农场、林地、中央广场

---

## 已发现的问题 & 待办杂项

- `.env` 中有 API Key，不应提交到 git
- `godot_ai_repo.zip` 是否还需要？
- `D:\pixel-sandbox\.gitignore` 需确认是否忽略了 `.env`

---

### 2026-05-20（续）— NPC 数据抽取为独立 JSON 配置文件

**用户需求**：当前 NPC 姓名/职业/背景数据是硬编码的临时内容，未来需要方便修改。

**改动**：
- 新建 `server/data/npcs.json` — **NPC 独立配置文件**，所有 NPC 定义集中管理
  - 8 个预设 NPC（老强/小娜/阿超/美/涛/雪/老龙/小静）
  - 每个 NPC 包含：id, name, title, gender, age, job, backstory, color, traits, shop, relationships
  - 可直接编辑 JSON 增删改 NPC，无需改代码
- 新建 `server/data/NPCDataLoader.js` — 加载 JSON + 自动合并默认值
  - `loadNPCData()` — 读取 JSON → 缺省字段自动生成 → 验证必填
  - `generateTraits(seed)` — 独立的确定性人格生成函数
- 修改 `server/game/NPC.js` — 构造函数从 `(id, personality, tileMap)` 改为 `(npcData, tileMap)`
  - shop 支持 JSON 指定优先，否则按 job 自动生成
  - color 从 npcData 读取
- 修改 `server/game/GameWorld.js` — `_spawnNPCs()` 从 JSON 读取
  - 三遍式创建：① 创建 NPC 实例 ② 初始化关系图 ③ 应用 JSON 预设关系
  - 控制台日志增加称号/性别/年龄
  - 构造器不再需要 `npcCount` 参数
- 修改 `server/ai/Personality.js` — 新增 `generateTraits(seed)` 导出
- 修改 `server/index.js` — 移除 `NPC_COUNT` 环境变量和构造参数

**效果**：
- 改 NPC 名称/职业/背景/颜色/性格/商店/关系 → 直接编辑 `npcs.json`
- 增删 NPC → 在 JSON 数组里加/删一条记录
- 缺省字段（traits/mood/needs）自动生成，JSON 中不必手动填写
- 服务端启动时自动加载 JSON，无需编译或转译

---

### 2026-05-20（续）— NPC 加入 Godot 场景 + 地图碰撞

**用户需求**：把 NPC 加进游戏场景，且要能碰撞建筑物/水池/栅栏等。

**改动**：

地图碰撞（`scripts/world/town_map.gd`）：
- 给不可行走的 tile（墙壁/屋顶/水面/栅栏/树木）添加碰撞多边形
- 启用 TileMapLayer 物理碰撞（collision_enabled = true, 物理层 1）
- Player 和 NPC 用 `move_and_slide()` 自动与地图碰撞

NPC 系统（Godot 客户端）：
- 新建 `scripts/entities/npc.gd` — CharacterBody2D 占位脚本
  - 彩色方块占位精灵（28×28）
  - 碰撞箱（24×24）
  - 漫游 AI：状态机（行走→暂停→行走），在家周围随机移动
  - 卡住检测：碰墙 1.5 秒自动换方向
- 新建 `scenes/world/npc.tscn` — NPC 模板场景
- `scenes/world/town_map.tscn` — 加入 8 个 NPC 实例：

| NPC | 位置（tile） | 颜色 | 活动范围 |
|-----|-------------|------|---------|
| 老龙（酒馆老板） | 旅馆门口 (5,14) | #d35400 | 旅馆周围 3 tiles |
| 小娜（面包师） | 面包店旁 (8,16) | #e67e22 | 面包店周围 2.5 tiles |
| 老强（铁匠） | 铁匠铺旁 (9,34) | #c0392b | 铁匠铺周围 3 tiles |
| 阿超（农夫） | 农舍门口 (5,53) | #27ae60 | 田地区域 5 tiles |
| 美（商人） | 商店门口 (41,14) | #8e44ad | 商店周围 3 tiles |
| 雪（药师） | 市场摊位 (57,18) | #2980b9 | 市场区 4 tiles |
| 涛（猎人） | 林地 (63,55) | #16a085 | 森林区 6 tiles |
| 小静（守卫） | 哨所旁 (60,34) | #2c3e50 | 东城区 4 tiles |

玩家出生点：中央广场南部（tile 28,30，喷泉正南方）

**效果**：
- 打开 `town_map.tscn` 即可看到 8 个 NPC 在各自区域漫游
- NPC 会绕过建筑物/水池/栅栏/树木（被墙挡住后自动换方向）
- 玩家可以用 WASD 在城镇中行走，建筑物和水面有碰撞
- NPC 速度和漫游范围各自不同（铁匠缓慢、猎人快速）

---

### 2026-05-20（续）— NPC 数据修复 + 框架重构

**NPC 数据修复**：
- 删除死代码 `server/ai/Personality.js`（hash/generateTraits 已迁移到 NPCDataLoader）
- `NPCDataLoader.js` 新增 `deriveMood(traits)` — JSON 未指定 mood 时基于大五人格自动推导
- 修复 `npc_5`（雪）和 `npc_7`（小静）重复的背景故事
- 修复 `index.js` 中 `NPC_COUNT` 未定义的启动错误

**框架重构（5 步）**：

1. **目录重组**：
   - `game/` → 拆分为 `entities/`、`world/`
   - 新建 `combat/`、`economy/`
   - 删除 `game/` 和已废弃的 `ai/RelationshipGraph.js`

2. **WorldState 查询门面**（`server/world/WorldState.js`）：
   - 统一只读查询入口，不暴露 GameWorld 内部结构
   - debug 端点改用 WorldState

3. **子系统提取**：
   - `combat/CombatSystem.js` — 攻击判定、伤害计算、复活逻辑
   - `economy/ShopManager.js` — 商店买卖
   - `economy/GiftSystem.js` — 送礼偏好计算
   - GameWorld 保留委托方法，向后兼容

4. **分层修复**：
   - WebSocketServer 不再直接访问 `router.world` → 改用 `router.handlePlayerJoin()`
   - index.js 猴子补丁 `router.broadcast = ...` → 移除，MessageRouter 自带公开 broadcast()
   - NPCBrain 参数从 9 个降为 5 个（ServiceContext 依赖注入）

5. **GameLoop 提取**（`server/core/GameLoop.js`）：
   - 主 Tick（30fps）+ NPC 深思（3s）封装为独立模块
   - index.js 瘦身为纯组装入口

**效果**：
- 每个功能域有明确的新文件位置（entities/ world/ combat/ economy/ social/ ai/ core/ network/）
- GameWorld 从上帝对象（~500 行）精简为核心协调器
- 网络传输层与业务逻辑层完全分离
- NPCBrain 构造器更清爽，新增 AI 组件只需加到 ServiceContext
