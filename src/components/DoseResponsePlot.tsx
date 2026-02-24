import { useEffect, useRef, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import type { MetaAnalysisResult } from '../lib/types';
import { isLogScale, doseResponseAnalysis } from '../lib/statistics';
import { t, type Lang } from '../lib/i18n';
import { useUIStore, type ColorScheme } from '../store';

interface DoseResponsePlotProps {
  result: MetaAnalysisResult;
  doses: number[];
  names: string[];
  lang: Lang;
  width?: number;
  height?: number;
}

const MARGIN = { top: 40, right: 40, bottom: 60, left: 70 };

const COLORS: Record<ColorScheme, { point: string; line: string; ci: string; bg: string; text: string; grid: string }> = {
  default: { point: '#3b82f6', line: '#dc2626', ci: '#fecaca', bg: '#f8fafc', text: '#1e293b', grid: '#e5e7eb' },
  bw: { point: '#333333', line: '#000000', ci: '#dddddd', bg: '#ffffff', text: '#000000', grid: '#cccccc' },
  colorblind: { point: '#0072B2', line: '#D55E00', ci: '#FFE0C0', bg: '#f8fafc', text: '#1e293b', grid: '#e5e7eb' },
};

export default function DoseResponsePlot({ result, doses, names, lang, width = 640, height = 460 }: DoseResponsePlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const plotSettings = useUIStore((s) => s.plotSettings);

  const drResult = useMemo(() => {
    return doseResponseAnalysis(result.studies, doses, names);
  }, [result.studies, doses, names]);

  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;

  useEffect(() => {
    if (!svgRef.current || !drResult) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const colors = COLORS[plotSettings.colorScheme];
    const fs = plotSettings.fontSize;
    const useLog = isLogScale(result.measure);

    // Background
    svg.append('rect').attr('width', width).attr('height', height).attr('fill', colors.bg);
    svg.append('desc').text(t('a11y.doseResponsePlot', lang));

    // Title
    svg.append('text')
      .attr('x', width / 2).attr('y', 22)
      .attr('text-anchor', 'middle')
      .attr('font-size', fs + 2).attr('font-weight', '600').attr('fill', colors.text)
      .text(t('doseResponse.title', lang));

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Scales
    const doseExtent = d3.extent(drResult.points, (p) => p.dose) as [number, number];
    const dosePad = (doseExtent[1] - doseExtent[0]) * 0.08;
    const xScale = d3.scaleLinear()
      .domain([doseExtent[0] - dosePad, doseExtent[1] + dosePad])
      .range([0, plotWidth]);

    const allY = [
      ...drResult.points.map((p) => p.effect),
      ...drResult.curve.map((c) => c.ciLower),
      ...drResult.curve.map((c) => c.ciUpper),
    ];
    const yExtent = d3.extent(allY) as [number, number];
    const yPad = (yExtent[1] - yExtent[0]) * 0.1;
    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - yPad, yExtent[1] + yPad])
      .range([plotHeight, 0]);

    // Grid lines
    const yTicks = yScale.ticks(6);
    yTicks.forEach((tick) => {
      g.append('line')
        .attr('x1', 0).attr('x2', plotWidth)
        .attr('y1', yScale(tick)).attr('y2', yScale(tick))
        .attr('stroke', colors.grid).attr('stroke-width', 0.5);
    });

    // Null effect line
    const nullVal = useLog ? 0 : 0; // on log/raw scale
    if (yScale(nullVal) >= 0 && yScale(nullVal) <= plotHeight) {
      g.append('line')
        .attr('x1', 0).attr('x2', plotWidth)
        .attr('y1', yScale(nullVal)).attr('y2', yScale(nullVal))
        .attr('stroke', '#999').attr('stroke-width', 1).attr('stroke-dasharray', '4,3');
    }

    // CI band (area)
    const area = d3.area<{ dose: number; ciLower: number; ciUpper: number }>()
      .x((d) => xScale(d.dose))
      .y0((d) => yScale(d.ciLower))
      .y1((d) => yScale(d.ciUpper))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(drResult.curve)
      .attr('d', area)
      .attr('fill', colors.ci)
      .attr('opacity', 0.5);

    // Fitted curve line
    const line = d3.line<{ dose: number; effect: number }>()
      .x((d) => xScale(d.dose))
      .y((d) => yScale(d.effect))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(drResult.curve)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', colors.line)
      .attr('stroke-width', 2.5);

    // Data points (bubble size proportional to weight)
    const maxWeight = d3.max(drResult.points, (p) => p.weight) || 1;
    const rScale = d3.scaleSqrt().domain([0, maxWeight]).range([4, 14]);

    g.selectAll('.dose-point')
      .data(drResult.points)
      .join('circle')
      .attr('class', 'dose-point')
      .attr('cx', (d) => xScale(d.dose))
      .attr('cy', (d) => yScale(d.effect))
      .attr('r', (d) => rScale(d.weight))
      .attr('fill', colors.point)
      .attr('opacity', 0.7)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1);

    // Point labels
    g.selectAll('.dose-label')
      .data(drResult.points)
      .join('text')
      .attr('class', 'dose-label')
      .attr('x', (d) => xScale(d.dose) + rScale(d.weight) + 4)
      .attr('y', (d) => yScale(d.effect) + 3)
      .attr('font-size', fs - 2)
      .attr('fill', colors.text)
      .attr('opacity', 0.7)
      .text((d) => d.name.length > 15 ? d.name.slice(0, 13) + '…' : d.name);

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${plotHeight})`)
      .call(d3.axisBottom(xScale).ticks(7))
      .selectAll('text').attr('font-size', 10);

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(6))
      .selectAll('text').attr('font-size', 10);

    // X axis label
    g.append('text')
      .attr('x', plotWidth / 2).attr('y', plotHeight + 40)
      .attr('text-anchor', 'middle').attr('font-size', fs).attr('fill', colors.text)
      .text(t('doseResponse.xLabel', lang));

    // Y axis label
    g.append('text')
      .attr('transform', `rotate(-90)`)
      .attr('x', -plotHeight / 2).attr('y', -50)
      .attr('text-anchor', 'middle').attr('font-size', fs).attr('fill', colors.text)
      .text(`${result.measure} (${useLog ? 'log scale' : 'raw'})`);

  }, [drResult, result, width, height, plotWidth, plotHeight, plotSettings, lang]);

  const downloadSVG = useCallback(() => {
    if (!svgRef.current) return;
    const source = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dose-response-plot.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Check if we have dose data
  const hasDoseData = doses.filter((d) => d != null && !isNaN(d)).length >= 3;

  if (!hasDoseData) {
    return (
      <div>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
          {t('doseResponse.noDoseData', lang)}
        </p>
        <p style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
          {t('doseResponse.howToAdd', lang)}
        </p>
      </div>
    );
  }

  if (!drResult) {
    return <p style={{ color: '#6b7280', fontSize: 13 }}>{t('doseResponse.noResult', lang)}</p>;
  }

  const formatP = (p: number) => (p < 0.001 ? '< 0.001' : p.toFixed(3));

  return (
    <div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
        {t('doseResponse.desc', lang)}
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          onClick={downloadSVG}
          style={{ padding: '7px 14px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
        >
          {t('doseResponse.downloadSVG', lang)}
        </button>
      </div>
      <div className="dose-response-container" style={{ overflowX: 'auto' }}>
        <svg ref={svgRef} width={width} height={height} role="img" aria-label={t('a11y.doseResponsePlot', lang)}
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', minWidth: 500 }}
        />
      </div>

      {/* Results summary */}
      <div style={{ marginTop: 12, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 18px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 8 }}>
          {t('doseResponse.results', lang)}
        </div>
        <table style={{ fontSize: 13 }}>
          <tbody>
            <tr>
              <td style={{ padding: '4px 12px 4px 0', color: '#6b7280' }}>{t('doseResponse.modelType', lang)}</td>
              <td style={{ fontFamily: 'monospace' }}>{drResult.modelType === 'quadratic' ? t('doseResponse.quadratic', lang) : t('doseResponse.linear', lang)}</td>
            </tr>
            <tr>
              <td style={{ padding: '4px 12px 4px 0', color: '#6b7280' }}>{t('doseResponse.doseLevels', lang)}</td>
              <td style={{ fontFamily: 'monospace' }}>{drResult.k}</td>
            </tr>
            <tr>
              <td style={{ padding: '4px 12px 4px 0', color: '#6b7280' }}>{t('doseResponse.linearCoeff', lang)}</td>
              <td style={{ fontFamily: 'monospace', color: drResult.pLinear < 0.05 ? '#dc2626' : '#111827', fontWeight: drResult.pLinear < 0.05 ? 600 : 400 }}>
                {drResult.beta1.toFixed(4)} (P = {formatP(drResult.pLinear)})
              </td>
            </tr>
            {drResult.modelType === 'quadratic' && (
              <tr>
                <td style={{ padding: '4px 12px 4px 0', color: '#6b7280' }}>{t('doseResponse.quadCoeff', lang)}</td>
                <td style={{ fontFamily: 'monospace', color: drResult.pQuadratic < 0.05 ? '#dc2626' : '#111827', fontWeight: drResult.pQuadratic < 0.05 ? 600 : 400 }}>
                  {drResult.beta2.toFixed(6)} (P = {formatP(drResult.pQuadratic)})
                </td>
              </tr>
            )}
            <tr>
              <td style={{ padding: '4px 12px 4px 0', color: '#6b7280' }}>R²</td>
              <td style={{ fontFamily: 'monospace' }}>{(drResult.R2 * 100).toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: drResult.pLinear < 0.05 ? '#dc2626' : '#16a34a', marginTop: 8, fontWeight: 500 }}>
          {drResult.pLinear < 0.05 ? t('doseResponse.sigTrend', lang) : t('doseResponse.noSigTrend', lang)}
        </p>
      </div>
    </div>
  );
}
