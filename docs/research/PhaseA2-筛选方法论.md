# Phase A-2：文献筛选方法论深度研究

**作者：** Research Thompson（Ben Thompson 模型）
**日期：** 2026-02-25
**状态：** 已完成
**置信度：** 高（经 20+ 来源交叉验证，多篇同行评审研究）

---

## 摘要

文献筛选是系统评价中最耗费人力的步骤，占总审查时间的 40-70%。该领域正在经历结构性变革：**Active Learning (AL) 方法已经成熟并经过验证；基于 LLM 的方法前景广阔但尚未标准化。** MetaReview 的最优策略是结合两种方法的混合流水线，可以在保持 Cochrane 标准要求的 >=95% 召回率阈值的同时，减少 70-90% 的筛选工作量。

**核心战略洞察：** 筛选步骤是 MetaReview 能够构建最深竞争壁垒的环节。现有工具（Covidence、Rayyan、ASReview）各自擅长问题的某一部分。目前没有任何产品能够提供一个集成的流水线，将去重 -> Active Learning 优先排序 -> LLM 分类 -> 人工验证串联在一个单一的、可审计的工作流中，并提供符合 PRISMA-trAIce 标准的报告。

---

## 1. 传统筛选流程：黄金标准

### 1.1 标准两阶段流程

传统系统评价筛选遵循顺序两阶段流程，由 Cochrane 手册和 PRISMA 2020 编纂规范：

**第一阶段：标题/摘要筛选（T/A Screening）**
- 输入：去重后数据库搜索返回的所有记录（通常 2,000-20,000 条记录）
- 操作：两名独立审稿人阅读每条标题和摘要，应用预定义的纳入/排除标准
- 决策：纳入、排除或不确定（转入全文阶段）
- 典型排除率：此阶段排除 85-95% 的记录
- 每条记录耗时：每条标题/摘要 30 秒至 2 分钟

**第二阶段：全文筛选**
- 输入：第一阶段中标记为"纳入"或"不确定"的所有记录（通常 100-500 条记录）
- 操作：两名独立审稿人阅读全文，应用详细的资格标准
- 决策：纳入或排除（按 PRISMA 2020 要求记录排除原因）
- 典型排除率：全文记录中排除 40-70%
- 每条记录耗时：每篇全文 10-30 分钟

### 1.2 双人独立筛选

PRISMA 2020（条目 6a）要求作者报告：
1. 每条记录由多少名审稿人筛选
2. 是否独立工作（对彼此的决策盲态）
3. 解决分歧的流程

标准做法要求**至少两名独立审稿人**并行工作，互不知晓对方的决策。这不仅仅是建议——而是 Cochrane 和大多数高影响力期刊强制执行的方法学标准。

**双人筛选的重要性：**
- 单人筛选遗漏 5-15% 的相关研究（已证实）
- 人类筛选的错误率约为 10%，假排除率略高（约 13-14%）（已证实）
- 疲劳、认知偏差和领域知识缺口在大数据集上会叠加放大

### 1.3 Cohen's Kappa：衡量一致性

Cohen's Kappa (k) 衡量超出偶然预期的评估者间一致性。它是评估筛选一致性的标准指标。

| Kappa 范围 | 解读 | 对系统评价的意义 |
|------------|------|------------------|
| < 0.00 | 低于偶然水平 | 标准需要全面修订 |
| 0.00 - 0.20 | 轻微一致 | 需要重大标准修正 |
| 0.21 - 0.40 | 尚可一致 | 标准存在模糊性 |
| 0.41 - 0.60 | 中度一致 | 早期试点轮次可接受 |
| 0.61 - 0.80 | 高度一致 | 筛选的标准目标 |
| 0.81 - 1.00 | 几乎完美 | 优秀；标准清晰 |

**关键细节：** 在系统评价筛选中，可能有 90% 的文章被排除，因此两名评估者基于该基础率的纯随机决策也可以产生 82% 的原始一致率。Kappa 校正了这种膨胀，这就是为什么它在原始百分比一致率之上至关重要。

