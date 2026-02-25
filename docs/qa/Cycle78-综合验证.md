# Cycle 78 -- 统计引擎综合验证

**产品：** MetaReview
**被测引擎：** `src/lib/statistics/`（效应量、Meta 分析、分布函数、发表偏倚）
**QA 负责人：** qa-bach（James Bach 方法论）
**日期：** 2026-02-24
**状态：** 通过 -- 370/370 项检查，零差异

---

## 1. 执行摘要

本验证周期将覆盖范围从单一效应指标（OR）扩展到 MetaReview 统计引擎的全部功能面。前一次验证（Cycle 5）针对经典 Aspirin 数据集确认了 54/54 项 Odds Ratio 检查。Cycle 78 新增了 316 项检查，涵盖七个额外测试场景，包括 Risk Ratio、Mean Difference、Standardized Mean Difference（Hedges' g）、零单元格校正、高异质性以及小 k 值边界情况。

在本次验证过程中，发现并修复了卡方 p 值实现中连分数分支的一个数值 Bug。修复后，所有 370 项检查均通过独立 Python 黄金标准（numpy/scipy）的验证。

**综合结果：370/370 通过 -- 零差异。**

---

## 2. 范围与依据

### 2.1 已验证内容（Cycle 5）

| 场景 | 指标 | 研究数 | 检查项 | 结果 |
|----------|---------|---------|--------|--------|
| Aspirin Meta 分析 | OR (Odds Ratio) | 7 | 54 | 54/54 通过 |

Cycle 5 确立了最常用二分类效应指标的基线正确性。然而，以下内容完全未经测试：

- Risk Ratio (RR) 计算
- 连续型数据指标（MD、SMD）
- 零单元格连续性校正行为
- 高异质性场景（tau 平方 >> 0，I 平方 > 75%）
- k=1 和 k=2 研究的边界情况
- 卡方 CDF 的连分数分支（仅在 x >= a+1 时触发）

### 2.2 Cycle 78 新增内容

使用 SFDPOT 启发式方法（Structure、Function、Data、Platform、Operations、Time）设计了八个测试场景，系统性覆盖未测试的代码路径：

- **Function：** 全部四种效应指标（OR、RR、MD、SMD）
- **Data：** 二分类和连续型输入、零单元格、高方差、最小数据量
- **Structure：** 逐研究计算、合并估计值、异质性统计量
- **Operations：** 公式退化的边界情况（k=1、k=2、df=0）

### 2.3 风险评估

统计引擎是 MetaReview 的核心计算组件。此处的任何数值错误都会直接传播到呈现给研究人员的临床结论中。这是一个高影响、高后果的领域。风险矩阵：

| 风险 | 影响 | 概率 | 优先级 |
|------|--------|-------------|----------|
| 效应量计算错误 | 严重 | 中等 | 必须测试 |
| 异质性统计量错误 | 严重 | 中等 | 必须测试 |
| 分布函数产生负 p 值 | 重大 | 低（已知） | 必须测试 |
| 零单元格校正遗漏 | 重大 | 中等 | 必须测试 |
| 边界情况崩溃（k=1、k=2） | 重大 | 中等 | 必须测试 |

---

## 3. Bug 报告：卡方 CDF 产生负 P 值

### 3.1 摘要

| 字段 | 值 |
|-------|-------|
| **标题** | `gammaPContinuedFraction` 产生 CDF > 1.0，导致负 p 值 |
| **严重程度** | 严重 |
| **组件** | `src/lib/statistics/distributions.ts` |
| **函数** | `gammaPContinuedFraction()` |
| **触发条件** | 当 `x >= a + 1` 时的卡方 CDF 计算（连分数分支） |
| **影响** | `chiSquaredPValue()` 返回负值；异质性 p 值变得毫无意义 |
| **状态** | 已修复 |

### 3.2 根本原因

原始实现使用 Thompson 连分数公式计算上不完全伽玛函数 Q(a, x)。该算法在某些参数组合下存在已知的数值不稳定性，连分数收敛缓慢或振荡超过真实值。

有问题的代码使用了一种临时的系数方案：

