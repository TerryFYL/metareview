import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { MetaAnalysisResult } from '../lib/types';
import { funnelPlotData } from '../lib/statistics';

interface FunnelPlotProps {
  result: MetaAnalysisResult;
  width?: number;
  height?: number;
}

const MARGIN = { top: 30, right: 30, bottom: 50, left: 60 };

export default function FunnelPlot({
  result,
  width = 500,
  height = 400,
}: FunnelPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);

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
      .attr('fill', '#f3f4f6')
      .attr('stroke', '#d1d5db')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3');

    // Summary effect line
    g.append('line')
      .attr('x1', xScale(summaryEffect))
      .attr('x2', xScale(summaryEffect))
      .attr('y1', 0)
      .attr('y2', plotH)
      .attr('stroke', '#dc2626')
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
      .attr('fill', '#2563eb')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .append('title')
      .text((d) => `${d.name}: ${d.x.toFixed(3)}`);

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${plotH})`)
      .call(d3.axisBottom(xScale).ticks(7))
      .selectAll('text')
      .attr('font-size', 10);

    // Y axis (inverted: 0 at top)
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5))
      .selectAll('text')
      .attr('font-size', 10);

    // Axis labels
    g.append('text')
      .attr('x', plotW / 2)
      .attr('y', plotH + 38)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('fill', '#666')
      .text('Effect Size');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -plotH / 2)
      .attr('y', -42)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('fill', '#666')
      .text('Standard Error');

    // Title
    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('font-size', 13)
      .attr('font-weight', 'bold')
      .attr('fill', '#333')
      .text('Funnel Plot');
  }, [result, width, height]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    />
  );
}