**已发表系统评价中的典型值：** Kappa 范围 0.6-0.9，0.61 以上被认为可接受。

### 1.4 冲突解决

当两名筛选者意见不一致时，标准方法包括：
1. **讨论达成共识** —— 最常见；两名审稿人讨论具体记录
2. **第三方裁决** —— 由高级审稿人或领域专家做出最终决定
3. **包容性方法** —— 任一审稿人标记为"纳入"的记录均进入下一阶段（更高召回率，更低精确率）

### 1.5 PRISMA 2020 筛选报告要求

PRISMA 2020 特别要求报告：
- **条目 6a：** 说明用于判断研究是否满足纳入标准的方法，包括多少名审稿人筛选了每条记录和检索到的每份报告，是否独立工作，以及如适用，所使用的自动化工具的详细信息
- **条目 16a：** 给出筛选、评估资格和纳入综述的研究数量，以及每个阶段的排除原因，最好附流程图
- **流程图：** PRISMA 流程图必须显示：识别的记录 -> 去除重复项 -> 筛选的记录 -> 排除的记录 -> 评估资格的报告 -> 排除的报告（附原因）-> 纳入的研究

---

## 2. AI/ML 辅助筛选方法

### 2.1 方法分类

AI 辅助筛选方法分为三类，各自具有根本不同的架构：

| 类别 | 代表工具 | 方法 | 训练数据 | 核心权衡 |
|------|----------|------|----------|----------|
| **Active Learning (AL)** | ASReview, SWIFT-ActiveScreener, Abstrackr | 人在回路的迭代 ML 分类 | 审查过程中由用户标注 | 最佳召回率保证；需要用户交互 |
| **LLM Zero/Few-Shot** | GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro | 基于提示的纳入/排除分类 | 无需训练；依赖预训练知识 | 最快启动；精确率不稳定；按记录计费 |
| **传统 ML** | SVM、随机森林配合 TF-IDF/Word2Vec | 批量训练分类器 | 需要预标注数据集 | 成熟；需要标注训练数据 |

### 2.2 Active Learning：以 ASReview 作为参考架构

ASReview 是系统评价筛选中研究最多、部署最广泛的开源 Active Learning 系统。其架构作为理解 AL 在该领域如何运作的参考模型。

**核心架构（ASReview LAB v2，2025）：**

该系统是一个包含四个可替换组件的模块化流水线：

```
[Feature Extractor] -> [Classifier] -> [Balancer] -> [Querier]
        |                   |               |             |
     TF-IDF              SVM           Dynamic       Max Relevance
     sBERT          Naive Bayes       Resampling      Uncertainty
     MXBAI           Logistic Reg      Fixed           Random
     E5 (multilingual)  XGBoost
```

**默认配置（ELAS-Ultra）：**
- 特征提取：TF-IDF（单字和双字组合）
- 分类器：LinearSVC (Support Vector Machine)
- 相比 v1 默认配置实现 24.1% 的损失减少
- 在消费级硬件上秒级处理

**ELAS 模型变体：**
| 模型 | 特征提取器 | 分类器 | 使用场景 | 速度 |
|------|-----------|--------|----------|------|
| ELAS-Ultra | TF-IDF（双字组合） | SVM | 通用，默认 | 秒级 |
| ELAS-Heavy | MXBAI 语义嵌入 | SVM | 需要语义相似度 | 约 15 分钟 |
| ELAS-Lang | E5 多语言嵌入 | SVM | 非英语文档 | 相当 |

**Active Learning 循环：**
1. 用户提供"先验知识"——几条已知的相关和不相关记录
2. 系统在这些标注样本上训练初始模型
3. 模型按预测相关性对所有未标注记录排序
4. 最可能相关的记录呈现给用户进行标注
5. 模型在扩展的标注集上重新训练
6. 循环重复直至满足停止标准

