# 像素沙盒 (Pixel Sandbox)

像素风 AI NPC 沙盒多人游戏。星露谷般的田园外观，黑暗人性的社交深度。

## 项目定位

外观是一个温馨的像素田园小镇，但 NPC 拥有完整的内心世界和 8 维关系系统。NPC 之间会自发产生爱恨情仇、背叛、谋杀、栽赃、三角恋等黑暗剧情，玩家可以通过对话和调查拼凑真相。

目标是让系统**涌现连开发者都意想不到的剧情**。

## 核心架构

| 模块 | 说明 |
|------|------|
| **社交戏剧引擎** | 周期性扫描世界状态，识别 NPC 关系中的"戏剧潜力"，通过 LLM 生成事件 |
| **NPC 主观世界模型** | 道具、场景通过 `narrativeTags` 与 NPC 内心状态关联，同一件物品对不同 NPC 意义截然不同 |
| **涟漪传播** | 事件通过 BFS 在关系网中传播（3 层衰减），旁观者也会受影响 |
| **秘密系统** | NPC 知情程度分层（全知/部分知情/碎片/谣言），秘密会自然传播 |
| **NPC 内心系统** | 压力值、9 维欲望系统、心理防线、信念系统、反应风格 |
| **8 维关系图** | 信任/爱慕/恐惧/尊敬/嫉妒/怨恨/亏欠/怀疑，含交叉涟漪效应 |
| **切片人格** | 8 个 NPC = 同一意识被实验切割成的 8 个碎片，每个有 3 种可变版本 |

## 完整社交管道

```
事件发生 → EventImpactSystem(冲击计算) → BehaviorResponse(行为匹配)
  → MemorySystem(记忆存储) → ScheduleSystem(日程覆写) → SecretSystem(秘密传播)
  → EventChain(涟漪BFS) → DramaEngine(导演编排)
```

## 技术栈

### 客户端
- **Godot 4.6+** — 主客户端
- GDScript — 游戏逻辑
- TileMapLayer + 自定义碰撞 — 地图系统
- CharacterBody2D + Area2D — 物理与交互
- npc_library_tool — 可视化 NPC 管理插件

### 服务器
- **Node.js** — 服务端（ESM 模块）
- **WebSocket (ws)** — 网络通信
- EventBus — 模块间解耦通信
- 存档：JSON 文件（世界 + 玩家双轨存档）

### AI
- **DeepSeek API** — NPC 对话与剧情生成
- LLM 作为"编剧顾问"而非行为执行者

## 对话系统

玩家靠近 NPC 时按 `T` 键进入对话：
- NPC 头顶显示实时生成的气泡对话（内容通过 DeepSeek API 生成）
- 底部输入框支持多轮对话
- NPC 在对话中停止移动
- NPC 拥有独立的性格设定和说话风格，对话风格各不相同

## 项目结构

```
pixel-sandbox/
├── godot_client/              # Godot 客户端
│   ├── scenes/                # 场景文件
│   ├── scripts/               # GDScript 脚本
│   │   ├── entities/          # 玩家、NPC 逻辑
│   │   └── world/             # 地图逻辑
│   ├── assets/                # 资源文件（地图、图标等）
│   ├── addons/                # Godot 插件
│   │   └── npc_library_tool/  # 可视化 NPC 管理工具
│   ├── generated/             # 自动生成的 NPC 场景
│   └── AI资源库/              # AI 生成素材（NPC 精灵、特效、音频）
├── server/                    # Node.js 服务端
│   ├── entities/              # 实体逻辑
│   ├── social/                # 社交系统（核心）
│   │   ├── EventImpactSystem  # 事件冲击计算
│   │   ├── BehaviorResponse   # 行为响应引擎
│   │   ├── ScheduleSystem     # 三层日程系统
│   │   ├── SecretSystem       # 秘密传播引擎
│   │   ├── EventChain         # 涟漪 BFS 传播
│   │   ├── DramaEngine        # AI 导演编排
│   │   └── NPCInternalState   # NPC 内心状态
│   ├── economy/               # 经济系统
│   ├── combat/                # 战斗系统
│   ├── core/                  # 核心框架（EventBus、TimeManager、SaveManager）
│   ├── world/                 # 世界管理（GameWorld、WorldState）
│   ├── data/                  # NPC 数据配置（npcs.json）
│   └── network/               # 网络通信（WebSocket）
├── DESIGN.md                  # 完整游戏设计文档
├── DEVELOPMENT.md             # 开发指南
└── PROGRESS.md                # 进度追踪
```

## 当前状态

**Phase 2** — NPC/社交深度升级进行中。虚拟社会骨架（事件→冲击→行为→日程→秘密→涟漪→戏剧引擎）已全部完成。

### 已完成
- 8 维关系图谱（信任/爱慕/恐惧/尊敬/嫉妒/怨恨/亏欠/怀疑）
- NPC 内心系统（压力/欲望/信念/防线/反应风格）
- EventImpactSystem（20 种事件类型 × 人格 × 关系）
- BehaviorResponse（29 条匹配规则，4 级优先级）
- ScheduleSystem（正常/异常覆写/永久改变三层）
- SecretSystem（4 级知情程度 + 传播动机计算）
- EventChain（BFS 涟漪传播，3 层衰减）
- DramaEngine（扫描→决策→LLM 生成→落地→广播）
- NPC 切片人格 + 说话风格系统

### 开发中
- 端到端场景整合（客户端 ↔ 服务器联调）
- 调查系统
- 核心玩法（采集、合成、建造）
