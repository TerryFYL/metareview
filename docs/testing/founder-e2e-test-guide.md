# MetaReview 端到端测试指南（Founder 专用）

**产品地址：** https://metareview.cc/
**Gold Standard 论文：** Zheng SL, Roddick AJ. Association of Aspirin Use for Primary Prevention With Cardiovascular Events and Bleeding Events: A Systematic Review and Meta-Analysis. JAMA. 2019;321(3):277-287.
**日期：** 2026-02-25
**预计总时长：** 40 分钟

---

## 测试目标

验证 MetaReview 作为一个端到端 Meta 分析工具的完整性：从数据输入到统计分析到图表渲染到报告导出，全链路是否正常工作。

### 成功标准

1. **Demo 数据路径**：加载 7 项 Aspirin 研究的 OR 数据，所有 21 个 tab 可正常访问，Forest/Funnel 等核心图表正确渲染，HTML 和 DOCX 报告可导出并打开
2. **Zheng 2019 HR 路径**：手动输入 13 项 RCT 的 HR 数据，pooled HR 约为 0.89（论文报告 HR 0.89, 95% CI 0.84-0.95），所有图表正常渲染
3. **搜索-分析路径**：PubMed 检索 → AI 筛选 → PDF 提取 → 分析，记录哪些环节顺畅、哪些需要人工介入
4. **无 JavaScript 报错**：Console 中无红色 Error（Warning 可接受）
5. **无 UI 卡死**：任何操作响应时间 < 3 秒

---

## 路径一：Demo 数据快速验证（约 5 分钟）

这条路径用内置示例数据走一遍核心分析流程，目的是确认基本功能没有 regression。

### 步骤 1：打开应用

1. 打开浏览器（推荐 Chrome），访问 https://metareview.cc/
2. 按 F12 打开 DevTools，切到 Console tab，留意红色 Error
3. 确认页面正常加载，无白屏

### 步骤 2：加载示例数据

1. 在首页找到"加载示例数据"按钮（英文界面为 "Load Demo Data"），点击
2. 确认自动跳转到 **数据录入（Input）** tab
3. 检查数据表格中出现 **7 项研究**：ISIS-2 (1988), SALT (1991), UK-TIA (1991), ESPS-2 (1996), TPT (1998), HOT (1998), PPP (2001)
4. 确认 Effect Measure 选择为 **OR**，Model 选择为 **Random Effects**

### 步骤 3：运行分析

1. 点击"运行分析"按钮（英文界面为 "Run Analysis"）
2. 确认切换到 **分析结果（Results）** tab
3. 无报错，页面正常渲染

### 步骤 4：逐 Tab 检查

按以下顺序点击每个 tab，记录是否正常。

#### 4.1 Results（分析结果）

**期望看到：**
- 7 项研究的汇总统计
- Pooled OR 大约在 **0.70 - 0.90** 范围（Random Effects），应显示 Aspirin 有保护作用（OR < 1）
- I-squared 应较低（接近 0%），表示异质性低
- P-value 应有统计学意义（< 0.05）
- 有 Fixed Effects 和 Random Effects 两组结果

**检查项：**
- [ ] Pooled OR 合理（在 0.70-0.90 之间）
- [ ] I-squared 显示为低异质性（< 25%）
- [ ] P-value 显著
- [ ] 无显示异常或空白区域

#### 4.2 Forest Plot（森林图）

**期望看到：**
- **7 行**研究数据，每行有方块（effect size）和横线（CI）
- 底部有**菱形**（diamond）表示 pooled effect
- 方块大小与权重成正比（ISIS-2 和 HOT 样本量最大，方块应最大）
- 菱形位于 OR < 1 一侧（Favours Aspirin）
- 右侧有数值列：OR [95% CI], Weight

**检查项：**
- [ ] 显示 7 行 + 1 菱形
- [ ] 方块大小有明显差异
- [ ] 可下载 SVG/PNG
- [ ] 设置面板可展开（配色方案、字号、排序等）

#### 4.3 Funnel Plot（漏斗图）

**期望看到：**
- **7 个散点**分布在漏斗形区域内
- X 轴为 Effect Size（log OR），Y 轴为 Standard Error（SE 越小越精确，越靠上）
- 虚线表示 pooled effect
- 散点大致对称分布（无明显 publication bias）

