import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { MetaAnalysisResult, EggersTest } from '../lib/types';
import { funnelPlotData } from '../lib/statistics';
import type { TrimAndFillResult } from '../lib/statistics';
import { t, type Lang } from '../lib/i18n';
import { useUIStore, type ColorScheme } from '../store';

interface FunnelPlotProps {
  result: MetaAnalysisResult;
  lang?: Lang;
  width?: number;
  height?: number;
  trimFillResult?: TrimAndFillResult | null;
  showContours?: boolean;
  eggers?: EggersTest | null;
  showEggersLine?: boolean;
}

const MARGIN = { top: 30, right: 30, bottom: 50, left: 60 };

const FUNNEL_COLORS: Record<ColorScheme, { point: string; summary: string; funnel: string; funnelStroke: string; imputed: string; contour01: string; contour05: string; contour10: string; eggersLine: string }> = {
  default: { point: '#2563eb', summary: '#dc2626', funnel: '#f3f4f6', funnelStroke: '#d1d5db', imputed: '#f97316', contour01: '#dbeafe', contour05: '#e0f2fe', contour10: '#f0f9ff', eggersLine: '#7c3aed' },
  bw: { point: '#333333', summary: '#000000', funnel: '#f5f5f5', funnelStroke: '#999999', imputed: '#888888', contour01: '#d4d4d4', contour05: '#e5e5e5', contour10: '#f0f0f0', eggersLine: '#555555' },
  colorblind: { point: '#0072B2', summary: '#D55E00', funnel: '#f0f4f8', funnelStroke: '#a0aec0', imputed: '#CC79A7', contour01: '#c7d2fe', contour05: '#ddd6fe', contour10: '#ede9fe', eggersLine: '#009E73' },
};

