import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { MetaAnalysisResult } from '../lib/types';
import { isLogScale } from '../lib/statistics';

interface ForestPlotProps {
  result: MetaAnalysisResult;
  width?: number;
  title?: string;
}

const MARGIN = { top: 40, right: 220, bottom: 40, left: 200 };
const ROW_HEIGHT = 28;
const DIAMOND_HEIGHT = 12;

export default function ForestPlot({
  result,
  width = 900,
  title,
}: ForestPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const totalRows = result.studies.length + 2; // studies + gap + summary
  const height = MARGIN.top + totalRows * ROW_HEIGHT + MARGIN.bottom;
  const plotWidth = width - MARGIN.left - MARGIN.right;

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { studies, measure } = result;
    const useLog = isLogScale(measure);

    // Gather all CI bounds for scale
    const allValues = studies.flatMap((s) => [s.ciLower, s.ciUpper]);
    allValues.push(result.ciLower, result.ciUpper);
    const nullValue = useLog ? 1 : 0;
    allValues.push(nullValue);

    const xMin = d3.min(allValues)!;
    const xMax = d3.max(allValues)!;
    const padding = (xMax - xMin) * 0.15;

    const xScale = d3
      .scaleLinear()
      .domain([xMin - padding, xMax + padding])
      .range([0, plotWidth]);

    // Main group
    const g = svg
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Title
    if (title) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', 14)
        .attr('font-weight', 'bold')
        .attr('fill', '#1a1a1a')
        .text(title);
    }

    // Header
    const headerY = -8;
    g.append('text')
      .attr('x', -MARGIN.left + 10)
      .attr('y', headerY)
      .attr('font-size', 11)
      .attr('font-weight', 'bold')
      .attr('fill', '#666')
      .text('Study');

    g.append('text')
      .attr('x', plotWidth + 10)
      .attr('y', headerY)
      .attr('font-size', 11)
      .attr('font-weight', 'bold')
      .attr('fill', '#666')
      .text(`${measure} [95% CI]`);

    g.append('text')
      .attr('x', plotWidth + 150)
      .attr('y', headerY)
      .attr('font-size', 11)
      .attr('font-weight', 'bold')
      .attr('fill', '#666')
      .text('Weight');

    // Null effect line
    g.append('line')
      .attr('x1', xScale(nullValue))
      .attr('x2', xScale(nullValue))
      .attr('y1', -2)
      .attr('y2', (studies.length + 1) * ROW_HEIGHT + 5)
      .attr('stroke', '#999')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3');

    // Studies
    const maxWeight = d3.max(studies, (s) =>
      result.model === 'random' ? s.weightRandom : s.weightFixed
    )!;

    studies.forEach((study, i) => {
      const y = i * ROW_HEIGHT + ROW_HEIGHT / 2;
      const weight =
        result.model === 'random' ? study.weightRandom : study.weightFixed;

      // Study name
      g.append('text')
        .attr('x', -MARGIN.left + 10)
        .attr('y', y + 4)
        .attr('font-size', 11)
        .attr('fill', '#333')
        .text(
          study.year
            ? `${study.name} (${study.year})`
            : study.name
        );

      // CI line
      const ciLeft = Math.max(xScale(study.ciLower), 0);
      const ciRight = Math.min(xScale(study.ciUpper), plotWidth);

      g.append('line')
        .attr('x1', ciLeft)
        .attr('x2', ciRight)
        .attr('y1', y)
        .attr('y2', y)
        .attr('stroke', '#2563eb')
        .attr('stroke-width', 1.5);

      // CI whiskers (if within bounds)
      if (xScale(study.ciLower) >= 0) {
        g.append('line')
          .attr('x1', ciLeft)
          .attr('x2', ciLeft)
          .attr('y1', y - 4)
          .attr('y2', y + 4)
          .attr('stroke', '#2563eb')
          .attr('stroke-width', 1.5);
      }
      if (xScale(study.ciUpper) <= plotWidth) {
        g.append('line')
          .attr('x1', ciRight)
          .attr('x2', ciRight)
          .attr('y1', y - 4)
          .attr('y2', y + 4)
          .attr('stroke', '#2563eb')
          .attr('stroke-width', 1.5);
      }

      // Effect size square (size proportional to weight)
      const squareSize = 4 + (weight / maxWeight) * 10;
      g.append('rect')
        .attr('x', xScale(study.effect) - squareSize / 2)
        .attr('y', y - squareSize / 2)
        .attr('width', squareSize)
        .attr('height', squareSize)
        .attr('fill', '#2563eb');

      // Effect text (right side)
      g.append('text')
        .attr('x', plotWidth + 10)
        .attr('y', y + 4)
        .attr('font-size', 10)
        .attr('fill', '#333')
        .attr('font-family', 'monospace')
        .text(
          `${study.effect.toFixed(2)} [${study.ciLower.toFixed(2)}, ${study.ciUpper.toFixed(2)}]`
        );

      // Weight text
      g.append('text')
        .attr('x', plotWidth + 155)
        .attr('y', y + 4)
        .attr('font-size', 10)
        .attr('fill', '#666')
        .attr('font-family', 'monospace')
        .text(`${weight.toFixed(1)}%`);
    });

    // Summary diamond
    const summaryY = (studies.length + 0.5) * ROW_HEIGHT + ROW_HEIGHT / 2;

    // Separator line
    g.append('line')
      .attr('x1', -MARGIN.left + 10)
      .attr('x2', plotWidth + 200)
      .attr('y1', studies.length * ROW_HEIGHT + 4)
      .attr('y2', studies.length * ROW_HEIGHT + 4)
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1);

    // Diamond
    const diamondX = xScale(result.effect);
    const diamondLeft = xScale(result.ciLower);
    const diamondRight = xScale(result.ciUpper);

    g.append('polygon')
      .attr(
        'points',
        [
          `${diamondLeft},${summaryY}`,
          `${diamondX},${summaryY - DIAMOND_HEIGHT / 2}`,
          `${diamondRight},${summaryY}`,
          `${diamondX},${summaryY + DIAMOND_HEIGHT / 2}`,
        ].join(' ')
      )
      .attr('fill', '#dc2626')
      .attr('opacity', 0.85);

    // Summary label
    g.append('text')
      .attr('x', -MARGIN.left + 10)
      .attr('y', summaryY + 4)
      .attr('font-size', 11)
      .attr('font-weight', 'bold')
      .attr('fill', '#333')
      .text(
        `Overall (${result.model === 'random' ? 'Random' : 'Fixed'}, I\u00B2=${result.heterogeneity.I2.toFixed(0)}%)`
      );

    // Summary effect text
    g.append('text')
      .attr('x', plotWidth + 10)
      .attr('y', summaryY + 4)
      .attr('font-size', 10)
      .attr('font-weight', 'bold')
      .attr('fill', '#333')
      .attr('font-family', 'monospace')
      .text(
        `${result.effect.toFixed(2)} [${result.ciLower.toFixed(2)}, ${result.ciUpper.toFixed(2)}]`
      );

    // X-axis
    const xAxis = d3.axisBottom(xScale).ticks(7);
    g.append('g')
      .attr('transform', `translate(0,${(studies.length + 1) * ROW_HEIGHT + 10})`)
      .call(xAxis)
      .selectAll('text')
      .attr('font-size', 10);

    // X-axis label
    g.append('text')
      .attr('x', plotWidth / 2)
      .attr('y', (studies.length + 1) * ROW_HEIGHT + 38)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('fill', '#666')
      .text(useLog ? `${measure} (log scale)` : measure);

    // Favours labels
    const labelY = (studies.length + 1) * ROW_HEIGHT + 38;
    g.append('text')
      .attr('x', xScale(nullValue) - 20)
      .attr('y', labelY)
      .attr('text-anchor', 'end')
      .attr('font-size', 9)
      .attr('fill', '#999')
      .text('\u2190 Favours treatment');

    g.append('text')
      .attr('x', xScale(nullValue) + 20)
      .attr('y', labelY)
      .attr('text-anchor', 'start')
      .attr('font-size', 9)
      .attr('fill', '#999')
      .text('Favours control \u2192');
  }, [result, width, title]);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
      />
    </div>
  );
}
