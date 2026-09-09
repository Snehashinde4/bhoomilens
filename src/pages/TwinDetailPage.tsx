import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Badge, RiskBadge, SeverityBadge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/Form';
import { StatTile } from '@/components/kpi/KpiCard';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { MapView, type MapLayerSpec } from '@/components/map/MapView';
import { EChart } from '@/components/charts/EChart';
import { graphOption } from '@/components/charts/presets';
import { ScoreDisclaimer, AnomalyDisclaimer } from '@/components/ui/Disclaimers';
import { useAsync } from '@/hooks/useAsync';
import { getParcelDetail } from '@/services/api';
import { buildParcelGraph, NODE_COLORS } from '@/graph/ownershipGraph';
import { THEME } from '@/config/constants';
import { formatArea, formatCurrency, formatDate, maskIdentifier } from '@/lib/format';
import { parcelsToGeoJson } from '@/lib/geo';
import { round } from '@/lib/stats';
import type { Mutation, OwnershipRecord } from '@/types';

const TRUST_SIGNALS = [
  { key: 'ownership', label: 'Ownership consistency' },
  { key: 'mutation', label: 'Mutation continuity' },
  { key: 'registry', label: 'Registry match' },
  { key: 'authenticity', label: 'Document authenticity' },
  { key: 'duplicates', label: 'Duplicate claims' },
  { key: 'legal', label: 'Legal disputes' },
  { key: 'gis', label: 'GIS match' },
];

const HEALTH_SIGNALS = [
  { key: 'boundary', label: 'Boundary consistency' },
  { key: 'classification', label: 'Classification consistency' },
  { key: 'tax', label: 'Tax-record match' },
  { key: 'acquisition', label: 'Acquisition status' },
  { key: 'possession', label: 'Possession evidence' },
  { key: 'environment', label: 'Environmental observations' },
  { key: 'completeness', label: 'Record completeness' },
];

