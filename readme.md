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
- **地图信息**：
  以下是针对 `assets/resources/level/levelData.json` 文件中地图信息的说明，适合添加到 README 中：

### 地图信息说明

在游戏中，地图数据存储在 `assets/resources/level/levelData.json` 文件中。该文件包含多个关卡的地图信息，每个关卡的地图数据结构如下：

- **id**: 关卡的唯一标识符。
- **name**: 关卡的名称。
- **description**: 关卡的描述，提供玩家对关卡的背景信息。
- **difficulty**: 关卡的难度等级，数值越大表示难度越高。
- **mapSize**: 地图的尺寸，包含宽度（width）和高度（height）。
- **developed**: 布尔值，指示关卡是否已开发完成。
- **unlocked**: 布尔值，指示关卡是否已解锁，可以被玩家访问。
- **mapData**: 地图的具体数据，包含以下字段：
  - **terrain**: 地形类型矩阵，表示地图上不同区域的地形类型。地形类型由 `TerrainType` 枚举定义，包括：
    - **基本土地** (0): 可正常通行和占领的基本地形
    - **人口重镇** (1): 提供额外资源增长的特殊地形
    - **政治中心** (2): 提供战略优势的重要地形
    - **大本营** (3): 玩家的主要基地
    - **高山** (4): 不可通行的地形，士兵无法穿越或占领
    - **湖泊** (5): 不可通行的地形，士兵无法穿越或占领
  - **ownership**: 土地所有权矩阵，表示每个格子当前的所有者ID。-1 表示该格子没有被任何玩家占领。
  - **troops**: 驻军数量矩阵，表示每个格子上驻扎的兵力数量。
  - **headquarters**: 大本营位置数组，包含每个玩家的大本营坐标，格式为 [玩家ID, x, y]。

```ts
export enum TerrainType {
    BASIC_LAND = 0,        // 基本土地
    POPULATION_CENTER = 1, // 人口重镇
    POLITICAL_CENTER = 2,  // 政治中心
    HEADQUARTERS = 3,       // 大本营
    MOUNTAIN = 4,          // 高山（不可通行）
    LAKE = 5               // 湖泊（不可通行）
}
```

- **players**: 关卡中的玩家信息数组，每个玩家包含以下字段：
  - **id**: 玩家唯一标识符。
  - **name**: 玩家名称。
  - **isAI**: 布尔值，指示该玩家是否为AI。
  - **aiLevel**: AI的难度等级（可选）。

- **gameRules**: 游戏规则设置，包含以下字段：
  - **baseIncreaseRate**: 基本土地增长周期。
  - **populationIncreaseRate**: 人口重镇的增长速率。
  - **headquartersIncreaseRate**: 大本营的增长速率。
  - **politicalCenterEffect**: 政治中心的效果。
  - **fogOfWar**: 布尔值，指示是否开启战争迷雾。
  - **visibilityRange**: 视野范围。
  - **winCondition**: 胜利条件，定义玩家获胜的标准。

#### 不可到达地形说明

游戏中的不可到达地形（高山、湖泊）具有以下特性：

1. **视觉表现**：高山和湖泊分别以不同颜色显示（棕褐色表示高山，蓝色表示湖泊）。
2. **交互限制**：
   - 玩家无法选择这些地形格子。
   - 这些格子不能被高亮显示。
   - 士兵无法被派遣到这些格子。
3. **寻路影响**：
   - 自动寻路算法会避开这些不可到达的地形。
   - 如果玩家尝试派遣士兵经过这些地形，游戏会自动寻找绕过的路径。
   - 如果无法找到到达目标的路径，派遣操作会被取消。
4. **战略意义**：
   - 不可到达地形可用于创建自然障碍，增加地图的策略性。
   - 这些障碍可以形成防御点或者迫使玩家选择特定的进攻路线。

要在关卡中添加不可到达的地形，只需在 `levelData.json` 文件的相应关卡的 `mapData.terrain` 矩阵中使用值 `4`（高山）或 `5`（湖泊）即可。

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

### 1. 游戏结束判断机制优化

#### 多层次游戏结束检测
- **大本营占领检测**：
  - 基于大本营归属进行胜负判断，而非玩家状态标记
  - 当玩家占领敌方大本营时，立即标记敌方为已击败状态
  - 全部敌方大本营被占领时，人类玩家胜利；人类玩家大本营被占领时，游戏失败

#### 高频率结束条件检查
- **多重触发点**：
  - 地块所有权变更时：`MapManager.checkHeadquartersStatus()`直接检查大本营状态
  - 定期检查：每3秒在`LocalGameController.update()`中执行一次全面检查
  - 事件驱动：所有可能导致游戏结束的事件（战斗、行军等）都会触发检查

#### 实现要点
- **不依赖固定ID**：使用`isAI`属性而非硬编码ID区分玩家类型
- **增强事件响应**：添加多级事件监听确保事件正确传播
- **详细日志**：使用【大本营】标签统一日志格式，方便调试跟踪

#### 技术细节
```typescript
// MapManager中直接检查大本营状态
private checkHeadquartersStatus(x: number, y: number, newOwnerId: number, oldOwnerId: number): void {
    // 检查变更的地块是否是某个玩家的大本营
    this._players.forEach(player => {
        if (player.headquarters && player.headquarters.x === x && player.headquarters.y === y) {
            // 如果大本营被占领，标记玩家为已击败
            if (player.id !== newOwnerId) {
                player.defeated = true;
                this.node.emit('player-defeated', player.id);
            }
        }
    });
}

// LocalGameController定期检查
private _checkGameEndCondition() {
    // 检查所有大本营状态
    let allAIDefeated = true;
    let humanDefeated = true;
    
    // 检查基于玩家类型而非ID
    const humanPlayers = this._playerManager.getPlayers().filter(p => !p.isAI);
    const aiPlayers = this._playerManager.getPlayers().filter(p => p.isAI);
    
    // 检查胜负条件并显示结果
    if (allAIDefeated && !humanDefeated) {
        this._gameOver = true;
        this._timeManager?.pauseGame();
        gameOverPanelComponent.showGameOver(true, aiPlayers.length);
    } 
}
```


## 六、总结
WarChessor是一个基于Cocos Creator开发的实时战略棋盘游戏，结合了RTS的策略性和棋盘游戏的精确操作。通过实时AI行为和玩家并行操作，提供了紧张刺激的游戏体验。项目采用模块化设计，各系统间松耦合，便于扩展和维护。游戏结束判断机制基于大本营控制权，确保游戏结果的准确判定。未来将持续优化游戏性能，并添加更多特色玩法，为玩家提供更丰富的战略选择。