export default function FunnelPlot({
  result,
  lang = 'en',
  width = 500,
  height = 400,
  trimFillResult,
  showContours = false,
  eggers,
  showEggersLine = false,
}: FunnelPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const plotSettings = useUIStore((s) => s.plotSettings);
  const colors = FUNNEL_COLORS[plotSettings.colorScheme];
  const fontSize = plotSettings.fontSize;

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const plotW = width - MARGIN.left - MARGIN.right;
    const plotH = height - MARGIN.top - MARGIN.bottom;

    const points = funnelPlotData(result.studies);
    const summaryEffect = result.summary;

    // X scale: effect sizes
    const xExtent = d3.extent(points, (p) => p.x) as [number, number];
    const xPad = (xExtent[1] - xExtent[0]) * 0.3 || 0.5;
    const xScale = d3
      .scaleLinear()
      .domain([xExtent[0] - xPad, xExtent[1] + xPad])
      .range([0, plotW]);

    // Y scale: SE (inverted — 0 at top, max at bottom)
    const maxSE = d3.max(points, (p) => p.y) || 1;
    const yScale = d3
      .scaleLinear()
      .domain([0, maxSE * 1.1])
      .range([0, plotH]);

    const g = svg
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Significance contour regions (centered on null effect = 0)
    // Shows where individual study p-values fall: p<0.01, p<0.05, p<0.10
    if (showContours) {
      const contourLevels = [
        { z: 2.576, fill: colors.contour01, label: 'p < 0.01' },
        { z: 1.96, fill: colors.contour05, label: 'p < 0.05' },
        { z: 1.645, fill: colors.contour10, label: 'p < 0.10' },
      ];
      const seSteps = d3.range(0, maxSE * 1.1, maxSE / 80).concat([maxSE * 1.1]);

      // Draw from widest (least significant) to narrowest (most significant)
      // so narrower regions paint on top
      for (let i = contourLevels.length - 1; i >= 0; i--) {
        const { z: zCrit, fill } = contourLevels[i];
        const leftEdge = seSteps.map((se) => ({ x: -zCrit * se, y: se }));
        const rightEdge = seSteps.map((se) => ({ x: zCrit * se, y: se }));

        const contourArea = [
          ...leftEdge.map((p) => `${xScale(p.x)},${yScale(p.y)}`),
          ...rightEdge.reverse().map((p) => `${xScale(p.x)},${yScale(p.y)}`),
        ].join(' ');

        g.append('polygon')
          .attr('points', contourArea)
          .attr('fill', fill)
          .attr('opacity', 0.7);
      }

      // Contour boundary lines
      contourLevels.forEach(({ z: zCrit }) => {
        // Left boundary
        g.append('line')
          .attr('x1', xScale(0)).attr('y1', yScale(0))
          .attr('x2', xScale(-zCrit * maxSE * 1.1)).attr('y2', yScale(maxSE * 1.1))
          .attr('stroke', '#94a3b8').attr('stroke-width', 0.5).attr('stroke-dasharray', '2,2');
        // Right boundary
        g.append('line')
          .attr('x1', xScale(0)).attr('y1', yScale(0))
          .attr('x2', xScale(zCrit * maxSE * 1.1)).attr('y2', yScale(maxSE * 1.1))
          .attr('stroke', '#94a3b8').attr('stroke-width', 0.5).attr('stroke-dasharray', '2,2');
      });
    }

    // Pseudo 95% CI funnel
    const funnelSEValues = d3.range(0, maxSE * 1.1, maxSE / 50);
    const funnelLeft = funnelSEValues.map((se) => ({
      x: summaryEffect - 1.96 * se,
      y: se,
    }));
    const funnelRight = funnelSEValues.map((se) => ({
      x: summaryEffect + 1.96 * se,
      y: se,
    }));

    // Fill funnel area
    const areaPoints = [
      ...funnelLeft.map((p) => `${xScale(p.x)},${yScale(p.y)}`),
      ...funnelRight.reverse().map((p) => `${xScale(p.x)},${yScale(p.y)}`),
    ].join(' ');

    g.append('polygon')
      .attr('points', areaPoints)
      .attr('fill', colors.funnel)
      .attr('stroke', colors.funnelStroke)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3');

    // Summary effect line
    g.append('line')
      .attr('x1', xScale(summaryEffect))
      .attr('x2', xScale(summaryEffect))
      .attr('y1', 0)
      .attr('y2', plotH)
      .attr('stroke', colors.summary)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '6,3');

    // Data points
    g.selectAll('.point')
      .data(points)
      .enter()
      .append('circle')
      .attr('cx', (d) => xScale(d.x))
      .attr('cy', (d) => yScale(d.y))
      .attr('r', 4)
      .attr('fill', colors.point)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .append('title')
      .text((d) => `${d.name}: ${d.x.toFixed(3)}`);

    // Trim-and-Fill: imputed points (open circles with dashed stroke)
    if (trimFillResult && trimFillResult.imputedPoints.length > 0) {
      g.selectAll('.imputed-point')
        .data(trimFillResult.imputedPoints)
        .enter()
        .append('circle')
        .attr('class', 'imputed-point')
        .attr('cx', (d) => xScale(d.x))
        .attr('cy', (d) => yScale(d.y))
        .attr('r', 4)
        .attr('fill', 'none')
        .attr('stroke', colors.imputed)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '3,2')
        .append('title')
        .text((d) => `${d.name}: ${d.x.toFixed(3)}`);

      // Adjusted summary line
      g.append('line')
        .attr('x1', xScale(trimFillResult.adjustedSummary))
        .attr('x2', xScale(trimFillResult.adjustedSummary))
        .attr('y1', 0)
        .attr('y2', plotH)
        .attr('stroke', colors.imputed)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,4');

      // Adjusted symmetry funnel boundaries (corrected 95% CI funnel)
      const adjSummary = trimFillResult.adjustedSummary;
      const adjFunnelSE = d3.range(0, maxSE * 1.1, maxSE / 50);
      // Left boundary
      g.append('path')
        .datum(adjFunnelSE.map(se => [xScale(adjSummary - 1.96 * se), yScale(se)] as [number, number]))
        .attr('d', d3.line())
        .attr('fill', 'none')
        .attr('stroke', colors.imputed)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '6,4')
        .attr('opacity', 0.5);
      // Right boundary
      g.append('path')
        .datum(adjFunnelSE.map(se => [xScale(adjSummary + 1.96 * se), yScale(se)] as [number, number]))
        .attr('d', d3.line())
        .attr('fill', 'none')
        .attr('stroke', colors.imputed)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '6,4')
        .attr('opacity', 0.5);
    }

    // Egger's regression line overlay
    if (showEggersLine && eggers) {
      const seSteps = d3.range(0, maxSE * 1.1, maxSE / 50);
      // In funnel plot space: x = slope + intercept * SE
      g.append('path')
        .datum(seSteps.map(se => [xScale(eggers.slope + eggers.intercept * se), yScale(se)] as [number, number]))
        .attr('d', d3.line())
        .attr('fill', 'none')
        .attr('stroke', colors.eggersLine)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '5,3')
        .attr('opacity', 0.8);
    }

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${plotH})`)
      .call(d3.axisBottom(xScale).ticks(7))
      .selectAll('text')
      .attr('font-size', fontSize - 1);

    // Y axis (inverted: 0 at top)
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5))
      .selectAll('text')
      .attr('font-size', fontSize - 1);

    // Axis labels
    g.append('text')
      .attr('x', plotW / 2)
      .attr('y', plotH + 38)
      .attr('text-anchor', 'middle')
      .attr('font-size', fontSize)
      .attr('fill', '#666')
      .text(plotSettings.customXLabel || 'Effect Size');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -plotH / 2)
      .attr('y', -42)
      .attr('text-anchor', 'middle')
      .attr('font-size', fontSize)
      .attr('fill', '#666')
      .text('Standard Error');

    // Title
    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('font-size', fontSize + 2)
      .attr('font-weight', 'bold')
      .attr('fill', '#333')
      .text(plotSettings.customTitle || 'Funnel Plot');
  }, [result, width, height, plotSettings, trimFillResult, showContours, eggers, showEggersLine]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      role="img"
      aria-label={t('a11y.funnelPlot', lang)}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    />
  );
}