export default function TwinDetailPage() {
  const { parcelId = '' } = useParams();
  const navigate = useNavigate();
  const { data, loading } = useAsync(() => getParcelDetail(parcelId), [parcelId]);

  const graph = useMemo(() => buildParcelGraph(parcelId), [parcelId]);

  if (loading) {
    return (
      <Card>
        <p className="p-6 text-[13px] text-muted">Loading land digital twin…</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <div className="surface-card">
        <EmptyState
          title="Parcel not found"
          description={`No land digital twin exists for "${parcelId}" in this environment.`}
          action={
            <button className="btn-primary" onClick={() => navigate('/twins')}>
              Back to parcel register
            </button>
          }
        />
      </div>
    );
  }

  const { parcel, owner, ownership, mutations, registrations, documents, validations, alerts, inspections, project, watershed } = data;
  const deviation = round((Math.abs(parcel.area - parcel.gisArea) / parcel.area) * 100, 1);

  const layers: MapLayerSpec[] = [
    {
      id: 'parcel',
      label: 'Parcel geometry',
      group: 'cadastral',
      visible: true,
      kind: 'polygon',
      data: parcelsToGeoJson([parcel]),
      style: { color: THEME.ink, weight: 2, fillColor: THEME.teal, fillOpacity: 0.25 },
      popup: (p) => `<b>${p.parcelId}</b><br/>Recorded ${p.area} ha · GIS ${p.gisArea} ha`,
    },
  ];

  const categories = [...new Set(graph.nodes.map((n) => n.kind))];

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${parcel.parcelId} · ${parcel.owner}`}
        description={`Survey ${parcel.surveyNumber} · Khasra ${parcel.khasraNumber} · Khata ${parcel.khataNumber} · ${parcel.village}, ${parcel.tehsil}, ${parcel.district}, ${parcel.state}`}
        trail={[{ label: 'Land Digital Twins', to: '/twins' }, { label: parcel.parcelId }]}
        actions={
          <>
            <button className="btn-secondary" onClick={() => navigate(`/gis?parcel=${parcel.parcelId}`)}>
              Open in GIS Explorer
            </button>
            <button className="btn-secondary" onClick={() => navigate(`/ownership-graph?parcel=${parcel.parcelId}`)}>
              Ownership graph
            </button>
            {project && (
              <button className="btn-primary" onClick={() => navigate(`/projects/${project.code}`)}>
                Open project {project.code}
              </button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <StatTile label="Recorded area" value={formatArea(parcel.area)} />
        <StatTile label="GIS area" value={formatArea(parcel.gisArea)} tone={deviation > 12 ? 'red' : 'ink'} />
        <StatTile label="Deviation" value={`${deviation}%`} tone={deviation > 12 ? 'red' : 'green'} />
        <StatTile label="Trust score" value={String(parcel.trustScore)} tone={parcel.trustScore >= 80 ? 'green' : 'amber'} />
        <StatTile label="Health score" value={String(parcel.healthScore)} tone={parcel.healthScore >= 80 ? 'green' : 'amber'} />
        <StatTile label="Fraud-risk score" value={String(parcel.fraudRiskScore)} tone={parcel.fraudRiskScore > 60 ? 'red' : 'ink'} />
        <StatTile label="Dispute-risk score" value={String(parcel.disputeRiskScore)} tone={parcel.disputeRiskScore > 60 ? 'red' : 'ink'} />
        <StatTile label="Legal status" value={parcel.legalStatus} tone={parcel.legalStatus === 'Clear' ? 'green' : 'red'} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_1fr]">
        <Card title="Parcel summary">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
            <Field label="Parcel ID" value={parcel.parcelId} />
            <Field label="Survey number" value={parcel.surveyNumber} />
            <Field label="Khasra number" value={parcel.khasraNumber} />
            <Field label="Khata number" value={parcel.khataNumber} />
            <Field label="Current owner" value={parcel.owner} />
            <Field label="Guardian" value={owner?.guardianName ?? '—'} />
            <Field label="Ownership type" value={parcel.ownershipType} />
            <Field label="Identity reference" value={owner ? maskIdentifier(owner.aadhaarMasked, 4) : '—'} />
            <Field label="Classification" value={parcel.landType} />
            <Field label="Tax status" value={parcel.taxStatus} />
            <Field label="Acquisition status" value={parcel.acquisitionStatus} />
            <Field label="Possession status" value={parcel.possessionStatus} />
            <Field label="Linked project" value={project ? `${project.code} · ${project.name}` : 'Not under acquisition'} />
            <Field label="Watershed" value={watershed ? `${watershed.code} · ${watershed.name}` : '—'} />
            <Field label="Record created" value={formatDate(parcel.createdAt)} />
            <Field label="Last updated" value={formatDate(parcel.updatedAt)} />
          </dl>
        </Card>

        <Card dense title="Geospatial boundary" subtitle="Cadastral polygon rendered from GeoJSON">
          <MapView layers={layers} center={[parcel.centroid[1], parcel.centroid[0]]} zoom={16} height={330} />
        </Card>
      </div>

      <Tabs
        items={[
          {
            id: 'scores',
            label: 'Trust & health',
            content: (
              <div className="grid gap-3 xl:grid-cols-2">
                <ScoreCard
                  title="Land Trust Score"
                  score={parcel.trustScore}
                  signals={TRUST_SIGNALS.map((s) => ({
                    label: s.label,
                    value: signalValue(s.key, parcel, ownership, mutations, registrations.length, alerts.length),
                  }))}
                  available={[
                    `${ownership.length} ownership record(s)`,
                    `${mutations.length} mutation entr(ies)`,
                    `${registrations.length} registration record(s)`,
                    `${documents.length} supporting document(s)`,
                  ]}
                  missing={[
                    registrations.length < mutations.length ? 'Registration reference for one or more mutations' : '',
                    documents.length === 0 ? 'Scanned record of rights' : '',
                    deviation > 12 ? 'Reconciled cadastral geometry' : '',
                  ].filter(Boolean)}
                  followUp={
                    deviation > 12
                      ? 'Order a joint re-survey and reconcile the polygon against the record of rights.'
                      : parcel.legalStatus !== 'Clear'
                        ? 'Obtain the current court status and attach the order to the parcel record.'
                        : 'No follow-up required; re-evaluate at the next verification cycle.'
                  }
                  calculationDate={parcel.updatedAt}
                />
                <ScoreCard
                  title="Land Health Score"
                  score={parcel.healthScore}
                  signals={HEALTH_SIGNALS.map((s) => ({
                    label: s.label,
                    value: healthSignalValue(s.key, parcel, deviation, inspections.length, watershed ? 1 : 0),
                  }))}
                  available={[
                    `${inspections.length} field inspection(s)`,
                    watershed ? `Watershed observation ${watershed.code}` : 'No watershed linkage',
                    `${validations.length} validation record(s)`,
                  ]}
                  missing={[
                    inspections.length === 0 ? 'Field possession evidence' : '',
                    !watershed ? 'Environmental observation' : '',
                  ].filter(Boolean)}
                  followUp="Schedule a field inspection to confirm possession and encroachment status."
                  calculationDate={parcel.updatedAt}
                />
              </div>
            ),
          },
          { id: 'ownership', label: 'Ownership timeline', badge: ownership.length, content: <OwnershipTimeline records={ownership} /> },
          { id: 'mutation', label: 'Mutation timeline', badge: mutations.length, content: <MutationTimeline mutations={mutations} /> },
          {
            id: 'registration',
            label: 'Registrations',
            badge: registrations.length,
            content: (
              <Card dense title="Registration history">
                <DataTable
                  rows={registrations}
                  columns={[
                    { key: 'no', header: 'Registration number', accessor: (r) => r.registrationNumber },
                    { key: 'date', header: 'Date', accessor: (r) => r.registrationDate, render: (r) => formatDate(r.registrationDate) },
                    { key: 'office', header: 'Sub-registrar office', accessor: (r) => r.subRegistrarOffice },
                    { key: 'seller', header: 'Seller', accessor: (r) => r.seller },
                    { key: 'buyer', header: 'Buyer', accessor: (r) => r.buyer },
                    { key: 'amount', header: 'Consideration', accessor: (r) => r.considerationAmount, align: 'right', render: (r) => formatCurrency(r.considerationAmount) },
                    { key: 'stamp', header: 'Stamp duty', accessor: (r) => r.stampDuty, align: 'right', render: (r) => formatCurrency(r.stampDuty) },
                  ]}
                  rowKey={(r) => r.id}
                  pageSize={8}
                  emptyTitle="No registration records linked to this parcel"
                />
              </Card>
            ),
          },
          {
            id: 'documents',
            label: 'Documents',
            badge: documents.length,
            content: (
              <Card dense title="Document evidence">
                <DataTable
                  rows={documents}
                  columns={[
                    { key: 'code', header: 'Document', accessor: (d) => d.code, render: (d) => <span className="metric">{d.code}</span> },
                    { key: 'type', header: 'Type', accessor: (d) => d.documentType },
                    { key: 'lang', header: 'Language', accessor: (d) => d.language, render: (d) => d.language.toUpperCase() },
                    { key: 'conf', header: 'OCR confidence', accessor: (d) => d.ocrConfidence, align: 'right', render: (d) => `${d.ocrConfidence}%` },
                    { key: 'status', header: 'Status', accessor: (d) => d.status, render: (d) => <StatusBadge status={d.status} /> },
                    { key: 'uploaded', header: 'Uploaded', accessor: (d) => d.uploadedAt, render: (d) => formatDate(d.uploadedAt) },
                  ]}
                  rowKey={(d) => d.id}
                  pageSize={8}
                  onRowClick={(d) => navigate(`/digitization/${d.code}`)}
                  emptyTitle="No documents linked to this parcel"
                />
              </Card>
            ),
          },
          {
            id: 'validation',
            label: 'Validation',
            badge: validations.length,
            content: (
              <Card dense title="Validation history">
                <DataTable
                  rows={validations}
                  columns={[
                    { key: 'sev', header: 'Severity', accessor: (v) => v.severity, render: (v) => <SeverityBadge severity={v.severity} /> },
                    { key: 'title', header: 'Conflict', accessor: (v) => v.title },
                    { key: 'ocr', header: 'OCR', accessor: (v) => v.ocrValue },
                    { key: 'lrms', header: 'LRMS', accessor: (v) => v.lrmsValue },
                    { key: 'gis', header: 'GIS', accessor: (v) => v.gisValue },
                    { key: 'status', header: 'Status', accessor: (v) => v.status, render: (v) => <StatusBadge status={v.status} /> },
                  ]}
                  rowKey={(v) => v.id}
                  pageSize={8}
                  emptyTitle="No validation conflicts recorded"
                />
              </Card>
            ),
          },
          {
            id: 'risk',
            label: 'Risk & anomalies',
            badge: alerts.length,
            content: (
              <div className="space-y-3">
                <Card title="Potential anomalies" dense>
                  {alerts.length === 0 ? (
                    <p className="px-3 py-4 text-2xs text-muted">No potential anomalies flagged for this parcel.</p>
                  ) : (
                    <ul className="divide-y divide-line/40">
                      {alerts.map((a) => (
                        <li key={a.id} className="px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-semibold">
                              <span className="metric">{a.code}</span> · {a.category}
                            </span>
                            <span className="flex gap-1.5">
                              <RiskBadge level={a.severity} score={a.anomalyScore} />
                              <StatusBadge status={a.status} />
                            </span>
                          </div>
                          <p className="mt-0.5 text-2xs text-muted">{a.summary}</p>
                          <p className="mt-0.5 text-2xs text-muted">Evidence: {a.evidence.join(' · ')}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="px-3 py-2">
                    <AnomalyDisclaimer />
                  </div>
                </Card>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Card title="Fraud-risk score">
                    <ProgressBar value={parcel.fraudRiskScore} tone={parcel.fraudRiskScore > 60 ? 'red' : 'amber'} />
                    <ScoreDisclaimer className="mt-2" />
                  </Card>
                  <Card title="Dispute-risk score">
                    <ProgressBar value={parcel.disputeRiskScore} tone={parcel.disputeRiskScore > 60 ? 'red' : 'amber'} />
                    <ScoreDisclaimer className="mt-2" />
                  </Card>
                </div>
              </div>
            ),
          },
          {
            id: 'evidence',
            label: 'Field evidence',
            badge: inspections.length,
            content: (
              <Card dense title="Field inspections and geo-coded evidence">
                {inspections.length === 0 ? (
                  <p className="px-3 py-4 text-2xs text-muted">No field inspections recorded for this parcel.</p>
                ) : (
                  <ul className="divide-y divide-line/40">
                    {inspections.map((i) => (
                      <li key={i.id} className="px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-semibold">
                            <span className="metric">{i.code}</span> · {i.officer}
                          </span>
                          <StatusBadge status={i.verificationStatus} />
                        </div>
                        <p className="text-2xs text-muted">{formatDate(i.inspectedOn)} · {i.findings}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {i.photographs.map((ph) => (
                            <Badge key={ph.id} tone="blue">
                              {ph.type} · {ph.source} · {ph.confidence}%
                            </Badge>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ),
          },
          {
            id: 'graph',
            label: 'Relationship graph',
            content: (
              <Card dense title="Parcel relationship graph" subtitle="Red outlines indicate a conflicting relationship">
                <EChart
                  option={graphOption(
                    graph.nodes.map((n) => ({
                      id: n.id,
                      name: n.name,
                      symbolSize: n.kind === 'parcel' ? 34 : 20,
                      color: NODE_COLORS[n.kind],
                      category: categories.indexOf(n.kind),
                      conflict: n.conflict,
                    })),
                    graph.edges.map((e) => ({ source: e.source, target: e.target, label: e.kind, conflict: e.conflict })),
                    categories,
                  )}
                  height={460}
                  ariaLabel="Parcel relationship graph"
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}

function signalValue(
  key: string,
  parcel: import('@/types').Parcel,
  ownership: OwnershipRecord[],
  mutations: Mutation[],
  registrationCount: number,
  alertCount: number,
): number {
  switch (key) {
    case 'ownership':
      return Math.round((ownership.filter((o) => o.verified).length / Math.max(1, ownership.length)) * 100);
    case 'mutation':
      return Math.round((mutations.filter((m) => m.status === 'Approved' && !m.anomalyFlag).length / Math.max(1, mutations.length)) * 100);
    case 'registry':
      return Math.round((registrationCount / Math.max(1, mutations.length)) * 100);
    case 'authenticity':
      return Math.max(20, 100 - alertCount * 12);
    case 'duplicates':
      return alertCount > 0 ? 45 : 96;
    case 'legal':
      return parcel.legalStatus === 'Clear' ? 98 : 32;
    default:
      return Math.max(0, Math.round(100 - (Math.abs(parcel.area - parcel.gisArea) / parcel.area) * 240));
  }
}

function healthSignalValue(
  key: string,
  parcel: import('@/types').Parcel,
  deviation: number,
  inspectionCount: number,
  watershedLinked: number,
): number {
  switch (key) {
    case 'boundary':
      return Math.max(0, Math.round(100 - deviation * 2.6));
    case 'classification':
      return parcel.landType === 'Agricultural' || parcel.landType === 'Residential' ? 94 : 78;
    case 'tax':
      return parcel.taxStatus === 'Paid' ? 98 : parcel.taxStatus === 'Partially Paid' ? 62 : 34;
    case 'acquisition':
      return parcel.acquisitionStatus === 'Not Notified' ? 90 : parcel.acquisitionStatus === 'Possessed' ? 96 : 68;
    case 'possession':
      return inspectionCount > 0 ? 88 : 44;
    case 'environment':
      return watershedLinked ? 82 : 50;
    default:
      return parcel.healthScore;
  }
}

function ScoreCard({
  title,
  score,
  signals,
  available,
  missing,
  followUp,
  calculationDate,
}: {
  title: string;
  score: number;
  signals: Array<{ label: string; value: number }>;
  available: string[];
  missing: string[];
  followUp: string;
  calculationDate: string;
}) {
  const category = score >= 85 ? 'Strong' : score >= 70 ? 'Good' : score >= 55 ? 'Moderate' : score >= 40 ? 'Weak' : 'Critical';
  const confidence = Math.max(45, 100 - missing.length * 14);
  return (
    <Card title={title} subtitle={`${category} · calculated ${formatDate(calculationDate)}`}>
      <div className="flex items-end gap-4">
        <p className="metric text-[40px] font-semibold leading-none">{score}</p>
        <div className="flex-1">
          <ProgressBar value={score} tone={score >= 80 ? 'green' : score >= 55 ? 'amber' : 'red'} />
          <p className="mt-1 text-2xs text-muted">Confidence in this score: {confidence}%</p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <p className="text-2xs font-bold uppercase tracking-wide text-muted">Contributing signals</p>
        {signals.map((s) => (
          <div key={s.label}>
            <div className="flex justify-between text-2xs">
              <span>{s.label}</span>
              <span className="metric">{s.value}</span>
            </div>
            <ProgressBar value={s.value} tone={s.value >= 80 ? 'green' : s.value >= 55 ? 'amber' : 'red'} showLabel={false} height={4} />
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded border border-line/60 bg-paper/40 p-2">
          <p className="text-2xs font-bold uppercase text-muted">Available evidence</p>
          <ul className="mt-0.5 space-y-0.5 text-2xs text-muted">
            {available.map((a) => (
              <li key={a}>• {a}</li>
            ))}
          </ul>
        </div>
        <div className="rounded border border-signal-amber/40 bg-signal-amber/8 p-2">
          <p className="text-2xs font-bold uppercase text-[#8a5f10]">Missing evidence</p>
          <ul className="mt-0.5 space-y-0.5 text-2xs text-muted">
            {missing.length ? missing.map((m) => <li key={m}>• {m}</li>) : <li>• None identified</li>}
          </ul>
        </div>
      </div>

      <div className="mt-2 rounded border border-teal/40 bg-teal/8 p-2">
        <p className="text-2xs font-bold uppercase text-teal">Recommended follow-up</p>
        <p className="text-2xs">{followUp}</p>
      </div>

      <ScoreDisclaimer className="mt-2" />
    </Card>
  );
}

function OwnershipTimeline({ records }: { records: OwnershipRecord[] }) {
  return (
    <Card title="Ownership timeline" subtitle="Chronological chain of recorded holders">
      <ol className="relative space-y-4 border-l border-line pl-5">
        {records.map((r) => (
          <li key={r.id} className="relative">
            <span
              className={`absolute -left-[23px] top-1.5 h-2.5 w-2.5 rounded-full ${
                r.toYear === null ? 'bg-teal' : r.verified ? 'bg-signal-green' : 'bg-signal-red'
              }`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="metric text-[13px] font-semibold">{r.fromYear}</span>
              <span className="text-[14px] font-medium">{r.ownerName}</span>
              {r.toYear === null ? <Badge tone="teal">Current owner</Badge> : <Badge tone="neutral">until {r.toYear}</Badge>}
              {!r.verified && <Badge tone="red">Unverified</Badge>}
            </div>
            <p className="text-2xs text-muted">
              Acquisition mode: {r.acquisitionMode} · share {r.sharePercent}%
            </p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function MutationTimeline({ mutations }: { mutations: Mutation[] }) {
  const columns: Column<Mutation>[] = [
    { key: 'no', header: 'Mutation number', accessor: (m) => m.mutationNumber, render: (m) => <span className="metric">{m.mutationNumber}</span> },
    { key: 'date', header: 'Date', accessor: (m) => m.mutationDate, render: (m) => formatDate(m.mutationDate) },
    { key: 'from', header: 'From owner', accessor: (m) => m.fromOwner },
    { key: 'to', header: 'To owner', accessor: (m) => m.toOwner },
    { key: 'reason', header: 'Mode', accessor: (m) => m.reason },
    { key: 'officer', header: 'Officer', accessor: (m) => m.officer },
    { key: 'status', header: 'Status', accessor: (m) => m.status, render: (m) => <StatusBadge status={m.status} /> },
    {
      key: 'reg',
      header: 'Registration link',
      sortable: false,
      render: (m) => (m.registrationId ? <Badge tone="green">Linked</Badge> : <Badge tone="red">Missing</Badge>),
    },
    {
      key: 'anomaly',
      header: 'Anomaly',
      sortable: false,
      render: (m) => (m.anomalyFlag ? <Badge tone="amber">Potential anomaly</Badge> : <Badge tone="neutral">None</Badge>),
    },
  ];
  return (
    <Card dense title="Mutation chain">
      <DataTable rows={mutations} columns={columns} rowKey={(m) => m.id} pageSize={8} emptyTitle="No mutations recorded" />
      <div className="px-3 py-2">
        <AnomalyDisclaimer />
      </div>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="metric text-[13px]">{value}</dd>
    </div>
  );
}
