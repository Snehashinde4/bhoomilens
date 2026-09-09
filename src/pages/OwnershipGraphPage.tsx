import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Labelled, Select, TextInput } from '@/components/ui/Form';
import { EChart, type EChartHandle } from '@/components/charts/EChart';
import { graphOption } from '@/components/charts/presets';
import { buildOwnerGraph, buildParcelGraph, NODE_COLORS, type EdgeKind, type OwnershipGraph } from '@/graph/ownershipGraph';
import { getDataset } from '@/data/dataset';
import { downloadBlob } from '@/lib/export';
import { AnomalyDisclaimer } from '@/components/ui/Disclaimers';

const EDGE_KINDS: EdgeKind[] = [
  'OWNS',
  'PREVIOUSLY_OWNED',
  'MUTATED_TO',
  'REGISTERED_UNDER',
  'LOCATED_IN',
  'ACQUIRED_FOR',
  'COMPENSATED_BY',
  'DISPUTED_BY',
  'VALIDATED_AGAINST',
  'OVERLAPS_WITH',
  'SUPPORTED_BY',
];

export default function OwnershipGraphPage() {
  const navigate = useNavigate();
  const dataset = getDataset();
  const [params, setParams] = useSearchParams();
  const chartRef = useRef<EChartHandle>(null);

  const [mode, setMode] = useState<'parcel' | 'owner'>('parcel');
  const [query, setQuery] = useState(params.get('parcel') ?? 'BL-184');
  const [activeEdges, setActiveEdges] = useState<EdgeKind[]>(EDGE_KINDS);
  const [conflictsOnly, setConflictsOnly] = useState(false);
  const [selectedNode, setSelectedNode] = useState<OwnershipGraph['nodes'][number] | null>(null);

  const graph = useMemo<OwnershipGraph>(() => {
    if (mode === 'owner') return buildOwnerGraph(query);
    return buildParcelGraph(query.toUpperCase());
  }, [mode, query]);

  const filtered = useMemo(() => {
    const edges = graph.edges.filter(
      (e) => activeEdges.includes(e.kind) && (!conflictsOnly || e.conflict),
    );
    const keep = new Set(edges.flatMap((e) => [e.source, e.target]));
    const nodes = graph.nodes.filter((n) => keep.has(n.id) || (!conflictsOnly && edges.length === 0));
    return { nodes: nodes.length ? nodes : graph.nodes, edges };
  }, [graph, activeEdges, conflictsOnly]);

  const categories = [...new Set(filtered.nodes.map((n) => n.kind))];
  const conflictCount = graph.edges.filter((e) => e.conflict).length;

  const suggestions = useMemo(() => {
    if (mode === 'owner') return dataset.owners.slice(0, 12).map((o) => o.name);
    return dataset.parcels
      .filter((p) => p.legalStatus !== 'Clear' || Math.abs(p.area - p.gisArea) / p.area > 0.12)
      .slice(0, 12)
      .map((p) => p.parcelId);
  }, [mode, dataset]);

  const exportImage = () => {
    const url = chartRef.current?.getPngDataUrl();
    if (!url) return;
    fetch(url)
      .then((r) => r.blob())
      .then((b) => downloadBlob(b, `ownership-graph-${query}.png`));
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ownership and Conflict Knowledge Graph"
        description="Explore how owners, parcels, mutations, registrations, projects, compensation and legal cases connect. Conflicting relationships are highlighted in red."
        trail={[{ label: 'Ownership Graph' }]}
        actions={
          <>
            <button className="btn-secondary" onClick={exportImage}>
              Export graph image
            </button>
            {mode === 'parcel' && (
              <button className="btn-primary" onClick={() => navigate(`/twins/${query.toUpperCase()}`)}>
                Open parcel profile
              </button>
            )}
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-[280px_1fr]">
        <Card title="Graph controls">
          <div className="space-y-3">
            <Labelled label="Search mode">
              <Select
                value={mode}
                aria-label="Graph search mode"
                onChange={(e) => setMode(e.target.value as 'parcel' | 'owner')}
                options={[
                  { value: 'parcel', label: 'By parcel' },
                  { value: 'owner', label: 'By owner' },
                ]}
              />
            </Labelled>

            <Labelled label={mode === 'parcel' ? 'Parcel identifier' : 'Owner name'}>
              <TextInput
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (mode === 'parcel') setParams({ parcel: e.target.value });
                }}
                placeholder={mode === 'parcel' ? 'BL-184' : 'Ram Lal Meena'}
              />
            </Labelled>

            <div>
              <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted">Suggestions</p>
              <div className="flex flex-wrap gap-1">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="chip border-line bg-paper text-muted hover:border-teal hover:text-teal"
                    onClick={() => {
                      setQuery(s);
                      if (mode === 'parcel') setParams({ parcel: s });
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-2xs font-semibold uppercase tracking-wide text-muted">Relationships</p>
                <button
                  type="button"
                  className="text-2xs text-teal hover:underline"
                  onClick={() => setActiveEdges(activeEdges.length === EDGE_KINDS.length ? [] : EDGE_KINDS)}
                >
                  {activeEdges.length === EDGE_KINDS.length ? 'Clear all' : 'Select all'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {EDGE_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`chip ${
                      activeEdges.includes(k)
                        ? 'border-teal/50 bg-teal/12 text-teal'
                        : 'border-line bg-paper text-muted'
                    }`}
                    onClick={() =>
                      setActiveEdges((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))
                    }
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={conflictsOnly}
                onChange={(e) => setConflictsOnly(e.target.checked)}
              />
              Highlight conflicts only
            </label>

            <div className="rounded border border-line/60 bg-paper/40 p-2">
              <p className="text-2xs font-semibold uppercase text-muted">Graph statistics</p>
              <p className="metric text-2xs">{graph.nodes.length} nodes · {graph.edges.length} edges</p>
              <p className="metric text-2xs text-signal-red">{conflictCount} conflicting relationship(s)</p>
            </div>

            <div>
              <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted">Node legend</p>
              <div className="flex flex-wrap gap-1">
                {categories.map((c) => (
                  <span key={c} className="chip border-line bg-surface text-muted">
                    <span className="h-2 w-2 rounded-full" style={{ background: NODE_COLORS[c] }} />
                    {c.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>

            <AnomalyDisclaimer />
          </div>
        </Card>

        <div className="space-y-3">
          <Card
            dense
            title={`Knowledge graph · ${query}`}
            subtitle="Scroll to zoom, drag to pan, drag a node to reposition, click a node for details"
          >
            {filtered.nodes.length === 0 ? (
              <p className="px-3 py-10 text-center text-[13px] text-muted">
                No graph could be built for &ldquo;{query}&rdquo;. Try one of the suggestions.
              </p>
            ) : (
              <EChart
                ref={chartRef}
                option={graphOption(
                  filtered.nodes.map((n) => ({
                    id: n.id,
                    name: n.name,
                    symbolSize: n.kind === 'parcel' || n.kind === 'owner' ? 34 : 20,
                    color: NODE_COLORS[n.kind],
                    category: categories.indexOf(n.kind),
                    conflict: n.conflict,
                  })),
                  filtered.edges.map((e) => ({
                    source: e.source,
                    target: e.target,
                    label: e.kind,
                    conflict: e.conflict,
                  })),
                  categories,
                )}
                height={540}
                ariaLabel="Ownership knowledge graph"
                onEvent={{
                  click: (p) => {
                    const params2 = p as { dataType?: string; data?: { id?: string } };
                    if (params2.dataType !== 'node') return;
                    const node = graph.nodes.find((n) => n.id === params2.data?.id);
                    if (node) setSelectedNode(node);
                  },
                }}
              />
            )}
          </Card>

          {selectedNode && (
            <Card title={`${selectedNode.name}`} subtitle={selectedNode.kind.replace(/_/g, ' ')}>
              <p className="text-[13px]">{selectedNode.detail}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedNode.conflict && <Badge tone="red">Conflicting relationship</Badge>}
                {selectedNode.route && (
                  <button className="btn-secondary py-1 text-2xs" onClick={() => navigate(selectedNode.route!)}>
                    Open record
                  </button>
                )}
                <button className="btn-ghost py-1 text-2xs" onClick={() => setSelectedNode(null)}>
                  Close
                </button>
              </div>

              <div className="mt-3">
                <p className="text-2xs font-semibold uppercase text-muted">Connected relationships</p>
                <ul className="mt-1 space-y-0.5">
                  {graph.edges
                    .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                    .map((e, i) => {
                      const other = e.source === selectedNode.id ? e.target : e.source;
                      const node = graph.nodes.find((n) => n.id === other);
                      return (
                        <li key={i} className="text-2xs">
                          <span className={e.conflict ? 'text-signal-red' : 'text-muted'}>{e.kind}</span> →{' '}
                          {node?.name ?? other}
                        </li>
                      );
                    })}
                </ul>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
