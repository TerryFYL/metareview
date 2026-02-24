import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { MetaAnalysisResult, SubgroupAnalysisResult } from '../lib/types';
import { isLogScale } from '../lib/statistics';
import { t, type Lang } from '../lib/i18n';
import { useUIStore, type ColorScheme } from '../store';

interface ForestPlotProps {
  result: MetaAnalysisResult;
  subgroupResult?: SubgroupAnalysisResult | null;
  width?: number;
  title?: string;
  lang?: Lang;
}

const MARGIN = { top: 40, right: 220, bottom: 40, left: 200 };
const ROW_HEIGHT = 28;
const DIAMOND_HEIGHT = 12;

// Color schemes
const COLOR_SCHEMES: Record<ColorScheme, { study: string; overall: string; subgroup: string; subgroupHeader: string }> = {
  default: { study: '#2563eb', overall: '#dc2626', subgroup: '#f59e0b', subgroupHeader: '#2563eb' },
  bw: { study: '#333333', overall: '#000000', subgroup: '#666666', subgroupHeader: '#333333' },
  colorblind: { study: '#0072B2', overall: '#D55E00', subgroup: '#E69F00', subgroupHeader: '#0072B2' },
};

export default function ForestPlot({
  result,
  subgroupResult,
  width: propWidth,
  title,
  lang = 'en',
}: ForestPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(propWidth || 900);
  const plotSettings = useUIStore((s) => s.plotSettings);
  const colors = COLOR_SCHEMES[plotSettings.colorScheme];

  // Responsive: observe container width
  useEffect(() => {
    if (propWidth) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setContainerWidth(Math.max(w, 600));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [propWidth]);

  const width = propWidth || containerWidth;
  const hasSubgroups = subgroupResult && subgroupResult.subgroups.length > 1;

  // Calculate total rows needed
  let totalRows: number;
  if (hasSubgroups) {
    // For each subgroup: header row + studies + subtotal row + spacing row
    totalRows = subgroupResult.subgroups.reduce(
      (sum, sg) => sum + 1 + sg.result.studies.length + 1, 0
    ) + 2; // overall + spacing
  } else {
    totalRows = result.studies.length + 2;
  }

  const height = MARGIN.top + totalRows * ROW_HEIGHT + MARGIN.bottom;
  const plotWidth = width - MARGIN.left - MARGIN.right;

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { measure } = result;
    const useLog = isLogScale(measure);

    // Collect all values for x-scale domain
    const allValues = result.studies.flatMap((s) => [s.ciLower, s.ciUpper]);
    allValues.push(result.ciLower, result.ciUpper);
    if (hasSubgroups) {
      for (const sg of subgroupResult.subgroups) {
        allValues.push(sg.result.ciLower, sg.result.ciUpper);
      }
    }
    const nullValue = useLog ? 1 : 0;
    allValues.push(nullValue);

    const xMin = d3.min(allValues)!;
    const xMax = d3.max(allValues)!;
    const padding = (xMax - xMin) * 0.15;

    const xScale = d3
      .scaleLinear()
      .domain([xMin - padding, xMax + padding])
      .range([0, plotWidth]);

    const g = svg
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Title
    const displayTitle = plotSettings.customTitle || title;
    if (displayTitle) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', plotSettings.fontSize + 3)
        .attr('font-weight', 'bold')
        .attr('fill', '#1a1a1a')
        .text(displayTitle);
    }

    // Column headers
    const fs = plotSettings.fontSize;
    const headerY = -8;
    g.append('text')
      .attr('x', -MARGIN.left + 10)
      .attr('y', headerY)
      .attr('font-size', fs)
      .attr('font-weight', 'bold')
      .attr('fill', '#666')
      .text(lang === 'zh' ? '研究' : 'Study');

    g.append('text')
      .attr('x', plotWidth + 10)
      .attr('y', headerY)
      .attr('font-size', fs)
      .attr('font-weight', 'bold')
      .attr('fill', '#666')
      .text(`${measure} [95% CI]`);

    if (plotSettings.showWeights) {
      g.append('text')
        .attr('x', plotWidth + 150)
        .attr('y', headerY)
        .attr('font-size', fs)
        .attr('font-weight', 'bold')
        .attr('fill', '#666')
        .text(lang === 'zh' ? '权重' : 'Weight');
    }

    // Max weight for square sizing (from overall result)
    const maxWeight = d3.max(result.studies, (s) =>
      result.model === 'random' ? s.weightRandom : s.weightFixed
    )!;

    // Helper: draw a study row
    function drawStudyRow(
      study: { effect: number; ciLower: number; ciUpper: number; name: string; year?: number; weightFixed: number; weightRandom: number },
      y: number,
      modelType: string,
      indent: boolean = false
    ) {
      const weight = modelType === 'random' ? study.weightRandom : study.weightFixed;

      g.append('text')
        .attr('x', -MARGIN.left + (indent ? 20 : 10))
        .attr('y', y + 4)
        .attr('font-size', fs)
        .attr('fill', '#333')
        .text(study.year ? `${study.name} (${study.year})` : study.name);

      const ciLeft = Math.max(xScale(study.ciLower), 0);
      const ciRight = Math.min(xScale(study.ciUpper), plotWidth);

      // CI line
      g.append('line')
        .attr('x1', ciLeft).attr('x2', ciRight)
        .attr('y1', y).attr('y2', y)
        .attr('stroke', colors.study).attr('stroke-width', 1.5);

      // CI caps
      if (xScale(study.ciLower) >= 0) {
        g.append('line')
          .attr('x1', ciLeft).attr('x2', ciLeft)
          .attr('y1', y - 4).attr('y2', y + 4)
          .attr('stroke', colors.study).attr('stroke-width', 1.5);
      }
      if (xScale(study.ciUpper) <= plotWidth) {
        g.append('line')
          .attr('x1', ciRight).attr('x2', ciRight)
          .attr('y1', y - 4).attr('y2', y + 4)
          .attr('stroke', colors.study).attr('stroke-width', 1.5);
      }

      // Weight square
      const squareSize = 4 + (weight / maxWeight) * 10;
      g.append('rect')
        .attr('x', xScale(study.effect) - squareSize / 2)
        .attr('y', y - squareSize / 2)
        .attr('width', squareSize).attr('height', squareSize)
        .attr('fill', colors.study);

      // Effect text
      g.append('text')
        .attr('x', plotWidth + 10).attr('y', y + 4)
        .attr('font-size', fs - 1).attr('fill', '#333')
        .attr('font-family', 'monospace')
        .text(`${study.effect.toFixed(2)} [${study.ciLower.toFixed(2)}, ${study.ciUpper.toFixed(2)}]`);

      // Weight text
      if (plotSettings.showWeights) {
        g.append('text')
          .attr('x', plotWidth + 155).attr('y', y + 4)
          .attr('font-size', fs - 1).attr('fill', '#666')
          .attr('font-family', 'monospace')
          .text(`${weight.toFixed(1)}%`);
      }
    }

    // Helper: draw a diamond (summary)
    function drawDiamond(
      res: { effect: number; ciLower: number; ciUpper: number },
      y: number,
      label: string,
      color: string
    ) {
      const dx = xScale(res.effect);
      const dl = xScale(res.ciLower);
      const dr = xScale(res.ciUpper);

      g.append('polygon')
        .attr('points', [
          `${dl},${y}`, `${dx},${y - DIAMOND_HEIGHT / 2}`,
          `${dr},${y}`, `${dx},${y + DIAMOND_HEIGHT / 2}`,
        ].join(' '))
        .attr('fill', color).attr('opacity', 0.85);

      g.append('text')
        .attr('x', -MARGIN.left + 10).attr('y', y + 4)
        .attr('font-size', fs).attr('font-weight', 'bold').attr('fill', '#333')
        .text(label);

      g.append('text')
        .attr('x', plotWidth + 10).attr('y', y + 4)
        .attr('font-size', fs - 1).attr('font-weight', 'bold').attr('fill', '#333')
        .attr('font-family', 'monospace')
        .text(`${res.effect.toFixed(2)} [${res.ciLower.toFixed(2)}, ${res.ciUpper.toFixed(2)}]`);
    }

    let currentRow = 0;

    if (hasSubgroups) {
      // === SUBGROUP MODE ===
      const subtotalLabel = lang === 'zh' ? '小计' : 'Subtotal';

      for (const sg of subgroupResult.subgroups) {
        // Subgroup header
        const headerRowY = currentRow * ROW_HEIGHT + ROW_HEIGHT / 2;
        g.append('text')
          .attr('x', -MARGIN.left + 10)
          .attr('y', headerRowY + 4)
          .attr('font-size', fs)
          .attr('font-weight', 'bold')
          .attr('fill', colors.subgroupHeader)
          .text(sg.name || (lang === 'zh' ? '未分组' : 'Ungrouped'));
        currentRow++;

        // Studies in this subgroup — map to overall study effects for consistent weights
        for (const sgStudy of sg.result.studies) {
          const overallStudy = result.studies.find((s) => s.id === sgStudy.id);
          const y = currentRow * ROW_HEIGHT + ROW_HEIGHT / 2;
          drawStudyRow(overallStudy || sgStudy, y, result.model, true);
          currentRow++;
        }

        // Subtotal diamond
        const subY = currentRow * ROW_HEIGHT + ROW_HEIGHT / 2;
        const sgHet = sg.result.heterogeneity;
        drawDiamond(
          sg.result,
          subY,
          `${subtotalLabel} (I\u00B2=${sgHet.I2.toFixed(0)}%, k=${sg.result.studies.length})`,
          colors.subgroup
        );

        // Separator line
        g.append('line')
          .attr('x1', -MARGIN.left + 10).attr('x2', plotWidth + 200)
          .attr('y1', (currentRow + 1) * ROW_HEIGHT - 4)
          .attr('y2', (currentRow + 1) * ROW_HEIGHT - 4)
          .attr('stroke', '#e5e7eb').attr('stroke-width', 1);
        currentRow++;
      }

      // Overall separator
      currentRow++;

    } else {
      // === NORMAL MODE (no subgroups) ===
      for (const study of result.studies) {
        const y = currentRow * ROW_HEIGHT + ROW_HEIGHT / 2;
        drawStudyRow(study, y, result.model);
        currentRow++;
      }

      // Separator
      g.append('line')
        .attr('x1', -MARGIN.left + 10).attr('x2', plotWidth + 200)
        .attr('y1', currentRow * ROW_HEIGHT + 4)
        .attr('y2', currentRow * ROW_HEIGHT + 4)
        .attr('stroke', '#e5e7eb').attr('stroke-width', 1);

      currentRow++;
    }

    // Null effect line
    g.append('line')
      .attr('x1', xScale(nullValue)).attr('x2', xScale(nullValue))
      .attr('y1', -2).attr('y2', currentRow * ROW_HEIGHT - 10)
      .attr('stroke', '#999').attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3');

    // Overall diamond
    const overallY = currentRow * ROW_HEIGHT - ROW_HEIGHT / 2 + 4;
    const overallLabel = `${lang === 'zh' ? '总计' : 'Overall'} (${result.model === 'random' ? 'Random' : 'Fixed'}, I\u00B2=${result.heterogeneity.I2.toFixed(0)}%)`;
    drawDiamond(result, overallY, overallLabel, colors.overall);

    // Subgroup test annotation
    if (hasSubgroups) {
      const testY = overallY + ROW_HEIGHT;
      const pStr = subgroupResult.test.pValue < 0.001
        ? '< 0.001'
        : subgroupResult.test.pValue.toFixed(3);
      g.append('text')
        .attr('x', -MARGIN.left + 10)
        .attr('y', testY + 4)
        .attr('font-size', fs - 1)
        .attr('fill', subgroupResult.test.pValue < 0.05 ? colors.overall : '#666')
        .attr('font-style', 'italic')
        .text(
          `${t('subgroup.testTitle', lang)}: Q=${subgroupResult.test.Q.toFixed(2)}, df=${subgroupResult.test.df}, p=${pStr}`
        );
    }

    // X axis
    const axisY = currentRow * ROW_HEIGHT + 10;
    const xAxis = d3.axisBottom(xScale).ticks(7);
    g.append('g')
      .attr('transform', `translate(0,${axisY})`)
      .call(xAxis)
      .selectAll('text')
      .attr('font-size', 10);

    // X axis label
    const labelY = axisY + 28;
    const xLabel = plotSettings.customXLabel || (useLog ? `${measure} (log scale)` : measure);
    g.append('text')
      .attr('x', plotWidth / 2).attr('y', labelY)
      .attr('text-anchor', 'middle').attr('font-size', fs).attr('fill', '#666')
      .text(xLabel);

    // Favours labels
    const leftLabel = plotSettings.favoursLeftLabel || t('forest.favoursTreatment', lang);
    const rightLabel = plotSettings.favoursRightLabel || t('forest.favoursControl', lang);
    g.append('text')
      .attr('x', xScale(nullValue) - 20).attr('y', labelY)
      .attr('text-anchor', 'end').attr('font-size', fs - 2).attr('fill', '#999')
      .text(leftLabel);

    g.append('text')
      .attr('x', xScale(nullValue) + 20).attr('y', labelY)
      .attr('text-anchor', 'start').attr('font-size', fs - 2).attr('fill', '#999')
      .text(rightLabel);
  }, [result, subgroupResult, width, title, lang, plotWidth, hasSubgroups, plotSettings]);

  return (
    <div ref={containerRef} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', minWidth: 600 }}
      />
    </div>
  );
}
