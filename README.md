# game-reskin

换皮游戏专项仓库。

当前策略：`main` 分支保存一份来自 `E:\project\game\game_nmxxq\B` 的基础 Cocos Creator 工程快照；每个审核包或主题包从 `main` 新建独立分支，只改该主题需要替换的素材、配置和验收记录。

## Main 分支规则

`main` 只做基础工程 copy、公共同步和通用经验沉淀用途，不在 `main` 上做具体主题换皮修改。

所有游戏主题、素材替换、包名配置、OSS prefix、审核版本和验收记录，都必须在独立主题分支中完成。需要新包时，先从 `main` 新建分支，再在新分支里修改。

## 目录说明

- `assets/`：Cocos 工程资源，包含本地资源、远程资源源文件和脚本组件。
- `settings/`：Cocos 工程配置。
- `profiles/`：构建相关配置，仅保留必要的可提交配置文件。
- `README.md`：仓库用途、分支规则、通用换皮流程和踩坑记录；主题专属说明写在对应主题分支的 README 中。

## 分支约定

- `main`：基础工程快照，只做 copy 基线、公共同步和通用文档，不直接做具体主题换皮。
- 主题分支：从 `main` 切出，例如 `shangke-dianming`，只放该主题的换皮改动。
- 主题分支 README 可以补充当前主题名称、主题方向、素材清单、验收状态和特殊注意事项。

## 新主题建议流程

1. 从 `main` 新建主题分支。
2. 先确定游戏名称、主题方向、图标和平台基础信息。
3. 按 P0/P1/P2 拆换皮资源，不要一次性乱改所有文件。
4. 替换图片和音频时保留 `.meta`，除非明确知道 uuid 不被引用。
5. 构建后在微信开发者工具验收首页、关卡、提示、设置、结算、排行榜、音频和控制台。
6. 验收通过后再提交并推送主题分支。

## 通用换皮清单

### P0 必换

- 首页背景：`assets/RemoteBundle/images/menu_main_bg.png`
- 游戏内背景：`assets/RemoteBundle/images/背景图.png`
- 首页标题：`assets/RemoteBundle/images/menu_title_logo.png`
- 首页中间角色：
  - `assets/RemoteBundle/characters/menu_idle_static.png`
  - `assets/BootstrapBundle/characters/menu_idle_static.png`
  - `assets/RemoteBundle/characters/menu_idle/*.png`
- 棋盘格/棋子：
  - `assets/RemoteBundle/balloon_atlas/*.png`
  - `assets/BootstrapBundle/balloon_atlas/*.png`
- 主要按钮：
  - `assets/RemoteBundle/images/menu_level_button.png`
  - `assets/RemoteBundle/images/menu_daily_button.png`
  - `assets/RemoteBundle/images/menu_survival_button.png`
- 可见文案：代码、场景、弹窗、结算页、排行榜。

### P1 建议换

- 排行入口：`assets/RemoteBundle/images/menu_rank_entry.png`
- HUD 图标和状态条：
  - `assets/RemoteBundle/images/hud_coin.png`
  - `assets/RemoteBundle/images/hud_setting.png`
  - `assets/RemoteBundle/images/hud_pill_base.png`
  - `assets/RemoteBundle/images/hud_stamina_frame.png`
- 新手/提示图：
  - `assets/RemoteBundle/guide/guide_finger.png`
  - `assets/RemoteBundle/guide/second_hint_unlock.png`
  - `assets/RemoteBundle/guide/fourth_hint_unlock.png`
- 兜底首包资源：
  - `assets/BootstrapBundle/images/menu_level_button.png`
  - `assets/BootstrapBundle/images/hud_coin.png`
  - `assets/BootstrapBundle/images/hud_setting.png`
  - `assets/BootstrapBundle/images/hud_pill_base.png`
  - `assets/BootstrapBundle/images/hud_stamina_frame.png`

### P2 可后置

- 音效：`assets/BootstrapBundle/audio/`、`assets/RemoteBundle/audio/`
- 本地非远程 UI 小图：`assets/images/`
- 代码混淆：审核包构建前确认混淆方案，优先保证 Cocos 与微信小游戏运行不受影响。

## 构建与 OSS

- 本地替换资源后再构建，不直接手动改 OSS。
- 构建会生成远程资源包，再上传到 OSS。
- 每个主题建议使用独立 OSS prefix，例如：`nmxxq/wechat/<theme-branch>/`。
- 不要和其他换皮包共用默认 `nmxxq/wechat/`，避免互相覆盖资源。

## 换皮踩坑记录

这部分是给后续主题换皮复用的通用检查清单。

### 1. 不要只换 RemoteBundle

- 棋盘格子资源走 `AssetService.loadSpriteFrameDir('balloon_atlas')`。
- `balloon_atlas` 在 `AssetService` 里被配置为优先读取 `BootstrapBundle`，失败后才回退 `RemoteBundle`。
- 所以换棋盘/格子/座位时，必须同时检查：
  - `assets/RemoteBundle/balloon_atlas/*.png`
  - `assets/BootstrapBundle/balloon_atlas/*.png`
