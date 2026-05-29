# image2 换皮生图模板

## 使用方式

这个模板用于后续换皮主题。原则是：

- 大背景单张生成，保证构图完整。
- 标题单张生成，保证文字清晰。
- 角色单独生成 5 帧，方便做 idle 动画。
- 按钮、排行榜、HUD 这类小 UI 可以合图。
- 棋盘格和道具提示图必须放在同一张里生成，保证玩法元素一致。

使用前替换这些占位：

- `{GAME_NAME}`：小游戏名称，例如“图书馆别占座”。
- `{THEME}`：主题场景，例如“大学图书馆自习室”。
- `{TARGET_OBJECT}`：隐藏目标/玩法目标，例如“被占用的座位”。
- `{GRID_TILE}`：棋盘格元素，例如“图书馆自习座位/桌位”。
- `{MASCOT}`：首页角色，例如“被占座的自习座位”。
- `{STYLE_NOTES}`：主题风格补充，例如“蓝绿色 + 暖木色，清爽明亮”。

生成后建议放到：

`assets/image-2/{branch-or-theme-name}`

## 统一要求

主题：`{GAME_NAME}`。

玩法底层不能变：方格观察、排除干扰、找到隐藏目标。格子在这个主题里代表 `{GRID_TILE}`，不要画成无关杂物。

统一风格：2D 休闲微信小游戏，`{THEME}`，柔和光照，干净边缘，`{STYLE_NOTES}`，轻微 Q 版但不要幼儿化。

统一禁止：不要真实照片，不要复杂人物，不要儿童，不要二维码，不要水印，不要品牌 logo，不要英文乱字。除标题 Logo 外，其他元素不要出现可读文字。

## 01_home_background.png

用途：`assets/RemoteBundle/images/menu_main_bg.png`

最终尺寸：`941x1672`

```text
Generate a 941x1672 vertical mobile game home background for a casual puzzle game called "{GAME_NAME}". A bright {THEME} scene with clear open composition, soft daylight, subtle environment details, {STYLE_NOTES}. Keep the upper center and middle area visually clean for title, mascot and menu buttons. 2D polished casual mobile game art, soft shadows, no humans, no animals unless the theme requires it, no readable text, no UI buttons, no watermark.
```

## 02_game_background.png

用途：`assets/RemoteBundle/images/背景图.png`

最终尺寸：`941x1672`

```text
Generate a 941x1672 vertical in-game background for a {GAME_NAME} puzzle. A quiet {THEME} scene with low visual noise and a grid-friendly layout so a puzzle board can be placed on top. Use {STYLE_NOTES}. 2D casual mobile game art, no readable text, no UI, no watermark.
```

## 03_title_logo.png

用途：`assets/RemoteBundle/images/menu_title_logo.png`

最终尺寸：`559x446`

```text
Generate a 559x446 transparent PNG title logo for a 2D casual mobile game. The Chinese title text must be exactly "{GAME_NAME}". Playful bold mobile game lettering, theme-relevant signboard style, small blank decorative tag, bright readable colors, clean outline, polished UI look. Transparent background. No watermark, no QR code, no extra text, no English.
```

## 04_character_5poses_sheet.png

用途：

- `assets/RemoteBundle/characters/menu_idle_static.png`
- `assets/BootstrapBundle/characters/menu_idle_static.png`
- `assets/RemoteBundle/characters/menu_idle/*.png`

目标裁切：

- 5 列 x 1 行。
- 每帧最终 `306x320`。

```text
Generate a transparent PNG sprite sheet arranged as exactly 5 equal columns and 1 row.

Create the same mascot in all 5 frames: {MASCOT}, suitable for a casual puzzle game called "{GAME_NAME}".

Frame 1: neutral idle pose.
Frame 2: slight lean left.
Frame 3: slight lean right.
Frame 4: small bounce up.
Frame 5: happy recovered pose.

Keep the same design, same colors, same proportions, same outline in every frame. Front-facing sprite, clean outline, soft shading, no background, no watermark, no readable text except tiny symbolic marks if needed.
```

## 05_menu_buttons_sheet.png

用途：

- `assets/RemoteBundle/images/menu_level_button.png`
- `assets/RemoteBundle/images/menu_daily_button.png`
- `assets/RemoteBundle/images/menu_survival_button.png`
- `assets/RemoteBundle/images/menu_rank_entry.png`

```text
Generate a transparent PNG UI sprite sheet for a 2D casual mobile game called "{GAME_NAME}". Place four separate UI assets with large transparent spacing for clean cropping.

Asset A: main level button background, rounded rectangular theme card, empty center for text.
Asset B: daily challenge large card background, playful theme notice board, empty center for text.
Asset C: survival mode large card background, theme timer card, empty center for text.
Asset D: leaderboard entrance icon, theme-relevant ranking entry icon.

Polished 2D casual mobile game UI, consistent style, transparent background, no watermark, no QR code, no readable text.
```

## 06_tile_and_guide_sheet.png

用途：

- `assets/RemoteBundle/balloon_atlas/*.png`
- `assets/BootstrapBundle/balloon_atlas/*.png`
- `assets/RemoteBundle/guide/second_hint_unlock.png`
- `assets/RemoteBundle/guide/fourth_hint_unlock.png`

重要：棋盘格和道具提示里的格子必须同图生成，保证它们长得一样。

```text
Generate a transparent PNG gameplay sprite sheet for a 2D casual mobile game called "{GAME_NAME}".

This sheet must use one consistent tile design everywhere. The tiles in the 12-tile grid and the tiles shown inside the two tutorial cards must look identical in shape, outline, perspective and shading.

Left top area: create a precise 4 columns by 3 rows grid of 12 separate top-down {GRID_TILE} tiles. Each tile should be clear as a puzzle grid tile, not a random object. Keep 12 color identities: purple, blue, green, pink, teal, rose, yellow, gray-blue, orange, steel-blue, brown, bright yellow.

Right upper area: create a vertical tutorial card for a quick-exclude hint tool. It should show a small grid using the exact same tile design, with several impossible tiles crossed out clearly. It should communicate "exclude wrong choices". No readable text.

Right lower area: create a vertical tutorial card for a target-lock hint tool. It should show a small grid using the exact same tile design, with one correct target tile highlighted by a glowing ring and check mark. It should communicate "show the correct target". No readable text.

Polished 2D casual mobile game style, clean outline, transparent background outside the assets, no readable text, no watermark.
```

## 07_hud_sheet.png

用途：

- `assets/RemoteBundle/images/hud_coin.png`
- `assets/RemoteBundle/images/hud_setting.png`
- `assets/RemoteBundle/images/hud_pill_base.png`
- `assets/RemoteBundle/images/hud_stamina_frame.png`
- `assets/RemoteBundle/guide/guide_finger.png`

```text
Generate a transparent PNG sprite sheet of small HUD and guide UI assets for a {GAME_NAME} puzzle game. Keep each asset separated with enough empty transparent space for cropping.

Asset A: theme currency icon, square icon, polished and readable at small size.
Asset B: clean settings gear icon with a small theme detail.
Asset C: long rounded status pill base, empty center for numbers.
Asset D: stamina frame shaped like a small theme card, empty center for text and numbers.
Asset E: friendly cartoon hand pointer icon, pointing downward, holding a small blank theme card.

2D casual mobile game UI, clean outlines, soft highlights, transparent background, no readable text, no watermark.
```
