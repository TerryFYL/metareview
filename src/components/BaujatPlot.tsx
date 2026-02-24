import { useEffect, useRef, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import type { MetaAnalysisResult } from '../lib/types';
import { baujatPlotData } from '../lib/statistics';
import { t, type Lang } from '../lib/i18n';
import { useUIStore, type ColorScheme } from '../store';

interface BaujatPlotProps {
  result: MetaAnalysisResult;
  lang: Lang;
  width?: number;
  height?: number;
}

const MARGIN = { top: 30, right: 30, bottom: 55, left: 65 };

const COLORS: Record<ColorScheme, { point: string; highlight: string; line: string; meanLine: string; bg: string; text: string; grid: string }> = {
  default: { point: '#3b82f6', highlight: '#f59e0b', line: '#94a3b8', meanLine: '#dc2626', bg: '#f8fafc', text: '#1e293b', grid: '#e2e8f0' },
  bw: { point: '#333333', highlight: '#666666', line: '#888888', meanLine: '#000000', bg: '#ffffff', text: '#000000', grid: '#dddddd' },
  colorblind: { point: '#0072B2', highlight: '#E69F00', line: '#999999', meanLine: '#D55E00', bg: '#f8fafc', text: '#1e293b', grid: '#e2e8f0' },
};

export default function BaujatPlot({ result, lang, width = 560, height = 420 }: BaujatPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const plotSettings = useUIStore((s) => s.plotSettings);

  const data = useMemo(() => {
    const tau2 = result.heterogeneity.tau2;
    return baujatPlotData(result.studies, result.summary, tau2);
  }, [result]);

  useEffect(() => {
    if (!svgRef.current || !data) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const colors = COLORS[plotSettings.colorScheme];
    const fs = plotSettings.fontSize;
    const iw = width - MARGIN.left - MARGIN.right;
    const ih = height - MARGIN.top - MARGIN.bottom;

    // Background
    svg.append('rect').attr('width', width).attr('height', height).attr('fill', colors.bg);

    // Accessible description
    svg.append('desc').text(t('a11y.baujatPlot', lang));

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Scales
    const xMax = d3.max(data.points, (d) => d.contribution)! * 1.15;
    const yMax = d3.max(data.points, (d) => d.influence)! * 1.15;

    const xScale = d3.scaleLinear().domain([0, xMax]).range([0, iw]).nice();
    const yScale = d3.scaleLinear().domain([0, yMax]).range([ih, 0]).nice();

    // Grid
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(yScale.ticks(5))
      .join('line')
      .attr('x1', 0).attr('x2', iw)
      .attr('y1', (d) => yScale(d)).attr('y2', (d) => yScale(d))
      .attr('stroke', colors.grid).attr('stroke-dasharray', '2,2');

    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(xScale.ticks(5))
      .join('line')
      .attr('x1', (d) => xScale(d)).attr('x2', (d) => xScale(d))
      .attr('y1', 0).attr('y2', ih)
      .attr('stroke', colors.grid).attr('stroke-dasharray', '2,2');

    // Mean threshold lines (dashed red)
    if (data.meanContribution > 0 && xScale(data.meanContribution) < iw) {
      g.append('line')
        .attr('x1', xScale(data.meanContribution)).attr('x2', xScale(data.meanContribution))
        .attr('y1', 0).attr('y2', ih)
        .attr('stroke', colors.meanLine).attr('stroke-dasharray', '4,4').attr('stroke-width', 1);
    }
    if (data.meanInfluence > 0 && yScale(data.meanInfluence) > 0) {
      g.append('line')
        .attr('x1', 0).attr('x2', iw)
        .attr('y1', yScale(data.meanInfluence)).attr('y2', yScale(data.meanInfluence))
        .attr('stroke', colors.meanLine).attr('stroke-dasharray', '4,4').attr('stroke-width', 1);
    }

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${ih})`)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.format('.2f')))
      .selectAll('text').attr('font-size', fs);

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(6).tickFormat(d3.format('.2f')))
      .selectAll('text').attr('font-size', fs);

    // Axis labels
    g.append('text')
      .attr('x', iw / 2).attr('y', ih + 42)
      .attr('text-anchor', 'middle')
      .attr('font-size', fs + 1).attr('fill', colors.text)
      .text(t('baujat.xAxis', lang));

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -ih / 2).attr('y', -50)
      .attr('text-anchor', 'middle')
      .attr('font-size', fs + 1).attr('fill', colors.text)
      .text(t('baujat.yAxis', lang));

    // Title
    svg.append('text')
      .attr('x', width / 2).attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('font-size', fs + 2).attr('font-weight', '600').attr('fill', colors.text)
      .text(t('baujat.title', lang));

    // Points
    const tooltip = tooltipRef.current;

    g.selectAll('circle')
      .data(data.points)
      .join('circle')
      .attr('cx', (d) => xScale(d.contribution))
      .attr('cy', (d) => yScale(d.influence))
      .attr('r', 5)
      .attr('fill', (d) =>
        d.contribution > data.meanContribution && d.influence > data.meanInfluence
          ? colors.highlight
          : colors.point
      )
      .attr('opacity', 0.8)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .attr('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this).attr('r', 7).attr('opacity', 1);
        if (tooltip) {
          tooltip.style.display = 'block';
          tooltip.innerHTML = `<strong>${d.name}</strong><br/>${t('baujat.contribLabel', lang)}: ${d.contribution.toFixed(3)}<br/>${t('baujat.influenceLabel', lang)}: ${d.influence.toFixed(3)}`;
          tooltip.style.left = `${event.offsetX + 12}px`;
          tooltip.style.top = `${event.offsetY - 10}px`;
        }
      })
      .on('mouseout', function () {
        d3.select(this).attr('r', 5).attr('opacity', 0.8);
        if (tooltip) tooltip.style.display = 'none';
      });

    // Study name labels for highlighted points (upper-right quadrant)
    data.points
      .filter((d) => d.contribution > data.meanContribution && d.influence > data.meanInfluence)
      .forEach((d) => {
        g.append('text')
          .attr('x', xScale(d.contribution) + 8)
          .attr('y', yScale(d.influence) - 6)
          .attr('font-size', fs - 1)
          .attr('fill', colors.highlight)
          .attr('font-weight', '500')
          .text(d.name);
      });

  }, [data, width, height, plotSettings, lang, result]);

  const downloadSVG = useCallback(() => {
    if (!svgRef.current) return;
    const source = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'baujat-plot.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (!data) {
    return <p style={{ color: '#6b7280', fontSize: 13 }}>{t('baujat.noData', lang)}</p>;
  }

  const highlightedStudies = data.points.filter(
    (d) => d.contribution > data.meanContribution && d.influence > data.meanInfluence
  );

  return (
    <div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
        {t('baujat.desc', lang)}
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          onClick={downloadSVG}
          style={{ padding: '7px 14px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
        >
          {t('baujat.downloadSVG', lang)}
        </button>
      </div>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <svg ref={svgRef} width={width} height={height} role="img" aria-label={t('a11y.baujatPlot', lang)} />
        <div
          ref={tooltipRef}
          style={{
            display: 'none',
            position: 'absolute',
            background: 'rgba(0,0,0,0.85)',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: 4,
            fontSize: 11,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}
        />
      </div>
      {/* Summary */}
      <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>{t('baujat.totalStudies', lang)}: {data.points.length}</span>
        <span>
          {t('baujat.highInfluence', lang)}: {highlightedStudies.length}
          {highlightedStudies.length > 0 && ` (${highlightedStudies.map((s) => s.name).join(', ')})`}
        </span>
      </div>
    </div>
  );
}
