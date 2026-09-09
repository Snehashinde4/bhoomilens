import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Labelled, Select, TextInput } from '@/components/ui/Form';
import { StatTile } from '@/components/kpi/KpiCard';
import { MapView, type MapHandle, type MapLayerSpec } from '@/components/map/MapView';
import { getDataset } from '@/data/dataset';
import { useScope } from '@/hooks/useScope';
import { filterByGeo } from '@/services/analytics';
import { THEME } from '@/config/constants';
import {
  downloadGeoJson,
  parcelsToGeoJson,
  watershedsToGeoJson,
  type FeatureCollection,
} from '@/lib/geo';
import { formatArea, formatDate } from '@/lib/format';
import { parseJsonFile } from '@/lib/export';
import { round } from '@/lib/stats';

const MAX_RENDER = 1200;

export default function GisPage() {
  const navigate = useNavigate();
  const scope = useScope();
  const dataset = getDataset();
  const mapRef = useRef<MapHandle>(null);
  const [params] = useSearchParams();

  const [satellite, setSatellite] = useState(false);
  const [drawMode, setDrawMode] = useState<'none' | 'polygon' | 'measure'>('none');
  const [measurement, setMeasurement] = useState<{ area: number; perimeter: number } | null>(null);
  const [search, setSearch] = useState(params.get('parcel') ?? params.get('project') ?? '');
  const [searchKind, setSearchKind] = useState<'parcel' | 'survey' | 'khasra' | 'village' | 'project'>('parcel');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'high' | 'critical'>('ALL');
  const [imageryYear, setImageryYear] = useState(2026);
  const [imported, setImported] = useState<FeatureCollection | null>(null);
  const [visible, setVisible] = useState<Record<string, boolean>>({
    states: true,
    districts: true,
    parcels: true,
    mismatch: true,
    projects: true,
    highRisk: true,
    compensation: false,
    possession: false,
    rr: false,
    legal: true,
    watershed: false,
    water: false,
    vegetation: false,
    encroachment: false,
    inspections: false,
    imported: true,
  });

  const parcels = useMemo(() => filterByGeo(dataset.parcels, scope), [dataset.parcels, scope]);
  const projects = useMemo(
    () =>
      dataset.projects.filter(
        (p) =>
          (!scope.state || p.state === scope.state) && (!scope.district || p.district === scope.district),
      ),
    [dataset.projects, scope],
  );
  const watersheds = useMemo(() => filterByGeo(dataset.watersheds, scope), [dataset.watersheds, scope]);

  const rendered = parcels.slice(0, MAX_RENDER);

  const layers: MapLayerSpec[] = useMemo(() => {
    const point = (
      features: Array<{ id: string; coords: [number, number]; props: Record<string, unknown> }>,
    ): FeatureCollection => ({
      type: 'FeatureCollection',
      features: features.map((f) => ({
        type: 'Feature' as const,
        id: f.id,
        geometry: { type: 'Point' as const, coordinates: f.coords },
        properties: f.props,
      })),
    });

    const stateBoundaries: FeatureCollection = {
      type: 'FeatureCollection',
      features: dataset.states.map((s) => ({
        type: 'Feature' as const,
        id: s.code,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [circle(s.center, 1.9)],
        },
        properties: { name: s.name, code: s.code, zone: s.zone, districts: s.districts.length },
      })),
    };

    const districtBoundaries: FeatureCollection = {
      type: 'FeatureCollection',
      features: dataset.districts
        .filter((d) => (!scope.state || d.state === scope.state))
        .map((d) => ({
          type: 'Feature' as const,
          id: d.code,
          geometry: { type: 'Polygon' as const, coordinates: [circle(d.center, 0.55)] },
          properties: { name: d.name, state: d.state, tehsils: d.tehsils.length },
        })),
    };

    const projectBoundaries: FeatureCollection = {
      type: 'FeatureCollection',
      features: projects.slice(0, 400).map((p) => ({
        type: 'Feature' as const,
        id: p.code,
        geometry: { type: 'Polygon' as const, coordinates: [circle(p.centroid, 0.16)] },
        properties: {
          code: p.code,
          name: p.name,
          stage: p.currentStage,
          risk: p.riskLevel,
          delayProbability: p.delayProbability,
        },
      })),
    };

    return [
      {
        id: 'states',
        label: 'State boundaries',
        group: 'administrative',
        visible: visible.states,
        kind: 'polygon',
        data: stateBoundaries,
        style: { color: THEME.inkDeep, weight: 1.6, fillOpacity: 0.02, dashArray: '6 3' },
        popup: (p) => `<b>${p.name}</b><br/>${p.zone} zone · ${p.districts} districts`,
      },
      {
        id: 'districts',
        label: 'District boundaries',
        group: 'administrative',
        visible: visible.districts,
        kind: 'polygon',
        data: districtBoundaries,
        style: { color: THEME.ink, weight: 0.9, fillOpacity: 0.02, dashArray: '3 3' },
        popup: (p) => `<b>${p.name}</b><br/>${p.state} · ${p.tehsils} tehsils`,
      },
      {
        id: 'parcels',
        label: `Survey / khasra parcels (${rendered.length})`,
        group: 'cadastral',
        visible: visible.parcels,
        kind: 'polygon',
        data: parcelsToGeoJson(rendered),
        style: { color: '#8a7c66', weight: 0.7, fillColor: THEME.sand, fillOpacity: 0.28 },
        popup: (p) =>
          `<b>${p.parcelId}</b><br/>Owner: ${p.owner}<br/>Survey: ${p.surveyNumber} · Khasra: ${p.khasraNumber}<br/>Recorded ${p.area} ha · GIS ${p.gisArea} ha<br/>${p.landType} · ${p.legalStatus}`,
        onFeatureClick: (p) => navigate(`/twins/${p.parcelId}`),
      },
      {
        id: 'mismatch',
        label: 'GIS mismatch parcels',
        group: 'cadastral',
        visible: visible.mismatch,
        kind: 'polygon',
        data: parcelsToGeoJson(
          parcels.filter((p) => Math.abs(p.area - p.gisArea) / p.area > 0.12).slice(0, 400),
        ),
        style: { color: THEME.red, weight: 1.6, fillColor: THEME.red, fillOpacity: 0.18 },
        popup: (p) => `<b>${p.parcelId}</b><br/>Area deviation ${p.areaMismatchPercent}%`,
      },
      {
        id: 'legal',
        label: 'Legal-conflict parcels',
        group: 'cadastral',
        visible: visible.legal,
        kind: 'polygon',
        data: parcelsToGeoJson(parcels.filter((p) => p.legalStatus !== 'Clear').slice(0, 400)),
        style: { color: '#96281b', weight: 1.4, fillColor: '#96281b', fillOpacity: 0.16 },
        popup: (p) => `<b>${p.parcelId}</b><br/>Legal status: ${p.legalStatus}`,
      },
      {
        id: 'projects',
        label: 'Acquisition project boundaries',
        group: 'project',
        visible: visible.projects,
        kind: 'polygon',
        data: projectBoundaries,
        style: { color: THEME.teal, weight: 1.8, fillColor: THEME.teal, fillOpacity: 0.1 },
        popup: (p) => `<b>${p.name}</b><br/>${p.code} · stage ${p.stage}<br/>Risk: ${p.risk}`,
        onFeatureClick: (p) => navigate(`/projects/${p.code}`),
      },
      {
        id: 'highRisk',
        label: 'High-risk project markers',
        group: 'project',
        visible: visible.highRisk,
        kind: 'point',
        data: point(
          projects
            .filter((p) => (riskFilter === 'ALL' ? p.riskLevel === 'high' || p.riskLevel === 'critical' : p.riskLevel === riskFilter))
            .slice(0, 400)
            .map((p) => ({
              id: p.code,
              coords: p.centroid,
              props: { code: p.code, name: p.name, risk: p.riskLevel, delay: p.delayProbability },
            })),
        ),
        style: { color: THEME.red, weight: 2, fillColor: THEME.red },
        popup: (p) => `<b>${p.name}</b><br/>${p.code} · ${p.risk} risk · delay probability ${p.delay}%`,
        onFeatureClick: (p) => navigate(`/projects/${p.code}`),
      },
      {
        id: 'compensation',
        label: 'Compensation progress',
        group: 'project',
        visible: visible.compensation,
        kind: 'polygon',
        data: parcelsToGeoJson(parcels.filter((p) => p.acquisitionStatus === 'Compensated').slice(0, 400)),
        style: { color: THEME.green, weight: 1, fillColor: THEME.green, fillOpacity: 0.2 },
        popup: (p) => `<b>${p.parcelId}</b><br/>Compensation recorded`,
      },
      {
        id: 'possession',
        label: 'Possession status',
        group: 'project',
        visible: visible.possession,
        kind: 'polygon',
        data: parcelsToGeoJson(parcels.filter((p) => p.possessionStatus === 'Complete').slice(0, 400)),
        style: { color: THEME.blue, weight: 1, fillColor: THEME.blue, fillOpacity: 0.2 },
        popup: (p) => `<b>${p.parcelId}</b><br/>Possession complete`,
      },
      {
        id: 'rr',
        label: 'R&R sites',
        group: 'project',
        visible: visible.rr,
        kind: 'point',
        data: point(
          projects.slice(0, 120).map((p) => ({
            id: `rr-${p.code}`,
            coords: [p.centroid[0] + 0.05, p.centroid[1] + 0.05] as [number, number],
            props: { name: `${p.name} resettlement site`, progress: p.rrProgressPercent },
          })),
        ),
        style: { color: THEME.olive, weight: 2, fillColor: THEME.olive },
        popup: (p) => `<b>${p.name}</b><br/>R&R progress ${p.progress}%`,
      },
      {
        id: 'watershed',
        label: 'Watershed boundaries',
        group: 'environment',
        visible: visible.watershed,
        kind: 'polygon',
        data: watershedsToGeoJson(watersheds),
        style: { color: THEME.teal, weight: 1.4, fillColor: THEME.teal, fillOpacity: 0.12, dashArray: '5 3' },
        popup: (p) => `<b>${p.name}</b><br/>${p.code} · ${p.areaHa} ha<br/>Erosion risk ${p.erosionRiskAfter}`,
      },
      {
        id: 'water',
        label: 'Water bodies and drainage',
        group: 'environment',
        visible: visible.water,
        kind: 'polygon',
        data: parcelsToGeoJson(parcels.filter((p) => p.landType === 'Water Body').slice(0, 300)),
        style: { color: '#3d7ea6', weight: 1.2, fillColor: '#5fa8d3', fillOpacity: 0.45 },
        popup: (p) => `<b>${p.parcelId}</b><br/>Recorded water body · ${p.area} ha`,
      },
      {
        id: 'vegetation',
        label: 'Vegetation and forest cover',
        group: 'environment',
        visible: visible.vegetation,
        kind: 'polygon',
        data: parcelsToGeoJson(parcels.filter((p) => p.landType === 'Forest').slice(0, 300)),
        style: { color: THEME.olive, weight: 1, fillColor: THEME.olive, fillOpacity: 0.35 },
        popup: (p) => `<b>${p.parcelId}</b><br/>Forest classification`,
      },
      {
        id: 'encroachment',
        label: 'Encroachment alerts',
        group: 'environment',
        visible: visible.encroachment,
        kind: 'point',
        data: point(
          dataset.inspections
            .filter((i) => i.encroachmentObserved)
            .slice(0, 300)
            .map((i) => ({
              id: i.code,
              coords: i.photographs[0]?.location ?? [78, 22],
              props: { code: i.code, parcel: i.parcelId, findings: i.findings },
            })),
        ),
        style: { color: THEME.amber, weight: 2, fillColor: THEME.amber },
        popup: (p) => `<b>${p.code}</b><br/>Parcel ${p.parcel}<br/>${p.findings}`,
      },
      {
        id: 'inspections',
        label: 'Field photographs',
        group: 'evidence',
        visible: visible.inspections,
        kind: 'point',
        data: point(
          dataset.inspections.slice(0, 400).flatMap((i) =>
            i.photographs.map((ph) => ({
              id: ph.id,
              coords: ph.location,
              props: { caption: ph.caption, source: ph.source, captured: formatDate(ph.capturedOn), confidence: ph.confidence },
            })),
          ),
        ),
        style: { color: '#a8577a', weight: 1.5, fillColor: '#a8577a' },
        popup: (p) => `<b>${p.caption}</b><br/>${p.source} · ${p.captured}<br/>Confidence ${p.confidence}%`,
      },
      ...(imported
        ? [
            {
              id: 'imported',
              label: 'Imported GeoJSON',
              group: 'cadastral' as const,
              visible: visible.imported,
              kind: 'polygon' as const,
              data: imported,
              style: { color: '#7b6ca6', weight: 2, fillColor: '#7b6ca6', fillOpacity: 0.2 },
              popup: (p: Record<string, unknown>) => `<b>Imported feature</b><br/>${JSON.stringify(p).slice(0, 160)}`,
            },
          ]
        : []),
    ];
  }, [dataset, parcels, projects, watersheds, rendered, visible, riskFilter, imported, navigate, scope.state]);

  const runSearch = () => {
    const q = search.trim().toLowerCase();
    if (!q) return;
    if (searchKind === 'project') {
      const project = projects.find((p) => p.code.toLowerCase() === q || p.name.toLowerCase().includes(q));
      if (project) mapRef.current?.flyTo(project.centroid[1], project.centroid[0], 12);
      return;
    }
    const parcel = parcels.find((p) => {
      if (searchKind === 'parcel') return p.parcelId.toLowerCase() === q;
      if (searchKind === 'survey') return p.surveyNumber.toLowerCase() === q;
      if (searchKind === 'khasra') return p.khasraNumber.toLowerCase() === q;
      return p.village.toLowerCase().includes(q);
    });
    if (parcel) mapRef.current?.flyTo(parcel.centroid[1], parcel.centroid[0], 16);
  };

  const groups: Array<{ key: MapLayerSpec['group']; label: string }> = [
    { key: 'administrative', label: 'Administrative' },
    { key: 'cadastral', label: 'Cadastral' },
    { key: 'project', label: 'Acquisition' },
    { key: 'environment', label: 'Environment' },
    { key: 'evidence', label: 'Field evidence' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="GIS Explorer"
        description="Cadastral, administrative, acquisition and environmental layers rendered from GeoJSON. Draw, measure, compare boundaries and open any parcel directly from the map."
        trail={[{ label: 'GIS Explorer' }]}
        actions={
          <>
            <button
              className="btn-secondary"
              onClick={() => downloadGeoJson(parcelsToGeoJson(rendered), `bhoomilens-parcels-${scope.district ?? scope.state ?? 'national'}`)}
            >
              Export GeoJSON
            </button>
            <label className="btn-secondary cursor-pointer">
              Import GeoJSON
              <input
                type="file"
                accept=".geojson,.json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fc = await parseJsonFile<FeatureCollection>(file);
                  setImported(fc);
                  setVisible((v) => ({ ...v, imported: true }));
                }}
              />
            </label>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Parcels in scope" value={parcels.length.toLocaleString('en-IN')} hint={`${rendered.length} rendered`} />
        <StatTile label="Projects" value={String(projects.length)} />
        <StatTile label="Watersheds" value={String(watersheds.length)} />
        <StatTile label="GIS mismatch" value={String(parcels.filter((p) => Math.abs(p.area - p.gisArea) / p.area > 0.12).length)} tone="red" />
        <StatTile label="Disputed parcels" value={String(parcels.filter((p) => p.legalStatus !== 'Clear').length)} tone="amber" />
        <StatTile label="Total recorded area" value={formatArea(round(parcels.reduce((s, p) => s + p.area, 0), 0), 0)} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[280px_1fr]">
        <Card title="Layer control" subtitle="Toggle layers, search and measure">
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto] gap-1.5">
              <Labelled label="Search">
                <TextInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                  placeholder="BL-184"
                />
              </Labelled>
              <div className="flex items-end">
                <button className="btn-teal" onClick={runSearch}>
                  Go
                </button>
              </div>
            </div>
            <Select
              className="text-2xs"
              aria-label="Search by"
              value={searchKind}
              onChange={(e) => setSearchKind(e.target.value as typeof searchKind)}
              options={[
                { value: 'parcel', label: 'By parcel ID' },
                { value: 'survey', label: 'By survey number' },
                { value: 'khasra', label: 'By khasra number' },
                { value: 'village', label: 'By village' },
                { value: 'project', label: 'By project' },
              ]}
            />

            {groups.map((g) => (
              <div key={g.key}>
                <p className="mb-1 text-2xs font-bold uppercase tracking-wide text-muted">{g.label}</p>
                <div className="space-y-1">
                  {layers
                    .filter((l) => l.group === g.key)
                    .map((l) => (
                      <label key={l.id} className="flex items-center gap-2 text-[12.5px]">
                        <input
                          type="checkbox"
                          checked={visible[l.id] ?? false}
                          onChange={(e) => setVisible((v) => ({ ...v, [l.id]: e.target.checked }))}
                        />
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: l.style.fillColor ?? l.style.color }} />
                        <span className="truncate">{l.label}</span>
                      </label>
                    ))}
                </div>
              </div>
            ))}

            <div>
              <p className="mb-1 text-2xs font-bold uppercase tracking-wide text-muted">Tools</p>
              <div className="flex flex-wrap gap-1">
                <button
                  className={drawMode === 'polygon' ? 'btn-teal py-1 text-2xs' : 'btn-secondary py-1 text-2xs'}
                  onClick={() => setDrawMode((m) => (m === 'polygon' ? 'none' : 'polygon'))}
                >
                  Draw polygon
                </button>
                <button
                  className={drawMode === 'measure' ? 'btn-teal py-1 text-2xs' : 'btn-secondary py-1 text-2xs'}
                  onClick={() => setDrawMode((m) => (m === 'measure' ? 'none' : 'measure'))}
                >
                  Measure
                </button>
                <button
                  className="btn-secondary py-1 text-2xs"
                  onClick={() => {
                    mapRef.current?.clearDrawing();
                    setMeasurement(null);
                  }}
                >
                  Clear
                </button>
                <button
                  className={satellite ? 'btn-teal py-1 text-2xs' : 'btn-secondary py-1 text-2xs'}
                  onClick={() => setSatellite((s) => !s)}
                >
                  Satellite
                </button>
                <button
                  className="btn-secondary py-1 text-2xs"
                  onClick={() => mapRef.current?.map()?.getContainer().requestFullscreen?.()}
                >
                  Full screen
                </button>
              </div>
              {drawMode !== 'none' && (
                <p className="mt-1 text-2xs text-muted">
                  Click to add vertices, double-click to finish.
                </p>
              )}
              {measurement && (
                <div className="mt-1.5 rounded border border-teal/40 bg-teal/8 p-2">
                  <p className="metric text-[13px]">Area: {measurement.area.toFixed(2)} ha</p>
                  <p className="metric text-2xs text-muted">Perimeter: {measurement.perimeter.toFixed(2)} km</p>
                </div>
              )}
            </div>

            <div>
              <Labelled label={`Imagery year: ${imageryYear}`} hint="Time-based imagery slider (synthetic reference)">
                <input
                  type="range"
                  min={2018}
                  max={2026}
                  value={imageryYear}
                  className="w-full accent-teal"
                  aria-label="Imagery year"
                  onChange={(e) => setImageryYear(Number(e.target.value))}
                />
              </Labelled>
            </div>

            <Select
              className="text-2xs"
              aria-label="Filter project markers by risk"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as typeof riskFilter)}
              options={[
                { value: 'ALL', label: 'High and critical markers' },
                { value: 'critical', label: 'Critical only' },
                { value: 'high', label: 'High only' },
              ]}
            />

            <div className="rounded border border-line/60 bg-paper/40 p-2">
              <p className="text-2xs font-bold uppercase text-muted">Legend</p>
              <ul className="mt-1 space-y-0.5 text-2xs text-muted">
                <li><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: THEME.sand }} />Cadastral parcel</li>
                <li><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: THEME.red }} />Risk / mismatch</li>
                <li><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: THEME.teal }} />Watershed / project</li>
                <li><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: THEME.olive }} />Vegetation</li>
                <li><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: THEME.inkDeep }} />Administrative boundary</li>
              </ul>
            </div>
          </div>
        </Card>

        <Card dense title="Map workspace" subtitle={`Base map: ${satellite ? 'satellite imagery' : 'street basemap'} · imagery reference year ${imageryYear}`}>
          <MapView
            ref={mapRef}
            layers={layers}
            satellite={satellite}
            drawMode={drawMode}
            onDrawComplete={(area, perimeter) => setMeasurement({ area, perimeter })}
            height={620}
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-line/60 px-3 py-2">
            <Badge tone="neutral">Rendering capped at {MAX_RENDER} parcels for performance</Badge>
            <Badge tone="blue">Click a parcel to open its land digital twin</Badge>
            <Badge tone="teal">Click a project marker to open the project profile</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}

/** Generates a simple ring around a centre for administrative reference outlines. */
function circle(center: [number, number], radiusDeg: number, points = 24): Array<[number, number]> {
  return Array.from({ length: points + 1 }, (_, i) => {
    const angle = (i / points) * Math.PI * 2;
    return [
      round(center[0] + Math.cos(angle) * radiusDeg, 4),
      round(center[1] + Math.sin(angle) * radiusDeg * 0.86, 4),
    ] as [number, number];
  });
}