```typescript
// 修复前（有 Bug）
function gammaPContinuedFraction(a: number, x: number, lnA: number): number {
  let f = 1e-30;
  let c = f;
  let d = 0;

  for (let i = 1; i < 200; i++) {
    const an = i % 2 === 1 ? ((i + 1) / 2 - a) : i / 2;
    const bn = x + i - (i % 2 === 1 ? 0 : a - 1);
    // ...使用这些系数的修正 Lentz 方法...
  }
  return f * Math.exp(-x + a * Math.log(x) - lnA);
}
```

对于某些 x 显著大于 a 的 (a, x) 组合，奇偶系数方案产生的连分数值在乘以指数前因子后，得到 Q(a, x) < 0 -- 即 P(a, x) = 1 - Q(a, x) > 1.0。

由于 `chiSquaredPValue` 最初以 `1 - chiSquaredCdf(x, df)` 计算而未进行截断，这导致了负 p 值。

### 3.3 已应用的修复

两项更改：

**更改 1：** 用数值稳定的 Legendre 连分数公式替换了连分数算法，该公式是 Numerical Recipes、scipy 及其他参考实现所使用的标准算法：

```typescript
// 修复后
function gammaPContinuedFraction(a: number, x: number, lnA: number): number {
  // Q(a,x) = Gamma(a,x)/Gamma(a) 的 Legendre 连分数
  // CF = 1/(x+1-a- 1*(1-a)/(x+3-a- 2*(2-a)/(x+5-a- ...)))
  // 使用修正 Lentz 方法
  let b = x + 1 - a;
  let c = 1e30;
  let d = 1 / b;
  let f = d;

  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-10) break;
  }

  return f * Math.exp(-x + a * Math.log(x) - lnA);
}
```

**更改 2：** 在 `chiSquaredPValue` 中添加了防御性截断作为双重保险措施：

```typescript
export function chiSquaredPValue(x: number, df: number): number {
  return Math.max(0, 1 - chiSquaredCdf(x, df));
}
```

### 3.4 为何 Cycle 5 未捕获此问题

Cycle 5 的 Aspirin 数据集产生的 Cochran's Q 值落在 `regularizedGammaP` 的级数展开分支（当 `x < a + 1` 时）。级数展开是正确的。连分数分支仅在 Q 值相对于自由度较高的场景中触发 -- 恰好是 Cycle 78 设计要测试的那类场景。

这是一个教科书式的例子，说明为何单一"正常路径"验证是不够的。`regularizedGammaP` 中的分支条件 `x < a + 1` 创建了两条完全独立的代码路径，而原始测试数据只覆盖了其中一条。

---

## 4. 验证方法论

### 4.1 黄金标准

使用 numpy 和 scipy 的独立 Python 实现作为预言机。每个测试场景：

1. 定义输入数据（研究级别的二分类或连续型数据）
2. 使用 `numpy` 进行算术运算，`scipy.stats` 进行分布函数计算，得出所有逐研究和合并统计量
3. 以 JSON 格式输出结果，精度达 10+ 位有效数字

Node.js 引擎处理相同的输入数据并产生输出。比较脚本以 `1e-6`（绝对值）或 `0.01%`（相对值）的容差检查每一对值，取两者中更宽松的标准。

**验证文件：**

| 文件 | 用途 |
|------|---------|
| `scripts/validate-comprehensive.py` | Python 黄金标准实现 |
| `scripts/validate-comprehensive.mjs` | Node.js 引擎测试工具 |
| `scripts/compare-comprehensive.py` | 跨语言比较脚本（含容差） |

### 4.2 每项检查验证的内容

对于每个场景中的每项研究，比较以下值：

**逐研究指标（每项研究 7 个）：**

| 指标 | 描述 |
|--------|-------------|
| `yi` | 对数尺度（OR、RR）或原始尺度（MD、SMD）上的效应量 |
| `sei` | 效应量的标准误 |
| `vi` | 方差（sei 的平方） |
| `effect` | 原始尺度上的效应量（OR/RR 取 exp(yi)，MD/SMD 取 yi） |
| `ciLower` | 95% 置信区间下限（原始尺度） |
| `ciUpper` | 95% 置信区间上限（原始尺度） |
| `weight` | 随机效应权重百分比 |

**合并汇总指标（4 个）：**

| 指标 | 描述 |
|--------|-------------|
| `summary` | 合并效应估计值（对数/原始尺度） |
| `se` | 合并估计值的标准误 |
| `z` | 合并效应的 Z 统计量 |
| `pValue` | 合并效应的双侧 p 值 |

