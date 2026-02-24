import { useCallback, useRef } from 'react';
import { t, type Lang } from '../lib/i18n';
import { generatePRISMADOCX } from '../lib/report-docx';

export interface PRISMAData {
  dbRecords: string;
  otherRecords: string;
  duplicatesRemoved: string;
  recordsScreened: string;
  recordsExcluded: string;
  fullTextAssessed: string;
  fullTextExcluded: string;
  fullTextExcludeReasons: string;
  qualitativeSynthesis: string;
  quantitativeSynthesis: string;
}

export const emptyPRISMA: PRISMAData = {
  dbRecords: '',
  otherRecords: '',
  duplicatesRemoved: '',
  recordsScreened: '',
  recordsExcluded: '',
  fullTextAssessed: '',
  fullTextExcluded: '',
  fullTextExcludeReasons: '',
  qualitativeSynthesis: '',
  quantitativeSynthesis: '',
};

interface Props {
  data: PRISMAData;
  onChange: (data: PRISMAData) => void;
  lang: Lang;
}

// Layout constants
const SVG_W = 800;
const SVG_H = 620;
const BOX_RX = 6;

// Color palette
const COL = {
  id: '#dbeafe',       // blue-100
  idBorder: '#93c5fd', // blue-300
  sc: '#fef9c3',       // yellow-100
  scBorder: '#fde047', // yellow-300
  el: '#fed7aa',       // orange-100
  elBorder: '#fdba74', // orange-300
  inc: '#bbf7d0',      // green-100
  incBorder: '#86efac', // green-300
  arrow: '#6b7280',
  label: '#374151',
  number: '#111827',
  phase: '#6b7280',
};

function n(val: string): string {
  return val.trim() || '—';
}