**检查项：**
- [ ] 7 个点全部显示
- [ ] 漏斗形区域可见
- [ ] Contour-enhanced 模式可切换
- [ ] 可下载 SVG

#### 4.4 Galbraith Plot（Galbraith 图）

**期望看到：**
- 7 个散点
- X 轴为 1/SE（precision），Y 轴为 standardized effect
- 两条水平虚线表示 +/-2 CI band
- 大部分点应在 band 内（低异质性数据集）

**检查项：**
- [ ] 图表正常渲染
- [ ] 散点和 CI band 可见

#### 4.5 L'Abbe Plot（L'Abbe 图）

**期望看到：**
- 7 个气泡
- X 轴为 Control group event rate，Y 轴为 Treatment group event rate
- 气泡大小反映样本量
- 对角线表示无效果（OR = 1）
- 大部分气泡在对角线下方（treatment event rate < control event rate）

**检查项：**
- [ ] 图表正常渲染
- [ ] 气泡大小有差异

**注意：** L'Abbe 图仅适用于 Binary 数据（OR/RR），HR/MD/SMD 数据不会显示此图。

#### 4.6 Baujat Plot（Baujat 图）

**期望看到：**
- 7 个散点
- X 轴为对 overall effect 的影响，Y 轴为对 heterogeneity 的贡献
- 标注了各研究名称

**检查项：**
- [ ] 图表正常渲染
- [ ] 研究名称标注正确

#### 4.7 Cumulative（累积分析）

**期望看到：**
- 按年份排序的累积 Forest Plot
- 从 ISIS-2 (1988) 开始，逐步加入更多研究
- 可以看到 pooled effect 随时间变化的趋势

**检查项：**
- [ ] 7 行累积结果
- [ ] 年份排序正确

#### 4.8 Sensitivity（敏感性分析）

**期望看到：**
- Leave-one-out 分析结果
- 7 行，每行去掉一项研究后的 pooled effect
- 若某项研究去掉后结论翻转（从显著变不显著或反向），应高亮标记

**检查项：**
- [ ] 7 行结果
- [ ] 去掉任一研究后 pooled OR 变化幅度合理

#### 4.9 Influence（影响力分析）

**期望看到：**
- Influence diagnostics 表格
- 指标包括：Hat value, Externally Studentized Residual, Cook's Distance, DFFITS, Covariance Ratio

**检查项：**
- [ ] 表格正常渲染
- [ ] 7 行数据

#### 4.10 LOO（留一法）

**期望看到：**
- Leave-one-out 的图形化展示
- 7 行，每行对应去掉一项研究后的结果

**检查项：**
- [ ] 图表正常渲染

#### 4.11 Network（网络图）

**期望看到：**
- 力导向网络图（D3.js force-directed graph）
- Demo 数据为两组对比（Aspirin vs Placebo），所以网络图较简单，仅显示两个节点

**检查项：**
- [ ] 图表渲染，无空白
- [ ] 节点可拖拽交互

#### 4.12 Dose-Response（剂量-反应）

**期望看到：**
- 如果没有输入 dose 数据，应显示提示信息
- Demo 数据不含 dose 列，预期此 tab 显示"无剂量数据"或类似提示

**检查项：**
- [ ] 无报错（即使无数据也应优雅处理）

#### 4.13 Subgroup（亚组分析）

**期望看到：**
- Demo 数据包含两个 Subgroup：Secondary Prevention (ISIS-2, SALT, UK-TIA, ESPS-2) 和 Primary Prevention (TPT, HOT, PPP)
- 应显示各亚组的 pooled effect 和 Q-between test

**检查项：**
- [ ] 两个亚组分别有 pooled effect
- [ ] 有亚组间差异检验（Q-between）

#### 4.14 Meta-Regression（Meta 回归）

**期望看到：**
- 散点图，X 轴为 Year（或其他协变量），Y 轴为 Effect Size
- 回归线和 95% CI band

**检查项：**
- [ ] 图表正常渲染
- [ ] 回归系数和 p-value 显示

#### 4.15 GRADE（GRADE 评价）

**期望看到：**
- GRADE evidence quality assessment 界面
- 5 个降级因素（Risk of Bias, Inconsistency, Indirectness, Imprecision, Publication Bias）
- 可手动调整或使用 auto-assessment

