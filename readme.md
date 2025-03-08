# WarChessor - 实时战棋游戏

## 一、系统架构

### 1. 核心管理器体系

#### MapManager（地图管理器）
- **功能职责**：
  - 加载和解析地图数据（地形、所有权、兵力）
  - 创建和渲染地图网格
  - 管理地图格子的状态更新
  - 提供格子查询和操作接口
  - 地形类型包括：基本土地、人口重镇、政治中心、大本营
- **主要方法**：
  - `loadMapData(mapData: MapData)`: 加载地图数据
  - `createMapGrid()`: 创建地图网格
  - `getTile(x: number, y: number)`: 获取指定坐标的格子
  - `updateTileTroops(x: number, y: number, troops: number)`: 更新格子兵力
  - `updateTileOwnership(x: number, y: number, ownerId: number)`: 更新格子所有权

#### PlayerManager（玩家管理器）
- **功能职责**：
  - 管理所有玩家数据和状态（含AI和真实玩家）
  - 跟踪玩家拥有的土地和资源
  - 检查玩家胜负条件
  - 处理多玩家同时操作的状态同步
- **主要方法**：
  - `createPlayers(playerCount: number, aiCount: number)`: 创建玩家
  - `getPlayer(playerId: number)`: 获取指定ID的玩家
  - `getPlayerColor(playerId: number)`: 获取玩家颜色
  - `updatePlayerStats(playerId: number)`: 更新玩家统计数据
  - `checkVictoryCondition()`: 检查胜利条件

#### TimeManager（时间管理器）
- **功能职责**：
  - 管理游戏实时时钟
  - 处理游戏速度控制（加速/减速/暂停）
  - 协调各系统的实时更新频率
  - 触发周期性事件（如兵力增长、资源收集）
- **主要方法**：
  - `startGame()`: 开始游戏时钟
  - `pauseGame()`: 暂停游戏
  - `resumeGame()`: 恢复游戏
  - `setGameSpeed(speed: number)`: 设置游戏速度
  - `scheduleEvent(callback: Function, interval: number)`: 安排周期性事件

#### TroopManager（部队管理器）
- **功能职责**：
  - 管理部队实时移动和战斗逻辑
  - 维护并行的行军路径队列
  - 处理兵力分配和战斗解算
  - 实现行军状态更新和反馈
- **主要方法**：
  - `createMarchingPath(playerId: number, sourceTile: Vec2, targetTiles: Vec2[], troops: number)`: 创建行军路径
  - `processMarchingQueues()`: 实时处理所有行军队列
  - `resolveCombat(attackerId: number, defenderX: number, defenderY: number, attackingTroops: number)`: 解决战斗
  - `getMarchingStatus()`: 获取行军状态
  - `updateMarchingStatus()`: 更新行军状态

#### AIManager（AI管理器）
- **功能职责**：
  - 实现AI实时决策逻辑
  - 根据AI难度执行不同策略
  - 评估地图态势并做出行动决策
  - 与玩家同步行动，提供实时挑战
- **主要方法**：
  - `processAILogic(deltaTime: number)`: 执行AI逻辑，每帧调用
  - `evaluateMap()`: 评估地图态势
  - `findBestTarget()`: 寻找最佳攻击目标
  - `selectAttackPath()`: 选择进攻路径
  - `planDefense()`: 规划防御策略

### 2. 组件系统

#### TileComponent（格子组件）
- **功能职责**：
  - 管理单个地图格子的显示和交互
  - 处理格子点击事件
  - 更新格子的视觉状态（所有权、兵力、高亮等）
  - 显示地形和战争迷雾
- **主要属性**：
  - `background: Sprite`: 背景精灵
  - `troopsLabel: Label`: 兵力显示标签
  - `highlightNode: Node`: 高亮效果节点
  - `fogNode: Node`: 战争迷雾节点
  - `terrainIcon: Sprite`: 地形图标
- **主要方法**：
  - `onTileClicked()`: 处理格子点击事件
  - `setHighlight(highlight: boolean)`: 设置高亮状态
  - `updateOwnerDisplay()`: 更新所有者显示
  - `updateTroopsDisplay()`: 更新兵力显示
  - `updateVisibility()`: 更新格子可见性

#### LocalGameController（本地游戏控制器）
- **功能职责**：
  - 作为游戏主控制器，协调所有系统
  - 处理用户输入和UI交互
  - 管理游戏流程和状态
  - 实现特殊游戏功能（如派遣模式）
  - 处理AI和玩家的并行操作
- **主要方法**：
  - `update(dt: number)`: 每帧更新游戏状态
  - `_onTileSelected(tile: TileComponent)`: 处理格子选择
  - `_onDispatchButtonClicked()`: 处理派遣按钮点击
  - `_finishDispatchMode()`: 完成派遣模式
  - `_calculatePathBetweenPoints(start: Vec2, end: Vec2)`: 计算两点间路径
  - `_highlightTargetTiles()`: 高亮目标格子
  - `_clearHighlights()`: 清除高亮效果

## 二、RTS游戏核心机制

### 1. 实时操作系统
- **特点**：所有玩家（包括AI）同时进行操作，没有轮流行动的概念
- **技术实现**：
  - 使用`update`方法每帧处理游戏逻辑
  - 多线程处理玩家指令和AI决策
  - 设置优先级队列处理并发操作
- **时间控制**：
  - 游戏速度固定为一秒一步，最小的单位是一秒

