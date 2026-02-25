# Cycle 80 -- Hazard Ratio (HR) 统计引擎验证

**产品：** MetaReview
**被测引擎：** `src/lib/statistics/effect-size.ts` (`logHazardRatio`) + `src/lib/statistics/meta-analysis.ts`
**QA 负责人：** qa-bach（James Bach 方法论）
**日期：** 2026-02-24
**状态：** PASS -- 198/198 项检查，零差异

---

## 1. 执行摘要

本验证周期将 MetaReview 统计引擎的测试覆盖范围扩展至 Hazard Ratio (HR) 效应量度。此前的验证（Cycle 5: OR, Cycle 78: OR/RR/MD/SMD）已确认二分类和连续数据输入的正确性。Cycle 80 验证 `logHazardRatio()` 函数，该函数从报告的 HR 和 95% CI 中推导 log(HR) 和 SE -- 这是一条与基于事件计数的效应量度根本不同的输入路径。

五个测试场景涵盖简单合并、高异质性、一致的保护性效应、最小 k=2 以及接近零效应。一个使用 numpy/scipy 的独立 Python 实现作为金标准，并对每个中间计算进行手动交叉验证。

**结果：198/198 PASS -- 零差异。**

---

## 2. 范围与依据

### 2.1 为何需要 HR 验证

Hazard Ratio 是时间-事件（生存）数据的标准效应量度，常见于肿瘤学、心脏病学和流行病学研究。与从原始事件计数或均值计算的 OR/RR/MD/SMD 不同，HR 数据以预计算形式输入：用户提供来源文献中报告的 HR、CI 下限和 CI 上限。

这在引擎中创建了一条独特的代码路径：

```
HR input -> logHazardRatio() -> yi = log(HR), sei = (log(ciUpper) - log(ciLower)) / 3.92
```

该路径绕过了 `correctZeroCells()`、`logOddsRatio()`、`meanDifference()` 等函数。`isLogScale()` 函数必须对 HR 返回 `true`，而 `toOriginalScale()` 必须应用 `exp()` 进行反变换。这些在 Cycle 5 或 78 中均未测试。

### 2.2 本周期测试内容

| 领域 | 具体验证项 |
|------|---------------------|
| `logHazardRatio()` | yi = log(HR), sei = (log(ciUpper) - log(ciLower)) / (2 * 1.96) |
| `isLogScale('HR')` | 返回 `true`，因此合并在对数尺度上进行 |
| `toOriginalScale()` | 对 HR 量度应用 `exp()` |
| `calculateCI()` | 通过 `exp()` 对 HR 进行反变换 |
| 固定效应合并 | 使用 HR 派生权重的逆方差法 |
| 随机效应合并 | 使用 HR 派生的 tau 平方的 DerSimonian-Laird 法 |
| 异质性 | HR 数据的 Q、I-squared、tau-squared、H-squared |
| 边界情况 | k=2 最小自由度、接近零效应、tau-squared 为零 |

### 2.3 已验证的内容

| 周期 | 量度 | 研究数 | 检查数 | 结果 |
|-------|---------|---------|--------|--------|
| Cycle 5 | OR | 7 | 54 | 54/54 PASS |
| Cycle 78 | OR, RR, MD, SMD | 35 | 316 | 316/316 PASS |
| **Cycle 80** | **HR** | **18** | **198** | **198/198 PASS** |

---

## 3. 验证方法学

### 3.1 金标准

一个独立的 Python 实现（`scripts/validate-hr.py`）使用 numpy 和 scipy 为所有五个场景计算参考值。该脚本：

1. 为每项研究定义 HR 输入数据（hr, ciLower, ciUpper）
2. 使用文档中的公式计算每项研究的 log(HR)、SE、方差
3. 运行逆方差固定效应和 DerSimonian-Laird 随机效应合并
4. 使用 scipy 的卡方分布计算异质性统计量
5. 在同一脚本内将每个值与第二个独立的手动计算进行交叉验证
6. 以 JSON 格式输出所有结果

运行命令：
```bash
uv run --with numpy --with scipy python scripts/validate-hr.py
```

### 3.2 每项检查验证的内容

**每项研究的指标（每项研究 6 个）：**

