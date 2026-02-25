import { useCallback, useMemo, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { Study, RobJudgment, RobDomain, RobAssessments, StudyRobAssessment } from '../lib/types';
import { t, type Lang } from '../lib/i18n';
import { useUIStore, type ColorScheme } from '../store';

interface RobAssessmentProps {
  studies: Study[];
  robAssessments: RobAssessments;
  onUpdate: (assessments: RobAssessments) => void;
  lang: Lang;
}

const ROB_DOMAINS: { key: RobDomain; labelKey: string; fullKey: string }[] = [
  { key: 'd1_randomization', labelKey: 'rob.d1', fullKey: 'rob.d1Full' },
  { key: 'd2_deviations', labelKey: 'rob.d2', fullKey: 'rob.d2Full' },
  { key: 'd3_missing', labelKey: 'rob.d3', fullKey: 'rob.d3Full' },
  { key: 'd4_measurement', labelKey: 'rob.d4', fullKey: 'rob.d4Full' },
  { key: 'd5_selection', labelKey: 'rob.d5', fullKey: 'rob.d5Full' },
];

const JUDGMENT_OPTIONS: { value: RobJudgment; labelKey: string }[] = [
  { value: 'low', labelKey: 'rob.low' },
  { value: 'some_concerns', labelKey: 'rob.some_concerns' },
  { value: 'high', labelKey: 'rob.high' },
];

const ROB_COLORS: Record<ColorScheme, Record<RobJudgment, { bg: string; text: string; fill: string }>> = {
  default: {
    low: { bg: '#dcfce7', text: '#166534', fill: '#22c55e' },
    some_concerns: { bg: '#fef9c3', text: '#854d0e', fill: '#eab308' },
    high: { bg: '#fee2e2', text: '#991b1b', fill: '#ef4444' },
  },
  bw: {
    low: { bg: '#f5f5f5', text: '#333', fill: '#999' },
    some_concerns: { bg: '#e5e5e5', text: '#333', fill: '#666' },
    high: { bg: '#d4d4d4', text: '#000', fill: '#333' },
  },
  colorblind: {
    low: { bg: '#d1e8ff', text: '#004080', fill: '#0072B2' },
    some_concerns: { bg: '#fff2cc', text: '#7a5c00', fill: '#E69F00' },
    high: { bg: '#ffd6cc', text: '#8b1a00', fill: '#D55E00' },
  },
};

const SYMBOLS: Record<RobJudgment, string> = {
  low: '+',
  some_concerns: '?',
  high: '\u2212', // minus sign
};

function emptyAssessment(): StudyRobAssessment {
  return {
    domains: {
      d1_randomization: 'some_concerns',
      d2_deviations: 'some_concerns',
      d3_missing: 'some_concerns',
      d4_measurement: 'some_concerns',
      d5_selection: 'some_concerns',
    },
    overall: 'some_concerns',
    notes: '',
  };
}

function deriveOverall(domains: Record<RobDomain, RobJudgment>): RobJudgment {
  const values = Object.values(domains);
  if (values.some(v => v === 'high')) return 'high';
  if (values.some(v => v === 'some_concerns')) return 'some_concerns';
  return 'low';
}

export default function RobAssessment({ studies, robAssessments, onUpdate, lang }: RobAssessmentProps) {
  const plotSettings = useUIStore((s) => s.plotSettings);
  const colors = ROB_COLORS[plotSettings.colorScheme];
  const chartRef = useRef<SVGSVGElement>(null);

  // Ensure all studies have assessments
  const assessments = useMemo(() => {
    const result: RobAssessments = {};
    for (const study of studies) {
      result[study.id] = robAssessments[study.id] || emptyAssessment();
    }
    return result;
  }, [studies, robAssessments]);

  const updateDomain = useCallback((studyId: string, domain: RobDomain, value: RobJudgment) => {
    const current = assessments[studyId] || emptyAssessment();
    const newDomains = { ...current.domains, [domain]: value };
    const newOverall = deriveOverall(newDomains);
    onUpdate({
      ...assessments,
      [studyId]: { ...current, domains: newDomains, overall: newOverall },
    });
  }, [assessments, onUpdate]);

  const updateNotes = useCallback((studyId: string, notes: string) => {
    const current = assessments[studyId] || emptyAssessment();
    onUpdate({
      ...assessments,
      [studyId]: { ...current, notes },
    });
  }, [assessments, onUpdate]);

  // Bar chart data: proportion of judgments per domain
  const chartData = useMemo(() => {
    const k = studies.length;
    if (k === 0) return [];
    return [...ROB_DOMAINS.map(d => ({
      domain: t(d.labelKey, lang),
      low: studies.filter(s => (assessments[s.id]?.domains[d.key] || 'some_concerns') === 'low').length / k * 100,
      some_concerns: studies.filter(s => (assessments[s.id]?.domains[d.key] || 'some_concerns') === 'some_concerns').length / k * 100,
      high: studies.filter(s => (assessments[s.id]?.domains[d.key] || 'some_concerns') === 'high').length / k * 100,
    })), {
      domain: t('rob.overall', lang),
      low: studies.filter(s => (assessments[s.id]?.overall || 'some_concerns') === 'low').length / k * 100,
      some_concerns: studies.filter(s => (assessments[s.id]?.overall || 'some_concerns') === 'some_concerns').length / k * 100,
      high: studies.filter(s => (assessments[s.id]?.overall || 'some_concerns') === 'high').length / k * 100,
    }];
  }, [studies, assessments, lang]);

  // D3 bar chart
  useEffect(() => {
    if (!chartRef.current || chartData.length === 0) return;
    const svg = d3.select(chartRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 10, right: 20, bottom: 30, left: 120 };
    const width = 500 - margin.left - margin.right;
    const height = chartData.length * 36;

    svg.attr('width', width + margin.left + margin.right)
       .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const y = d3.scaleBand().domain(chartData.map(d => d.domain)).range([0, height]).padding(0.25);
    const x = d3.scaleLinear().domain([0, 100]).range([0, width]);

    // Stacked bars: low → some_concerns → high
    const judgments: RobJudgment[] = ['low', 'some_concerns', 'high'];
    const stack = judgments.map(j => ({
      key: j,
      data: chartData.map(d => {
        let x0 = 0;
        for (const k of judgments) {
          if (k === j) return { x0, x1: x0 + d[k], domain: d.domain };
          x0 += d[k];
        }
        return { x0: 0, x1: 0, domain: d.domain };
      }),
    }));

    for (const layer of stack) {
      g.selectAll(`.bar-${layer.key}`)
        .data(layer.data)
        .enter()
        .append('rect')
        .attr('x', d => x(d.x0))
        .attr('y', d => y(d.domain)!)
        .attr('width', d => x(d.x1) - x(d.x0))
        .attr('height', y.bandwidth())
        .attr('fill', colors[layer.key as RobJudgment].fill)
        .attr('rx', 2);
    }

    // Y axis labels
    g.append('g')
      .call(d3.axisLeft(y).tickSize(0))
      .select('.domain').remove();
    g.selectAll('.tick text').attr('font-size', 11).attr('fill', '#374151');

    // X axis (percentage)
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d => `${d}%`))
      .select('.domain').remove();
    g.selectAll('.tick text').attr('font-size', 10).attr('fill', '#6b7280');
    g.selectAll('.tick line').attr('stroke', '#e5e7eb');

    // Legend
    const legend = svg.append('g')
      .attr('transform', `translate(${margin.left + width / 2 - 120},${height + margin.top + 20})`);

    judgments.forEach((j, i) => {
      const lg = legend.append('g').attr('transform', `translate(${i * 90}, 0)`);
      lg.append('rect').attr('width', 12).attr('height', 12).attr('rx', 2).attr('fill', colors[j].fill);
      lg.append('text').attr('x', 16).attr('y', 10).attr('font-size', 10).attr('fill', '#374151')
        .text(t(`rob.${j}`, lang));
    });
  }, [chartData, colors, lang]);

  if (studies.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
        {t('rob.noStudies', lang)}
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
        {t('rob.desc', lang)}
      </p>

      {/* Traffic Light Summary Table */}
      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 8 }}>
        {t('rob.summaryTitle', lang)}
      </h3>
      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>{t('rob.study', lang)}</th>
              {ROB_DOMAINS.map(d => (
                <th key={d.key} style={{ ...thStyle, textAlign: 'center', minWidth: 80 }} title={t(d.fullKey, lang)}>
                  {t(d.labelKey, lang)}
                </th>
              ))}
              <th style={{ ...thStyle, textAlign: 'center', minWidth: 80 }}>{t('rob.overall', lang)}</th>
              <th style={{ ...thStyle, minWidth: 120 }}>{t('rob.notes', lang)}</th>
            </tr>
          </thead>
          <tbody>
            {studies.map((study, i) => {
              const assess = assessments[study.id] || emptyAssessment();
              return (
                <tr key={study.id} style={{ background: i % 2 ? '#f9fafb' : '#fff' }}>
                  <td style={{ ...tdStyle, fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {study.name}{study.year ? ` (${study.year})` : ''}
                  </td>
                  {ROB_DOMAINS.map(d => {
                    const val = assess.domains[d.key];
                    const c = colors[val];
                    return (
                      <td key={d.key} style={{ ...tdStyle, textAlign: 'center', padding: '4px 6px' }}>
                        <select
                          value={val}
                          onChange={e => updateDomain(study.id, d.key, e.target.value as RobJudgment)}
                          style={{
                            width: '100%',
                            padding: '4px 2px',
                            border: 'none',
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                            color: c.text,
                            background: c.bg,
                            cursor: 'pointer',
                            textAlign: 'center',
                          }}
                        >
                          {JUDGMENT_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{SYMBOLS[opt.value]} {t(opt.labelKey, lang)}</option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                  <td style={{ ...tdStyle, textAlign: 'center', padding: '4px 6px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 700,
                      color: colors[assess.overall].text,
                      background: colors[assess.overall].bg,
                    }}>
                      {SYMBOLS[assess.overall]} {t(`rob.${assess.overall}`, lang)}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, padding: '4px 6px' }}>
                    <input
                      type="text"
                      value={assess.notes}
                      onChange={e => updateNotes(study.id, e.target.value)}
                      placeholder="..."
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        border: '1px solid #e5e7eb',
                        borderRadius: 4,
                        fontSize: 11,
                        color: '#374151',
                        background: '#fff',
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Distribution Bar Chart */}
      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 8 }}>
        {t('rob.chartTitle', lang)}
      </h3>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <svg ref={chartRef} role="img" aria-label={t('rob.chartTitle', lang)} />
      </div>

      {/* Note */}
      <p style={{ marginTop: 16, fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>
        {t('rob.note', lang)}
      </p>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '2px solid #e5e7eb',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: '7px 10px',
  borderBottom: '1px solid #f3f4f6',
};