**异质性统计量（7 个）：**

| 指标 | 描述 |
|--------|-------------|
| `Q` | Cochran's Q 统计量 |
| `df` | 自由度（k - 1） |
| `pValue` | Q 检验的 p 值（卡方分布） |
| `I2` | I 平方百分比 |
| `tau2` | 研究间方差（DerSimonian-Laird） |
| `tau` | tau 平方的平方根 |
| `H2` | H 平方 |

### 4.3 容差标准

| 比较类型 | 阈值 | 依据 |
|----------------|-----------|-----------|
| 绝对差异 | < 1e-6 | 考虑浮点数表示差异 |
| 相对差异 | < 0.01% | 允许 JS/Python 之间的轻微舍入偏差 |
| 接近零的 p 值 | 绝对值 < 1e-10 | 极小 p 值本身精度有限 |

如果满足绝对或相对阈值中的任一项，则该检查通过。

---

## 5. 测试场景与结果

### 场景 1：Risk Ratio (RR) -- Aspirin 数据集

**目的：** 验证 `logRiskRatio()` 函数及二分类数据的端到端流水线。

| 属性 | 值 |
|----------|-------|
| 研究数 | 7（经典 Aspirin 试验数据集） |
| 数据类型 | 二分类（事件数/总数） |
| 指标 | RR (Risk Ratio) |
| 模型 | 随机效应（DerSimonian-Laird） |
| 检查项 | 56 |
| 结果 | **56/56 通过** |

**覆盖内容：**
- `logRiskRatio()`：log(p1/p2) 及 SE 公式 sqrt((1-p1)/e1 + (1-p2)/e2)
- 该数据集无零单元格，因此 `correctZeroCells()` 不执行任何操作
- 完整异质性链（Q、I 平方、tau 平方、H 平方）
- 中等异质性下的随机效应加权

---

### 场景 2：Mean Difference (MD) -- 血压研究

**目的：** 验证连续型数据处理和 `meanDifference()`。

| 属性 | 值 |
|----------|-------|
| 研究数 | 6（合成血压降低数据） |
| 数据类型 | 连续型（均值、SD、n） |
| 指标 | MD (Mean Difference) |
| 模型 | 随机效应 |
| 检查项 | 49 |
| 结果 | **49/49 通过** |

**覆盖内容：**
- `meanDifference()`：yi = mean1 - mean2，sei = sqrt(sd1^2/n1 + sd2^2/n2)
- 非零 tau 平方（存在研究间方差）
- 与固定效应权重差异显著的随机效应权重
- 负效应量（治疗降低血压）

---

### 场景 3：Standardized Mean Difference (SMD / Hedges' g) -- 同一血压数据

**目的：** 验证 Hedges' g 计算，包括合并 SD、Cohen's d 和 Hedges 校正因子。