| 指标 | 描述 |
|--------|-------------|
| `yi` | log(HR) |
| `sei` | 从 CI 推导的 SE：(log(ciUpper) - log(ciLower)) / (2 * 1.96) |
| `vi` | 方差（sei 的平方） |
| `effect` | 原始尺度上的 HR（应等于输入的 HR） |
| `ciLower` | 原始尺度上的 95% CI 下限 |
| `ciUpper` | 原始尺度上的 95% CI 上限 |

**权重验证（每个场景 1 个）：**

| 指标 | 描述 |
|--------|-------------|
| `weight_sum` | 随机效应权重之和为 100% |

**固定效应（每个场景 3 个）：**

| 指标 | 描述 |
|--------|-------------|
| `fixed.summary` | 固定效应合并 log(HR) |
| `fixed.se` | 固定效应合并估计值的 SE |
| `fixed.effect` | 固定效应合并 HR（反变换后） |

**异质性（每个场景 7 个）：**

| 指标 | 描述 |
|--------|-------------|
| `het.Q` | Cochran's Q 统计量 |
| `het.df` | 自由度 (k - 1) |
| `het.pValue` | Q 的 p 值（卡方分布） |
| `het.I2` | I-squared 百分比 |
| `het.tau2` | 研究间方差（DerSimonian-Laird） |
| `het.tau` | tau-squared 的平方根 |
| `het.H2` | H-squared |

**随机效应合并结果（每个场景 7 个）：**

| 指标 | 描述 |
|--------|-------------|
| `pooled.summary` | 随机效应合并 log(HR) |
| `pooled.se` | 随机效应合并估计值的 SE |
| `pooled.z` | Z 统计量 |
| `pooled.pValue` | 双侧 p 值 |
| `pooled.effect` | 合并 HR（反变换后） |
| `pooled.ciLower` | HR 尺度上的 95% CI 下限 |
| `pooled.ciUpper` | HR 尺度上的 95% CI 上限 |

### 3.3 容差标准

| 比较类型 | 阈值 | 依据 |
|----------------|-----------|-----------|
| 绝对差异 | < 1e-6 | 浮点数表示容差 |
| 相对差异 | < 0.01% | 轻微舍入偏差 |

满足任一阈值即视为检查通过。

---

## 4. 测试场景与结果

### 场景 1：简单 HR 合并（k=3，肿瘤学）

**目的：** 验证具有中等异质性的基本 HR meta 分析。

| 属性 | 值 |
|----------|-------|
| 研究 | 3 项肿瘤学试验（ONCO_A, ONCO_B, ONCO_C） |
| HR 范围 | 0.68 -- 0.85（均为保护性效应） |
| 预期 | 中等异质性，显著的合并效应 |
| 检查数 | 36 |
| 结果 | **36/36 PASS** |

**关键结果：**

| 指标 | 值 |
|--------|-------|
| 合并 HR（随机效应） | 0.748 |
| 95% CI | [0.661, 0.847] |
| p 值 | 4.31e-06 |
| I-squared | 62.2% |
| tau-squared | 0.0074 |
| Q p 值 | 0.071 |

**本场景覆盖的内容：**
- 使用三个典型肿瘤学 HR 的 `logHazardRatio()`
- 非零 tau-squared（中等异质性）
- 随机效应权重与固定效应权重不同
- 从 log(HR) 到 HR 尺度的反变换

---

### 场景 2：高异质性 HR（k=5，心血管）

**目的：** 验证具有大量研究间方差和混合效应方向时的行为。

| 属性 | 值 |
|----------|-------|
| 研究 | 5 项心血管试验 |
| HR 范围 | 0.50 -- 1.10（包含有害方向） |
| 预期 | 高 I-squared，大 tau-squared |
| 检查数 | 48 |
| 结果 | **48/48 PASS** |

**关键结果：**

| 指标 | 值 |
|--------|-------|
| 合并 HR（随机效应） | 0.778 |
| 95% CI | [0.615, 0.983] |
| p 值 | 0.035 |
| I-squared | 73.9% |
| tau-squared | 0.0518 |
| Q p 值 | 0.004 |