**检查项：**
- [ ] 界面可交互
- [ ] 可切换各因素等级

#### 4.16 RoB（偏倚风险）

**期望看到：**
- Risk of Bias 评估界面
- 功能有限（见"已知限制"）

**检查项：**
- [ ] 界面加载无报错

#### 4.17 PRISMA（PRISMA 流程图）

**期望看到：**
- PRISMA 2020 流程图
- 如果从 Search tab 检索过文献，数字应自动填入
- Demo 路径下可能为空或显示默认模板

**检查项：**
- [ ] 流程图渲染
- [ ] 可导出 SVG/PNG

#### 4.18 Protocol（研究方案）

**期望看到：**
- PICO 已填入 Demo 数据的内容：
  - Population: Adults at risk of cardiovascular disease
  - Intervention: Aspirin (75-325 mg/day)
  - Comparison: Placebo
  - Outcome: Major cardiovascular events (MI, stroke, CV death)

**检查项：**
- [ ] PICO 四项已填入
- [ ] 可编辑

### 步骤 5：导出报告

1. 回到 **Results** tab
2. 点击 **导出 HTML 报告** 按钮
   - 确认浏览器下载了 `.html` 文件
   - 双击打开，确认包含森林图、漏斗图、统计结果
3. 点击 **导出 DOCX 报告** 按钮
   - 确认浏览器下载了 `.docx` 文件
   - 用 Word/WPS 打开，确认表格和文字正常

**检查项：**
- [ ] HTML 文件可下载并正常打开
- [ ] DOCX 文件可下载并正常打开
- [ ] 报告内容与页面上的分析结果一致

### 步骤 6：记录结果

在"发现问题记录表"（本文档底部）中记录每个 tab 的状态和发现的问题。

---

## 路径二：Zheng 2019 HR 数据手动输入（约 15 分钟）

这条路径测试 HR（Hazard Ratio）数据的手动输入和分析流程，使用 Zheng 2019 JAMA 论文中 13 项 RCT 的数据作为验证基准。

### 背景

Zheng 2019 是 Aspirin 一级预防领域的高质量 Meta 分析，发表于 JAMA。论文纳入 13 项 RCT，研究终点为 composite cardiovascular events。论文报告的 pooled HR 为 **0.89 (95% CI: 0.84-0.95)**。

我们使用这个已发表的结果作为 Gold Standard，验证 MetaReview 的 HR 分析引擎是否输出正确结果。

### 步骤 1：清空当前数据

1. 如果已加载 Demo 数据，点击"重置"或刷新页面
2. 确认数据表格为空

### 步骤 2：填写 Protocol

切换到 **Protocol（研究方案）** tab，填入以下 PICO：

| 字段 | 内容 |
|------|------|
| Population | Adults without established cardiovascular disease (primary prevention) |
| Intervention | Aspirin (75-500 mg/day) |
| Comparison | Placebo or no treatment |
| Outcome | Composite cardiovascular events (MI, stroke, cardiovascular death) |

### 步骤 3：设置 Effect Measure

1. 切换到 **Input（数据录入）** tab
2. 将 Effect Measure 切换为 **HR**
3. 确认数据输入列变为：Study, Year, HR, CI Lower, CI Upper

### 步骤 4：输入 13 项研究数据

以下数据来自 Zheng 2019 论文 Figure 1（composite cardiovascular events endpoint）。可逐行手动输入，也可以尝试 CSV paste 功能。

**注意：** 这些 HR 值是从论文 Figure 1 的 Forest Plot 中近似读取的，可能与精确数值有微小差异。测试目的是验证 MetaReview 的 pooled effect 是否接近论文报告值，不要求完全一致。

#### CSV 格式数据（可直接粘贴）

```
Study,Year,HR,CI_Lower,CI_Upper
BDT,1988,0.97,0.79,1.19
PHS,1989,0.96,0.85,1.08
TPT,1998,0.80,0.56,1.13
HOT,1998,0.85,0.73,0.99
PPP,2003,0.71,0.48,1.04
WHS,2005,0.90,0.81,1.00
POPADAD,2008,0.98,0.76,1.26
JPAD,2008,0.80,0.58,1.10
AAA,2010,1.03,0.84,1.27
JPPP,2014,0.94,0.77,1.15
ARRIVE,2018,0.96,0.81,1.13
ASCEND,2018,0.88,0.79,0.97
ASPREE,2018,0.95,0.83,1.08
```

