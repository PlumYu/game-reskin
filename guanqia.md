# 关卡生成与难度曲线

## 2026-05-13 执行方案

本轮目标不是只按 `target_difficulty` 生成关卡，而是建立一条完整流水线：

1. 按目标曲线生成候选。
2. 用修复后的评估函数重新计算真实难度 `actual_difficulty`。
3. 只接受 `actual_difficulty == target_difficulty` 且通过可读性策略的关卡。
4. 按真实难度和尺寸做确定性重排。
5. 发布到运行时真正读取的 `B/assets/levels`。

因此，最终上线曲线以 `actual_n / actual_difficulty` 为准，不以生成时传入的目标值为准。

## 生效目录

游戏代码通过 `configs/main/001`、`configs/survival/001`、`configs/daily_challenge/001` 加载关卡。

`AssetService` 会把 `configs/` 映射到名为 `levels` 的 bundle；这个 bundle 对应：

```text
B/assets/levels
```

所以线上生效路径是：

```text
B/assets/levels/main/*.json
B/assets/levels/survival/*.json
B/assets/levels/daily_challenge/*.json
```

`level-data.js` 只用于关卡浏览器/辅助查看，也要同步生成，但不是 Cocos 运行时的主要加载源。

## 难度评估原则

当前难度分为 `L1~L5`。

`target_difficulty` 只是生成目标；`actual_difficulty` 是重新评估后的真实难度。两者不一致时，以 `actual_difficulty` 为准。

评估函数必须关注玩家体感，而不只看旧的 `anchor_count / g_rule_count`：

| 指标 | 目的 |
|---|---|
| `first_place_round` | 第几轮第一次确定牛马，越晚越难 |
| `pre_place_exclusion_rounds` | 第一次确定前有多少轮排除 |
| `pre_place_excluded_cells` | 第一次确定前排除了多少格 |
| `g_large_count` / `largest_g_size` | 是否出现 `G4+` 大组合推理 |
| `small_region_count_2/3/4` | 小区域是否过密 |
| `region_imbalance` | 最大区域和最小区域是否严重失衡 |
| `uses_advanced_viability` | 是否使用高级可行性推理 `V` |
| `logic_event_count` | 总推理链长度 |

## L1~L5 定义

| 难度 | 定义 |
|---|---|
| `L1` | 4x4/6x6 入门；无 G 组推理；第一次确定牛马不能太晚 |
| `L2` | 普通关；允许少量 `G2/G3`，禁止 `G4+`，禁止长前置排除链 |
| `L3` | 中档关；允许中等联动和更长链路，但仍禁止 `G4+` 常态化 |
| `L4` | 高难关；出现 `G4+`、晚出第一只牛马、小块密集、区域严重失衡等都会进入 L4 |
| `L5` | 受控猜测/极限压力档；本轮三种玩法暂不常规使用 |

## 可读性策略

低难关比高难关更严格。

`L1/L2` 不允许：

- `G4+` 大组合推理。
- 过晚才第一次确定牛马。
- 过长的前置排除链。
- 2 格/3 格小区域过密。
- 区域大小严重失衡。
- 高级可行性推理 `V`。

`L3` 允许一定联动，但仍不允许 `G4+`。

`L4` 可以包含复杂结构，但仍不能出现尾盘纯猜。

## 曲线与重排

生成后的候选会按 `actual_n / actual_difficulty` 入池，然后按固定槽位确定性重排。

重排规则：

1. 优先使用完全匹配槽位的关卡：`actual_n == target_n` 且 `actual_difficulty == target_difficulty`。
2. 同一池内按 canonical level key 稳定排序。
3. 不使用随机 shuffle。
4. 同一输入、同一脚本、同一 seed，输出固定。
5. 如果某个槽位没有完全匹配关卡，直接失败，不静默降级。

## 2026-05-13 扩容发布结果

本次从 `200 / 50 / 50` 扩到：

| 玩法 | 发布数量 | 保留旧前段 | 新增区间 |
|---|---:|---:|---:|
| 主线 | 500 | 1-200 | 201-500 |
| 生存 | 200 | 1-50 | 51-200 |
| 每日挑战 | 200 | 1-50 | 51-200 |

注意：直接按 500/200/200 全量生成会让确定性重排把旧前段也换掉。本次最终发布时，旧前段已用哈希确认保持不变，只拼入新增区间。

## 主线 500 关发布分布

| 尺寸 | 数量 |
|---|---:|
| 4x4 | 2 |
| 6x6 | 26 |
| 7x7 | 70 |
| 8x8 | 179 |
| 9x9 | 167 |
| 10x10 | 45 |
| 11x11 | 5 |
| 12x12 | 6 |

| 难度 | 数量 |
|---|---:|
| L1 | 18 |
| L2 | 40 |
| L3 | 208 |
| L4 | 234 |
| L5 | 0 |

前 200 关保持上一批降难度版本；201 之后逐步进入 `8x8/9x9` 为主、少量 `10x10+` 的后段挑战区。

## 生存 200 关发布分布

| 尺寸 | 数量 |
|---|---:|
| 6x6 | 3 |
| 7x7 | 58 |
| 8x8 | 81 |
| 9x9 | 49 |
| 10x10 | 9 |

| 难度 | 数量 |
|---|---:|
| L1 | 3 |
| L2 | 25 |
| L3 | 106 |
| L4 | 66 |
| L5 | 0 |

生存模式是限时连续玩法，不再 10 关强制结算；前 50 关保持上一批，后续补到 200 关供高手连续推进。

## 每日挑战 200 关发布分布

| 尺寸 | 数量 |
|---|---:|
| 7x7 | 4 |
| 8x8 | 58 |
| 9x9 | 106 |
| 10x10 | 23 |
| 11x11 | 3 |
| 12x12 | 6 |

| 难度 | 数量 |
|---|---:|
| L1 | 0 |
| L2 | 0 |
| L3 | 70 |
| L4 | 130 |
| L5 | 0 |

每日挑战允许比主线更难，最低从 `L3` 起步；新增段以 `9x9 L4` 为主，但 `10x10+` 仍控制在少数。

## 本次校验结果

| 玩法 | 数量 | valid | hall_ok | logic_solved | 目标错配 |
|---|---:|---:|---:|---:|---:|
| 主线 | 500 | 500 | 500 | 500 | 0 |
| 生存 | 200 | 200 | 200 | 200 | 0 |
| 每日挑战 | 200 | 200 | 200 | 200 | 0 |

## 执行命令

```bash
python3 scripts/generate_mode_levels.py generate-mode --mode main --count 500 --seed 20260513 --clean
python3 scripts/generate_mode_levels.py generate-mode --mode survival --count 200 --seed 20260514 --clean
python3 scripts/generate_mode_levels.py generate-mode --mode daily_challenge --count 200 --seed 20260515 --clean
python3 scripts/verify_levels.py verify-mode --mode main
python3 scripts/verify_levels.py verify-mode --mode survival
python3 scripts/verify_levels.py verify-mode --mode daily_challenge
python3 scripts/generate_level_index.py
```

如果后续继续追加关卡，不能直接全量覆盖旧前段；要先固定已经发布区间，再只拼入新增区间，或者给脚本补一个正式的 append 模式。
