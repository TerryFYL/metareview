import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import type { MetaAnalysisResult } from '../lib/types';
import { galbraithPlotData } from '../lib/statistics';
import { t, type Lang } from '../lib/i18n';
import { useUIStore, type ColorScheme } from '../store';

interface GalbraithPlotProps {
  result: MetaAnalysisResult;
  lang: Lang;
  width?: number;
  height?: number;
}

const MARGIN = { top: 30, right: 30, bottom: 50, left: 60 };

const GALBRAITH_COLORS: Record<ColorScheme, { point: string; outlier: string; line: string; band: string; bandStroke: string }> = {
  default: { point: '#2563eb', outlier: '#dc2626', line: '#111827', band: '#f0f4ff', bandStroke: '#93c5fd' },
  bw: { point: '#333333', outlier: '#000000', line: '#000000', band: '#f5f5f5', bandStroke: '#999999' },
  colorblind: { point: '#0072B2', outlier: '#D55E00', line: '#000000', band: '#f0f4f8', bandStroke: '#a0aec0' },
};

export default function GalbraithPlot({ result, lang, width = 560, height = 420 }: GalbraithPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const plotSettings = useUIStore((s) => s.plotSettings);
  const colors = GALBRAITH_COLORS[plotSettings.colorScheme];
  const fontSize = plotSettings.fontSize;

  const data = galbraithPlotData(result.studies, result.summary);

  const showTooltip = useCallback((event: MouseEvent, html: string) => {
    const tip = tooltipRef.current;
    if (!tip) return;
    tip.innerHTML = html;
    tip.style.display = 'block';
    const svgRect = svgRef.current?.parentElement?.getBoundingClientRect();
    if (!svgRect) return;
    tip.style.left = `${event.clientX - svgRect.left + 12}px`;
    tip.style.top = `${event.clientY - svgRect.top - 10}px`;
  }, []);

  const hideTooltip = useCallback(() => {
    const tip = tooltipRef.current;
    if (tip) tip.style.display = 'none';
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    if (data.points.length === 0) return;

    const plotW = width - MARGIN.left - MARGIN.right;
    const plotH = height - MARGIN.top - MARGIN.bottom;

    // Accessible desc
    svg.append('desc').text(t('a11y.galbraithPlot', lang));

    // X scale: precision (1/SE)
    const maxPrec = d3.max(data.points, (p) => p.precision) || 10;
    const xScale = d3.scaleLinear().domain([0, maxPrec * 1.15]).range([0, plotW]);

    // Y scale: z-score (yi/SE)
    const allZ = data.points.map((p) => p.zScore);
    const zExtent = d3.extent(allZ) as [number, number];
    const zPad = Math.max((zExtent[1] - zExtent[0]) * 0.2, 2);
    const yScale = d3.scaleLinear().domain([zExtent[0] - zPad, zExtent[1] + zPad]).range([plotH, 0]);

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // ±2 confidence bands: z = slope * x ± 2
    const xMax = maxPrec * 1.15;
    const bandPoints = d3.range(0, xMax, xMax / 100).concat([xMax]);

    // Upper band line
    const upperLine = bandPoints.map((x) => `${xScale(x)},${yScale(data.slope * x + 2)}`).join(' ');
    const lowerLine = bandPoints.map((x) => `${xScale(x)},${yScale(data.slope * x - 2)}`).join(' ');

    // Fill band area
    const areaUp = bandPoints.map((x) => `${xScale(x)},${yScale(data.slope * x + 2)}`);
    const areaDown = [...bandPoints].reverse().map((x) => `${xScale(x)},${yScale(data.slope * x - 2)}`);
    g.append('polygon')
      .attr('points', [...areaUp, ...areaDown].join(' '))
      .attr('fill', colors.band)
      .attr('opacity', 0.6);

    // Band boundary lines (dashed)
    g.append('polyline')
      .attr('points', upperLine)
      .attr('fill', 'none')
      .attr('stroke', colors.bandStroke)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3');

    g.append('polyline')
      .attr('points', lowerLine)
      .attr('fill', 'none')
      .attr('stroke', colors.bandStroke)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3');

    // Regression line: z = slope * precision (through origin)
    g.append('line')
      .attr('x1', xScale(0)).attr('y1', yScale(0))
      .attr('x2', xScale(xMax)).attr('y2', yScale(data.slope * xMax))
      .attr('stroke', colors.line)
      .attr('stroke-width', 1.5);

    // Zero line (horizontal)
    if (yScale.domain()[0] <= 0 && yScale.domain()[1] >= 0) {
      g.append('line')
        .attr('x1', 0).attr('x2', plotW)
        .attr('y1', yScale(0)).attr('y2', yScale(0))
        .attr('stroke', '#ccc')
        .attr('stroke-width', 0.5)
        .attr('stroke-dasharray', '2,2');
    }

    // Data points
    g.selectAll('.galbraith-point')
      .data(data.points)
      .enter()
      .append('circle')
      .attr('class', 'galbraith-point')
      .attr('cx', (d) => xScale(d.precision))
      .attr('cy', (d) => yScale(d.zScore))
      .attr('r', (d) => d.isOutlier ? 5 : 4)
      .attr('fill', (d) => d.isOutlier ? colors.outlier : colors.point)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseenter', function (event: MouseEvent, d) {
        d3.select(this).attr('r', d.isOutlier ? 7 : 6).attr('stroke-width', 2);
        const html = `
          <div style="font-weight:600;margin-bottom:3px">${d.name}${d.isOutlier ? ' <span style="color:#dc2626">(outlier)</span>' : ''}</div>
          <div>Precision: ${d.precision.toFixed(2)}</div>
          <div>z-score: ${d.zScore.toFixed(3)}</div>
        `;
        showTooltip(event, html);
      })
      .on('mousemove', function (event: MouseEvent, d) {
        const html = `
          <div style="font-weight:600;margin-bottom:3px">${d.name}${d.isOutlier ? ' <span style="color:#dc2626">(outlier)</span>' : ''}</div>
          <div>Precision: ${d.precision.toFixed(2)}</div>
          <div>z-score: ${d.zScore.toFixed(3)}</div>
        `;
        showTooltip(event, html);
      })
      .on('mouseleave', function (_event: MouseEvent, d) {
        d3.select(this).attr('r', d.isOutlier ? 5 : 4).attr('stroke-width', 1);
        hideTooltip();
      });

    // Outlier labels
    data.points.filter((p) => p.isOutlier).forEach((p) => {
      g.append('text')
        .attr('x', xScale(p.precision) + 7)
        .attr('y', yScale(p.zScore) + 3)
        .attr('font-size', fontSize - 1)
        .attr('fill', colors.outlier)
        .attr('font-weight', 500)
        .text(p.name);
    });

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${plotH})`)
      .call(d3.axisBottom(xScale).ticks(7))
      .selectAll('text')
      .attr('font-size', fontSize - 1);

    // Y axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(7))
      .selectAll('text')
      .attr('font-size', fontSize - 1);

    // Axis labels
    g.append('text')
      .attr('x', plotW / 2).attr('y', plotH + 38)
      .attr('text-anchor', 'middle')
      .attr('font-size', fontSize).attr('fill', '#666')
      .text(t('galbraith.xAxis', lang));

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -plotH / 2).attr('y', -42)
      .attr('text-anchor', 'middle')
      .attr('font-size', fontSize).attr('fill', '#666')
      .text(t('galbraith.yAxis', lang));

    // Title
    svg.append('text')
      .attr('x', width / 2).attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('font-size', fontSize + 2).attr('font-weight', 'bold').attr('fill', '#333')
      .text(t('galbraith.title', lang));
  }, [result, width, height, plotSettings, lang, data, showTooltip, hideTooltip, colors, fontSize]);

  const downloadSVG = useCallback(() => {
    if (!svgRef.current) return;
    const source = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'galbraith-plot.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
        {t('galbraith.desc', lang)}
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button onClick={downloadSVG} style={{ padding: '7px 14px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
          {t('galbraith.downloadSVG', lang)}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto', position: 'relative' }}>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          role="img"
          aria-label={t('a11y.galbraithPlot', lang)}
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
        />
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
            maxWidth: 240,
            lineHeight: 1.5,
          }}
        />
      </div>

      {/* Outlier summary */}
      <div style={{
        marginTop: 12,
        padding: '10px 14px',
        background: data.outliers.length > 0 ? '#fef2f2' : '#f0fdf4',
        border: `1px solid ${data.outliers.length > 0 ? '#fecaca' : '#bbf7d0'}`,
        borderRadius: 8,
        fontSize: 13,
      }}>
        {data.outliers.length > 0 ? (
          <div>
            <span style={{ color: '#dc2626', fontWeight: 500 }}>
              {t('galbraith.outlier', lang).replace('{count}', String(data.outliers.length))}
            </span>
            <span style={{ marginLeft: 4 }}>{data.outliers.join(', ')}</span>
          </div>
        ) : (
          <span style={{ color: '#16a34a' }}>{t('galbraith.noOutlier', lang)}</span>
        )}
      </div>
    </div>
  );
}
