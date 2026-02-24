import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { CumulativeResult, EffectMeasure } from '../lib/types';
import { isLogScale } from '../lib/statistics';
import { t, type Lang } from '../lib/i18n';
import { useUIStore } from '../store';

interface Props {
  results: CumulativeResult[];
  measure: EffectMeasure;
  lang: Lang;
}

export default function CumulativeMeta({ results, measure, lang }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { plotSettings } = useUIStore();

  const nullVal = isLogScale(measure) ? 1 : 0;
  const formatEffect = (v: number) => isLogScale(measure) ? v.toFixed(2) : v.toFixed(3);
  const formatP = (p: number) => p < 0.001 ? '< 0.001' : p.toFixed(3);

  // Stability assessment: check if effect changed < 10% over last 3 steps
  const stabilityMsg = useMemo(() => {
    if (results.length < 4) return null;
    const last3 = results.slice(-3);
    const baseline = last3[0].effect;
    if (baseline === 0) return null;
    const stable = last3.every(r => Math.abs((r.effect - baseline) / baseline) < 0.1);
    if (stable) {
      return t('cumulative.stable', lang).replace('{n}', '3');
    }
    return t('cumulative.unstable', lang);
  }, [results, lang]);

  const hasYearGaps = results.some(r => !r.year);

  // Draw cumulative forest-style chart
  useEffect(() => {
    if (!svgRef.current || results.length === 0) return;
    const svg = svgRef.current;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const ns = 'http://www.w3.org/2000/svg';
    const w = 700;
    const rowH = 28;
    const labelW = 180;
    const plotL = labelW + 10;
    const plotR = w - 80;
    const plotW = plotR - plotL;
    const topPad = 30;
    const h = topPad + results.length * rowH + 40;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));

    // Determine x domain from all CIs
    let xMin = Infinity, xMax = -Infinity;
    for (const r of results) {
      if (r.ciLower < xMin) xMin = r.ciLower;
      if (r.ciUpper > xMax) xMax = r.ciUpper;
    }
    // Include null line
    if (nullVal < xMin) xMin = nullVal;
    if (nullVal > xMax) xMax = nullVal;
    const pad = (xMax - xMin) * 0.15;
    xMin -= pad;
    xMax += pad;

    const xScale = (v: number) => plotL + ((v - xMin) / (xMax - xMin)) * plotW;

    const colors = plotSettings.colorScheme === 'bw'
      ? { study: '#333', overall: '#000', line: '#999' }
      : plotSettings.colorScheme === 'colorblind'
      ? { study: '#0072B2', overall: '#D55E00', line: '#999' }
      : { study: '#2563eb', overall: '#dc2626', line: '#d1d5db' };

    const fontSize = plotSettings.fontSize;

    // Null line
    const nullX = xScale(nullVal);
    const nullLine = document.createElementNS(ns, 'line');
    nullLine.setAttribute('x1', String(nullX));
    nullLine.setAttribute('x2', String(nullX));
    nullLine.setAttribute('y1', String(topPad - 5));
    nullLine.setAttribute('y2', String(topPad + results.length * rowH + 5));
    nullLine.setAttribute('stroke', colors.line);
    nullLine.setAttribute('stroke-dasharray', '4,3');
    svg.appendChild(nullLine);

    // X-axis label
    const xLabel = document.createElementNS(ns, 'text');
    xLabel.setAttribute('x', String((plotL + plotR) / 2));
    xLabel.setAttribute('y', String(h - 5));
    xLabel.setAttribute('text-anchor', 'middle');
    xLabel.setAttribute('font-size', String(fontSize - 1));
    xLabel.setAttribute('fill', '#6b7280');
    xLabel.textContent = measure;
    svg.appendChild(xLabel);

    // Null label
    const nullLabel = document.createElementNS(ns, 'text');
    nullLabel.setAttribute('x', String(nullX));
    nullLabel.setAttribute('y', String(topPad - 10));
    nullLabel.setAttribute('text-anchor', 'middle');
    nullLabel.setAttribute('font-size', String(fontSize - 2));
    nullLabel.setAttribute('fill', '#9ca3af');
    nullLabel.textContent = String(nullVal);
    svg.appendChild(nullLabel);

    // Draw rows
    results.forEach((r, i) => {
      const y = topPad + i * rowH + rowH / 2;

      // Label
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', String(labelW));
      label.setAttribute('y', String(y + 4));
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('font-size', String(fontSize));
      label.setAttribute('fill', '#374151');
      const yearStr = r.year ? ` (${r.year})` : '';
      label.textContent = `${r.addedStudy}${yearStr}`;
      svg.appendChild(label);

      // k count
      const kText = document.createElementNS(ns, 'text');
      kText.setAttribute('x', String(plotR + 8));
      kText.setAttribute('y', String(y + 4));
      kText.setAttribute('font-size', String(fontSize - 1));
      kText.setAttribute('fill', '#9ca3af');
      kText.textContent = `k=${r.studyCount}`;
      svg.appendChild(kText);

      // CI line
      const ciX1 = Math.max(plotL, xScale(r.ciLower));
      const ciX2 = Math.min(plotR, xScale(r.ciUpper));
      const ciLine = document.createElementNS(ns, 'line');
      ciLine.setAttribute('x1', String(ciX1));
      ciLine.setAttribute('x2', String(ciX2));
      ciLine.setAttribute('y1', String(y));
      ciLine.setAttribute('y2', String(y));
      ciLine.setAttribute('stroke', i === results.length - 1 ? colors.overall : colors.study);
      ciLine.setAttribute('stroke-width', i === results.length - 1 ? '2' : '1.5');
      svg.appendChild(ciLine);

      // Point estimate
      const px = xScale(r.effect);
      if (px >= plotL && px <= plotR) {
        const size = i === results.length - 1 ? 5 : 3.5;
        const point = document.createElementNS(ns, 'rect');
        point.setAttribute('x', String(px - size));
        point.setAttribute('y', String(y - size));
        point.setAttribute('width', String(size * 2));
        point.setAttribute('height', String(size * 2));
        point.setAttribute('fill', i === results.length - 1 ? colors.overall : colors.study);
        svg.appendChild(point);
      }
    });
  }, [results, measure, nullVal, plotSettings]);

  const downloadSVG = useCallback(() => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgRef.current);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cumulative-meta-analysis.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (results.length === 0) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>
            {t('cumulative.title', lang)}
          </h2>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            {t('cumulative.desc', lang)}
          </p>
        </div>
        <button onClick={downloadSVG} style={btnStyle}>
          {t('cumulative.downloadSVG', lang)}
        </button>
      </div>

      {hasYearGaps && (
        <p style={{ fontSize: 12, color: '#ca8a04', marginBottom: 8 }}>
          {t('cumulative.noYear', lang)}
        </p>
      )}

      {/* Cumulative forest plot */}
      <div className="cumulative-plot-container" style={{ overflowX: 'auto', marginBottom: 16 }}>
        <svg ref={svgRef} style={{ display: 'block', margin: '0 auto' }} />
      </div>

      {/* Stability assessment */}
      {stabilityMsg && (
        <div style={{
          padding: '10px 14px',
          background: stabilityMsg.includes('stable') || stabilityMsg.includes('\u7a33\u5b9a') ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${stabilityMsg.includes('stable') || stabilityMsg.includes('\u7a33\u5b9a') ? '#bbf7d0' : '#fecaca'}`,
          borderRadius: 8,
          fontSize: 12,
          color: '#374151',
          marginBottom: 16,
        }}>
          {stabilityMsg}
        </div>
      )}

      {/* Data table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, minWidth: 500 }}>
          <thead>
            <tr>
              <th style={thStyle}>{t('cumulative.addedStudy', lang)}</th>
              <th style={thStyle}>k</th>
              <th style={thStyle}>{measure} [95% CI]</th>
              <th style={thStyle}>{t('cumulative.heterogeneity', lang)}</th>
              <th style={thStyle}>P</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i} style={{
                background: i === results.length - 1 ? '#f0f9ff' : i % 2 ? '#f9fafb' : '#fff',
                fontWeight: i === results.length - 1 ? 600 : 400,
              }}>
                <td style={tdStyle}>
                  {r.addedStudy}{r.year ? ` (${r.year})` : ''}
                </td>
                <td style={tdStyle}>{r.studyCount}</td>
                <td style={{ ...tdStyle, fontFamily: 'monospace' }}>
                  {formatEffect(r.effect)} [{formatEffect(r.ciLower)}, {formatEffect(r.ciUpper)}]
                </td>
                <td style={tdStyle}>
                  I{'\u00B2'} = {r.I2.toFixed(1)}%
                </td>
                <td style={{
                  ...tdStyle,
                  fontWeight: r.pValue < 0.05 ? 600 : 400,
                  color: r.pValue < 0.05 ? '#dc2626' : '#6b7280',
                }}>
                  {formatP(r.pValue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '2px solid #e5e7eb',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid #f3f4f6',
  fontSize: 13,
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
