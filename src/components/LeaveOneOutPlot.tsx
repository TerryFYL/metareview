import { useEffect, useRef, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import type { MetaAnalysisResult, SensitivityResult } from '../lib/types';
import { isLogScale } from '../lib/statistics';
import { t, type Lang } from '../lib/i18n';
import { useUIStore, type ColorScheme } from '../store';

interface LeaveOneOutPlotProps {
  result: MetaAnalysisResult;
  sensitivityResults: SensitivityResult[];
  lang: Lang;
  width?: number;
}

const MARGIN = { top: 40, right: 180, bottom: 40, left: 200 };
const ROW_HEIGHT = 26;

const COLORS: Record<ColorScheme, { study: string; overall: string; highlight: string; bg: string; text: string; ref: string }> = {
  default: { study: '#3b82f6', overall: '#dc2626', highlight: '#fef3c7', bg: '#f8fafc', text: '#1e293b', ref: '#dc2626' },
  bw: { study: '#333333', overall: '#000000', highlight: '#eeeeee', bg: '#ffffff', text: '#000000', ref: '#000000' },
  colorblind: { study: '#0072B2', overall: '#D55E00', highlight: '#FFF2CC', bg: '#f8fafc', text: '#1e293b', ref: '#D55E00' },
};

export default function LeaveOneOutPlot({ result, sensitivityResults, lang, width: propWidth }: LeaveOneOutPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const plotSettings = useUIStore((s) => s.plotSettings);

  const width = propWidth || 800;

  // Detect influential studies (direction or significance change)
  const influentialSet = useMemo(() => {
    const isRatio = result.measure === 'OR' || result.measure === 'RR' || result.measure === 'HR';
    const set = new Set<string>();
    for (const s of sensitivityResults) {
      const dirChanged = isRatio
        ? (s.effect > 1) !== (result.effect > 1)
        : (s.effect > 0) !== (result.effect > 0);
      const origSig = isRatio
        ? (result.ciLower > 1 || result.ciUpper < 1)
        : (result.ciLower > 0 || result.ciUpper < 0);
      const newSig = isRatio
        ? (s.ciLower > 1 || s.ciUpper < 1)
        : (s.ciLower > 0 || s.ciUpper < 0);
      if (dirChanged || origSig !== newSig) set.add(s.omittedStudy);
    }
    return set;
  }, [result, sensitivityResults]);

  const totalRows = sensitivityResults.length + 2; // +1 separator +1 overall
  const height = MARGIN.top + totalRows * ROW_HEIGHT + MARGIN.bottom;
  const plotWidth = width - MARGIN.left - MARGIN.right;

  useEffect(() => {
    if (!svgRef.current || sensitivityResults.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const colors = COLORS[plotSettings.colorScheme];
    const fs = plotSettings.fontSize;
    const useLog = isLogScale(result.measure);
    const nullValue = useLog ? 1 : 0;

    // Background
    svg.append('rect').attr('width', width).attr('height', height).attr('fill', colors.bg);
    svg.append('desc').text(t('a11y.looPlot', lang));

    // Collect all values for x-scale
    const allValues = sensitivityResults.flatMap((s) => [s.ciLower, s.ciUpper]);
    allValues.push(result.ciLower, result.ciUpper, nullValue);

    const xMin = d3.min(allValues)!;
    const xMax = d3.max(allValues)!;
    const padding = (xMax - xMin) * 0.12;
    const xScale = d3.scaleLinear().domain([xMin - padding, xMax + padding]).range([0, plotWidth]);

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Title
    svg.append('text')
      .attr('x', width / 2).attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', fs + 2).attr('font-weight', '600').attr('fill', colors.text)
      .text(t('loo.title', lang));

    // Column headers
    g.append('text').attr('x', -MARGIN.left + 10).attr('y', -8)
      .attr('font-size', fs).attr('font-weight', 'bold').attr('fill', '#666')
      .text(t('loo.omittedStudy', lang));

    g.append('text').attr('x', plotWidth + 10).attr('y', -8)
      .attr('font-size', fs).attr('font-weight', 'bold').attr('fill', '#666')
      .text(`${result.measure} [95% CI]`);

    // Vertical reference line = full model pooled effect
    g.append('line')
      .attr('x1', xScale(result.effect)).attr('x2', xScale(result.effect))
      .attr('y1', -2).attr('y2', (sensitivityResults.length + 1) * ROW_HEIGHT)
      .attr('stroke', colors.ref).attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,3').attr('opacity', 0.6);

    // Null effect line
    g.append('line')
      .attr('x1', xScale(nullValue)).attr('x2', xScale(nullValue))
      .attr('y1', -2).attr('y2', (sensitivityResults.length + 1) * ROW_HEIGHT)
      .attr('stroke', '#999').attr('stroke-width', 1).attr('stroke-dasharray', '2,2');

    // Study rows
    sensitivityResults.forEach((s, i) => {
      const y = i * ROW_HEIGHT + ROW_HEIGHT / 2;
      const isHighlight = influentialSet.has(s.omittedStudy);

      // Highlight background
      if (isHighlight) {
        g.append('rect')
          .attr('x', -MARGIN.left).attr('y', y - ROW_HEIGHT / 2)
          .attr('width', plotWidth + MARGIN.left + MARGIN.right)
          .attr('height', ROW_HEIGHT)
          .attr('fill', colors.highlight);
      }

      // Study name
      g.append('text')
        .attr('x', -MARGIN.left + 10).attr('y', y + 4)
        .attr('font-size', fs)
        .attr('fill', isHighlight ? colors.overall : '#333')
        .attr('font-weight', isHighlight ? '600' : '400')
        .text(`${s.omittedStudy}${isHighlight ? ' *' : ''}`);

      // CI line
      const ciLeft = Math.max(xScale(s.ciLower), 0);
      const ciRight = Math.min(xScale(s.ciUpper), plotWidth);
      g.append('line')
        .attr('x1', ciLeft).attr('x2', ciRight)
        .attr('y1', y).attr('y2', y)
        .attr('stroke', colors.study).attr('stroke-width', 1.5);

      // CI caps
      if (xScale(s.ciLower) >= 0) {
        g.append('line')
          .attr('x1', ciLeft).attr('x2', ciLeft)
          .attr('y1', y - 3).attr('y2', y + 3)
          .attr('stroke', colors.study).attr('stroke-width', 1.5);
      }
      if (xScale(s.ciUpper) <= plotWidth) {
        g.append('line')
          .attr('x1', ciRight).attr('x2', ciRight)
          .attr('y1', y - 3).attr('y2', y + 3)
          .attr('stroke', colors.study).attr('stroke-width', 1.5);
      }

      // Point estimate
      g.append('circle')
        .attr('cx', xScale(s.effect)).attr('cy', y)
        .attr('r', 4)
        .attr('fill', colors.study);

      // Effect text
      g.append('text')
        .attr('x', plotWidth + 10).attr('y', y + 4)
        .attr('font-size', fs - 1).attr('fill', '#333')
        .attr('font-family', 'monospace')
        .text(`${s.effect.toFixed(2)} [${s.ciLower.toFixed(2)}, ${s.ciUpper.toFixed(2)}]`);
    });

    // Separator line
    const sepY = sensitivityResults.length * ROW_HEIGHT;
    g.append('line')
      .attr('x1', -MARGIN.left + 10).attr('x2', plotWidth + 170)
      .attr('y1', sepY + 4).attr('y2', sepY + 4)
      .attr('stroke', '#e5e7eb').attr('stroke-width', 1);

    // Overall diamond
    const overallY = (sensitivityResults.length + 1) * ROW_HEIGHT - ROW_HEIGHT / 2 + 4;
    const dx = xScale(result.effect);
    const dl = xScale(result.ciLower);
    const dr = xScale(result.ciUpper);
    const dh = 10;

    g.append('polygon')
      .attr('points', [
        `${dl},${overallY}`, `${dx},${overallY - dh / 2}`,
        `${dr},${overallY}`, `${dx},${overallY + dh / 2}`,
      ].join(' '))
      .attr('fill', colors.overall).attr('opacity', 0.85);

    g.append('text')
      .attr('x', -MARGIN.left + 10).attr('y', overallY + 4)
      .attr('font-size', fs).attr('font-weight', 'bold').attr('fill', '#333')
      .text(t('loo.fullModel', lang));

    g.append('text')
      .attr('x', plotWidth + 10).attr('y', overallY + 4)
      .attr('font-size', fs - 1).attr('font-weight', 'bold').attr('fill', '#333')
      .attr('font-family', 'monospace')
      .text(`${result.effect.toFixed(2)} [${result.ciLower.toFixed(2)}, ${result.ciUpper.toFixed(2)}]`);

    // X axis
    const axisY = (sensitivityResults.length + 1) * ROW_HEIGHT + 10;
    g.append('g')
      .attr('transform', `translate(0,${axisY})`)
      .call(d3.axisBottom(xScale).ticks(7))
      .selectAll('text').attr('font-size', 10);

    // X axis label
    g.append('text')
      .attr('x', plotWidth / 2).attr('y', axisY + 28)
      .attr('text-anchor', 'middle').attr('font-size', fs).attr('fill', '#666')
      .text(result.measure);

  }, [result, sensitivityResults, width, height, plotWidth, plotSettings, lang, influentialSet]);

  const downloadSVG = useCallback(() => {
    if (!svgRef.current) return;
    const source = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leave-one-out-plot.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (sensitivityResults.length === 0) {
    return <p style={{ color: '#6b7280', fontSize: 13 }}>{t('loo.noData', lang)}</p>;
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
        {t('loo.desc', lang)}
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          onClick={downloadSVG}
          style={{ padding: '7px 14px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
        >
          {t('loo.downloadSVG', lang)}
        </button>
      </div>
      <div ref={containerRef} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <svg ref={svgRef} width={width} height={height} role="img" aria-label={t('a11y.looPlot', lang)}
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', minWidth: 600 }}
        />
      </div>
      {/* Summary */}
      <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>{t('loo.totalStudies', lang)}: {sensitivityResults.length}</span>
        <span>
          {t('loo.influential', lang)}: {influentialSet.size}
          {influentialSet.size > 0 && ` (${Array.from(influentialSet).join(', ')})`}
        </span>
      </div>
      {influentialSet.size > 0 && (
        <p style={{ fontSize: 12, color: '#ea580c', marginTop: 6 }}>
          * {t('loo.influentialNote', lang)}
        </p>
      )}
    </div>
  );
}
