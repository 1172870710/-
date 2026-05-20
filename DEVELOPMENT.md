# 像素沙盒 - 开发指南

> 目标：让 AI Agent 在最短时间内理解项目并开始工作。本文件不超过 200 行，只写关键信息。

## 项目概述

像素风 AI NPC 沙盒多人游戏，核心特色是 **社交戏剧引擎（Social Drama Engine）**：NPC 之间能自发产生爱恨情仇、谋杀、背叛等黑暗剧情，玩家可以调查、介入。

## 技术栈

- **服务端**：Node.js + Express + 纯 WebSocket（`ws`），DeepSeek API
- **客户端**：**Godot**（主客户端，Web 端已废弃）
- **启动器**：`app/launcher.js` — Edge/Chrome --app 模式桌面窗口
- **LLM**：DeepSeek API（`DEEPSEEK_API_KEY` 在 `.env`）

## 关键文件速查

### 当前架构（按功能域组织）

| 文件 | 作用 |
|------|------|
| `server/index.js` | 服务入口（组装依赖 + 启动） |
| `server/core/EventBus.js` | 全局事件总线 + 24 种标准事件 |
| `server/core/TimeManager.js` | 时间系统（日/季/年/小时/昼夜） |
| `server/core/SaveManager.js` | 存档系统（自动存档 + 每日存档） |
| `server/core/GameLoop.js` | 游戏主循环（30fps Tick + NPC 深思） |
| `server/world/GameWorld.js` | 世界状态管理（玩家/NPC/关系） |
| `server/world/TileMap.js` | 瓦片地图碰撞 |
| `server/world/WorldState.js` | 只读查询门面 |
| `server/entities/Player.js` | 玩家实体（HP、金币） |
| `server/entities/NPC.js` | NPC 实体（商店、HP） |
| `server/ai/NPCBrain.js` | NPC 双层决策（反应 500ms + LLM 深思 30s） |
| `server/ai/MemorySystem.js` | NPC 记忆 + LLM 压缩 |
| `server/ai/LLMClient.js` | DeepSeek API 客户端 |
| `server/ai/PromptBuilder.js` | LLM Prompt 构建 |
| `server/ai/DecisionParser.js` | LLM 回复解析 |
| `server/ai/BehaviorExecutor.js` | 行为执行器 |
| `server/combat/CombatSystem.js` | 战斗系统（攻击判定/伤害/复活） |
| `server/economy/ShopManager.js` | 商店交易 |
| `server/economy/GiftSystem.js` | 送礼系统 |
| `server/social/RelationshipGraph.js` | 8 维关系图谱 |
| `server/social/NPCInternalState.js` | NPC 内心系统（压力/欲望/信念/防线） |
| `server/network/WebSocketServer.js` | 纯 WebSocket 传输层 |
| `server/network/MessageRouter.js` | 传输无关的消息路由 |
| `server/network/Protocol.js` | 消息类型常量定义 |
| `server/data/npcs.json` | **NPC 核心配置** — 编辑此文件调整 NPC 名称/职业/性格/关系 |
| `server/data/NPCDataLoader.js` | NPC 数据加载（JSON → 运行时，自动补齐缺失 traits/mood） |
| `shared/` | 服务端+客户端共享常量/物品/地图 |

### 待建设模块
| 文件（待创建） | 作用 |
|------|------|
| `server/social/DramaEngine.js` | **★ 核心** — 戏剧引擎，扫描+生成事件 |
| `server/social/SecretSystem.js` | 秘密/谎言/揭发 |
| `server/social/NPCScheduler.js` | NPC 日程绑定时间 |
| `server/social/DramaPatterns.js` | 戏剧模式库 |
| `server/social/EventChain.js` | 事件链传播 |
| `server/systems/InvestigationSystem.js` | 玩家调查系统 |
| `server/schedule/` | 日程系统（待提取） |
| `server/drama/` | 戏剧系统（待提取） |
| `server/investigation/` | 调查系统（待提取） |

## 网络架构（Phase 1.1 新）

```
WebSocketServer（传输：连接管理、JSON 编解码）
       ↓ 注入 onSend / onBroadcast
MessageRouter（路由：传输无关，纯业务调度）
       ↓ 调用 GameWorld 方法
GameWorld（世界状态 + NPC AI）
```

## 核心设计理念

### NPC 社交八维关系
信任、爱慕、恐惧、尊敬、嫉妒、怨恨、亏欠、怀疑 —— 组合决定关系状态

### 戏剧引擎工作流
1. 扫描 NPC 关系图 → 识别"戏剧潜力"
2. 匹配戏剧模式 → 筛选触发条件达标的
3. LLM 生成事件种子 → 具体化事件
4. 事件链传播 → 涟漪式影响所有相关 NPC
5. 可视化 + NPC 行为变化 → 玩家可调查

### 道具/场景的主观意义
所有内容物注册时带 `narrativeTags`，戏剧引擎自动匹配：
- 道具对不同 NPC 有不同"主观意义"（取决于经历）
- 场景被事件"污染意义"后影响 NPC 行为

## Godot 项目结构（`godot_client/`）

```
godot_client/
├── project.godot              # Godot 4.6 项目
├── scenes/
│   ├── main.tscn              # 主入口场景
│   ├── game_world.tscn        # 游戏世界（待创建）
│   └── ui/                    # UI 面板（待创建）
├── scripts/                   # GDScript（待创建）
│   ├── globals/               # AutoLoad 全局单例
│   ├── world/                 # 世界/地图
│   ├── entities/              # 玩家/NPC
│   ├── ui/                    # UI 逻辑
│   └── systems/               # 摄像机/输入
├── assets/                    # 美术（待创建）
│   ├── sprites/               # 角色精灵 (28x28)
│   ├── tilesets/              # 瓦片集
│   ├── fonts/                 # 像素字体
│   └── sounds/                # 音效
└── data/                      # JSON 数据（已有）
    ├── constants.json
    ├── items.json
    └── map_data.json
```

## 场景搭建方案

| 方式 | 效率 | 适合场景 |
|------|------|---------|
| **Tiled Map Editor**（推荐） | 最高 | 城镇/室内/关键场景 |
| **程序化生成**（GDScript） | 高 | 野外/森林/大地图 |
| **混合方案**（最优） | — | Tiled 手工做城镇，代码批量填野外 |

推荐工具链（全部免费）：

| 环节 | 工具 | 产出 |
|------|------|------|
| 像素画 | Aseprite / LibreSprite | PNG 精灵/瓦片集 |
| 地图编辑 | **Tiled Map Editor** | .tmx 地图 |
| 字体 | zpix 等像素字体 | .ttf |
| 音效 | jsfxr / Chiptone | .wav |

场景树结构：
```
MainScene → WorldLayer(TileMap+装饰) → EntityLayer(玩家+NPC)
         → EffectsLayer(天气/粒子) → Camera2D → UILayer(HUD/对话/背包/调查)
```

## 开发约定

- 服务端新文件用 **ESM**（`import/export`），旧文件逐步迁移
- 消息协议用 JSON，后续可切二进制
- 新模块通过 `EventBus` 通信，不直接互相引用
- 先搭骨架再填细节
- 存档用 JSON 文件，后续换 SQLite
- Godot 中通过 GameState（AutoLoad）单例访问网络和世界数据
