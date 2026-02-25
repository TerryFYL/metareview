import { useCallback, useMemo } from 'react';
import { t, type Lang } from '../lib/i18n';
import type { ProtocolData, PICO, StudyDesignType, DatabaseType, RobToolType, EffectMeasure } from '../lib/types';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

interface ProtocolTemplateProps {
  protocol: ProtocolData;
  pico: PICO;
  measure: EffectMeasure;
  model: string;
  onChange: (protocol: ProtocolData) => void;
  lang: Lang;
}

const STUDY_TYPES: StudyDesignType[] = ['RCT', 'quasi_experimental', 'cohort', 'case_control', 'cross_sectional', 'case_series', 'other'];

const DATABASES: DatabaseType[] = ['pubmed', 'embase', 'central', 'scopus', 'web_of_science', 'cinahl', 'psycinfo', 'other'];

const ROB_TOOLS: RobToolType[] = ['rob2', 'robins_i', 'nos', 'jbi', 'custom'];

const sectionStyle: React.CSSProperties = {
  marginBottom: 24,
  padding: '16px 20px',
  background: '#f9fafb',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: '#1f2937',
  marginBottom: 12,
  paddingBottom: 8,
  borderBottom: '1px solid #e5e7eb',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: '#374151',
  marginBottom: 4,
  marginTop: 12,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 13,
  border: '1px solid #d1d5db',
  borderRadius: 6,
  background: '#fff',
  color: '#111827',
  boxSizing: 'border-box',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 72,
  resize: 'vertical' as const,
  fontFamily: 'inherit',
  lineHeight: 1.5,
};

const checkboxGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px 16px',
  marginTop: 6,
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 13,
  color: '#374151',
  cursor: 'pointer',
};

const btnPrimary: React.CSSProperties = {
  padding: '8px 18px',
  fontSize: 13,
  fontWeight: 600,
  color: '#fff',
  background: '#2563eb',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  padding: '8px 18px',
  fontSize: 13,
  fontWeight: 500,
  color: '#2563eb',
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  borderRadius: 6,
  cursor: 'pointer',
};

function defaultScreeningProcess(lang: Lang): string {
  return lang === 'zh'
    ? '两名研究者将独立筛选所有检索到的文献标题和摘要。对于可能符合纳入标准的文献，将获取全文进行进一步评估。两名研究者将独立阅读全文，根据预先设定的纳入排除标准做出最终纳入决策。分歧通过讨论或咨询第三方解决。使用 Cohen\'s Kappa 评估筛选者间一致性。'
    : 'Two reviewers will independently screen all titles and abstracts. Full texts of potentially eligible studies will be retrieved for further assessment. Two reviewers will independently assess full texts against pre-specified eligibility criteria. Disagreements will be resolved by discussion or consultation with a third reviewer. Inter-rater agreement will be assessed using Cohen\'s Kappa.';
}

function defaultDataExtraction(lang: Lang): string {
  return lang === 'zh'
    ? '两名研究者将独立使用标准化数据提取表提取数据。提取的信息包括：研究特征（作者、年份、国家、研究设计）、人群特征（样本量、年龄、性别比例、疾病分期）、干预和对照详情、结局数据及随访时长。分歧通过讨论或参照原始文献解决。'
    : 'Two reviewers will independently extract data using a standardized extraction form. Information to be extracted includes: study characteristics (authors, year, country, study design), population characteristics (sample size, age, sex ratio, disease stage), intervention and comparator details, outcome data, and follow-up duration. Disagreements will be resolved by discussion or reference to the original article.';
}

function defaultHeterogeneity(lang: Lang): string {
  return lang === 'zh'
    ? '使用 Cochran\'s Q 检验（显著性水平 P < 0.10）和 I² 统计量评估异质性。I² < 25% 视为低异质性，25-75% 为中等异质性，> 75% 为高异质性。异质性较高时将采用亚组分析和 Meta 回归探索异质性来源。'
    : 'Heterogeneity will be assessed using Cochran\'s Q test (significance level P < 0.10) and the I² statistic. I² < 25% indicates low heterogeneity, 25-75% moderate, and > 75% high. Subgroup analyses and meta-regression will be used to explore sources of heterogeneity when substantial.';
}

function defaultPublicationBias(lang: Lang): string {
  return lang === 'zh'
    ? '若纳入研究 ≥ 10 项，将通过漏斗图目视检查、Egger\'s 回归检验和 Begg\'s 秩相关检验评估发表偏倚。若检测到不对称，将使用 Trim-and-Fill 方法进行敏感性分析。'
    : 'If ≥ 10 studies are included, publication bias will be assessed by visual inspection of funnel plots, Egger\'s regression test, and Begg\'s rank correlation test. If asymmetry is detected, Trim-and-Fill sensitivity analysis will be performed.';
}