**性能（SYNERGY 基准，24 个数据集）：**
- PTSD 数据集示例：v1 需要筛选 542 篇论文才能找到全部 38 篇相关论文；v2 只需 271 篇（减少 50%）
- 标准差从 189 降至 11，表明性能一致性显著提高
- 在 29,000+ 次模拟运行中，Active Learning 在 100% 的测试场景中优于随机筛选

### 2.3 停止问题

Active Learning 筛选中的关键未解问题：**何时可以安全停止？**

由于在完成审查之前你不知道相关记录的总数，所以你无法知道何时找到了其中的 95%。这是根本性挑战。

**SAFE 流程（Boetje & van de Schoot, 2024）：**

一个四阶段停止启发式方法：

| 阶段 | 名称 | 操作 | 停止规则 |
|------|------|------|----------|
| S | **Screen** 随机训练数据 | 筛选 1% 的记录或直到找到 >= 1 条相关记录 | 不适用（过渡到下一阶段） |
| A | **Apply** Active Learning | 训练模型，按预测相关性筛选 | 四个条件同时满足（见下文） |
| F | **Find** 用不同模型发现更多 | 切换到深度学习模型（如 sBERT），重新排序剩余记录 | 连续 50 条不相关记录 |
| E | **Evaluate** 质量 | 独立筛选者审查排名靠前的被排除记录；引文追踪 | 连续 50 条不相关记录 |

**阶段 A 停止条件（四个条件必须全部满足）：**
1. 所有已知的关键论文已被识别为相关
2. 至少筛选了预估相关记录总数 2 倍的记录
3. 至少筛选了总数据集的 10%
4. 在最近连续 50 次筛选中未发现相关记录

**重要提示：** 作者明确指出这些阈值（1%、50、10%、2 倍）是"任意的，不应被视为普遍适用"。

**ASReview LAB v2 实现：**
- "停止圆环"UI 元素随着连续标注不相关记录而填充
- 当发现相关项目时重置
- 达到阈值后，用户看到三个选项：再审查 20 条记录、切换代理/模型、或完成项目

### 2.4 基于 LLM 的筛选：新兴前沿

LLM 代表了一种根本不同的方法：不是从用户标注中学习，而是基于预训练知识和包含纳入/排除标准的提示来分类记录。

**关键研究 1：用于引文筛选的最优 LLM（2025）**
在 5 个临床问题的 16,669 条引文上测试了 GPT-4o、Gemini 1.5 Pro、Claude 3.5 Sonnet、Llama 3.3 70B：

| 模型 | 敏感度 | 特异度 | 速度（100 条记录） | 成本（100 条记录） | 一致性 |
|------|--------|--------|-------------------|-------------------|--------|
| GPT-4o | 0.85 | 0.97 | 0.93 分钟 | $0.40 | 98.9% |
| Gemini 1.5 Pro | 0.94 | 0.85 | 1.53 分钟 | $0.28 | 97.8% |
| Claude 3.5 Sonnet | 0.94 | 0.80 | 3.25 分钟 | $0.39 | 95.9% |
| Llama 3.3 70B | 0.88 | 0.93 | 1.20 分钟 | $0.00 | 98.0% |

**模式：** 高敏感度模型（Claude、Gemini）牺牲特异度；高特异度模型（GPT-4o）牺牲敏感度。这是经典的精确率-召回率权衡。

**集成方法：** 结合 Claude 3.5 Sonnet + Gemini 1.5 Pro 实现敏感度 0.99，但特异度降至 0.70。

**关键研究 2：3 层 GPT 筛选策略（JMIR 2024）**
通过三层顺序筛选——研究设计、目标人群、干预/对照：

| 模型 | 研究 1 敏感度 | 研究 1 特异度 | 研究 2 敏感度 | 研究 2 特异度 |
|------|--------------|--------------|--------------|--------------|
| GPT-3.5 | 0.900 | 0.709 | 0.958 | 0.116 |
| GPT-4 | 0.806 | 0.996 | 0.875 | 0.855 |
| GPT-4（调整后） | 0.962 | 0.996 | 0.943 | 0.855 |

