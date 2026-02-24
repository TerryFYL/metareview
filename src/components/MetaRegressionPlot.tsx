import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import type { MetaRegressionResult } from '../lib/types';
import { t, type Lang } from '../lib/i18n';
import { useUIStore, type ColorScheme } from '../store';

interface Props {
  metaRegression: MetaRegressionResult;
  lang: Lang;
  width?: number;
  height?: number;
}

const MARGIN = { top: 30, right: 30, bottom: 50, left: 60 };

const METAREG_COLORS: Record<ColorScheme, { point: string; line: string; band: string; bandStroke: string }> = {
  default: { point: '#2563eb', line: '#dc2626', band: '#fef2f2', bandStroke: '#fca5a5' },
  bw: { point: '#333333', line: '#000000', band: '#f5f5f5', bandStroke: '#999999' },
  colorblind: { point: '#0072B2', line: '#D55E00', band: '#fff5f0', bandStroke: '#D55E00' },
};

export default function MetaRegressionPlot({ metaRegression: mr, lang, width = 560, height = 420 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const plotSettings = useUIStore((s) => s.plotSettings);
  const colors = METAREG_COLORS[plotSettings.colorScheme];
  const fontSize = plotSettings.fontSize;

  const { coefficient, intercept, se, pValue, z: zVal, points, QModel, QModelP, QResidual, QResidualDf, QResidualP, R2, k } = mr;

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
    if (!svgRef.current || points.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const plotW = width - MARGIN.left - MARGIN.right;
    const plotH = height - MARGIN.top - MARGIN.bottom;

    svg.append('desc').text(t('a11y.metaRegPlot', lang));

    // Compute CI band parameters from WLS
    const Sw = points.reduce((sum, p) => sum + p.weight, 0);
    const meanX = points.reduce((sum, p) => sum + p.weight * p.x, 0) / Sw;
    const Sxx = points.reduce((sum, p) => sum + p.weight * (p.x - meanX) ** 2, 0);

    // X scale: year
    const xExtent = d3.extent(points, (p) => p.x) as [number, number];
    const xPad = Math.max((xExtent[1] - xExtent[0]) * 0.1, 1);
    const xScale = d3.scaleLinear().domain([xExtent[0] - xPad, xExtent[1] + xPad]).range([0, plotW]);

    // Y scale: effect size
    // Also consider predicted values at domain edges for y extent
    const predMin = intercept + coefficient * (xExtent[0] - xPad);
    const predMax = intercept + coefficient * (xExtent[1] + xPad);
    const allY = [...points.map((p) => p.y), predMin, predMax];
    const yMin = d3.min(allY) as number;
    const yMax = d3.max(allY) as number;
    const yPad = Math.max((yMax - yMin) * 0.15, 0.1);
    const yScale = d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).range([plotH, 0]);

    // Weight scale for bubble size
    const wExtent = d3.extent(points, (p) => p.weight) as [number, number];
    const rScale = d3.scaleSqrt().domain([wExtent[0], wExtent[1]]).range([4, 14]);

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // 95% CI band for regression line
    const xDomMin = xExtent[0] - xPad;
    const xDomMax = xExtent[1] + xPad;
    const bandXs = d3.range(xDomMin, xDomMax, (xDomMax - xDomMin) / 100).concat([xDomMax]);

    const getCI = (x: number): [number, number] => {
      const pred = intercept + coefficient * x;
      const sePred = Math.sqrt(1 / Sw + (x - meanX) ** 2 / Sxx);
      return [pred - 1.96 * sePred, pred + 1.96 * sePred];
    };

    // CI band polygon
    const upperPts = bandXs.map((x) => `${xScale(x)},${yScale(getCI(x)[1])}`);
    const lowerPts = [...bandXs].reverse().map((x) => `${xScale(x)},${yScale(getCI(x)[0])}`);
    g.append('polygon')
      .attr('points', [...upperPts, ...lowerPts].join(' '))
      .attr('fill', colors.band)
      .attr('opacity', 0.6);

    // CI band boundary lines (dashed)
    g.append('polyline')
      .attr('points', bandXs.map((x) => `${xScale(x)},${yScale(getCI(x)[1])}`).join(' '))
      .attr('fill', 'none')
      .attr('stroke', colors.bandStroke)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3');

    g.append('polyline')
      .attr('points', bandXs.map((x) => `${xScale(x)},${yScale(getCI(x)[0])}`).join(' '))
      .attr('fill', 'none')
      .attr('stroke', colors.bandStroke)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3');

    // Regression line
    g.append('line')
      .attr('x1', xScale(xDomMin)).attr('y1', yScale(intercept + coefficient * xDomMin))
      .attr('x2', xScale(xDomMax)).attr('y2', yScale(intercept + coefficient * xDomMax))
      .attr('stroke', colors.line)
      .attr('stroke-width', 2);

    // Data points (bubbles, sized by weight)
    g.selectAll('.metareg-point')
      .data(points)
      .enter()
      .append('circle')
      .attr('class', 'metareg-point')
      .attr('cx', (d) => xScale(d.x))
      .attr('cy', (d) => yScale(d.y))
      .attr('r', (d) => rScale(d.weight))
      .attr('fill', colors.point)
      .attr('fill-opacity', 0.6)
      .attr('stroke', colors.point)
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseenter', function (event: MouseEvent, d) {
        d3.select(this).attr('fill-opacity', 0.9).attr('stroke-width', 2);
        const html = `
          <div style="font-weight:600;margin-bottom:3px">${d.name}</div>
          <div>${t('metaReg.covariate', lang)}: ${d.x}</div>
          <div>${t('forest.tooltip.effect', lang)}: ${d.y.toFixed(4)}</div>
          <div>${t('forest.tooltip.weight', lang)}: ${d.weight.toFixed(2)}</div>
        `;
        showTooltip(event, html);
      })
      .on('mousemove', function (event: MouseEvent, d) {
        const html = `
          <div style="font-weight:600;margin-bottom:3px">${d.name}</div>
          <div>${t('metaReg.covariate', lang)}: ${d.x}</div>
          <div>${t('forest.tooltip.effect', lang)}: ${d.y.toFixed(4)}</div>
          <div>${t('forest.tooltip.weight', lang)}: ${d.weight.toFixed(2)}</div>
        `;
        showTooltip(event, html);
      })
      .on('mouseleave', function () {
        d3.select(this).attr('fill-opacity', 0.6).attr('stroke-width', 1);
        hideTooltip();
      });

    // X axis (year — integer format)
    g.append('g')
      .attr('transform', `translate(0,${plotH})`)
      .call(d3.axisBottom(xScale).ticks(7).tickFormat(d3.format('d')))
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
      .text(t('metaReg.xAxis', lang));

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -plotH / 2).attr('y', -42)
      .attr('text-anchor', 'middle')
      .attr('font-size', fontSize).attr('fill', '#666')
      .text(t('metaReg.yAxis', lang));

    // Title
    svg.append('text')
      .attr('x', width / 2).attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('font-size', fontSize + 2).attr('font-weight', 'bold').attr('fill', '#333')
      .text(t('metaReg.scatterTitle', lang));
  }, [mr, width, height, plotSettings, lang, points, showTooltip, hideTooltip, colors, fontSize, coefficient, intercept]);

  const downloadSVG = useCallback(() => {
    if (!svgRef.current) return;
    const source = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meta-regression-plot.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const fmtP = (p: number) => p < 0.001 ? '< 0.001' : p.toFixed(3);

  return (
    <div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
        {t('metaReg.desc', lang)}
      </p>

      {/* Results table */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>{t('metaReg.title', lang)}</div>
        <table style={{ fontSize: 13 }}>
          <tbody>
            <Row label={t('metaReg.covariate', lang)} value={`${mr.covariate} (k = ${k})`} />
            <Row label={t('metaReg.coefficient', lang)} value={`${coefficient.toFixed(4)} (SE = ${se.toFixed(4)})`} />
            <Row label="Z" value={zVal.toFixed(4)} />
            <Row label="P-value" value={fmtP(pValue)} highlight={pValue < 0.05} />
            <Row label={t('metaReg.intercept', lang)} value={intercept.toFixed(4)} />
            <Row label={t('metaReg.qModel', lang)} value={`${QModel.toFixed(2)} (p = ${fmtP(QModelP)})`} highlight={QModelP < 0.05} />
            <Row label={t('metaReg.qResidual', lang)} value={`${QResidual.toFixed(2)} (df = ${QResidualDf}, p = ${fmtP(QResidualP)})`} />
            <Row label={t('metaReg.r2', lang)} value={`${(R2 * 100).toFixed(1)}%`} />
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: pValue < 0.05 ? '#dc2626' : '#16a34a', marginTop: 8, fontWeight: 500 }}>
          {pValue < 0.05 ? t('metaReg.significant', lang) : t('metaReg.notSignificant', lang)}
        </p>
      </div>

      {/* Download button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button onClick={downloadSVG} style={btnStyle}>
          {t('metaReg.downloadSVG', lang)}
        </button>
      </div>

      {/* Scatter plot */}
      <div style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto', position: 'relative' }}>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          role="img"
          aria-label={t('a11y.metaRegPlot', lang)}
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
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <tr>
      <td style={{ padding: '4px 12px 4px 0', color: '#6b7280', whiteSpace: 'nowrap' }}>{label}</td>
      <td style={{
        padding: '4px 0',
        fontFamily: 'monospace',
        fontWeight: highlight ? 600 : 400,
        color: highlight ? '#dc2626' : '#111827',
      }}>
        {value}
      </td>
    </tr>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '14px 18px',
  marginBottom: 12,
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#111827',
  marginBottom: 8,
};

const btnStyle: React.CSSProperties = {
  padding: '7px 14px',
  background: '#f3f4f6',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
};