### 2. 兵力增长与资源系统
- **自动增长**：
  - 各类土地按不同速率自动增长兵力（实时计时）
  - 基本土地：每5秒+1兵
  - 人口重镇：每1秒+1兵
  - 大本营：每1秒+1兵
  - 政治中心：本身不增加兵力，拥有一个政治中心后，所有其他节点增兵速度加快，人口重镇和大本营每一秒+2兵，基本土地每5秒+2兵

### 3. 渐变高亮效果实现
- **技术方案**：使用Cocos Creator的tween动画系统实现格子高亮的淡入淡出效果
- **实现步骤**：
  1. 在TileComponent中的highlightNode节点添加UIOpacity组件
  2. 实现高亮显示时的渐变效果代码：
  ```typescript
  private _highlightTargetTiles() {
      if (!this._mapManager) return;

      // 渐变高亮选中的格子
      if (this._selectedTile) {
          this._selectedTile.setHighlight(true);
          
          // 查找高亮节点
          const highlightNode = this._selectedTile.highlightNode;
          if (highlightNode) {
              // 获取或添加UIOpacity组件
              let uiOpacity = highlightNode.getComponent(UIOpacity);
              if (!uiOpacity) {
                  uiOpacity = highlightNode.addComponent(UIOpacity);
              }
              
              // 设置初始透明度为0
              uiOpacity.opacity = 0;
              highlightNode.active = true;
              
              // 使用tween实现渐变效果
              tween(uiOpacity)
                  .to(0.1, { opacity: 255 }) // 0.1秒内渐变至完全不透明
                  .start();
          }
      }
  }
  ```

### 4. 实时派遣路径系统
- **功能特性**：
  - 玩家可以随时发出部队移动指令
  - 玩家的部队移动指令需要进入指令队列进行排序，按照先进先出原则依次处理队列中的指令
  - 路径规划采用迪杰斯特拉算法

### 5. 实时战斗系统
- **战斗机制**：
  - 当两方部队在同一格子相遇时自动触发战斗
  - 暂不支持多方混战（2个以上玩家在同一格子）


### 6. AI系统
- **AI实时行为**：
  - AI和玩家同时行动，无需等待玩家操作
  - 实时评估局势，动态调整策略
  - 多级AI难度提供不同挑战性

## 三、组件交互与调用关系

### 1. 游戏主循环
- 游戏启动 → LocalGameController.start()
  - 初始化游戏系统和组件
  - 加载地图和玩家数据
  - 启动游戏时钟 → TimeManager.startGame()

- 每帧更新 → LocalGameController.update(deltaTime)
  - 处理用户输入
  - 更新AI行为 → AIManager.processAILogic(deltaTime)
  - 处理部队移动 → TroopManager.processMarchingQueues()
  - 更新地图状态 → MapManager.update()
  - 检查胜负条件 → PlayerManager.checkVictoryCondition()

### 2. 玩家操作流程
- 玩家点击格子 → TileComponent.onTileClicked() → LocalGameController._onTileSelected()
  - 判断是否可选择该格子
  - 高亮显示选中格子 → LocalGameController._highlightTargetTiles()
  - 在派遣模式下添加到路径点 → LocalGameController._handleDispatchModeSelection()

- 玩家点击派遣按钮 → LocalGameController._onDispatchButtonClicked()
  - 进入派遣模式
  - 更新UI状态
  - 等待玩家选择路径点

- 玩家完成派遣 → LocalGameController._finishDispatchMode()
  - 计算最终路径 → LocalGameController._calculatePathBetweenPoints()
  - 创建行军路径 → TroopManager.createMarchingPath()
  - 清除派遣模式状态
  - 更新行军状态面板

## 四、开发和调试指南

### 1. 项目结构
```
assets/
  ├── Scenes/               // 游戏场景
  │   ├── Main.scene        // 主菜单场景
  │   ├── Chooselevel.scene // 关卡选择场景
  │   └── LocalGame.scene   // 本地游戏场景
  ├── Scripts/
  │   ├── components/       // 组件脚本
  │   │   └── TileComponent.ts // 格子组件
  │   ├── managers/         // 管理器脚本
  │   │   ├── MapManager.ts
  │   │   ├── PlayerManager.ts
  │   │   ├── TimeManager.ts  // 替代原TurnManager
  │   │   ├── TroopManager.ts
  │   │   └── AIManager.ts
  │   ├── models/           // 数据模型
  │   │   ├── MapData.ts
  │   │   └── Player.ts
  │   └── utils/            // 工具类
  │        |—— LocalGameController.ts // 主控制器
  │        |—— ChooseLevel.ts
  │        |—— Main.ts
  │        └—— LevelItem.ts
  ├── resources/
  │   └── levels/          // 关卡数据
  │       └── levelData.json
  └── Prefabs/
      ├── Tile.prefab      // 格子预制体
      └── MarchingStatusItem.prefab // 行军状态项预制体
```


## 五、扩展功能与未来计划



## 六、总结
WarChessor是一个基于Cocos Creator开发的实时战略棋盘游戏，结合了RTS的策略性和棋盘游戏的精确操作。通过实时AI行为和玩家并行操作，提供了紧张刺激的游戏体验。项目采用模块化设计，各系统间松耦合，便于扩展和维护。未来将持续优化游戏性能，并添加更多特色玩法，为玩家提供更丰富的战略选择。