成本：约 4,500 条记录总计 $59（GPT-3.5 $4，GPT-4 $55）。处理时间：1-2 小时 vs. 人工筛选需要数天。

**关键研究 3：临床综述的自动化筛选（JMIR 2024）**
准确率 0.91，宏 F1 分数 0.60，纳入论文的敏感度 0.76。人类评估者间 kappa 仅为 0.46，而 LLM 与人类的一致性（调整偏差后的 kappa）为 0.96。

**关键研究 4：LLM 筛选的系统评价和 Meta 分析（2024）**
评估了 14 个基于 LLM 的模型；总体敏感度和特异度接近 90%。基于 GPT 的模型在数据提取任务中实现了平均精确率 83.0% 和召回率 86.0%。

### 2.5 混合方法

最有前景的方向是在流水线中组合多种方法：

**混合半自动化工作流（MDPI 2024）：**
1. LLM 从标题/摘要中提取关键词、短语和摘要（IVD 框架：Identifier、Verifier、Data fields）
2. 人类审稿人基于提取的关键词快速做出纳入/排除决策
3. 替代标题/摘要筛选和部分全文筛选
4. 结果：识别出 6/390（1.53%）被纯人工流程误分类的文章

**多模型 Active Learning 流水线（ASReview v2）：**
1. 随机采样 -> 轻量模型（Naive Bayes + TF-IDF）-> 深度学习模型（sBERT + SVM）-> 终止
2. 顺序代理交接，每个阶段有可配置的停止标准
3. 支持共享 AI 模型的多专家众包筛选

---

## 3. 精确率/召回率基准和关键指标

### 3.1 95% 召回率阈值

95% 召回率（敏感度）阈值是系统评价中自动化筛选的事实标准。其来源和理由：

- **含义：** 筛选程序必须识别出数据集中至少 95% 的所有相关研究
- **为什么是 95%：** 这是一个实用阈值——在大多数情况下，遗漏 5% 的相关研究被认为不太可能改变一项规范 Meta 分析的结论（推测性但被广泛接受）
- **关键局限：** 在实时审查期间你无法知道何时达到了 95%，因为相关记录的总数是未知的。WSS@95 是一个回顾性模拟指标
- **Cochrane 立场：** Cochrane 没有正式认可具体的数值阈值，但 95% 已通过研究实践成为社区标准（已证实）

### 3.2 WSS@95（95% 召回率下的工作节省量）

**定义：** 在 95% 召回率时筛选者无需阅读的记录比例。公式为：

```
WSS@95 = (TN + FN) / N - (1 - 0.95)
```

其中 N 是记录总数，TN 是真阴性，FN 是在找到 95% 相关记录时的假阴性。

**解读：**
- WSS@95 = 0.50 意味着筛选者节省了 50% 的工作量，同时仍找到了 95% 的相关研究
- WSS@95 = 0.85 意味着在 95% 召回率下减少了 85% 的工作量
- 越高越好；理论最大值取决于相关记录的比例

**典型值：**
- ASReview（Naive Bayes + TF-IDF）：WSS@95 范围 0.50-0.95，取决于数据集（已证实）
- 最佳表现模型：在大多数 SYNERGY 数据集上 WSS@95 > 0.80（已证实）
- 归一化 WSS（等同于 95% 召回率下的真阴性率）可实现跨数据集比较

### 3.3 基准数据集

| 数据集 | 记录数 | 综述数 | 相关比例 | 主要用途 |
|--------|--------|--------|----------|----------|
| **SYNERGY** | 169,288 | 26 篇系统评价 | 1.67% | ASReview 模型开发和基准测试 |
| **CLEF eHealth TAR** | 约 50 篇系统评价 | 不等 | 不等 | CLEF 评估活动（2017-2019） |
| **Cohen et al. 2006** | 15 项药物综述 | 平均 4,756 | 约 2% | 原始 WSS 指标验证 |