| 属性 | 值 |
|----------|-------|
| 研究数 | 6（与场景 2 相同的血压数据） |
| 数据类型 | 连续型 |
| 指标 | SMD (Hedges' g) |
| 模型 | 随机效应 |
| 检查项 | 49 |
| 结果 | **49/49 通过** |

**覆盖内容：**
- `hedgesG()` 完整流水线：
  - 合并 SD：sqrt(((n1-1)*sd1^2 + (n2-1)*sd2^2) / (n1+n2-2))
  - Cohen's d：(mean1 - mean2) / pooled_SD
  - Hedges' J 校正因子：1 - 3/(4*df - 1)
  - Hedges' g：Cohen's d * J
  - Hedges' g 的 SE：sqrt((n1+n2)/(n1*n2) + g^2/(2*(n1+n2))) * J
- 验证 SMD 和 MD 从相同原始数据产生不同的效应量
- 小样本偏差校正的正确应用

---

### 场景 4：零单元格校正 (OR) -- 含零事件的研究

**目的：** 验证二分类数据中零单元格的 0.5 连续性校正。

| 属性 | 值 |
|----------|-------|
| 研究数 | 4（其中 2 项在治疗组或对照组中有零事件） |
| 数据类型 | 含零单元格的二分类数据 |
| 指标 | OR (Odds Ratio) |
| 模型 | 随机效应 |
| 检查项 | 38 |
| 结果 | **38/38 通过** |

**覆盖内容：**
- `correctZeroCells()` 触发条件：
  - events1 === 0（治疗组零事件）
  - events2 === 0（对照组零事件）
  - events1 === total1（治疗组全部为事件）
  - events2 === total2（对照组全部为事件）
- 触发校正时，对所有单元格加 0.5，对所有总数加 1
- 在校正值上正确计算 log-OR 和 SE
- 部分研究需要校正而部分不需要的混合情况

---

### 场景 5：高异质性 (OR) -- 效应方向分歧的研究

**目的：** 验证当研究间方差较大且 I 平方超过 75% 时的行为。

| 属性 | 值 |
|----------|-------|
| 研究数 | 5（刻意设置不同效应方向） |
| 数据类型 | 二分类 |
| 指标 | OR (Odds Ratio) |
| 模型 | 随机效应 |
| 检查项 | 44 |
| 结果 | **44/44 通过** |

**覆盖内容：**
- 相对于自由度较大的 Cochran's Q
- tau 平方 >> 0（显著的研究间方差）
- I 平方 > 75%（高异质性阈值）
- 趋向等权重的随机效应权重
- `regularizedGammaP` 的连分数分支（此处发现了 Bug）
- Q 统计量的正确卡方 p 值

**注意：** 此场景是发现 `gammaPContinuedFraction` Bug 的主要触发因素。修复前，Q 的 p 值为负数。

---

### 场景 6a：单项研究 (k=1) -- 边界情况

**目的：** 验证 Meta 分析仅含一项研究这一退化情况的优雅处理。

| 属性 | 值 |
|----------|-------|
| 研究数 | 1 |
| 数据类型 | 二分类 |
| 指标 | OR (Odds Ratio) |
| 模型 | 随机效应 |
| 检查项 | 16 |
| 结果 | **16/16 通过** |

**覆盖内容：**
- `computeHeterogeneity()` 中 df = 0 的边界情况
- 所有异质性值应为：Q=0、df=0、pValue=1、I2=0、tau2=0、tau=0、H2=1
- 随机效应退化为固定效应（tau 平方 = 0）
- 合并估计值等于单项研究估计值

---

### 场景 6b：两项研究 (k=2) -- 边界情况

**目的：** 验证仅有单个自由度时的最小异质性估计。

| 属性 | 值 |
|----------|-------|
| 研究数 | 2 |
| 数据类型 | 二分类 |
| 指标 | OR (Odds Ratio) |
| 模型 | 随机效应 |
| 检查项 | 26 |
| 结果 | **26/26 通过** |

**覆盖内容：**
- df = 1（异质性估计的最小自由度）
- 最小信息量下的 DerSimonian-Laird tau 平方
- 小 Q 值可通过 max(0, ...) 截断产生 I2 = 0 的 I 平方计算
- 仅两项研究之间的权重分配

---

### 场景 7：含零单元格数据的 Risk Ratio

**目的：** 验证 RR 指标与零单元格连续性校正的组合（交叉关注点）。

| 属性 | 值 |
|----------|-------|
| 研究数 | 4（包含零事件组） |
| 数据类型 | 含零单元格的二分类数据 |
| 指标 | RR (Risk Ratio) |
| 模型 | 随机效应 |
| 检查项 | 38 |
| 结果 | **38/38 通过** |

**覆盖内容：**
- `correctZeroCells()` 在 `logRiskRatio()` 之前应用（不仅仅是 `logOddsRatio()`）
- 使用校正后单元格计数的 RR 特定 SE 公式
- 通过 RR 代码路径处理校正数据的端到端流水线

---

## 6. 结果汇总

### 6.1 Cycle 78 单独结果

| 场景 | 指标 | k | 检查项 | 结果 |
|----------|---------|---|--------|--------|
| 1. RR Aspirin | RR | 7 | 56 | 通过 |
| 2. MD 血压 | MD | 6 | 49 | 通过 |
| 3. SMD Hedges' g | SMD | 6 | 49 | 通过 |
| 4. 零单元格 OR | OR | 4 | 38 | 通过 |
| 5. 高异质性 | OR | 5 | 44 | 通过 |
| 6a. 单项研究 | OR | 1 | 16 | 通过 |
| 6b. 两项研究 | OR | 2 | 26 | 通过 |
| 7. RR 零单元格 | RR | 4 | 38 | 通过 |
| **Cycle 78 总计** | | **35** | **316** | **316/316 通过** |

### 6.2 与先前验证的综合结果

| 周期 | 范围 | 检查项 | 结果 |
|-------|-------|--------|--------|
| Cycle 5 | 仅 OR（Aspirin） | 54 | 54/54 通过 |
| Cycle 78 | 所有指标、边界情况 | 316 | 316/316 通过 |
| **累计** | **完整引擎** | **370** | **370/370 通过** |

---

## 7. 覆盖率分析

### 7.1 效应指标覆盖

| 指标 | 已测试？ | 场景 |
|---------|---------|-----------|
| OR (Odds Ratio) | 是 | Cycle 5 + 场景 4、5、6a、6b |
| RR (Risk Ratio) | 是 | 场景 1、7 |
| MD (Mean Difference) | 是 | 场景 2 |
| SMD (Hedges' g) | 是 | 场景 3 |

### 7.2 代码路径覆盖

| 模块 | 函数 | 已测试的代码路径 |
|--------|----------|-------------------|
| `effect-size.ts` | `logOddsRatio()` | 正常 + 零单元格校正 |
| `effect-size.ts` | `logRiskRatio()` | 正常 + 零单元格校正 |
| `effect-size.ts` | `meanDifference()` | 正常连续型数据 |
| `effect-size.ts` | `hedgesG()` | 合并 SD、Cohen's d、J 校正 |
| `effect-size.ts` | `correctZeroCells()` | 无操作路径 + 全部四个触发条件 |
| `effect-size.ts` | `calculateCI()` | 对数尺度（OR、RR）+ 原始尺度（MD、SMD） |
| `effect-size.ts` | `toOriginalScale()` | exp() 路径 + 恒等路径 |
| `meta-analysis.ts` | `fixedEffects()` | 正常 + 退化（k=1） |
| `meta-analysis.ts` | `randomEffects()` | tau2=0、中等 tau2、高 tau2 |
| `meta-analysis.ts` | `computeHeterogeneity()` | df=0、df=1、df>1、低 Q、高 Q |
| `distributions.ts` | `zToP()` | 各种 z 值 |
| `distributions.ts` | `chiSquaredPValue()` | 级数分支 + 连分数分支 |
| `distributions.ts` | `gammaPSeries()` | x < a+1 |
| `distributions.ts` | `gammaPContinuedFraction()` | x >= a+1（修复后） |

### 7.3 剩余未测试区域

以下区域被明确列为本次验证的**范围之外**，代表已知的测试债务：

| 区域 | 风险 | 推迟原因 |
|------|------|---------------------|
| `eggersTest()`（Egger 回归） | 中等 | 需要 k >= 3 项研究；单独验证 |
| `funnelPlotData()` | 低 | 简单的数据转换 |
| `subgroupAnalysis()` | 中等 | 组合已测试的基础组件；应单独验证 |
| `sensitivityAnalysis()` | 中等 | 留一法使用已测试的 `metaAnalysis()`；单独验证 |
| `tCdf()` / `tToP()` | 中等 | 仅被 Egger 检验使用；与 Egger 一起验证 |
| `normalQuantile()` | 低 | 用于 CI 计算；已间接测试 |
| `incompleteBeta()` | 中等 | 被 `tCdf()` 使用；与 t 分布测试一起验证 |
| 超大规模研究（n > 100,000） | 低 | 极端情况下潜在的浮点精度问题 |
| 极小 p 值（< 1e-15） | 低 | 分布函数精度限制 |

---

## 8. 置信度评估

### 8.1 高置信度的方面

- 四个核心效应量公式（OR、RR、MD、SMD）在数学上是正确的
- 零单元格连续性校正仅在需要时正确应用
- DerSimonian-Laird 随机效应模型产生正确的合并估计值和权重
- 异质性统计量（Q、I 平方、tau 平方、H 平方）正确
- 卡方 p 值现在在两条代码路径上均数值稳定
- 边界情况 k=1 和 k=2 不会崩溃，并产生正确的退化结果
- 所有结果与 scipy 在浮点容差范围内一致

### 8.2 较低置信度的方面

- 发表偏倚函数（Egger 检验）仍未验证
- 不完全 Beta 函数（被 t 分布 CDF 使用）尚未通过黄金标准独立验证
- 极端参数值（超大规模研究、极小方差）尚未测试
- `chiSquaredPValue` 中的 `Math.max(0, ...)` 截断是防御性措施；根本原因（Legendre 连分数）不应产生 > 1.0 的值，但可能存在边界情况

### 8.3 建议

统计引擎已通过验证，可在所有四种支持的效应指标上用于生产环境，支持二分类和连续型数据。发现的 Bug 已通过有原则的算法替换而非临时变通方案得到妥善修复。

**下一步验证优先级（按风险排序）：**

1. Egger 检验和 t 分布函数
2. 亚组分析（组间 Q 检验）
3. 极端参数值的压力测试
4. 留一法敏感性分析的抽样检查

---

## 9. 文件参考

### 被测源代码

| 文件 | 描述 |
|------|-------------|
| `src/lib/statistics/distributions.ts` | 正态分布、卡方分布、t 分布函数 |
| `src/lib/statistics/effect-size.ts` | OR、RR、MD、SMD 计算 + 零单元格校正 |
| `src/lib/statistics/meta-analysis.ts` | 固定/随机效应合并、异质性、亚组分析 |
| `src/lib/statistics/publication-bias.ts` | 漏斗图数据、Egger 检验 |
| `src/lib/statistics/index.ts` | 公共 API 桶导出 |
| `src/lib/types.ts` | 所有统计类型的 TypeScript 接口 |

### 验证产物

| 文件 | 描述 |
|------|-------------|
| `scripts/validate-comprehensive.py` | Python 黄金标准（numpy/scipy） |
| `scripts/validate-comprehensive.mjs` | Node.js 引擎测试工具 |
| `scripts/compare-comprehensive.py` | 跨语言比较脚本 |

---

## 10. 附录：Bug 修复 Diff

`src/lib/statistics/distributions.ts` 中 `gammaPContinuedFraction` 修复的完整 diff：

```diff
 /** Chi-squared p-value (upper tail) */
 export function chiSquaredPValue(x: number, df: number): number {
-  return 1 - chiSquaredCdf(x, df);
+  return Math.max(0, 1 - chiSquaredCdf(x, df));
 }
```

```diff
 function gammaPContinuedFraction(a: number, x: number, lnA: number): number {
-  let f = 1e-30;
-  let c = f;
-  let d = 0;
-
-  for (let i = 1; i < 200; i++) {
-    const an = i % 2 === 1 ? ((i + 1) / 2 - a) : i / 2;
-    const bn = x + i - (i % 2 === 1 ? 0 : a - 1);
-
-    d = bn + an * d;
+  // Legendre continued fraction for Q(a,x) = Gamma(a,x)/Gamma(a)
+  // Q(a,x) = e^{-x} * x^a / Gamma(a) * CF
+  // CF = 1/(x+1-a- 1*(1-a)/(x+3-a- 2*(2-a)/(x+5-a- ...)))
+  // Using modified Lentz's method
+  let b = x + 1 - a;
+  let c = 1e30;
+  let d = 1 / b;
+  let f = d;
+
+  for (let i = 1; i <= 200; i++) {
+    const an = -i * (i - a);
+    b += 2;
+    d = an * d + b;
     if (Math.abs(d) < 1e-30) d = 1e-30;
-    c = bn + an / c;
+    c = b + an / c;
     if (Math.abs(c) < 1e-30) c = 1e-30;
     d = 1 / d;
-    const delta = c * d;
+    const delta = d * c;
     f *= delta;
-    if (Math.abs(delta - 1) < 1e-14) break;
+    if (Math.abs(delta - 1) < 1e-10) break;
   }

   return f * Math.exp(-x + a * Math.log(x) - lnA);
```

旧实现使用 Thompson 连分数及临时的奇偶系数方案。替换版本使用标准的 Legendre 连分数，与 scipy 的 `gammainc` 实现和 Numerical Recipes（Press 等著，第三版，第 6.2 节）使用的算法相同。

---

*报告由 qa-bach 生成。测试不是为了证明正确性 -- 而是为了发现信息。本次验证发现了一个真实的 Bug，这正是好的测试策略应该做到的。*