- 只换 `RemoteBundle` 会导致构建成功但运行时仍显示旧图。

### 2. 背景有两个真实入口

- 菜单背景主要是：`assets/RemoteBundle/images/menu_main_bg.png`
- 游戏内背景实际加载：`assets/RemoteBundle/images/背景图.png`
- 只换 `menu_main_bg.png`，进关卡后可能仍然看到旧背景或兜底背景。
- 背景图尺寸目前按原资源保持 `941x1672`，方便直接替换。

### 3. 资源路径名比文件内容更重要

- 代码里有些资源是按固定路径加载的，例如：
  - `images/提示-排除`
  - `images/提示-点名`
  - `images/背景图`
- 即使已经有 `tips1.png`、`tips2.png`，如果代码加载的是中文路径，运行时仍会报缺图。
- 换皮时要用 `rg -n "AssetService.loadSpriteFrame|loadSpriteFrameDir|images/" assets` 找真实加载路径。

### 4. 场景引用必须保留 meta 和 uuid

- `scene.scene` 里部分节点直接引用 SpriteFrame uuid。
- 例如心形节点 `aixin-001` 引用 `assets/images/爱心.png.meta` 里的 uuid。
- 如果只复制 png 不复制对应 `.meta`，Cocos 可能重新生成 uuid，场景引用就会断。
- 从原工程补资源时，优先 png 和 `.meta` 一起复制。

### 5. Cocos 构建后才会进入微信包

- 修改 `assets/` 里的源资源后，微信开发者工具不会自动看到新资源。
- 每次补图、改 meta、改场景文案后，都要重新用 Cocos Creator 构建。
- 微信开发者工具里看到的 `build/wechatgame` 是旧构建产物，不重新构建就会继续报旧问题。

### 6. 可见文案要单独扫

- 换图不等于换皮完成，代码和场景里会残留主题文案。
- 每个新主题至少扫一次：
  - `rg -n "牛马|找牛|气球|奶牛|只牛" assets`
  - 根据主题替换为新口径，例如“座位 / 点名 / 缺席目标”。
- 内部变量名如 `cowPositions`、`foundCowNum` 可以先不动，避免牵连玩法逻辑；优先改用户能看到的文案。

### 7. 菜单角色不等于关卡目标

- 菜单中间角色来自：
  - `assets/RemoteBundle/characters/menu_idle_static.png`
  - `assets/BootstrapBundle/characters/menu_idle_static.png`
  - `assets/RemoteBundle/characters/menu_idle/*.png`
- 关卡里显示出来的目标也会复用 `characters/menu_idle` 的帧。
- 所以只换静态图不够，动画帧目录也要一起检查。

### 8. 源素材不要长期放 assets/image-2

- 把 AI 原图放进 `assets/` 后，Cocos 会自动生成 `.meta`，Git 状态会变脏。
- 更推荐把原始大图放到 `reskin-preview/<theme>/source/` 或仓库外，再把处理后的正式素材放进 `assets/`。

### 9. 每次换皮后的最低验收

- 首页：标题、按钮、主角、背景是否都是当前主题。
- 进关卡：棋盘格子是否替换成功，背景是否正确。
- 点击/双击：目标出现时是否还是旧主题。
- 提示弹窗：图标和文案是否符合当前主题。
- 失败/结算：普通失败、每日挑战失败、生存结算、胜利结算都要进一次。
- 排行榜：入口、入口展开菜单、完整排行榜面板都要看，注意代码补字是否跟图标动画一起动。
- 控制台：不能有 `sprite missing`、`load failed` 之类资源错误。
- 文案扫描：主要可见文案不能残留旧主题词。

### 10. 首页入口不要只换图

- `menu_daily_button.png`、`menu_survival_button.png` 换皮后，视觉边界可能和原按钮节点大小不一致。
- 需要同时检查 `MainPanel.ts` 里的：
  - `dailyChallengeCard`
  - `survivalBar`
  - 对应 `UITransform` 点击区
- 如果只换图片，视觉上点到了按钮边缘，实际可能没点中节点。
- 首页布局也不能完全照搬原版；可以轻微调整位置、层次、底板和角度，但不要改节点名和点击绑定。

### 11. 排行榜文字要挂在会动的节点里

- 首页排行榜入口有浮动动画。
- 如果代码补的“排行榜”文字挂在入口外层，图片会动、文字不动，看起来会错位。
- 文字应挂在 `rankEntryImage` 里面，跟随图标一起浮动。
- 排行榜还要检查三个地方：
  - 首页入口
  - 入口展开菜单
  - 完整排行榜面板

### 12. 结算页不只一个 FailPanel

- 普通闯关失败：`assets/FailPanel.ts`
- 每日挑战结算：`assets/DailyChallengeOverPanel.ts`
- 生存模式结算：`assets/SurvivalOverPanel.ts`
- 胜利结算和成功反馈也可能在 `WinPanel.ts` 或 `DrawGridModules` 里。
- 只改 `FailPanel.ts` 会漏掉每日挑战失败、生存失败、普通胜利等页面。
- 这些页面通常是代码 `Graphics` 绘制，不一定有独立图片资源可换。

