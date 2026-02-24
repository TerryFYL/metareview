import { useEffect, useRef, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import type { Study } from '../lib/types';
import { t, type Lang } from '../lib/i18n';
import { useUIStore, type ColorScheme } from '../store';

interface NetworkGraphProps {
  studies: Study[];
  lang: Lang;
  width?: number;
  height?: number;
}

interface NetworkNode {
  id: string;
  label: string;
  /** Number of study arms involving this intervention */
  studyCount: number;
}

interface NetworkEdge {
  source: string;
  target: string;
  /** Number of direct comparisons */
  weight: number;
  /** Study names for tooltip */
  studies: string[];
}

const COLORS: Record<ColorScheme, { node: string; nodeStroke: string; edge: string; label: string; bg: string; highlight: string }> = {
  default: { node: '#3b82f6', nodeStroke: '#1d4ed8', edge: '#94a3b8', label: '#1e293b', bg: '#f8fafc', highlight: '#f59e0b' },
  bw: { node: '#555555', nodeStroke: '#000000', edge: '#888888', label: '#000000', bg: '#ffffff', highlight: '#999999' },
  colorblind: { node: '#0072B2', nodeStroke: '#004A75', edge: '#999999', label: '#1e293b', bg: '#f8fafc', highlight: '#E69F00' },
};

/** Build network data from studies using subgroups as intervention labels.
 *  Each unique subgroup becomes a node, and studies within a subgroup
 *  form edges between the intervention (subgroup) and the common comparator.
 *  If no subgroups, uses study names to infer "intervention vs comparison" pairs.
 */
function buildNetwork(studies: Study[]): { nodes: NetworkNode[]; edges: NetworkEdge[] } {
  const nodeMap = new Map<string, NetworkNode>();
  const edgeMap = new Map<string, NetworkEdge>();

  // Strategy: Use PICO-style — if studies have subgroups, each subgroup is an "arm"
  // connected to a central "Control" node. Otherwise try to extract from study data.
  const hasSubgroups = studies.some((s) => s.subgroup && s.subgroup.trim() !== '');

  if (hasSubgroups) {
    // Build from subgroups
    const groups = new Map<string, Study[]>();
    for (const s of studies) {
      const grp = s.subgroup?.trim() || 'Other';
      if (!groups.has(grp)) groups.set(grp, []);
      groups.get(grp)!.push(s);
    }

    const groupNames = Array.from(groups.keys());
    // Each group is a node
    for (const name of groupNames) {
      nodeMap.set(name, { id: name, label: name, studyCount: groups.get(name)!.length });
    }

    // Create edges between all subgroup pairs
    for (let i = 0; i < groupNames.length; i++) {
      for (let j = i + 1; j < groupNames.length; j++) {
        const a = groupNames[i];
        const b = groupNames[j];
        const key = [a, b].sort().join('||');
        if (!edgeMap.has(key)) {
          edgeMap.set(key, { source: a, target: b, weight: 1, studies: [] });
        }
        const edge = edgeMap.get(key)!;
        // Weight = min studies in either group (proxy for head-to-head comparisons)
        edge.weight = Math.min(groups.get(a)!.length, groups.get(b)!.length);
        edge.studies = [...groups.get(a)!.map(s => s.name), ...groups.get(b)!.map(s => s.name)];
      }
    }
  } else {
    // No subgroups — build a simple two-node network (Intervention vs Control)
    // with each study as an edge
    const intervention = 'Intervention';
    const control = 'Control';
    nodeMap.set(intervention, { id: intervention, label: intervention, studyCount: studies.length });
    nodeMap.set(control, { id: control, label: control, studyCount: studies.length });

    const key = [intervention, control].sort().join('||');
    edgeMap.set(key, {
      source: intervention,
      target: control,
      weight: studies.length,
      studies: studies.map((s) => s.name),
    });
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}

export default function NetworkGraph({ studies, lang, width = 560, height = 480 }: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const plotSettings = useUIStore((s) => s.plotSettings);

  const network = useMemo(() => buildNetwork(studies), [studies]);

  useEffect(() => {
    if (!svgRef.current || network.nodes.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const colors = COLORS[plotSettings.colorScheme];
    const fs = plotSettings.fontSize;

    // Background
    svg.append('rect').attr('width', width).attr('height', height).attr('fill', colors.bg);
    svg.append('desc').text(t('a11y.networkGraph', lang));

    // Title
    svg.append('text')
      .attr('x', width / 2).attr('y', 22)
      .attr('text-anchor', 'middle')
      .attr('font-size', fs + 2).attr('font-weight', '600').attr('fill', colors.label)
      .text(t('network.title', lang));

    const g = svg.append('g').attr('transform', `translate(0,10)`);
    const tooltip = tooltipRef.current;

    // Node size scale based on study count
    const maxStudies = d3.max(network.nodes, (n) => n.studyCount) || 1;
    const nodeScale = d3.scaleSqrt().domain([1, maxStudies]).range([18, 40]);

    // Edge width scale
    const maxWeight = d3.max(network.edges, (e) => e.weight) || 1;
    const edgeScale = d3.scaleLinear().domain([1, maxWeight]).range([2, 8]);

    // D3 force simulation
    type SimNode = NetworkNode & d3.SimulationNodeDatum;
    type SimEdge = NetworkEdge & { source: SimNode | string; target: SimNode | string };

    const simNodes: SimNode[] = network.nodes.map((n) => ({ ...n }));
    const simEdges: SimEdge[] = network.edges.map((e) => ({ ...e }));

    const simulation = d3.forceSimulation<SimNode>(simNodes)
      .force('link', d3.forceLink<SimNode, SimEdge>(simEdges).id((d) => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2 + 10))
      .force('collision', d3.forceCollide<SimNode>().radius((d) => nodeScale(d.studyCount) + 10));

    // Draw edges
    const linkGroup = g.selectAll('.edge')
      .data(simEdges)
      .join('line')
      .attr('class', 'edge')
      .attr('stroke', colors.edge)
      .attr('stroke-width', (d) => edgeScale(d.weight))
      .attr('stroke-opacity', 0.6);

    // Edge labels (study count)
    const edgeLabels = g.selectAll('.edge-label')
      .data(simEdges)
      .join('text')
      .attr('class', 'edge-label')
      .attr('text-anchor', 'middle')
      .attr('font-size', fs - 1)
      .attr('fill', colors.edge)
      .attr('font-weight', '600')
      .text((d) => `k=${d.weight}`);

    // Draw nodes
    const nodeGroup = g.selectAll('.node')
      .data(simNodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer');

    nodeGroup.append('circle')
      .attr('r', (d) => nodeScale(d.studyCount))
      .attr('fill', colors.node)
      .attr('stroke', colors.nodeStroke)
      .attr('stroke-width', 2)
      .attr('opacity', 0.85);

    nodeGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', fs)
      .attr('font-weight', '600')
      .attr('fill', '#fff')
      .text((d) => d.label.length > 12 ? d.label.slice(0, 10) + '…' : d.label);

    // Node tooltips
    nodeGroup
      .on('mouseover', function (event, d) {
        d3.select(this).select('circle').attr('opacity', 1).attr('stroke', colors.highlight).attr('stroke-width', 3);
        if (tooltip) {
          tooltip.style.display = 'block';
          tooltip.innerHTML = `<strong>${d.label}</strong><br/>${t('network.studies', lang)}: ${d.studyCount}`;
          tooltip.style.left = `${event.offsetX + 12}px`;
          tooltip.style.top = `${event.offsetY - 10}px`;
        }
      })
      .on('mouseout', function () {
        d3.select(this).select('circle').attr('opacity', 0.85).attr('stroke', colors.nodeStroke).attr('stroke-width', 2);
        if (tooltip) tooltip.style.display = 'none';
      });

    // Edge tooltips
    linkGroup
      .on('mouseover', function (event, d) {
        d3.select(this).attr('stroke-opacity', 1).attr('stroke', colors.highlight);
        if (tooltip) {
          tooltip.style.display = 'block';
          const srcLabel = typeof d.source === 'object' ? (d.source as SimNode).label : d.source;
          const tgtLabel = typeof d.target === 'object' ? (d.target as SimNode).label : d.target;
          tooltip.innerHTML = `<strong>${srcLabel} — ${tgtLabel}</strong><br/>${t('network.comparisons', lang)}: ${d.weight}`;
          tooltip.style.left = `${event.offsetX + 12}px`;
          tooltip.style.top = `${event.offsetY - 10}px`;
        }
      })
      .on('mouseout', function () {
        d3.select(this).attr('stroke-opacity', 0.6).attr('stroke', colors.edge);
        if (tooltip) tooltip.style.display = 'none';
      });

    // Tick function
    simulation.on('tick', () => {
      linkGroup
        .attr('x1', (d) => (d.source as SimNode).x!)
        .attr('y1', (d) => (d.source as SimNode).y!)
        .attr('x2', (d) => (d.target as SimNode).x!)
        .attr('y2', (d) => (d.target as SimNode).y!);

      edgeLabels
        .attr('x', (d) => ((d.source as SimNode).x! + (d.target as SimNode).x!) / 2)
        .attr('y', (d) => ((d.source as SimNode).y! + (d.target as SimNode).y!) / 2 - 6);

      nodeGroup.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    // Drag behavior
    const drag = d3.drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodeGroup.call(drag as any);

    return () => {
      simulation.stop();
    };
  }, [network, width, height, plotSettings, lang]);

  const downloadSVG = useCallback(() => {
    if (!svgRef.current) return;
    const source = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'network-graph.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (network.nodes.length === 0) {
    return <p style={{ color: '#6b7280', fontSize: 13 }}>{t('network.noData', lang)}</p>;
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
        {t('network.desc', lang)}
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          onClick={downloadSVG}
          style={{ padding: '7px 14px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
        >
          {t('network.downloadSVG', lang)}
        </button>
      </div>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <svg ref={svgRef} width={width} height={height} role="img" aria-label={t('a11y.networkGraph', lang)} />
        <div
          ref={tooltipRef}
          style={{
            display: 'none',
            position: 'absolute',
            background: 'rgba(0,0,0,0.85)',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: 4,
            fontSize: 11,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}
        />
      </div>
      {/* Summary */}
      <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>{t('network.nodeCount', lang)}: {network.nodes.length}</span>
        <span>{t('network.edgeCount', lang)}: {network.edges.length}</span>
        <span>{t('network.totalStudies', lang)}: {studies.length}</span>
      </div>
      <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, fontStyle: 'italic' }}>
        {t('network.dragHint', lang)}
      </p>
    </div>
  );
}