**本场景覆盖的内容：**
- 混合效应方向（HR < 1 和 HR > 1）
- 高异质性（I-squared > 73%）
- 显著的 Q 检验（p = 0.004）
- 随机效应权重趋向等权
- 从宽 CI 正确推导对数尺度上的 SE

---

### 场景 3：全部为保护性 HR（k=4，方向一致）

**目的：** 验证所有研究方向一致且 tau-squared = 0 时的行为。

| 属性 | 值 |
|----------|-------|
| 研究 | 4 项研究，所有 HR < 1 |
| HR 范围 | 0.55 -- 0.70 |
| 预期 | 低异质性，tau-squared 截断为 0 |
| 检查数 | 42 |
| 结果 | **42/42 PASS** |

**关键结果：**

| 指标 | 值 |
|--------|-------|
| 合并 HR（随机效应） | 0.626 |
| 95% CI | [0.564, 0.695] |
| p 值 | < 1e-15 |
| I-squared | 0% |
| tau-squared | 0.0 |
| Q p 值 | 0.475 |

**本场景覆盖的内容：**
- 当 Q < df 时 tau-squared 的 `max(0, ...)` 截断
- 随机效应退化为固定效应（tau-squared = 0）
- I-squared 截断为 0%
- 极小 p 值（接近机器精度）
- 一致的保护性效应

---

### 场景 4：最小 k=2 的 HR

**目的：** 验证异质性估计自由度最小时的边界情况。

| 属性 | 值 |
|----------|-------|
| 研究数 | 2 |
| HR 值 | 0.75, 0.82 |
| 预期 | df=1，异质性信息有限 |
| 检查数 | 30 |
| 结果 | **30/30 PASS** |

**关键结果：**

| 指标 | 值 |
|--------|-------|
| 合并 HR（随机效应） | 0.790 |
| 95% CI | [0.684, 0.913] |
| p 值 | 0.0014 |
| I-squared | 0% |
| tau-squared | 0.0 |
| Q p 值 | 0.550 |

**本场景覆盖的内容：**
- df = 1（最小自由度）
- 信息极少时的 tau-squared 估计
- 通过 max(0, ...) 截断使 I-squared = 0
- 仅两项研究间的权重分配（41.2% / 58.8%）

---

### 场景 5：接近零效应的 HR（k=4，HR 接近 1.0）

**目的：** 验证 log(HR) 非常接近零时的精度。

| 属性 | 值 |
|----------|-------|
| 研究 | 4 项研究，HR 介于 0.95 和 1.05 之间 |
| 预期 | 接近零的合并效应，p 值不显著 |
| 检查数 | 42 |
| 结果 | **42/42 PASS** |

**关键结果：**

| 指标 | 值 |
|--------|-------|
| 合并 HR（随机效应） | 1.001 |
| 95% CI | [0.928, 1.079] |
| p 值 | 0.989 |
| I-squared | 0% |
| tau-squared | 0.0 |
| Q p 值 | 0.848 |

**本场景覆盖的内容：**
- log(HR) 值非常接近 0（范围：-0.051 至 +0.049）
- 小差异下的浮点精度
- 正确的不显著合并结果
- CI 跨越 1.0（HR 的零值）

---

## 5. 结果总结

### 5.1 Cycle 80 独立结果

| 场景 | k | 检查数 | 结果 |
|----------|---|--------|--------|
| 1. 简单 HR 合并 | 3 | 36 | PASS |
| 2. 高异质性 | 5 | 48 | PASS |
| 3. 全部保护性 | 4 | 42 | PASS |
| 4. 最小 k=2 | 2 | 30 | PASS |
| 5. 接近零效应 | 4 | 42 | PASS |
| **Cycle 80 总计** | **18** | **198** | **198/198 PASS** |

### 5.2 与所有先前验证的合并结果

| 周期 | 范围 | 检查数 | 结果 |
|-------|-------|--------|--------|
| Cycle 5 | 仅 OR（Aspirin） | 54 | 54/54 PASS |
| Cycle 78 | OR, RR, MD, SMD + 边界情况 | 316 | 316/316 PASS |
| Cycle 80 | HR（5 个场景） | 198 | 198/198 PASS |
| **累计** | **全部 5 种量度** | **568** | **568/568 PASS** |