#### 逐行输入参考表

| # | Study | Year | HR | CI Lower | CI Upper |
|---|-------|------|----|----------|----------|
| 1 | BDT | 1988 | 0.97 | 0.79 | 1.19 |
| 2 | PHS | 1989 | 0.96 | 0.85 | 1.08 |
| 3 | TPT | 1998 | 0.80 | 0.56 | 1.13 |
| 4 | HOT | 1998 | 0.85 | 0.73 | 0.99 |
| 5 | PPP | 2003 | 0.71 | 0.48 | 1.04 |
| 6 | WHS | 2005 | 0.90 | 0.81 | 1.00 |
| 7 | POPADAD | 2008 | 0.98 | 0.76 | 1.26 |
| 8 | JPAD | 2008 | 0.80 | 0.58 | 1.10 |
| 9 | AAA | 2010 | 1.03 | 0.84 | 1.27 |
| 10 | JPPP | 2014 | 0.94 | 0.77 | 1.15 |
| 11 | ARRIVE | 2018 | 0.96 | 0.81 | 1.13 |
| 12 | ASCEND | 2018 | 0.88 | 0.79 | 0.97 |
| 13 | ASPREE | 2018 | 0.95 | 0.83 | 1.08 |

### 步骤 5：运行分析

1. 确认 Model 为 **Random Effects**
2. 点击"运行分析"
3. 等待结果加载

### 步骤 6：验证 Pooled HR

**核心验证点：**

| 指标 | 论文报告值 | 可接受范围 | 验证结果 |
|------|-----------|-----------|----------|
| Pooled HR | 0.89 | 0.87 - 0.92 | [ ] |
| 95% CI Lower | 0.84 | 0.82 - 0.87 | [ ] |
| 95% CI Upper | 0.95 | 0.93 - 0.97 | [ ] |
| I-squared | 低 | < 30% | [ ] |
| P-value | 显著 | < 0.01 | [ ] |
| 研究数 | 13 | 恰好 13 | [ ] |

**为什么允许范围：** 论文报告的是 Bayesian credible interval (CrI)，MetaReview 使用 DerSimonian-Laird frequentist random effects model。两种方法的 pooled estimate 应非常接近，但 CI 可能有小差异。此外，我们输入的 HR 值是从 Forest Plot 近似读取的，本身就有微小误差。

### 步骤 7：检查图表渲染

逐一打开以下 tab，确认图表正常：

| Tab | 检查点 | 状态 |
|-----|--------|------|
| Forest Plot | 13 行研究 + 1 菱形，HR < 1 侧 | [ ] |
| Funnel Plot | 13 个散点，大致对称 | [ ] |
| Galbraith | 13 个散点，多数在 CI band 内 | [ ] |
| Baujat | 13 个散点，标注研究名 | [ ] |
| Cumulative | 13 行累积结果，按年份排序 | [ ] |
| Sensitivity | 13 行 leave-one-out 结果 | [ ] |
| Influence | 13 行 diagnostics 表格 | [ ] |
| LOO | 13 行图形化结果 | [ ] |
| Meta-Regression | 散点 + 回归线 | [ ] |
| GRADE | 可交互，5 个降级因素 | [ ] |

**注意：** L'Abbe 图仅适用于 Binary 数据。HR 数据不会显示 L'Abbe 图，这是正确行为，不是 bug。

### 步骤 8：导出报告

1. 导出 HTML 报告 → 打开确认 Forest Plot 显示 13 项研究
2. 导出 DOCX 报告 → 打开确认表格完整

---

## 路径三：搜索到分析端到端（约 20 分钟）

这条路径测试从文献检索到分析的上游工作流。目的不是获得完美结果，而是记录哪些环节可用、哪些需要人工介入。

### 步骤 1：PubMed 检索

1. 切换到 **Search（文献检索）** tab
2. 在搜索框输入：`aspirin primary prevention cardiovascular`
3. 可选过滤条件：
   - Article Type: Randomized Controlled Trial
   - Year: 2000-2020
