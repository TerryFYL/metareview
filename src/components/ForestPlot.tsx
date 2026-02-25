import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { MetaAnalysisResult, SubgroupAnalysisResult } from '../lib/types';
import { isLogScale } from '../lib/statistics';
import { t, type Lang } from '../lib/i18n';
import { useUIStore, type ColorScheme, type ForestSortBy } from '../store';

/** Sort studies based on user-selected sort order */
function sortStudies<T extends { effect: number; year?: number; name: string; weightRandom: number; weightFixed: number }>(
  studies: T[],
  sortBy: ForestSortBy,
  model: string,
): T[] {
  if (sortBy === 'default') return studies;
  const sorted = [...studies];
  switch (sortBy) {
    case 'effect':
      sorted.sort((a, b) => a.effect - b.effect);
      break;
    case 'year':
      sorted.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
      break;
    case 'weight': {
      const getW = model === 'random'
        ? (s: T) => s.weightRandom
        : (s: T) => s.weightFixed;
      sorted.sort((a, b) => getW(b) - getW(a));
      break;
    }
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }
  return sorted;
}

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
  const tooltipRef = useRef<HTMLDivElement>(null);
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

  const hasPredictionInterval = !!result.predictionInterval;

  // Calculate total rows needed
  let totalRows: number;
  if (hasSubgroups) {
    // For each subgroup: header row + studies + subtotal row + spacing row
    totalRows = subgroupResult.subgroups.reduce(
      (sum, sg) => sum + 1 + sg.result.studies.length + 1, 0
    ) + 2; // overall + spacing
    // Extra row for subgroup test annotation
    totalRows += 1;
    // Extra row for effect difference when significant
    if (subgroupResult.test.pValue < 0.05) totalRows += 1;
  } else {
    totalRows = result.studies.length + 2;
  }
  // Add row for prediction interval if available
  if (hasPredictionInterval) totalRows += 1;

  const height = MARGIN.top + totalRows * ROW_HEIGHT + MARGIN.bottom;
  const plotWidth = width - MARGIN.left - MARGIN.right;

  const showTooltip = useCallback((event: MouseEvent, html: string) => {
    const tip = tooltipRef.current;
    if (!tip) return;
    tip.innerHTML = html;
    tip.style.display = 'block';
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = event.clientX - rect.left + 12;
    const y = event.clientY - rect.top - 10;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }, []);

  const hideTooltip = useCallback(() => {
    const tip = tooltipRef.current;
    if (tip) tip.style.display = 'none';
  }, []);

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
    // Include prediction interval bounds in scale
    if (result.predictionInterval) {
      allValues.push(result.predictionInterval.lower, result.predictionInterval.upper);
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

    // Accessible desc element
    svg.append('desc').text(t('a11y.forestPlot', lang));

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
      const weightHeader = g.append('text')
        .attr('x', plotWidth + 150)
        .attr('y', headerY)
        .attr('font-size', fs)
        .attr('font-weight', 'bold')
        .attr('fill', '#666')
        .attr('cursor', 'help')
        .text(lang === 'zh' ? '权重 ⓘ' : 'Weight ⓘ');
      const weightTipKey = result.model === 'random' ? 'forest.weightTip.random' : 'forest.weightTip.fixed';
      weightHeader.append('title').text(t(weightTipKey, lang));
    }

    // Max weight for square sizing (from overall result), guard against 0
    const maxWeight = d3.max(result.studies, (s) =>
      result.model === 'random' ? s.weightRandom : s.weightFixed
    ) || 1;

    // Helper: draw a study row with tooltip + hover
    function drawStudyRow(
      study: { id?: string; effect: number; ciLower: number; ciUpper: number; name: string; year?: number; weightFixed: number; weightRandom: number; yi?: number; sei?: number },
      y: number,
      modelType: string,
      indent: boolean = false
    ) {
      const weight = modelType === 'random' ? study.weightRandom : study.weightFixed;

      // Group for the entire row (enables hover)
      const row = g.append('g')
        .attr('class', 'forest-study-row')
        .style('cursor', 'pointer');

      // Hover background
      row.append('rect')
        .attr('x', -MARGIN.left)
        .attr('y', y - ROW_HEIGHT / 2)
        .attr('width', plotWidth + MARGIN.left + MARGIN.right)
        .attr('height', ROW_HEIGHT)
        .attr('fill', 'transparent')
        .attr('class', 'row-bg');

      row.append('text')
        .attr('x', -MARGIN.left + (indent ? 20 : 10))
        .attr('y', y + 4)
        .attr('font-size', fs)
        .attr('fill', '#333')
        .text(study.year ? `${study.name} (${study.year})` : study.name);

      const ciLeft = Math.max(xScale(study.ciLower), 0);
      const ciRight = Math.min(xScale(study.ciUpper), plotWidth);

      // CI line
      row.append('line')
        .attr('x1', ciLeft).attr('x2', ciRight)
        .attr('y1', y).attr('y2', y)
        .attr('stroke', colors.study).attr('stroke-width', 1.5);

      // CI caps
      if (xScale(study.ciLower) >= 0) {
        row.append('line')
          .attr('x1', ciLeft).attr('x2', ciLeft)
          .attr('y1', y - 4).attr('y2', y + 4)
          .attr('stroke', colors.study).attr('stroke-width', 1.5);
      }
      if (xScale(study.ciUpper) <= plotWidth) {
        row.append('line')
          .attr('x1', ciRight).attr('x2', ciRight)
          .attr('y1', y - 4).attr('y2', y + 4)
          .attr('stroke', colors.study).attr('stroke-width', 1.5);
      }

      // Weight square
      const squareSize = 4 + (weight / maxWeight) * 10;
      row.append('rect')
        .attr('x', xScale(study.effect) - squareSize / 2)
        .attr('y', y - squareSize / 2)
        .attr('width', squareSize).attr('height', squareSize)
        .attr('fill', colors.study);

      // Effect text
      row.append('text')
        .attr('x', plotWidth + 10).attr('y', y + 4)
        .attr('font-size', fs - 1).attr('fill', '#333')
        .attr('font-family', 'monospace')
        .text(`${study.effect.toFixed(2)} [${study.ciLower.toFixed(2)}, ${study.ciUpper.toFixed(2)}]`);

      // Weight text
      if (plotSettings.showWeights) {
        row.append('text')
          .attr('x', plotWidth + 155).attr('y', y + 4)
          .attr('font-size', fs - 1).attr('fill', '#666')
          .attr('font-family', 'monospace')
          .text(`${weight.toFixed(1)}%`);
      }

      // Tooltip hover events
      const tooltipHtml = `
        <div style="font-weight:600;margin-bottom:4px">${study.year ? `${study.name} (${study.year})` : study.name}</div>
        <div>${t('forest.tooltip.effect', lang)}: <b>${study.effect.toFixed(3)}</b></div>
        <div>${t('forest.tooltip.ci', lang)}: [${study.ciLower.toFixed(3)}, ${study.ciUpper.toFixed(3)}]</div>
        <div>${t('forest.tooltip.weight', lang)}: ${weight.toFixed(1)}%</div>
        ${study.sei ? `<div>${t('forest.tooltip.se', lang)}: ${study.sei.toFixed(4)}</div>` : ''}
        <div style="margin-top:4px;font-size:11px;color:#888;max-width:260px">${t(modelType === 'random' ? 'forest.weightTip.random' : 'forest.weightTip.fixed', lang)}</div>
      `;

      row.on('mouseenter', function (event: MouseEvent) {
        d3.select(this).select('.row-bg').attr('fill', '#f0f9ff');
        showTooltip(event, tooltipHtml);
      })
      .on('mousemove', function (event: MouseEvent) {
        showTooltip(event, tooltipHtml);
      })
      .on('mouseleave', function () {
        d3.select(this).select('.row-bg').attr('fill', 'transparent');
        hideTooltip();
      });
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

        // Studies in this subgroup — sort + map to overall study effects for consistent weights
        const sortedSgStudies = sortStudies(sg.result.studies, plotSettings.forestSortBy, result.model);
        for (const sgStudy of sortedSgStudies) {
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
      const sortedStudies = sortStudies(result.studies, plotSettings.forestSortBy, result.model);
      for (const study of sortedStudies) {
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

    // Prediction interval (dashed diamond below overall)
    if (result.predictionInterval) {
      const pi = result.predictionInterval;
      const piY = overallY + ROW_HEIGHT;
      const piLeft = xScale(pi.lower);
      const piRight = xScale(pi.upper);
      const piCenter = xScale(result.effect);
      const piDH = DIAMOND_HEIGHT * 0.8;

      // Dashed diamond outline (no fill)
      g.append('polygon')
        .attr('points', [
          `${piLeft},${piY}`, `${piCenter},${piY - piDH / 2}`,
          `${piRight},${piY}`, `${piCenter},${piY + piDH / 2}`,
        ].join(' '))
        .attr('fill', 'none')
        .attr('stroke', colors.overall)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,3')
        .attr('opacity', 0.7);

      // Label
      g.append('text')
        .attr('x', -MARGIN.left + 10).attr('y', piY + 4)
        .attr('font-size', fs - 1).attr('fill', '#666')
        .attr('font-style', 'italic')
        .text(lang === 'zh' ? '95% 预测区间' : '95% Prediction Interval');

      // PI value text
      g.append('text')
        .attr('x', plotWidth + 10).attr('y', piY + 4)
        .attr('font-size', fs - 1).attr('fill', '#666')
        .attr('font-family', 'monospace')
        .attr('font-style', 'italic')
        .text(`[${pi.lower.toFixed(2)}, ${pi.upper.toFixed(2)}]`);

      currentRow++;
    }

    // Subgroup test annotation
    if (hasSubgroups) {
      const testY = (hasPredictionInterval ? overallY + ROW_HEIGHT * 2 : overallY + ROW_HEIGHT);
      const pStr = subgroupResult.test.pValue < 0.001
        ? '< 0.001'
        : subgroupResult.test.pValue.toFixed(3);
      const isSgSig = subgroupResult.test.pValue < 0.05;

      // Background highlight when Q-between is significant
      if (isSgSig) {
        g.append('rect')
          .attr('x', -MARGIN.left + 4)
          .attr('y', testY - ROW_HEIGHT / 2 + 2)
          .attr('width', plotWidth + MARGIN.left + MARGIN.right - 8)
          .attr('height', (subgroupResult.subgroups.length >= 2 ? ROW_HEIGHT * 2 : ROW_HEIGHT) - 4)
          .attr('rx', 4)
          .attr('fill', colors.overall === '#dc2626' ? '#fef2f2' : colors.overall === '#000000' ? '#f5f5f5' : '#fff1e6')
          .attr('stroke', colors.overall === '#dc2626' ? '#fecaca' : colors.overall === '#000000' ? '#d4d4d4' : '#fed7aa')
          .attr('stroke-width', 1);
      }

      g.append('text')
        .attr('x', -MARGIN.left + 10)
        .attr('y', testY + 4)
        .attr('font-size', fs - 1)
        .attr('fill', isSgSig ? colors.overall : '#666')
        .attr('font-style', 'italic')
        .attr('font-weight', isSgSig ? 'bold' : 'normal')
        .text(
          `${t('subgroup.testTitle', lang)}: Q=${subgroupResult.test.Q.toFixed(2)}, df=${subgroupResult.test.df}, p=${pStr}`
        );

      // Show inter-subgroup effect difference when significant
      if (isSgSig && subgroupResult.subgroups.length >= 2) {
        const effects = subgroupResult.subgroups.map(s => s.result.effect);
        const maxE = Math.max(...effects);
        const minE = Math.min(...effects);
        const diff = Math.abs(maxE - minE);
        const maxSg = subgroupResult.subgroups.find(s => s.result.effect === maxE);
        const minSg = subgroupResult.subgroups.find(s => s.result.effect === minE);

        g.append('text')
          .attr('x', -MARGIN.left + 10)
          .attr('y', testY + ROW_HEIGHT - 4)
          .attr('font-size', fs - 2)
          .attr('fill', '#666')
          .attr('font-style', 'italic')
          .text(
            `\u0394 ${result.measure}: ${diff.toFixed(2)} (${(minSg?.name || '').slice(0, 15)} vs ${(maxSg?.name || '').slice(0, 15)})`
          );
      }
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
  }, [result, subgroupResult, width, title, lang, plotWidth, hasSubgroups, hasPredictionInterval, plotSettings, showTooltip, hideTooltip, colors]);

  return (
    <div ref={containerRef} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', position: 'relative' }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="img"
        aria-label={t('a11y.forestPlot', lang)}
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', minWidth: 600 }}
      />
      {/* Tooltip overlay */}
      <div
        ref={tooltipRef}
        style={{
          display: 'none',
          position: 'absolute',
          background: '#fff',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: 12,
          color: '#333',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          pointerEvents: 'none',
          zIndex: 10,
          maxWidth: 280,
          lineHeight: 1.5,
        }}
      />
    </div>
  );
}
