import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { MetaAnalysisResult } from '../lib/types';
import { funnelPlotData } from '../lib/statistics';
import { useUIStore, type ColorScheme } from '../store';

interface FunnelPlotProps {
  result: MetaAnalysisResult;
  width?: number;
  height?: number;
}

const MARGIN = { top: 30, right: 30, bottom: 50, left: 60 };

const FUNNEL_COLORS: Record<ColorScheme, { point: string; summary: string; funnel: string; funnelStroke: string }> = {
  default: { point: '#2563eb', summary: '#dc2626', funnel: '#f3f4f6', funnelStroke: '#d1d5db' },
  bw: { point: '#333333', summary: '#000000', funnel: '#f5f5f5', funnelStroke: '#999999' },
  colorblind: { point: '#0072B2', summary: '#D55E00', funnel: '#f0f4f8', funnelStroke: '#a0aec0' },
};

export default function FunnelPlot({
  result,
  width = 500,
  height = 400,
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
  }, [result, width, height, plotSettings]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    />
  );
}