4. 点击搜索
5. 等待结果加载

**记录：**
- [ ] 搜索是否成功返回结果
- [ ] 返回了多少条文献
- [ ] 加载时间（< 5 秒为正常）
- [ ] 结果列表是否包含已知的关键试验（如 ASCEND, ASPREE, ARRIVE）

### 步骤 2：AI 文献筛选

1. 如果有 AI 筛选功能，尝试启用
2. 设置 PICO 关键词
3. 观察 AI 给出的相关性评分

**记录：**
- [ ] AI 筛选功能是否可用
- [ ] 评分是否合理（明确的 Aspirin RCT 应获高分）
- [ ] 是否有误判（排除了明显相关的或纳入了明显不相关的）
- [ ] 处理速度

### 步骤 3：PDF 数据提取

1. 切换到 **Extract（PDF 提取）** tab
2. 如果手头有 Zheng 2019 论文 PDF，尝试上传
3. 观察 AI 是否能识别并提取 Forest Plot 中的数据

**记录：**
- [ ] PDF 上传是否成功
- [ ] AI 是否识别出数据表或 Forest Plot
- [ ] 提取的数据是否准确
- [ ] 需要多少人工修正

### 步骤 4：端到端对接

1. 尝试将检索到或提取到的数据直接导入 Input tab
2. 运行分析
3. 检查结果是否合理

**记录：**
- [ ] 数据能否从 Search/Extract 自动流入 Input
- [ ] 需要哪些手动操作
- [ ] 断点在哪里（哪一步必须人工介入）

### 预期结论

Search → AI Screening → PDF Extraction 是辅助流程，当前阶段可能需要较多人工介入。重点记录：

1. **完全可用的环节**：哪些步骤无需人工即可完成
2. **需要人工介入的环节**：哪些步骤需要手动修正
3. **完全不可用的环节**：哪些步骤失败或产生不可用输出

---

## 发现问题记录表

复制以下表格，在测试过程中逐行填写。

### 路径一（Demo 数据）

| 步骤 | Tab | 问题描述 | 严重程度 | 截图文件名 |
|------|-----|----------|----------|-----------|
| 4.1 | Results | | | |
| 4.2 | Forest | | | |
| 4.3 | Funnel | | | |
| 4.4 | Galbraith | | | |
| 4.5 | L'Abbe | | | |
| 4.6 | Baujat | | | |
| 4.7 | Cumulative | | | |
| 4.8 | Sensitivity | | | |
| 4.9 | Influence | | | |
| 4.10 | LOO | | | |
| 4.11 | Network | | | |
| 4.12 | Dose-Response | | | |
| 4.13 | Subgroup | | | |
| 4.14 | Meta-Reg | | | |
| 4.15 | GRADE | | | |
| 4.16 | RoB | | | |
| 4.17 | PRISMA | | | |
| 4.18 | Protocol | | | |
| 5 | Export HTML | | | |
| 5 | Export DOCX | | | |

### 路径二（Zheng 2019 HR）

| 步骤 | Tab | 问题描述 | 严重程度 | 截图文件名 |
|------|-----|----------|----------|-----------|
| 3 | Input | HR measure 切换 | | |
| 4 | Input | 数据输入/粘贴 | | |
| 6 | Results | Pooled HR 验证 | | |
| 7 | Forest | 13 项 Forest Plot | | |
| 7 | Funnel | 13 点 Funnel Plot | | |
| 7 | 其他图表 | | | |
| 8 | Export | 报告导出 | | |

### 路径三（搜索端到端）

| 步骤 | Tab | 问题描述 | 严重程度 | 截图文件名 |
|------|-----|----------|----------|-----------|
| 1 | Search | PubMed 检索 | | |
| 2 | Search | AI 筛选 | | |
| 3 | Extract | PDF 提取 | | |
| 4 | Input | 数据对接 | | |

### 严重程度定义

| 等级 | 含义 | 举例 |
|------|------|------|
| **P0 - 阻断** | 功能完全不可用或数据错误 | Pooled HR 明显错误、页面白屏、Export 失败 |
| **P1 - 严重** | 功能受损但有 workaround | 图表部分渲染、粘贴功能失败但可手动输入 |
| **P2 - 中等** | 体验不佳但不影响结果 | 排版错乱、加载慢（>3秒）、翻译缺失 |
| **P3 - 轻微** | 打磨项 | 对齐偏差、颜色不一致、提示文案不清 |