**SYNERGY 数据集（主要基准）：**
- 来自 26 篇系统评价的 169,288 篇学术作品
- 仅 2,834（1.67%）被纳入——极端的类别不平衡，反映现实条件
- 开源，可通过 GitHub 获取（asreview/synergy-dataset）
- 用于 ASReview v2 超参数优化
- 24 个具有完整二元标签的数据集

### 3.4 综合性能比较

| 方法 | 敏感度（召回率） | 特异度 | WSS@95 | 设置时间 | 每 1000 条记录成本 |
|------|-----------------|--------|--------|----------|-------------------|
| **人工双人筛选** | 0.85-1.00 | 约 0.90 | 不适用（基线） | 数小时（培训） | $500-2000（人力） |
| **ASReview (AL, Ultra)** | 0.95+（设计目标） | 不等 | 0.50-0.95 | 数分钟 | 免费（开源） |
| **GPT-4o** | 0.85 | 0.97 | 不适用 | 数分钟 | $4.00 |
| **Claude 3.5 Sonnet** | 0.94 | 0.80 | 不适用 | 数分钟 | $3.90 |
| **Gemini 1.5 Pro** | 0.94 | 0.85 | 不适用 | 数分钟 | $2.80 |
| **Llama 3.3 70B** | 0.88 | 0.93 | 不适用 | 数分钟 | $0（自托管） |
| **LLM 集成（2 个模型）** | 0.99 | 0.70 | 不适用 | 数分钟 | $6-8 |
| **Rayyan (ML 辅助)** | 0.93 | 不等 | 约 0.40 | 数分钟 | $0-96/年 |
| **Covidence (ML 辅助)** | 未公开 | 未公开 | 未公开 | 数分钟 | 约 $500/年 |

---

## 4. 方法学争议与局限

### 4.1 可重复性

**核心问题：** 基于 LLM 的筛选不完全可重复。
- 模型版本会变化（今天的 GPT-4o 不是 6 个月后的 GPT-4o）
- Temperature 设置影响输出变异性
- API 限速和批处理可能导致不同结果
- 即使在 temperature=0 时，模型在多次运行中也显示 1-5% 的决策差异（已证实）

**Active Learning 的可重复性：**
- 比 LLM 更可重复（在相同种子和先验知识条件下是确定性的）
- 但取决于初始标注记录（先验知识）的顺序
- ASReview v2 通过完整的标注日志和模型可追溯性来解决此问题

### 4.2 期刊接受度

**当前状态（已证实，截至 2025 年底）：**
- 没有主要期刊明确禁止 AI 辅助筛选
- Cochrane 尚未发布关于 AI 辅助筛选的正式指导（截至 2025 年）
- PRISMA 2020 的条目 6a 中已包含"自动化工具"的语言
- PRISMA-trAIce（2025 年 12 月发布）提供了第一个专门的报告框架

**实践指导：**
- 始终在方法部分披露 AI 工具的使用
- 报告模型名称、版本、参数和提示词
- 提供人工验证率和一致性指标
- 包含修改后的 PRISMA 流程图，显示 AI vs. 人工决策

### 4.3 PRISMA-trAIce：新的报告标准

2025 年 12 月由 JMIR AI 发布，PRISMA-trAIce 在 PRISMA 2020 基础上扩展了 14 个新条目用于透明的 AI 报告：

**与筛选相关的关键条目：**
- **P-trAIce T1：** 在标题中注明 AI 辅助
- **P-trAIce M2：** 指定工具名称、版本、开发者、URL
- **P-trAIce M5：** 描述输出格式和置信度分数
- **P-trAIce M6：** 报告完整的提示词和参数（temperature、max tokens）
- **P-trAIce M8：** 记录人机交互（审稿人数量、验证比例、分歧解决方式）
- **P-trAIce M9：** 报告评估指标（准确率、敏感度、特异度、精确率、召回率、F1）
- **P-trAIce R1：** 在 PRISMA 流程图中区分 AI vs. 人工决策

