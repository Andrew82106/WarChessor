# WarChessor

## 一、游戏玩法设计细化

### 1. 核心机制优化

#### 兵力增长规则  
- **基本土地**：需至少1名士兵驻守，每5回合自动+1兵（可叠加政治中心效果）。若被敌军占领，驻军归零后需重新积累。  
- **大本营**：每回合固定+1兵，初始驻军设定为 0。若被攻陷，玩家立即失败。  
- **人口重镇**：占领后与大本营同频增长（每回合+1兵），建议地图中每50格设置1个，总数量不超过地图面积的5%。
- **政治中心**：  
  - 全局可见，本方缩短所有土地兵力增长周期（如占领1个则基本土地变为4回合+1兵，最多叠加至1回合+1兵）。  

#### 兵力运动规则
- 兵力运动速度恒定，每格一个回合。

### 2. 地图动态设计

#### 地形复杂度  
- **基础结构**：采用蜂窝状六边形网格（优于方形网格，增强策略性），地图尺寸支持10×10至 30×30动态生成。  
- **关键城镇分布**：  
  - 人口重镇优先布局在交通枢纽（如河流交叉口、山脉隘口）
  - 政治中心分散在地图四角或中心区域，需通过路径争夺。

### 3. 战斗与视野系统
- **占领判定**：军队数值高的方自动占领土地，若数值相等则双方兵力归零，土地被原来占领者拥有。  
- **视野机制**：  
  - 玩家仅可见已占领土地及外围1格（迷雾效果采用灰度渐变）
  - 政治中心以高亮图标全局显示。  

### 4. AI设计（本地关卡）
- **难度分级**：  
  - **简单AI**：优先防守大本营，兵力分散。
  - **困难AI**：主动抢占政治中心，采用"钳形攻势"包围玩家。
- **行为树逻辑**：根据玩家兵力密度动态调整策略，如低密度区域偷袭、高密度区域迂回。

## 二、UI/UX设计细化

### 1. 界面层级与交互

#### 主页面  
- **视觉风格**：极简线条风，背景纯色渐变。  
- **标题**：游戏名称"WarChessor"，图标为城堡(castle)，使用SVG生成。
- **按钮设计**：  
  - **本地模式**：图标为城堡，点击后弹出关卡选择浮层（显示关卡难度、地图尺寸、通关率）。  
  - **在线模式**：图标为卫星，点击后弹出Toast提示"指挥官，远征系统正在建设中！"并播放电流音效。

#### 战斗界面
- **状态面板**：右侧悬浮面板显示兵力统计、政治中心占领进度。 
- **地图渲染**：以用户颜色展示占领土地
- **缩放功能**：地图可缩放，放大时显示具体兵力，缩小时仅展示颜色
- **控制按钮**：左下侧放置行军按钮

#### 交互方式
- 用户通过点击行军按钮来开始行军
- 点击行军按钮后，用户可依次单击土地设置中转点（最多10个）
- 行军按钮点击后变为中止路径按钮，允许提前结束路径设置

### 2. 动态反馈与沉浸感
- **战斗特效**：政治中心被占领时播放全屏金色波纹动画。  
- **音效设计**：背景音乐根据战况动态切换（平静→紧张），关键事件配语音提示。

## 游戏界面

### 主界面
- **背景**：战棋主题背景图片
- **标题**：战棋大师（字体大小60px，白色）
- **按钮**：
  - 本地对战按钮：点击后进入关卡选择页面
  - 联机对战按钮：点击后显示"远征系统正在开发中"提示
  
游戏的第一个场景是主界面，玩家可以从这里进入本地对战模式或联机对战模式。主界面使用`Main.ts`脚本控制，目前已实现界面的基本布局，包括背景、标题和两个功能按钮。点击本地对战按钮会跳转到关卡选择页面，点击联机对战按钮会显示提示信息。

### 关卡选择页面
- **背景**：与主界面相同的背景图片
- **标题**：关卡选择（字体大小48px，白色）
- **滚动视图**：展示所有可选关卡
- **关卡项目**：
  - 关卡名称
  - 关卡描述
  - 难度等级（以星级表示）
  - 关卡预览图
  - 开始按钮
  - 锁定状态图标（未解锁的关卡）
- **返回按钮**：返回主界面

关卡选择页面允许玩家选择要挑战的关卡。未解锁的关卡显示为灰色，并带有锁定图标。关卡数据存储在`assets/resources/levels/levelData.json`文件中，可以方便地添加、修改或删除关卡。点击已解锁关卡的开始按钮将加载相应的游戏场景。

## 战棋游戏实现

本项目实现了一个RTS类战棋游戏，玩家和AI在四边形网格地图上争夺土地和资源。

### 重要修复

在开发过程中，我们解决了以下关键问题：

