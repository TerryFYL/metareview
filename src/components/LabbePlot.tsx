import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import type { Study } from '../lib/types';
import { labbeePlotData, isBinaryData } from '../lib/statistics';
import type { LabbeData } from '../lib/statistics';
import { t, type Lang } from '../lib/i18n';
import { useUIStore, type ColorScheme } from '../store';
import type { BinaryData } from '../lib/types';

interface LabbePlotProps {
  studies: Study[];
  lang: Lang;
  width?: number;
  height?: number;
}

const MARGIN = { top: 30, right: 30, bottom: 55, left: 60 };

const LABBE_COLORS: Record<ColorScheme, { point: string; diagonal: string; gridLine: string }> = {
  default: { point: '#2563eb', diagonal: '#dc2626', gridLine: '#e5e7eb' },
  bw: { point: '#333333', diagonal: '#000000', gridLine: '#d4d4d4' },
  colorblind: { point: '#0072B2', diagonal: '#D55E00', gridLine: '#d4d4d8' },
};

export default function LabbePlot({ studies, lang, width = 500, height = 500 }: LabbePlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const plotSettings = useUIStore((s) => s.plotSettings);
  const colors = LABBE_COLORS[plotSettings.colorScheme];
  const fontSize = plotSettings.fontSize;

  // Extract binary data for L'Abbé plot
  const binaryStudies = studies
    .filter((s) => isBinaryData(s.data))
    .map((s) => {
      const d = s.data as BinaryData;
      return { name: s.name, events1: d.events1, total1: d.total1, events2: d.events2, total2: d.total2 };
    });

  const data: LabbeData | null = labbeePlotData(binaryStudies);

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
    if (!svgRef.current || !data) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const plotW = width - MARGIN.left - MARGIN.right;
    const plotH = height - MARGIN.top - MARGIN.bottom;

    // Accessible desc
    svg.append('desc').text(t('a11y.labbePlot', lang));

    // Scales: both axes 0 to 1 (event rates)
    const xScale = d3.scaleLinear().domain([0, 1]).range([0, plotW]);
    const yScale = d3.scaleLinear().domain([0, 1]).range([plotH, 0]);

    // Bubble size scale: sqrt of sample size
    const maxN = d3.max(data.points, (p) => p.sampleSize) || 100;
    const rScale = d3.scaleSqrt().domain([0, maxN]).range([3, 18]);

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Grid lines
    const gridValues = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
    gridValues.forEach((v) => {
      // Vertical grid
      g.append('line')
        .attr('x1', xScale(v)).attr('x2', xScale(v))
        .attr('y1', 0).attr('y2', plotH)
        .attr('stroke', colors.gridLine).attr('stroke-width', 0.5);
      // Horizontal grid
      g.append('line')
        .attr('x1', 0).attr('x2', plotW)
        .attr('y1', yScale(v)).attr('y2', yScale(v))
        .attr('stroke', colors.gridLine).attr('stroke-width', 0.5);
    });

    // Diagonal line (y = x, no treatment effect)
    g.append('line')
      .attr('x1', xScale(0)).attr('y1', yScale(0))
      .attr('x2', xScale(1)).attr('y2', yScale(1))
      .attr('stroke', colors.diagonal)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6,3');

    // Region labels
    g.append('text')
      .attr('x', xScale(0.7)).attr('y', yScale(0.3))
      .attr('text-anchor', 'middle')
      .attr('font-size', fontSize - 1).attr('fill', '#9ca3af')
      .attr('font-style', 'italic')
      .text(t('labbe.favoursControl', lang));

    g.append('text')
      .attr('x', xScale(0.3)).attr('y', yScale(0.7))
      .attr('text-anchor', 'middle')
      .attr('font-size', fontSize - 1).attr('fill', '#9ca3af')
      .attr('font-style', 'italic')
      .text(t('labbe.favoursTreatment', lang));

    // Data points (bubbles)
    g.selectAll('.labbe-point')
      .data(data.points)
      .enter()
      .append('circle')
      .attr('class', 'labbe-point')
      .attr('cx', (d) => xScale(d.eventRateCtrl))
      .attr('cy', (d) => yScale(d.eventRateExp))
      .attr('r', (d) => rScale(d.sampleSize))
      .attr('fill', colors.point)
      .attr('fill-opacity', 0.6)
      .attr('stroke', colors.point)
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mouseenter', function (event: MouseEvent, d) {
        d3.select(this).attr('fill-opacity', 0.9).attr('stroke-width', 2.5);
        const html = `
          <div style="font-weight:600;margin-bottom:3px">${d.name}</div>
          <div>${t('labbe.expRate', lang)}: ${(d.eventRateExp * 100).toFixed(1)}%</div>
          <div>${t('labbe.ctrlRate', lang)}: ${(d.eventRateCtrl * 100).toFixed(1)}%</div>
          <div>${t('labbe.sampleSize', lang)}: ${d.sampleSize}</div>
        `;
        showTooltip(event, html);
      })
      .on('mousemove', function (event: MouseEvent, d) {
        const html = `
          <div style="font-weight:600;margin-bottom:3px">${d.name}</div>
          <div>${t('labbe.expRate', lang)}: ${(d.eventRateExp * 100).toFixed(1)}%</div>
          <div>${t('labbe.ctrlRate', lang)}: ${(d.eventRateCtrl * 100).toFixed(1)}%</div>
          <div>${t('labbe.sampleSize', lang)}: ${d.sampleSize}</div>
        `;
        showTooltip(event, html);
      })
      .on('mouseleave', function () {
        d3.select(this).attr('fill-opacity', 0.6).attr('stroke-width', 1.5);
        hideTooltip();
      });

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${plotH})`)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.format('.0%')))
      .selectAll('text')
      .attr('font-size', fontSize - 1);

    // Y axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format('.0%')))
      .selectAll('text')
      .attr('font-size', fontSize - 1);

    // Axis labels
    g.append('text')
      .attr('x', plotW / 2).attr('y', plotH + 42)
      .attr('text-anchor', 'middle')
      .attr('font-size', fontSize).attr('fill', '#666')
      .text(t('labbe.xAxis', lang));

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -plotH / 2).attr('y', -45)
      .attr('text-anchor', 'middle')
      .attr('font-size', fontSize).attr('fill', '#666')
      .text(t('labbe.yAxis', lang));

    // Title
    svg.append('text')
      .attr('x', width / 2).attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('font-size', fontSize + 2).attr('font-weight', 'bold').attr('fill', '#333')
      .text(t('labbe.title', lang));
  }, [data, width, height, plotSettings, lang, showTooltip, hideTooltip, colors, fontSize]);

  const downloadSVG = useCallback(() => {
    if (!svgRef.current) return;
    const source = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'labbe-plot.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (!data || data.points.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
        {t('labbe.noBinaryData', lang)}
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
        {t('labbe.desc', lang)}
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button onClick={downloadSVG} style={{ padding: '7px 14px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
          {t('labbe.downloadSVG', lang)}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto', position: 'relative' }}>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          role="img"
          aria-label={t('a11y.labbePlot', lang)}
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

      {/* Summary */}
      <div style={{
        marginTop: 12,
        padding: '10px 14px',
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        fontSize: 13,
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <span>
          <span style={{ color: '#6b7280' }}>{t('labbe.total', lang)}: </span>
          <span style={{ fontWeight: 500 }}>{data.points.length}</span>
        </span>
        <span>
          <span style={{ color: '#16a34a' }}>{t('labbe.belowDiagonal', lang)}: </span>
          <span style={{ fontWeight: 500 }}>{data.favoursTreatment}</span>
        </span>
        <span>
          <span style={{ color: '#dc2626' }}>{t('labbe.aboveDiagonal', lang)}: </span>
          <span style={{ fontWeight: 500 }}>{data.favoursControl}</span>
        </span>
      </div>
    </div>
  );
}
