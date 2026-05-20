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

---

## 开发历史

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