**对 MetaReview 的意义：** 将 PRISMA-trAIce 合规报告内置于产品中将是重要的差异化优势。大多数现有工具不支持此功能。

### 4.4 "足够好"之辩

越来越多的证据质疑双人独立人工筛选是否应继续作为黄金标准：
- 人类筛选中的评估者间 kappa 通常仅为 0.46-0.60（已证实）——勉强达到"中度"一致
- 个人人类错误率约 10%，假排除率约 13-14%（已证实）
- AI 工具可以达到与单个人类筛选者相当或更高的敏感度
- 一些研究表明 AI 能识别出纯人工流程遗漏的记录（一项研究中误分类率为 1.53%）

**这是 MetaReview 可以利用的结构性张力：** 黄金标准（双人人工筛选）昂贵、缓慢，且可靠性低于普遍假设。AI 辅助方法可以更快、更便宜、且同等或更可靠——但该领域缺乏一个标准化、可审计的工作流。

---

## 5. MetaReview 混合筛选流水线：推荐架构

基于本次研究，MetaReview 的最优筛选流水线结合了每种方法的优势：

### 5.1 建议的 4 阶段流水线

```
Stage 1: DEDUPLICATION & ENRICHMENT
  - Automated deduplication (rule-based + fuzzy matching)
  - RIS/BibTeX/CSV import from all major databases
  - PMID/DOI resolution for metadata enrichment

Stage 2: AI PRE-SCREENING (LLM Zero-Shot)
  - Input: User's PICO-formatted inclusion/exclusion criteria
  - LLM classifies each title/abstract as Include/Exclude/Uncertain
  - Use multi-model ensemble (2+ models) for maximum recall
  - Target: Sensitivity >= 0.95, flag ~30-50% as "safe to exclude"
  - Records classified as "Exclude" are flagged, NOT removed

Stage 3: ACTIVE LEARNING PRIORITIZATION
  - User reviews a small random sample + LLM-flagged "Uncertain" records
  - Active Learning model trains on these human decisions
  - Remaining records re-ranked by predicted relevance
  - User reviews in priority order (most likely relevant first)
  - SAFE-style stopping heuristic implemented
  - Savings: 50-85% of remaining records can be safely deprioritized

Stage 4: HUMAN VERIFICATION & CONFLICT RESOLUTION
  - Dual screening mode: User + AI as "second reviewer"
  - OR traditional dual human screening with Kappa calculation
  - All AI-flagged "Exclude" records available for human spot-check
  - Full audit trail: every decision logged with timestamp, method, confidence
```

### 5.2 为何采用此架构

**第 2 阶段（LLM）在第 3 阶段（AL）之前——而非相反：**
- LLM 可以高置信度地预筛掉 30-50% 明显不相关的记录，减少 Active Learning 需要处理的数据池
- Active Learning 在相关记录比例更高时（类别不平衡不那么极端）表现更好
- LLM 预筛选只需几分钟且成本极低；AL 需要迭代式的人机交互

**LLM 集成而非单一模型：**
- 没有单一 LLM 能在所有领域持续达到 >=95% 的敏感度
- 2 个模型的集成（如 Claude + GPT-4o）可以达到 99% 的敏感度，代价是较低的特异度（0.70）
- 较低的特异度是可接受的，因为剩余记录进入 AL 优先排序，而非直接排除

**人类仍然是最终决策者：**
- ASReview 的设计哲学是正确的："人类必须始终是神谕者"
- AI 增强速度和一致性；人类提供领域判断和责任担当
- 这也满足期刊审稿人的期望和 PRISMA-trAIce 的要求

### 5.3 竞争优势评估