### 13. 提示框和设置弹窗也算换皮范围

- 通用提示框：`assets/PopupPanel.ts`
- 设置弹窗：`assets/SettingPanel.ts`
- 提示购买/解锁弹窗：`assets/DrawGridModules/DrawGridHud.ts`
- 这些弹窗容易被漏掉，因为它们不是首页资源，也不一定在截图第一眼出现。
- 每个主题至少要打开一次设置、提示、退出确认，检查是否仍是原版 UI 和旧文案。

### 14. 广告和分享失败不能静默

- 很多按钮逻辑是 `RewardService.requestReward` 或 `GameApp.platform.share`。
- 如果广告不可用、分享失败后直接 `return`，用户会觉得按钮没反应。
- 换皮验收时要点：
  - 看广告复活
  - 看广告重新挑战
  - 双倍体力
  - 求助好友/同学
- 无广告 ID 或广告不可用时，要么走明确的审核兜底，要么弹 Toast 提示，不能静默。

### 15. 改 UI 位置时保留节点名

- 很多点击绑定靠固定节点名查找，例如：
  - `reviveBtn`
  - `retryBtn`
  - `helpBtn`
  - `doubleBtn`
  - `continueBtn`
  - `menuLink`
  - `SurvivalReviveBtn`
  - `SurvivalRestartBtn`
- 换皮时可以改位置、颜色、布局、图形，但不要随手改节点名。
- 改完后用 `rg` 搜节点名，确认创建和绑定两边还能对上。

### 16. 音频也要纳入换皮范围

- 音频入口集中在 `assets/Core/SfxManager.ts`，不要只按文件夹猜测；真实播放路径以 `clipPaths`、`loadMenuBgm()`、`loadLevelBgm()` 为准。
- `assets/Core/AssetService.ts` 会把 `audio/` 路径解析到 bundle；其中这些音效优先走首包 `BootstrapBundle`，失败后才回退到 `RemoteBundle`：
  - `audio/ui_click`
  - `audio/mark`
  - `audio/unmark`
  - `audio/reveal_fail`
  - `audio/rule_violation`
- 所以换这些音效时，至少要检查：
  - `assets/BootstrapBundle/audio/ui_click.mp3`
  - `assets/BootstrapBundle/audio/mark.mp3`
  - `assets/BootstrapBundle/audio/unmark.mp3`
  - `assets/BootstrapBundle/audio/reveal_fail.mp3`
  - `assets/RemoteBundle/audio/ui_click.mp3`
  - `assets/RemoteBundle/audio/mark.mp3`
  - `assets/RemoteBundle/audio/unmark.mp3`
  - `assets/RemoteBundle/audio/reveal_fail.mp3`
  - `assets/RemoteBundle/audio/rule_violation.mp3`
- 当前实际需要换皮的 BGM：
  - `assets/RemoteBundle/audio/bgm.mp3`：首页/菜单循环音乐，当前约 `14.016s`
  - `assets/RemoteBundle/audio/level_bgm.mp3`：关卡/游戏中循环音乐，当前约 `14.808s`
- 当前实际需要换皮的 SFX：
  - `ui_click.mp3`：按钮点击，当前约 `0.216s`
  - `mark.mp3`：标记/点名格子，当前约 `0.264s`
  - `unmark.mp3`：取消标记，当前约 `0.216s`
  - `reveal_fail.mp3`：翻开失败/错误格，当前约 `0.282s`
  - `rule_violation.mp3`：规则违规提示，当前约 `1.320s`
  - `reveal_cow_treasure.wav`：找到目标/翻中奖励，当前约 `1.520s`
  - `level_win.mp3`：关卡成功，当前约 `3.816s`
  - `level_fail.mp3`：关卡失败，当前约 `0.792s`
  - `coin_gain.mp3`：金币/奖励到账，当前约 `0.127s`
  - `rule_intro.mp3`：规则说明出现，当前约 `2.880s`
- `assets/RemoteBundle/audio/reveal_cow_chime.wav` 当前目录存在，但未在 `SfxManager` 和 TS/scene/prefab 搜索中发现直接引用，暂时按可选旧资源处理。
- 替换音频时优先覆盖同名文件，保留原 `.meta`，避免 Cocos 资源 uuid 变化。
- 替换后必须重新用 Cocos Creator 构建；微信开发者工具看到的是 `build/wechatgame` 产物，不重新构建就可能还在播放旧音频。
- 最低试听验收：
  - 首页停留，确认 `bgm.mp3` 已换。
  - 进入关卡，确认 `level_bgm.mp3` 已换。
  - 点击按钮、标记、取消标记、翻开失败格，确认首包音效没有残留旧声音。
  - 完成一关、失败一关、领取金币/奖励、打开规则提示，确认远程包音效都符合当前主题。