1. **修复地图数据加载问题**
   - 问题：`Cannot read properties of undefined (reading 'width')`和`关卡level1的地图数据无效`
   - 原因：JSON数据结构与代码期望的结构不匹配。地图尺寸在JSON中是关卡对象的顶层属性`mapSize`，而不是`mapData.size`
   - 解决方案：
     - 修改了`MapData`接口，使`size`字段成为可选的
     - 在`loadLevelData`方法中添加了逻辑，从`level.mapSize`复制到`level.mapData.size`
     - 增强了错误检查和日志记录，确保数据结构验证更全面

2. **修复Tile组件颜色显示问题**
   - 问题：格子颜色不正确显示
   - 解决方案：
     - 改进了`TileComponent`中的`updateOwnerDisplay`方法，使其能够正确获取PlayerManager和玩家颜色
     - 添加了地形颜色映射，使不同类型的格子有不同的基础颜色
     - 确保在格子初始化时正确设置节点状态

### Cocos Creator配置步骤

1. **资源目录结构**
   ```
   assets/
     ├── resources/
         └── levels/
             └── levelData.json
   ```

2. **Tile预制体设置**
   - 创建包含以下组件的Tile节点：
     - Sprite (背景)
     - Label (显示兵力)
     - Highlight节点 (选中效果)
     - Fog节点 (战争迷雾)
     - TerrainIcon节点 (地形图标)
   - 将TileComponent脚本添加到节点并正确设置引用

3. **LocalGame场景设置**
   - 确保LocalGameController脚本添加到场景根节点
   - 添加MapContainer节点并设置引用
   - 设置UI元素：回合显示、玩家显示、结束回合按钮等
   - 确保所有管理器脚本正确添加和初始化

### 调试技巧

1. 查看控制台日志，特别关注资源加载和数据解析过程
2. 使用Scene面板检查节点层次结构和组件设置
3. 确保预制体所有引用正确设置

### 游戏核心功能

- 地图生成与渲染
- 多种土地类型及其属性
- 玩家系统(用户和AI)
- 回合制系统
- 兵力增长机制
- 行军和战斗系统
  - 派遣部队时，源格子始终保留1个兵力作为守备
  - 经过己方土地时，会自动携带该地块上的所有士兵（组合兵力）
  - 战斗结果基于不同情况：
    1. 攻占无主土地：结果兵力 = 进攻兵力 - 无主土地兵力
    2. 攻击己方土地：直接更新为行军部队兵力
    3. 攻击敌方土地：按兵力对比决定胜负
  - 战斗平局时格子所有权不变，双方兵力归零
  - 行军路径自动计算，可以设置多个中转点
- 战争迷雾视野系统
- 胜负判定

### 新增功能：派遣路径设定

新增了派遣路径设定功能，允许玩家规划兵力移动路径：

1. **派遣按钮**：
   - 在游戏UI中添加一个"派遣"按钮
   - 点击后按钮文字变为"完成(X)"，X表示剩余可设置的路径点数
   - 可以随时点击"完成"按钮来结束路径点选择，系统会计算并执行行军路线

2. **路径设定**：
   - 进入派遣模式后，玩家点击地图上的格子来设置路径
   - 第一个选择的必须是玩家自己拥有的格子
   - 玩家可以选择任意格子作为路径点（不必相邻）
   - 系统会自动计算选择点之间的最短路径
   - 每次点击后X值减1，降至0或玩家主动点击完成按钮时结束设定

3. **路径计算**：
   - 完成选择后（点击"完成"按钮或者点数用完），系统会自动计算所有选择点之间的最短路径
   - 使用广度优先搜索(BFS)算法计算两点间最短路径
   - 如果计算出的路径超过20个点，会自动截断为20个点
   - 将计算好的最终路径添加到行军队列中

4. **行军状态显示**：
   - 在屏幕左侧添加了行军状态面板，显示当前行军队列中的路线状态
   - 无行军路线时，显示"无行军路线"（灰色文字）
   - 有执行中的行军路线时，显示"执行中：行军路线(A/B)"（绿色文字）
     - A表示当前执行到第几步
     - B表示行军路线总步数
   - 排队中的行军路线显示为"排队中：行军路线(B)"（橙色文字）
   - 面板会实时更新行军进度，完成后自动清除

5. **Cocos中实现步骤**：
   - 打开LocalGame场景，在UI节点下添加一个Button作为派遣按钮
   - 在Button旁添加一个Label显示剩余次数
   - 在屏幕左侧创建一个垂直布局的Node作为行军状态面板
   - 创建一个Label预制体作为行军状态项
   - 在Inspector面板中将相关UI组件拖拽到LocalGameController的对应属性中

6. **调试说明**：
   - 派遣模式下会在控制台输出详细日志
   - 可以看到路径选择过程和最终计算出的路径
   - 如遇问题，检查Tile预制体中是否包含Highlight节点
   - 确保marchingStatusPanel和marchingStatusItemPrefab已正确设置