| 功能 | Covidence | Rayyan | ASReview | MetaReview（建议） |
|------|-----------|--------|----------|-------------------|
| 双人筛选 | 是 | 是（盲态模式） | 是（v2 多专家） | 是 |
| Active Learning | 基础 ML 排序 | 星级评分（基础） | 完整 AL 流水线 | 完整 AL 流水线 |
| LLM 筛选 | 否 | 否 | 明确拒绝 | 是（多模型集成） |
| Kappa 计算 | 是 | 是 | 否 | 是（自动化） |
| PRISMA 流程图 | 模板 | 手动 | 否 | 自动生成 |
| PRISMA-trAIce 支持 | 否 | 否 | 否 | 是（内置） |
| 停止启发式 | 否 | 否 | 是（SAFE 兼容） | 是（SAFE + 置信度指标） |
| 完整审计追踪 | 部分 | 部分 | 是（v2） | 是（完整） |
| 成本 | 约 $500/年 | $0-96/年 | 免费 | 待定 |
| 开源 | 否 | 否 | 是 | 待定 |

**MetaReview 填补的空白：** 没有现有工具将 LLM 预筛选 + Active Learning 优先排序 + PRISMA-trAIce 合规报告组合在单一工作流中。这就是产品论点。

### 5.4 技术实现说明

**LLM 集成：**
- 通过 API 支持多个 LLM 供应商（OpenAI、Anthropic、Google、本地 Ollama）
- 用户提供自己的 API key（避免 MetaReview 承担成本）
- 基于结构化 PICO 标准的提示，temperature=0
- 每条记录处理 2 次（两个不同模型）以确保集成可靠性

**Active Learning：**
- 可基于 ASReview 的开源 Python 核心构建（MIT 许可证）
- 默认：TF-IDF + SVM（经验证最快且最可靠）
- 可选：用于特定领域综述的语义嵌入
- 停止圆环 UI，可配置连续不相关阈值

**审计与报告：**
- 记录每一个决策：时间戳、方法（人工/LLM/AL）、模型版本、置信度分数
- 自动生成带有 AI/人工决策分类的 PRISMA 流程图
- 导出审计日志用于方法部分撰写
- 实时计算和显示 Cohen's Kappa

---

## 6. 核心参考文献

### 基础文献（必读）

1. Page MJ, McKenzie JE, Bossuyt PM, et al. **The PRISMA 2020 statement: an updated guideline for reporting systematic reviews.** BMJ. 2021;372:n71. —— 当前的报告标准。

2. van de Schoot R, de Bruin J, Schram R, et al. **An open source machine learning framework for efficient and transparent systematic reviews.** Nature Machine Intelligence. 2021;3(2):125-133. —— ASReview 的奠基论文。

3. Cohen AM, Hersh WR, Peterson K, Yen PY. **Reducing workload in systematic review preparation using automated citation classification.** J Am Med Inform Assoc. 2006;13(2):206-219. —— 原始 WSS 指标。

### Active Learning 与停止规则

4. Boetje J, van de Schoot R. **The SAFE procedure: a practical stopping heuristic for active learning-based screening in systematic reviews and meta-analyses.** Systematic Reviews. 2024;13:73. —— 最实用的停止框架。

5. van de Schoot R, et al. **ASReview LAB v.2: Open-source text screening with multiple agents and a crowd of experts.** Patterns. 2025. —— 支持多代理的最新架构。

6. Teijema JJ, Ribeiro G, Seuren S, et al. **Simulation-based active learning for systematic reviews: A scoping review of literature.** Journal of Information Science. 2025. —— 60 篇 AL 研究的综合评述。

7. de Bruin J, et al. **Performance of active learning models for screening prioritization in systematic reviews: a simulation study into the Average Time to Discover relevant records.** Systematic Reviews. 2023;12:100.

### LLM 筛选性能

8. Takeshima N, et al. **Optimal large language models to screen citations for systematic reviews.** Research Synthesis Methods. 2025. —— GPT-4o vs Claude vs Gemini vs Llama 基准测试。

9. Choi J, et al. **Human-Comparable Sensitivity of Large Language Models in Identifying Eligible Studies Through Title and Abstract Screening: 3-Layer Strategy Using GPT-3.5 and GPT-4 for Systematic Reviews.** JMIR. 2024;26:e52758. —— 3 层提示策略。