---

## 已知限制

以下是当前版本的已知不足。在测试中遇到这些问题时，无需记录为 bug，但可以记录具体的体验感受。

| 限制 | 说明 |
|------|------|
| **RoB 2 工具不完整** | RoB tab 提供基础偏倚风险评估，但不包含完整的 Cochrane RoB 2.0 逐条目评估工具。无交通灯图。 |
| **GRADE 部分实现** | 5 个降级因素可评估，但 auto-assessment 逻辑有限，可能需要大量手动调整。无升级因素。 |
| **仅支持 PubMed 检索** | Search tab 只连接 PubMed 数据库，不支持 Cochrane Library, Embase, Web of Science 等。Systematic Review 通常要求至少 2 个数据库。 |
| **NNT/NNH 未实现** | 不计算 Number Needed to Treat / Number Needed to Harm。需要外部计算。 |
| **Network Meta-Analysis 仅可视化** | Network tab 显示力导向干预措施网络图，但不执行 Network Meta-Analysis 统计计算（无 SUCRA ranking, 无 league table）。 |
| **HR 数据无 L'Abbe 图** | L'Abbe 图需要原始 event rate 数据，HR 输入只有 HR 和 CI，因此 L'Abbe tab 对 HR 数据不可用。这是预期行为。 |
| **PDF 提取依赖 AI** | AI PDF 数据提取基于 Llama 3.1 8B (Cloudflare Workers AI free tier)，对复杂表格和 Forest Plot 图形的识别能力有限，几乎总是需要人工校验。 |
| **Dose-Response 需要 dose 列** | 需要在 Input 中手动添加各研究的 dose 数据列，Demo 数据和标准 HR 输入不包含此字段。 |

---

## 快速参考

### 21 个 Tab 速查

| # | Tab Key | 中文名 | 英文名 | Demo 数据适用 | HR 数据适用 |
|---|---------|--------|--------|:---:|:---:|
| 1 | protocol | 研究方案 | Protocol | Yes | Yes |
| 2 | search | 文献检索 | PubMed Search | N/A | N/A |
| 3 | extract | PDF 提取 | PDF Extract | N/A | N/A |
| 4 | input | 数据录入 | Data Input | Yes | Yes |
| 5 | results | 分析结果 | Results | Yes | Yes |
| 6 | forest | 森林图 | Forest Plot | Yes | Yes |
| 7 | funnel | 漏斗图 | Funnel Plot | Yes | Yes |
| 8 | galbraith | Galbraith 图 | Galbraith | Yes | Yes |
| 9 | labbe | L'Abbe 图 | L'Abbe Plot | Yes | No |
| 10 | baujat | Baujat 图 | Baujat Plot | Yes | Yes |
| 11 | cumulative | 累积分析 | Cumulative | Yes | Yes |
| 12 | sensitivity | 敏感性分析 | Sensitivity | Yes | Yes |
| 13 | influence | 影响力分析 | Influence | Yes | Yes |
| 14 | loo | 留一法 | LOO | Yes | Yes |
| 15 | network | 网络图 | Network | Yes | Yes |
| 16 | doseresponse | 剂量-反应 | Dose-Response | No | No |
| 17 | subgroup | 亚组分析 | Subgroup | Yes | No |
| 18 | metareg | Meta 回归 | Meta-Regression | Yes | Yes |
| 19 | grade | GRADE 评价 | GRADE | Yes | Yes |
| 20 | rob | 偏倚风险 | RoB 2.0 | Yes | Yes |
| 21 | prisma | PRISMA 流程图 | PRISMA Flow | Yes | Yes |

### Zheng 2019 论文关键数字

- **纳入研究数：** 13 项 RCT
- **总样本量：** 164,225 人
- **Pooled HR for composite CVD events：** 0.89 (95% CrI 0.84-0.95)
- **I-squared：** 论文未直接报告，但 HR 方向一致，预期较低
- **Effect Measure：** Hazard Ratio (HR)
- **Model：** 论文使用 Bayesian random effects，MetaReview 使用 DerSimonian-Laird random effects