export default function PRISMAFlow({ data, onChange, lang }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  const set = useCallback(
    (key: keyof PRISMAData, value: string) => {
      onChange({ ...data, [key]: value });
    },
    [data, onChange]
  );

  const downloadSVG = useCallback(() => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgRef.current);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prisma-flowchart.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const downloadPNG = useCallback(() => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgRef.current);
    const img = new Image();
    const canvas = document.createElement('canvas');
    const scale = 2; // retina
    canvas.width = SVG_W * scale;
    canvas.height = SVG_H * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);

    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, SVG_W, SVG_H);
      ctx.drawImage(img, 0, 0, SVG_W, SVG_H);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'prisma-flowchart.png';
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
  }, []);

  const downloadDOCX = useCallback(async () => {
    const blob = await generatePRISMADOCX(data);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prisma-flowchart.docx';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, [data]);

  // Input field component
  const field = (label: string, key: keyof PRISMAData, placeholder?: string) => (
    <div style={{ marginBottom: 8 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 2 }}>
        {label}
      </label>
      <input
        type="text"
        value={data[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder || '0'}
        style={{
          width: '100%',
          padding: '6px 10px',
          border: '1px solid #d1d5db',
          borderRadius: 4,
          fontSize: 13,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );

  // SVG helpers
  const Box = ({
    x, y, w, h, fill, stroke, lines, sub,
  }: {
    x: number; y: number; w: number; h: number;
    fill: string; stroke: string;
    lines: string[]; sub?: string;
  }) => {
    const lineH = 18;
    const totalTextH = lines.length * lineH + (sub ? lineH : 0);
    const startY = y + (h - totalTextH) / 2 + lineH - 2;

    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx={BOX_RX} fill={fill} stroke={stroke} strokeWidth={1.5} />
        {lines.map((line, i) => (
          <text
            key={i}
            x={x + w / 2}
            y={startY + i * lineH}
            textAnchor="middle"
            fill={COL.label}
            fontSize={12}
            fontWeight={600}
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          >
            {line}
          </text>
        ))}
        {sub && (
          <text
            x={x + w / 2}
            y={startY + lines.length * lineH}
            textAnchor="middle"
            fill={COL.number}
            fontSize={13}
            fontWeight={700}
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          >
            (n = {sub})
          </text>
        )}
      </g>
    );
  };

  const Arrow = ({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) => (
    <g>
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={COL.arrow} />
        </marker>
      </defs>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={COL.arrow} strokeWidth={1.5} markerEnd="url(#arrowhead)" />
    </g>
  );

  const ElbowArrow = ({ x1, y1, mx, x2, y2 }: { x1: number; y1: number; mx: number; x2: number; y2: number }) => (
    <g>
      <polyline
        points={`${x1},${y1} ${mx},${y1} ${mx},${y2} ${x2},${y2}`}
        fill="none"
        stroke={COL.arrow}
        strokeWidth={1.5}
        markerEnd="url(#arrowhead)"
      />
    </g>
  );

  const PhaseLabel = ({ x, y, text }: { x: number; y: number; text: string }) => (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fill={COL.phase}
      fontSize={11}
      fontWeight={700}
      fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      letterSpacing={1}
      transform={`rotate(-90, ${x}, ${y})`}
    >
      {text}
    </text>
  );

  // Layout positions
  const colL = 120;  // left column center x
  const colR = 580;  // right column center x
  const boxW = 260;
  const boxH = 52;
  const sideW = 200;

  return (
    <div>
      {/* Data input form */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 12 }}>
          {t('prisma.inputTitle', lang)}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px 16px' }}>
          {field(t('prisma.dbRecords', lang), 'dbRecords')}
          {field(t('prisma.otherRecords', lang), 'otherRecords')}
          {field(t('prisma.duplicatesRemoved', lang), 'duplicatesRemoved')}
          {field(t('prisma.recordsScreened', lang), 'recordsScreened')}
          {field(t('prisma.recordsExcluded', lang), 'recordsExcluded')}
          {field(t('prisma.fullTextAssessed', lang), 'fullTextAssessed')}
          {field(t('prisma.fullTextExcluded', lang), 'fullTextExcluded')}
          {field(t('prisma.fullTextExcludeReasons', lang), 'fullTextExcludeReasons', lang === 'zh' ? '例：不符合纳入标准 3 篇，数据不全 2 篇' : 'e.g., Not meeting criteria: 3, Incomplete data: 2')}
          {field(t('prisma.qualSynthesis', lang), 'qualitativeSynthesis')}
          {field(t('prisma.quantSynthesis', lang), 'quantitativeSynthesis')}
        </div>
      </div>

      {/* Download buttons */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={downloadSVG} style={dlBtnStyle}>
          {t('prisma.downloadSVG', lang)}
        </button>
        <button onClick={downloadPNG} style={dlBtnStyle}>
          {t('prisma.downloadPNG', lang)}
        </button>
        <button onClick={downloadDOCX} style={{ ...dlBtnStyle, background: '#f0fdf4', borderColor: '#86efac', color: '#16a34a' }}>
          {t('prisma.downloadDOCX', lang)}
        </button>
      </div>

      {/* SVG Flow Diagram */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', padding: 16 }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width={SVG_W}
          height={SVG_H}
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' }}
        >
          {/* Background */}
          <rect width={SVG_W} height={SVG_H} fill="#ffffff" />

          {/* Phase labels (rotated) */}
          <PhaseLabel x={18} y={70} text={t('prisma.phase.identification', lang)} />
          <PhaseLabel x={18} y={245} text={t('prisma.phase.screening', lang)} />
          <PhaseLabel x={18} y={410} text={t('prisma.phase.eligibility', lang)} />
          <PhaseLabel x={18} y={560} text={t('prisma.phase.included', lang)} />

          {/* Phase separator lines */}
          <line x1={40} y1={135} x2={780} y2={135} stroke="#e5e7eb" strokeWidth={1} strokeDasharray="6,4" />
          <line x1={40} y1={330} x2={780} y2={330} stroke="#e5e7eb" strokeWidth={1} strokeDasharray="6,4" />
          <line x1={40} y1={490} x2={780} y2={490} stroke="#e5e7eb" strokeWidth={1} strokeDasharray="6,4" />

          {/* === IDENTIFICATION === */}
          {/* Database records */}
          <Box
            x={colL - boxW / 2} y={30} w={boxW} h={boxH}
            fill={COL.id} stroke={COL.idBorder}
            lines={[t('prisma.box.dbRecords', lang)]}
            sub={n(data.dbRecords)}
          />
          {/* Other sources */}
          <Box
            x={colR - sideW / 2} y={30} w={sideW} h={boxH}
            fill={COL.id} stroke={COL.idBorder}
            lines={[t('prisma.box.otherRecords', lang)]}
            sub={n(data.otherRecords)}
          />

          {/* Arrow: DB records → Duplicates removed */}
          <Arrow x1={colL} y1={82} x2={colL} y2={155} />
          {/* Arrow: Other sources → merge to center */}
          <ElbowArrow x1={colR} y1={82} mx={colR} x2={colL + boxW / 2 + 10} y2={120} />

          {/* === SCREENING === */}
          {/* Duplicates removed */}
          <Box
            x={colL - boxW / 2} y={155} w={boxW} h={boxH}
            fill={COL.sc} stroke={COL.scBorder}
            lines={[t('prisma.box.duplicatesRemoved', lang)]}
            sub={n(data.duplicatesRemoved)}
          />

          {/* Arrow → Records screened */}
          <Arrow x1={colL} y1={207} x2={colL} y2={230} />

          {/* Records screened */}
          <Box
            x={colL - boxW / 2} y={230} w={boxW} h={boxH}
            fill={COL.sc} stroke={COL.scBorder}
            lines={[t('prisma.box.recordsScreened', lang)]}
            sub={n(data.recordsScreened)}
          />

          {/* Records excluded (right side) */}
          <Box
            x={colR - sideW / 2} y={230} w={sideW} h={boxH}
            fill={COL.sc} stroke={COL.scBorder}
            lines={[t('prisma.box.recordsExcluded', lang)]}
            sub={n(data.recordsExcluded)}
          />

          {/* Arrow → right (excluded) */}
          <Arrow x1={colL + boxW / 2} y1={256} x2={colR - sideW / 2} y2={256} />

          {/* Arrow → Full text */}
          <Arrow x1={colL} y1={282} x2={colL} y2={350} />

          {/* === ELIGIBILITY === */}
          {/* Full-text assessed */}
          <Box
            x={colL - boxW / 2} y={350} w={boxW} h={boxH}
            fill={COL.el} stroke={COL.elBorder}
            lines={[t('prisma.box.fullTextAssessed', lang)]}
            sub={n(data.fullTextAssessed)}
          />

          {/* Full-text excluded (right side) */}
          <Box
            x={colR - sideW / 2} y={350} w={sideW} h={boxH + 20}
            fill={COL.el} stroke={COL.elBorder}
            lines={[t('prisma.box.fullTextExcluded', lang), `(n = ${n(data.fullTextExcluded)})`]}
            sub={data.fullTextExcludeReasons ? data.fullTextExcludeReasons : undefined}
          />

          {/* Arrow → right (excluded full text) */}
          <Arrow x1={colL + boxW / 2} y1={376} x2={colR - sideW / 2} y2={376} />

          {/* Arrow → Qualitative */}
          <Arrow x1={colL} y1={402} x2={colL} y2={510} />

          {/* === INCLUDED === */}
          {/* Qualitative synthesis */}
          <Box
            x={colL - boxW / 2} y={510} w={boxW} h={boxH}
            fill={COL.inc} stroke={COL.incBorder}
            lines={[t('prisma.box.qualSynthesis', lang)]}
            sub={n(data.qualitativeSynthesis)}
          />

          {/* Arrow → Quantitative */}
          <Arrow x1={colL} y1={562} x2={colL + boxW / 2 + 60} y2={562} />

          {/* Quantitative synthesis */}
          <Box
            x={colR - sideW / 2} y={536} w={sideW} h={boxH}
            fill={COL.inc} stroke={COL.incBorder}
            lines={[t('prisma.box.quantSynthesis', lang)]}
            sub={n(data.quantitativeSynthesis)}
          />

          {/* Title */}
          <text x={SVG_W / 2} y={SVG_H - 4} textAnchor="middle" fill="#9ca3af" fontSize={10} fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
            PRISMA 2020 Flow Diagram — Generated by MetaReview
          </text>
        </svg>
      </div>
    </div>
  );
}

const dlBtnStyle: React.CSSProperties = {
  padding: '7px 14px',
  background: '#f3f4f6',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
};