function defaultConfidence(lang: Lang): string {
  return lang === 'zh'
    ? '使用 GRADE（推荐等级的评估、制定与评价）框架评估每个结局的证据质量。考虑五个降级因素：偏倚风险、不精确性、不一致性、间接性和发表偏倚。证据质量分为高、中、低、极低四个等级。'
    : 'The certainty of evidence for each outcome will be assessed using the GRADE (Grading of Recommendations, Assessment, Development and Evaluations) framework. Five downgrading factors will be considered: risk of bias, imprecision, inconsistency, indirectness, and publication bias. Evidence will be rated as high, moderate, low, or very low.';
}

export default function ProtocolTemplate({ protocol, pico, measure, model, onChange, lang }: ProtocolTemplateProps) {
  const update = useCallback(
    (field: keyof ProtocolData, value: ProtocolData[keyof ProtocolData]) => {
      onChange({ ...protocol, [field]: value });
    },
    [protocol, onChange],
  );

  const toggleStudyType = useCallback(
    (type: StudyDesignType) => {
      const current = protocol.studyTypes;
      const next = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];
      update('studyTypes', next);
    },
    [protocol.studyTypes, update],
  );

  const toggleDatabase = useCallback(
    (db: DatabaseType) => {
      const current = protocol.databases;
      const next = current.includes(db) ? current.filter((d) => d !== db) : [...current, db];
      update('databases', next);
    },
    [protocol.databases, update],
  );

  const autoFillFromPICO = useCallback(() => {
    const measureLabel = measure === 'OR' ? 'Odds Ratio (OR)' : measure === 'RR' ? 'Risk Ratio (RR)' : measure === 'HR' ? 'Hazard Ratio (HR)' : measure === 'MD' ? 'Mean Difference (MD)' : "Hedges' g (SMD)";
    const modelLabel = model === 'random' ? (lang === 'zh' ? '随机效应模型 (DerSimonian-Laird)' : 'Random-effects model (DerSimonian-Laird)') : (lang === 'zh' ? '固定效应模型 (Mantel-Haenszel)' : 'Fixed-effect model (Mantel-Haenszel)');

    onChange({
      ...protocol,
      participants: protocol.participants || pico.population,
      interventions: protocol.interventions || pico.intervention,
      comparators: protocol.comparators || pico.comparison,
      primaryOutcomes: protocol.primaryOutcomes || pico.outcome,
      studyTypes: protocol.studyTypes.length === 0 ? ['RCT'] : protocol.studyTypes,
      databases: protocol.databases.length === 0 ? ['pubmed', 'embase', 'central'] : protocol.databases,
      effectMeasure: protocol.effectMeasure || measureLabel,
      synthesisMethod: protocol.synthesisMethod || modelLabel,
      screeningProcess: protocol.screeningProcess || defaultScreeningProcess(lang),
      dataExtractionProcess: protocol.dataExtractionProcess || defaultDataExtraction(lang),
      heterogeneityAssessment: protocol.heterogeneityAssessment || defaultHeterogeneity(lang),
      publicationBiasAssessment: protocol.publicationBiasAssessment || defaultPublicationBias(lang),
      confidenceAssessment: protocol.confidenceAssessment || defaultConfidence(lang),
    });
  }, [protocol, pico, measure, model, lang, onChange]);

  const hasPICO = pico.population || pico.intervention || pico.comparison || pico.outcome;

  const completionCount = useMemo(() => {
    const fields: (keyof ProtocolData)[] = [
      'title', 'authors', 'rationale', 'participants', 'interventions', 'comparators',
      'primaryOutcomes', 'searchStrategy', 'screeningProcess', 'dataExtractionProcess',
      'effectMeasure', 'synthesisMethod', 'heterogeneityAssessment', 'publicationBiasAssessment', 'confidenceAssessment',
    ];
    const filled = fields.filter((f) => {
      const v = protocol[f];
      return typeof v === 'string' && v.trim().length > 0;
    }).length;
    const hasTypes = protocol.studyTypes.length > 0;
    const hasDbs = protocol.databases.length > 0;
    return { filled: filled + (hasTypes ? 1 : 0) + (hasDbs ? 1 : 0), total: fields.length + 2 };
  }, [protocol]);

  const exportDOCX = useCallback(async () => {
    const makePara = (text: string, opts?: { heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel]; bold?: boolean; spacing?: number }) =>
      new Paragraph({
        children: [new TextRun({ text, bold: opts?.bold, size: opts?.heading ? undefined : 22, font: 'Times New Roman' })],
        heading: opts?.heading,
        spacing: { after: opts?.spacing ?? 120 },
      });

    const makeField = (label: string, value: string) => [
      new Paragraph({
        children: [new TextRun({ text: label, bold: true, size: 22, font: 'Times New Roman' })],
        spacing: { before: 160, after: 60 },
      }),
      new Paragraph({
        children: [new TextRun({ text: value || (lang === 'zh' ? '（待填写）' : '(To be completed)'), size: 22, font: 'Times New Roman', italics: !value })],
        spacing: { after: 120 },
      }),
    ];

    const studyTypeLabels = protocol.studyTypes.map((st) => t(`protocol.studyType.${st}`, lang)).join(', ') || (lang === 'zh' ? '（待选择）' : '(To be selected)');
    const dbLabels = protocol.databases.map((db) => t(`protocol.db.${db}`, lang)).join(', ') || (lang === 'zh' ? '（待选择）' : '(To be selected)');
    const robLabel = t(`protocol.robTool.${protocol.robTool}`, lang);
    const dateRange = [protocol.searchDateFrom, protocol.searchDateTo].filter(Boolean).join(' — ') || (lang === 'zh' ? '数据库建库至检索日期' : 'Database inception to search date');

    const children: Paragraph[] = [
      // Title
      new Paragraph({
        children: [new TextRun({ text: protocol.title || (lang === 'zh' ? '系统评价与 Meta 分析方案' : 'Systematic Review and Meta-Analysis Protocol'), size: 32, bold: true, font: 'Times New Roman' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      // Authors
      new Paragraph({
        children: [new TextRun({ text: protocol.authors || '', size: 22, font: 'Times New Roman' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
      }),
      // Contact
      ...(protocol.contactEmail ? [new Paragraph({
        children: [new TextRun({ text: `Corresponding author: ${protocol.contactEmail}`, size: 20, font: 'Times New Roman', italics: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })] : []),
      // PROSPERO
      ...(protocol.prosperoId ? [new Paragraph({
        children: [new TextRun({ text: `PROSPERO Registration: ${protocol.prosperoId}`, size: 22, font: 'Times New Roman' })],
        spacing: { after: 200 },
      })] : []),

      // Section 1: Background
      makePara(lang === 'zh' ? '1. 研究背景与理由' : '1. Background & Rationale', { heading: HeadingLevel.HEADING_1 }),
      ...makeField(lang === 'zh' ? '背景' : 'Rationale', protocol.rationale),

      // Section 2: Eligibility
      makePara(lang === 'zh' ? '2. 纳入排除标准' : '2. Eligibility Criteria', { heading: HeadingLevel.HEADING_1 }),
      ...makeField(lang === 'zh' ? '研究类型' : 'Study Types', studyTypeLabels),
      ...makeField(lang === 'zh' ? '研究人群 (P)' : 'Participants (P)', protocol.participants),
      ...makeField(lang === 'zh' ? '干预措施 (I)' : 'Interventions (I)', protocol.interventions),
      ...makeField(lang === 'zh' ? '对照措施 (C)' : 'Comparators (C)', protocol.comparators),
      ...makeField(lang === 'zh' ? '主要结局 (O)' : 'Primary Outcomes (O)', protocol.primaryOutcomes),
      ...makeField(lang === 'zh' ? '次要结局' : 'Secondary Outcomes', protocol.secondaryOutcomes),
      ...makeField(lang === 'zh' ? '时间框架' : 'Timing', protocol.timingOfOutcomes),
      ...makeField(lang === 'zh' ? '研究场景' : 'Setting', protocol.setting),

      // Section 3: Information Sources
      makePara(lang === 'zh' ? '3. 信息来源' : '3. Information Sources', { heading: HeadingLevel.HEADING_1 }),
      ...makeField(lang === 'zh' ? '检索数据库' : 'Databases', dbLabels),
      ...makeField(lang === 'zh' ? '检索日期范围' : 'Search Date Range', dateRange),
      ...makeField(lang === 'zh' ? '其他信息来源' : 'Other Sources', protocol.otherSources),

      // Section 4: Search Strategy
      makePara(lang === 'zh' ? '4. 检索策略' : '4. Search Strategy', { heading: HeadingLevel.HEADING_1 }),
      ...makeField(lang === 'zh' ? '检索策略' : 'Search Strategy', protocol.searchStrategy),

      // Section 5: Study Selection
      makePara(lang === 'zh' ? '5. 研究筛选' : '5. Study Selection', { heading: HeadingLevel.HEADING_1 }),
      ...makeField(lang === 'zh' ? '筛选流程' : 'Screening Process', protocol.screeningProcess),

      // Section 6: Data Collection
      makePara(lang === 'zh' ? '6. 数据提取' : '6. Data Collection', { heading: HeadingLevel.HEADING_1 }),
      ...makeField(lang === 'zh' ? '数据提取流程' : 'Extraction Process', protocol.dataExtractionProcess),
      ...makeField(lang === 'zh' ? '提取数据项' : 'Data Items', protocol.dataItems),

      // Section 7: Risk of Bias
      makePara(lang === 'zh' ? '7. 偏倚风险评估' : '7. Risk of Bias Assessment', { heading: HeadingLevel.HEADING_1 }),
      ...makeField(lang === 'zh' ? '评估工具' : 'Assessment Tool', robLabel),
      ...makeField(lang === 'zh' ? '评估细节' : 'Assessment Details', protocol.robDetails),

      // Section 8: Data Synthesis
      makePara(lang === 'zh' ? '8. 数据合成' : '8. Data Synthesis', { heading: HeadingLevel.HEADING_1 }),
      ...makeField(lang === 'zh' ? '效应量指标' : 'Effect Measure', protocol.effectMeasure),
      ...makeField(lang === 'zh' ? '合成方法' : 'Synthesis Method', protocol.synthesisMethod),
      ...makeField(lang === 'zh' ? '异质性评估' : 'Heterogeneity Assessment', protocol.heterogeneityAssessment),
      ...makeField(lang === 'zh' ? '亚组分析计划' : 'Planned Subgroup Analyses', protocol.subgroupAnalyses),
      ...makeField(lang === 'zh' ? '敏感性分析计划' : 'Planned Sensitivity Analyses', protocol.sensitivityAnalyses),

      // Section 9: Meta-bias & Evidence Quality
      makePara(lang === 'zh' ? '9. 发表偏倚与证据质量' : '9. Meta-bias & Evidence Quality', { heading: HeadingLevel.HEADING_1 }),
      ...makeField(lang === 'zh' ? '发表偏倚评估' : 'Publication Bias Assessment', protocol.publicationBiasAssessment),
      ...makeField(lang === 'zh' ? '证据质量评估' : 'Confidence Assessment', protocol.confidenceAssessment),

      // Section 10: Timeline & Funding
      makePara(lang === 'zh' ? '10. 时间表与资助' : '10. Timeline & Funding', { heading: HeadingLevel.HEADING_1 }),
      ...makeField(lang === 'zh' ? '预计开始日期' : 'Anticipated Start Date', protocol.anticipatedStartDate),
      ...makeField(lang === 'zh' ? '预计完成日期' : 'Anticipated End Date', protocol.anticipatedEndDate),
      ...makeField(lang === 'zh' ? '资助来源' : 'Funding', protocol.funding),
      ...makeField(lang === 'zh' ? '利益冲突' : 'Conflicts of Interest', protocol.conflictsOfInterest),

      // Footer
      new Paragraph({ children: [], spacing: { before: 400 } }),
      new Paragraph({
        children: [new TextRun({ text: lang === 'zh' ? '本方案遵循 PRISMA-P 2015 指南编写。' : 'This protocol was prepared following PRISMA-P 2015 guidelines.', size: 20, font: 'Times New Roman', italics: true })],
        spacing: { after: 60 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `Generated by MetaReview (https://metareview.cc) — ${new Date().toISOString().split('T')[0]}`, size: 18, font: 'Times New Roman', italics: true, color: '999999' })],
      }),
    ];

    const doc = new Document({
      sections: [{
        properties: {
          page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        children,
      }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protocol-${protocol.prosperoId || 'draft'}-${new Date().toISOString().split('T')[0]}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [protocol, lang]);

  const exportMarkdown = useCallback(() => {
    const empty = lang === 'zh' ? '（待填写）' : '(To be completed)';
    const field = (label: string, value: string) => `**${label}**\n\n${value || empty}\n`;
    const studyTypeLabels = protocol.studyTypes.map((st) => t(`protocol.studyType.${st}`, lang)).join(', ') || (lang === 'zh' ? '（待选择）' : '(To be selected)');
    const dbLabels = protocol.databases.map((db) => t(`protocol.db.${db}`, lang)).join(', ') || (lang === 'zh' ? '（待选择）' : '(To be selected)');
    const robLabel = t(`protocol.robTool.${protocol.robTool}`, lang);
    const dateRange = [protocol.searchDateFrom, protocol.searchDateTo].filter(Boolean).join(' — ') || (lang === 'zh' ? '数据库建库至检索日期' : 'Database inception to search date');

    const lines = [
      `# ${protocol.title || (lang === 'zh' ? '系统评价与 Meta 分析方案' : 'Systematic Review and Meta-Analysis Protocol')}`,
      '',
      protocol.authors || '',
      protocol.contactEmail ? `*Corresponding author: ${protocol.contactEmail}*` : '',
      protocol.prosperoId ? `PROSPERO Registration: ${protocol.prosperoId}` : '',
      '',
      `## 1. ${lang === 'zh' ? '研究背景与理由' : 'Background & Rationale'}`,
      '',
      field(lang === 'zh' ? '背景' : 'Rationale', protocol.rationale),
      `## 2. ${lang === 'zh' ? '纳入排除标准' : 'Eligibility Criteria'}`,
      '',
      field(lang === 'zh' ? '研究类型' : 'Study Types', studyTypeLabels),
      field(lang === 'zh' ? '研究人群 (P)' : 'Participants (P)', protocol.participants),
      field(lang === 'zh' ? '干预措施 (I)' : 'Interventions (I)', protocol.interventions),
      field(lang === 'zh' ? '对照措施 (C)' : 'Comparators (C)', protocol.comparators),
      field(lang === 'zh' ? '主要结局 (O)' : 'Primary Outcomes (O)', protocol.primaryOutcomes),
      field(lang === 'zh' ? '次要结局' : 'Secondary Outcomes', protocol.secondaryOutcomes),
      field(lang === 'zh' ? '时间框架' : 'Timing', protocol.timingOfOutcomes),
      field(lang === 'zh' ? '研究场景' : 'Setting', protocol.setting),
      `## 3. ${lang === 'zh' ? '信息来源' : 'Information Sources'}`,
      '',
      field(lang === 'zh' ? '检索数据库' : 'Databases', dbLabels),
      field(lang === 'zh' ? '检索日期范围' : 'Search Date Range', dateRange),
      field(lang === 'zh' ? '其他信息来源' : 'Other Sources', protocol.otherSources),
      `## 4. ${lang === 'zh' ? '检索策略' : 'Search Strategy'}`,
      '',
      field(lang === 'zh' ? '检索策略' : 'Search Strategy', protocol.searchStrategy),
      `## 5. ${lang === 'zh' ? '研究筛选' : 'Study Selection'}`,
      '',
      field(lang === 'zh' ? '筛选流程' : 'Screening Process', protocol.screeningProcess),
      `## 6. ${lang === 'zh' ? '数据提取' : 'Data Collection'}`,
      '',
      field(lang === 'zh' ? '数据提取流程' : 'Extraction Process', protocol.dataExtractionProcess),
      field(lang === 'zh' ? '提取数据项' : 'Data Items', protocol.dataItems),
      `## 7. ${lang === 'zh' ? '偏倚风险评估' : 'Risk of Bias Assessment'}`,
      '',
      field(lang === 'zh' ? '评估工具' : 'Assessment Tool', robLabel),
      field(lang === 'zh' ? '评估细节' : 'Assessment Details', protocol.robDetails),
      `## 8. ${lang === 'zh' ? '数据合成' : 'Data Synthesis'}`,
      '',
      field(lang === 'zh' ? '效应量指标' : 'Effect Measure', protocol.effectMeasure),
      field(lang === 'zh' ? '合成方法' : 'Synthesis Method', protocol.synthesisMethod),
      field(lang === 'zh' ? '异质性评估' : 'Heterogeneity Assessment', protocol.heterogeneityAssessment),
      field(lang === 'zh' ? '亚组分析计划' : 'Planned Subgroup Analyses', protocol.subgroupAnalyses),
      field(lang === 'zh' ? '敏感性分析计划' : 'Planned Sensitivity Analyses', protocol.sensitivityAnalyses),
      `## 9. ${lang === 'zh' ? '发表偏倚与证据质量' : 'Meta-bias & Evidence Quality'}`,
      '',
      field(lang === 'zh' ? '发表偏倚评估' : 'Publication Bias Assessment', protocol.publicationBiasAssessment),
      field(lang === 'zh' ? '证据质量评估' : 'Confidence Assessment', protocol.confidenceAssessment),
      `## 10. ${lang === 'zh' ? '时间表与资助' : 'Timeline & Funding'}`,
      '',
      field(lang === 'zh' ? '预计开始日期' : 'Anticipated Start Date', protocol.anticipatedStartDate),
      field(lang === 'zh' ? '预计完成日期' : 'Anticipated End Date', protocol.anticipatedEndDate),
      field(lang === 'zh' ? '资助来源' : 'Funding', protocol.funding),
      field(lang === 'zh' ? '利益冲突' : 'Conflicts of Interest', protocol.conflictsOfInterest),
      '---',
      '',
      `*${lang === 'zh' ? '本方案遵循 PRISMA-P 2015 指南编写。' : 'This protocol was prepared following PRISMA-P 2015 guidelines.'}*`,
      `*Generated by MetaReview (https://metareview.cc) — ${new Date().toISOString().split('T')[0]}*`,
    ].filter(line => line !== null).join('\n');

    const blob = new Blob([lines], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protocol-${protocol.prosperoId || 'draft'}-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [protocol, lang]);

  return (
    <div style={{ padding: '20px 0', maxWidth: 820 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
            {t('protocol.desc', lang)}
          </p>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>
            {t('protocol.templateNote', lang)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hasPICO && (
            <button style={btnSecondary} onClick={autoFillFromPICO}>
              {t('protocol.autoFill', lang)}
            </button>
          )}
          <button style={btnPrimary} onClick={exportMarkdown}>
            {t('protocol.exportMd', lang)}
          </button>
          <button style={btnSecondary} onClick={exportDOCX}>
            {t('protocol.exportDocx', lang)}
          </button>
        </div>
      </div>

      {/* Completion progress */}
      <div style={{ marginBottom: 20, padding: '10px 14px', background: '#f0f9ff', borderRadius: 6, border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ height: 6, background: '#e0e7ff', borderRadius: 3 }}>
            <div style={{ height: 6, background: '#2563eb', borderRadius: 3, width: `${(completionCount.filled / completionCount.total) * 100}%`, transition: 'width 0.3s' }} />
          </div>
        </div>
        <span style={{ fontSize: 12, color: '#3b82f6', fontWeight: 500, whiteSpace: 'nowrap' }}>
          {completionCount.filled}/{completionCount.total}
        </span>
      </div>

      {/* Section 1: Administrative */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>{t('protocol.section.admin', lang)}</div>
        <label style={labelStyle}>{t('protocol.title', lang)} *</label>
        <input style={inputStyle} value={protocol.title} onChange={(e) => update('title', e.target.value)} placeholder={t('protocol.titlePlaceholder', lang)} />
        <label style={labelStyle}>{t('protocol.prosperoId', lang)}</label>
        <input style={inputStyle} value={protocol.prosperoId} onChange={(e) => update('prosperoId', e.target.value)} placeholder={t('protocol.prosperoIdPlaceholder', lang)} />
        <label style={labelStyle}>{t('protocol.authors', lang)} *</label>
        <input style={inputStyle} value={protocol.authors} onChange={(e) => update('authors', e.target.value)} placeholder={t('protocol.authorsPlaceholder', lang)} />
        <label style={labelStyle}>{t('protocol.contactEmail', lang)}</label>
        <input style={inputStyle} type="email" value={protocol.contactEmail} onChange={(e) => update('contactEmail', e.target.value)} placeholder="email@example.com" />
      </div>

      {/* Section 2: Background */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>{t('protocol.section.background', lang)}</div>
        <label style={labelStyle}>{t('protocol.rationale', lang)} *</label>
        <textarea style={{ ...textareaStyle, minHeight: 120 }} value={protocol.rationale} onChange={(e) => update('rationale', e.target.value)} placeholder={t('protocol.rationalePlaceholder', lang)} />
      </div>

      {/* Section 3: Eligibility */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>{t('protocol.section.eligibility', lang)}</div>
        <label style={labelStyle}>{t('protocol.studyTypes', lang)} *</label>
        <div style={checkboxGroupStyle}>
          {STUDY_TYPES.map((st) => (
            <label key={st} style={checkboxLabelStyle}>
              <input type="checkbox" checked={protocol.studyTypes.includes(st)} onChange={() => toggleStudyType(st)} />
              {t(`protocol.studyType.${st}`, lang)}
            </label>
          ))}
        </div>
        <label style={labelStyle}>{t('protocol.participants', lang)} *</label>
        <textarea style={textareaStyle} value={protocol.participants} onChange={(e) => update('participants', e.target.value)} placeholder={t('protocol.participantsPlaceholder', lang)} />
        <label style={labelStyle}>{t('protocol.interventions', lang)} *</label>
        <textarea style={textareaStyle} value={protocol.interventions} onChange={(e) => update('interventions', e.target.value)} placeholder={t('protocol.interventionsPlaceholder', lang)} />
        <label style={labelStyle}>{t('protocol.comparators', lang)} *</label>
        <textarea style={textareaStyle} value={protocol.comparators} onChange={(e) => update('comparators', e.target.value)} placeholder={t('protocol.comparatorsPlaceholder', lang)} />
        <label style={labelStyle}>{t('protocol.primaryOutcomes', lang)} *</label>
        <textarea style={textareaStyle} value={protocol.primaryOutcomes} onChange={(e) => update('primaryOutcomes', e.target.value)} placeholder={t('protocol.primaryOutcomesPlaceholder', lang)} />
        <label style={labelStyle}>{t('protocol.secondaryOutcomes', lang)}</label>
        <textarea style={textareaStyle} value={protocol.secondaryOutcomes} onChange={(e) => update('secondaryOutcomes', e.target.value)} placeholder={t('protocol.secondaryOutcomesPlaceholder', lang)} />
        <label style={labelStyle}>{t('protocol.timing', lang)}</label>
        <input style={inputStyle} value={protocol.timingOfOutcomes} onChange={(e) => update('timingOfOutcomes', e.target.value)} placeholder={t('protocol.timingPlaceholder', lang)} />
        <label style={labelStyle}>{t('protocol.setting', lang)}</label>
        <input style={inputStyle} value={protocol.setting} onChange={(e) => update('setting', e.target.value)} placeholder={t('protocol.settingPlaceholder', lang)} />
      </div>

      {/* Section 4: Information Sources */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>{t('protocol.section.sources', lang)}</div>
        <label style={labelStyle}>{t('protocol.databases', lang)} *</label>
        <div style={checkboxGroupStyle}>
          {DATABASES.map((db) => (
            <label key={db} style={checkboxLabelStyle}>
              <input type="checkbox" checked={protocol.databases.includes(db)} onChange={() => toggleDatabase(db)} />
              {t(`protocol.db.${db}`, lang)}
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('protocol.searchDateFrom', lang)}</label>
            <input style={inputStyle} type="date" value={protocol.searchDateFrom} onChange={(e) => update('searchDateFrom', e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('protocol.searchDateTo', lang)}</label>
            <input style={inputStyle} type="date" value={protocol.searchDateTo} onChange={(e) => update('searchDateTo', e.target.value)} />
          </div>
        </div>
        <label style={labelStyle}>{t('protocol.otherSources', lang)}</label>
        <textarea style={textareaStyle} value={protocol.otherSources} onChange={(e) => update('otherSources', e.target.value)} placeholder={t('protocol.otherSourcesPlaceholder', lang)} />
      </div>

      {/* Section 5: Search Strategy */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>{t('protocol.section.search', lang)}</div>
        <label style={labelStyle}>{t('protocol.searchStrategy', lang)} *</label>
        <textarea style={{ ...textareaStyle, minHeight: 120, fontFamily: 'monospace', fontSize: 12 }} value={protocol.searchStrategy} onChange={(e) => update('searchStrategy', e.target.value)} placeholder={t('protocol.searchStrategyPlaceholder', lang)} />
      </div>

      {/* Section 6: Study Selection */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>{t('protocol.section.selection', lang)}</div>
        <label style={labelStyle}>{t('protocol.screeningProcess', lang)} *</label>
        <textarea style={{ ...textareaStyle, minHeight: 100 }} value={protocol.screeningProcess} onChange={(e) => update('screeningProcess', e.target.value)} />
      </div>

      {/* Section 7: Data Collection */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>{t('protocol.section.extraction', lang)}</div>
        <label style={labelStyle}>{t('protocol.dataExtractionProcess', lang)} *</label>
        <textarea style={{ ...textareaStyle, minHeight: 100 }} value={protocol.dataExtractionProcess} onChange={(e) => update('dataExtractionProcess', e.target.value)} />
        <label style={labelStyle}>{t('protocol.dataItems', lang)}</label>
        <textarea style={textareaStyle} value={protocol.dataItems} onChange={(e) => update('dataItems', e.target.value)} placeholder={t('protocol.dataItemsPlaceholder', lang)} />
      </div>

      {/* Section 8: Risk of Bias */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>{t('protocol.section.rob', lang)}</div>
        <label style={labelStyle}>{t('protocol.robTool', lang)}</label>
        <select style={{ ...inputStyle, cursor: 'pointer' }} value={protocol.robTool} onChange={(e) => update('robTool', e.target.value as RobToolType)}>
          {ROB_TOOLS.map((tool) => (
            <option key={tool} value={tool}>{t(`protocol.robTool.${tool}`, lang)}</option>
          ))}
        </select>
        <label style={labelStyle}>{t('protocol.robDetails', lang)}</label>
        <textarea style={textareaStyle} value={protocol.robDetails} onChange={(e) => update('robDetails', e.target.value)} placeholder={t('protocol.robDetailsPlaceholder', lang)} />
      </div>

      {/* Section 9: Data Synthesis */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>{t('protocol.section.synthesis', lang)}</div>
        <label style={labelStyle}>{t('protocol.effectMeasure', lang)} *</label>
        <input style={inputStyle} value={protocol.effectMeasure} onChange={(e) => update('effectMeasure', e.target.value)} />
        <label style={labelStyle}>{t('protocol.synthesisMethod', lang)} *</label>
        <input style={inputStyle} value={protocol.synthesisMethod} onChange={(e) => update('synthesisMethod', e.target.value)} />
        <label style={labelStyle}>{t('protocol.heterogeneityAssessment', lang)} *</label>
        <textarea style={{ ...textareaStyle, minHeight: 100 }} value={protocol.heterogeneityAssessment} onChange={(e) => update('heterogeneityAssessment', e.target.value)} />
        <label style={labelStyle}>{t('protocol.subgroupAnalyses', lang)}</label>
        <textarea style={textareaStyle} value={protocol.subgroupAnalyses} onChange={(e) => update('subgroupAnalyses', e.target.value)} placeholder={t('protocol.subgroupAnalysesPlaceholder', lang)} />
        <label style={labelStyle}>{t('protocol.sensitivityAnalyses', lang)}</label>
        <textarea style={textareaStyle} value={protocol.sensitivityAnalyses} onChange={(e) => update('sensitivityAnalyses', e.target.value)} placeholder={t('protocol.sensitivityAnalysesPlaceholder', lang)} />
      </div>

      {/* Section 10: Meta-bias & Evidence Quality */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>{t('protocol.section.metabias', lang)}</div>
        <label style={labelStyle}>{t('protocol.publicationBias', lang)} *</label>
        <textarea style={{ ...textareaStyle, minHeight: 80 }} value={protocol.publicationBiasAssessment} onChange={(e) => update('publicationBiasAssessment', e.target.value)} />
        <label style={labelStyle}>{t('protocol.confidence', lang)} *</label>
        <textarea style={{ ...textareaStyle, minHeight: 80 }} value={protocol.confidenceAssessment} onChange={(e) => update('confidenceAssessment', e.target.value)} />
      </div>

      {/* Section 11: Timeline & Funding */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>{t('protocol.section.timeline', lang)}</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('protocol.startDate', lang)}</label>
            <input style={inputStyle} type="date" value={protocol.anticipatedStartDate} onChange={(e) => update('anticipatedStartDate', e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('protocol.endDate', lang)}</label>
            <input style={inputStyle} type="date" value={protocol.anticipatedEndDate} onChange={(e) => update('anticipatedEndDate', e.target.value)} />
          </div>
        </div>
        <label style={labelStyle}>{t('protocol.funding', lang)}</label>
        <input style={inputStyle} value={protocol.funding} onChange={(e) => update('funding', e.target.value)} placeholder={t('protocol.fundingPlaceholder', lang)} />
        <label style={labelStyle}>{t('protocol.coi', lang)}</label>
        <textarea style={textareaStyle} value={protocol.conflictsOfInterest} onChange={(e) => update('conflictsOfInterest', e.target.value)} placeholder={t('protocol.coiPlaceholder', lang)} />
      </div>

      {/* Bottom export button */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '20px 0' }}>
        {hasPICO && (
          <button style={btnSecondary} onClick={autoFillFromPICO}>
            {t('protocol.autoFill', lang)}
          </button>
        )}
        <button style={btnPrimary} onClick={exportMarkdown}>
          {t('protocol.exportMd', lang)}
        </button>
        <button style={btnSecondary} onClick={exportDOCX}>
          {t('protocol.exportDocx', lang)}
        </button>
      </div>
    </div>
  );
}