---

## 6. 覆盖率分析

### 6.1 效应量度覆盖（Cycle 80 之后）

| 量度 | 已测试？ | 验证周期 |
|---------|---------|--------------|
| OR (Odds Ratio) | 是 | Cycle 5, Cycle 78 |
| RR (Risk Ratio) | 是 | Cycle 78 |
| MD (Mean Difference) | 是 | Cycle 78 |
| SMD (Hedges' g) | 是 | Cycle 78 |
| **HR (Hazard Ratio)** | **是** | **Cycle 80** |

MetaReview 支持的全部五种效应量度现已通过独立 Python 金标准验证。

### 6.2 HR 特定代码路径覆盖

| 模块 | 函数 | 已测试路径 |
|--------|----------|--------------|
| `effect-size.ts` | `logHazardRatio()` | 各种 CI 宽度的正常 HR |
| `effect-size.ts` | `isHRData()` | HR 输入的类型守卫 |
| `effect-size.ts` | `calculateEffectSize()` | HR 分支（`measure === 'HR'`） |
| `effect-size.ts` | `isLogScale()` | 对 HR 返回 `true` |
| `effect-size.ts` | `toOriginalScale()` | HR 的 `exp()` 路径 |
| `effect-size.ts` | `calculateCI()` | 对数尺度 CI 及 `exp()` 反变换 |
| `meta-analysis.ts` | `fixedEffects()` | 使用 HR 派生方差 |
| `meta-analysis.ts` | `randomEffects()` | tau2=0（场景 3,4,5）和 tau2>0（场景 1,2） |
| `meta-analysis.ts` | `computeHeterogeneity()` | df=1 至 df=4，低 Q 和高 Q |

### 6.3 剩余未测试领域

未发现 HR 特有的新未测试领域。Cycle 78 中的一般测试债务仍然存在：

| 领域 | 风险 | 状态 |
|------|------|--------|
| Egger's test | 中 | 未测试 |
| 亚组分析 | 中 | 未测试 |
| 逐一剔除敏感性分析 | 中 | 未测试 |
| 极端参数值 | 低 | 未测试 |

---

## 7. 置信度评估

### 7.1 高置信度的方面

- `logHazardRatio()` 函数从报告的 HR 和 95% CI 正确推导 log(HR) 和 SE
- SE 公式 `(log(ciUpper) - log(ciLower)) / (2 * 1.96)` 在数学上等价于从已发表 CI 推导的标准 Wald 型 SE
- HR 数据正确流经完整的 meta 分析管线：效应量计算、逆方差合并、异质性估计、反变换
- `isLogScale('HR')` 和 `toOriginalScale()` 函数与 OR 和 RR 一起正确处理 HR
- 边界情况（接近零效应、k=2、tau-squared 为零）产生正确结果
- MetaReview 支持的全部五种效应量度现已通过验证

### 7.2 置信度较低的方面

- 在原始尺度上具有不对称 CI 的 HR 数据（当 SE 较大时常见）：该公式假设在对数尺度上 CI 对称，这是标准假设，但可能不适用于所有已发表结果
- 极端 HR（例如 HR = 0.01 或 HR = 100）：未测试，尽管数学上对数变换应能处理这些情况
- HR 与亚组分析或敏感性分析的结合：合并函数已测试，但亚组/敏感性的封装函数未测试

---

## 8. 文件参考

### 被测源码

| 文件 | 描述 |
|------|-------------|
| `src/lib/statistics/effect-size.ts` | `logHazardRatio()`、`isHRData()`、`calculateEffectSize()` HR 分支 |
| `src/lib/statistics/meta-analysis.ts` | 固定/随机效应合并、异质性 |
| `src/lib/statistics/distributions.ts` | `zToP()`、`chiSquaredPValue()` |

### 验证产物

| 文件 | 描述 |
|------|-------------|
| `scripts/validate-hr.py` | Python 金标准 + 自验证（198 项检查） |
| `docs/qa/cycle80-hr-validation.md` | 本报告 |

---

*报告由 qa-bach 生成。HR 代码路径简洁正确 -- 三个函数，一个公式，无分支复杂性。有时最简单的代码最难写错，也最容易验证。*