10. Guo E, et al. **Automated Paper Screening for Clinical Reviews Using Large Language Models: Data Analysis Study.** JMIR. 2024;26:e48996. —— LLM vs 人工筛选比较。

11. Kim Y, et al. **Evaluating large language models for title/abstract screening: a systematic review and meta-analysis & development of new tool.** J Med Artif Intell. 2025. —— 14 项基于 LLM 的筛选研究的 Meta 分析。

12. Lieberum T, et al. **Large Language Models in Systematic Review Screening: Opportunities, Challenges, and Methodological Considerations.** Information. 2025;16(5):378.

### 报告标准

13. Frisch N, et al. **Transparent Reporting of AI in Systematic Literature Reviews: Development of the PRISMA-trAIce Checklist.** JMIR AI. 2025;4:e80247. —— 系统评价的新 AI 报告标准。

14. Defined through Cochrane: **PRISMA AI reporting guidelines for systematic reviews and meta-analyses on AI in healthcare.** Nature Medicine. 2023.

### 基准数据集

15. SYNERGY Dataset. **Open machine learning dataset on study selection in systematic reviews.** GitHub: asreview/synergy-dataset. 169,288 条记录，26 篇系统评价。

16. Kanoulas E, et al. **CLEF 2018 Technologically Assisted Reviews in Empirical Medicine Overview.** —— 筛选自动化评估基准。

### 工具与比较

17. Harrison H, et al. **Software tools to support title and abstract screening for systematic reviews in healthcare: an evaluation.** BMC Medical Research Methodology. 2020;20:7. —— Covidence vs Rayyan 比较。

18. **ASReview LAB documentation.** https://asreview.readthedocs.io/ —— AL 实现的技术参考。

### 争议与局限

19. Kusa W, et al. **An analysis of work saved over sampling in the evaluation of automated citation screening in systematic literature reviews.** AI Open. 2023. —— WSS 指标分析与归一化。

20. Marshall IJ, Wallace BC. **Inter-reviewer reliability of human literature reviewing and implications for the introduction of machine-assisted systematic reviews.** BMC Medical Research Methodology. 2024. —— 人工筛选可靠性数据。

---

## 7. 信息空白与后续步骤

### 我们高置信度确认的内容：
- Active Learning 将筛选工作量减少 50-90%（经 60+ 项研究证实）
- LLM 在标题/摘要筛选中达到 85-95% 的敏感度（经多项研究证实）
- 没有现有工具在单一流水线中组合 AL + LLM（经竞品分析证实）
- PRISMA-trAIce 是新兴的报告标准（已证实，2025 年 12 月发布）

### 我们中等置信度认为的内容：
- 95% 召回率阈值"通常"足以保持 Meta 分析结论（很可能，但取决于数据集）
- LLM 集成方法比单一模型提高敏感度（很可能，研究有限）
- 如果透明且可审计，用户会接受 AI 辅助筛选（很可能，基于采纳趋势）

### 仍然未知的内容：
- Cochrane 对 AI 辅助筛选的官方立场（截至 2025 年无正式指导）
- 随着模型演进，基于 LLM 的筛选的长期可重复性
- PRISMA-trAIce 是否会被主要期刊采纳（太新，无法评估）
- 跨医学领域的最优提示模板（高度可变）
- 组合 AL+LLM 流水线是否确实优于单独使用任一方法（未找到正面对比研究）

### 建议后续研究：
1. 构建筛选流水线原型并在 SYNERGY 数据集上测试
2. 将我们的 LLM 提示词与已发表结果进行基准对比
3. 访谈 3-5 位系统评价作者，了解其筛选痛点
4. 分析定价敏感度——研究人员愿意为此功能支付多少？

---

*研究汇编自 20+ 篇同行评审来源、预印本和技术文档。所有声明按 Research Thompson 协议标注为已证实/很可能/推测性。信息截至 2026 年 2 月。*
