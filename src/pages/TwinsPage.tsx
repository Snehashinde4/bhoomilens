import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { ProgressBar, Select, TextInput } from '@/components/ui/Form';
import { StatTile } from '@/components/kpi/KpiCard';
import { ChartCard } from '@/components/charts/ChartCard';
import { donutOption, horizontalBarOption } from '@/components/charts/presets';
import { ScoreDisclaimer } from '@/components/ui/Disclaimers';
import { getDataset } from '@/data/dataset';
import { useScope } from '@/hooks/useScope';
import { filterByGeo } from '@/services/analytics';
import { CHART_PALETTE, THEME } from '@/config/constants';
import { formatArea } from '@/lib/format';
import { exportCsv } from '@/lib/export';
import { mean, round } from '@/lib/stats';
import type { LandClassification, Parcel } from '@/types';

export default function TwinsPage() {
  const navigate = useNavigate();
  const scope = useScope();
  const dataset = getDataset();

  const [search, setSearch] = useState('');
  const [landType, setLandType] = useState<LandClassification | 'ALL'>('ALL');
  const [trustBand, setTrustBand] = useState<'ALL' | 'low' | 'medium' | 'high'>('ALL');

  const parcels = useMemo(() => {
    const q = search.trim().toLowerCase();
    return filterByGeo(dataset.parcels, scope).filter((p) => {
      const band = p.trustScore < 55 ? 'low' : p.trustScore < 80 ? 'medium' : 'high';
      return (
        (landType === 'ALL' || p.landType === landType) &&
        (trustBand === 'ALL' || band === trustBand) &&
        (!q ||
          `${p.parcelId} ${p.surveyNumber} ${p.khasraNumber} ${p.khataNumber} ${p.owner} ${p.village}`
            .toLowerCase()
            .includes(q))
      );
    });
  }, [dataset.parcels, scope, search, landType, trustBand]);

  const landUse = useMemo(() => {
    const types: LandClassification[] = ['Agricultural', 'Non-Agricultural', 'Residential', 'Commercial', 'Government', 'Forest', 'Water Body'];
    return types.map((t) => ({ name: t, value: parcels.filter((p) => p.landType === t).length }));
  }, [parcels]);

  const trustBands = useMemo(() => {
    const bands = [
      { label: '0-40 (critical)', min: 0, max: 40 },
      { label: '41-55 (low)', min: 41, max: 55 },
      { label: '56-70 (moderate)', min: 56, max: 70 },
      { label: '71-85 (good)', min: 71, max: 85 },
      { label: '86-100 (strong)', min: 86, max: 100 },
    ];
    return bands.map((b) => ({
      label: b.label,
      count: parcels.filter((p) => p.trustScore >= b.min && p.trustScore <= b.max).length,
    }));
  }, [parcels]);

  const columns: Column<Parcel>[] = [
    { key: 'id', header: 'Parcel ID', accessor: (p) => p.parcelId, render: (p) => <span className="metric font-semibold">{p.parcelId}</span>, width: '96px' },
    { key: 'survey', header: 'Survey no.', accessor: (p) => p.surveyNumber },
    { key: 'khasra', header: 'Khasra', accessor: (p) => p.khasraNumber },
    { key: 'khata', header: 'Khata', accessor: (p) => p.khataNumber },
    { key: 'owner', header: 'Owner of record', accessor: (p) => p.owner },
    { key: 'village', header: 'Village', accessor: (p) => p.village },
    { key: 'district', header: 'District', accessor: (p) => p.district },
    { key: 'type', header: 'Classification', accessor: (p) => p.landType },
    { key: 'area', header: 'Recorded area', accessor: (p) => p.area, align: 'right', render: (p) => formatArea(p.area) },
    { key: 'gis', header: 'GIS area', accessor: (p) => p.gisArea, align: 'right', render: (p) => formatArea(p.gisArea) },
    { key: 'legal', header: 'Legal status', accessor: (p) => p.legalStatus, render: (p) => <StatusBadge status={p.legalStatus} /> },
    {
      key: 'trust',
      header: 'Trust score',
      accessor: (p) => p.trustScore,
      width: '130px',
      render: (p) => <ProgressBar value={p.trustScore} tone={p.trustScore >= 80 ? 'green' : p.trustScore >= 55 ? 'amber' : 'red'} />,
    },
    {
      key: 'health',
      header: 'Health score',
      accessor: (p) => p.healthScore,
      width: '130px',
      render: (p) => <ProgressBar value={p.healthScore} tone={p.healthScore >= 80 ? 'green' : p.healthScore >= 55 ? 'amber' : 'red'} />,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Land Digital Twins"
        description="A living digital profile for every parcel: ownership timeline, mutation chain, geometry, evidence and explainable trust and health scores."
        trail={[{ label: 'Land Digital Twins' }]}
        actions={
          <>
            <button className="btn-secondary" onClick={() => navigate('/twins/BL-184')}>
              Open reference twin BL-184
            </button>
            <button
              className="btn-secondary"
              onClick={() =>
                exportCsv(
                  parcels.slice(0, 5000).map((p) => ({
                    parcelId: p.parcelId,
                    surveyNumber: p.surveyNumber,
                    khasraNumber: p.khasraNumber,
                    khataNumber: p.khataNumber,
                    owner: p.owner,
                    area: p.area,
                    gisArea: p.gisArea,
                    village: p.village,
                    district: p.district,
                    state: p.state,
                    landType: p.landType,
                    trustScore: p.trustScore,
                    healthScore: p.healthScore,
                    legalStatus: p.legalStatus,
                    acquisitionStatus: p.acquisitionStatus,
                  })),
                  'land-digital-twins',
                )
              }
            >
              Export CSV
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Parcels in scope" value={parcels.length.toLocaleString('en-IN')} />
        <StatTile label="Mean trust score" value={String(round(mean(parcels.map((p) => p.trustScore)), 1))} tone="teal" />
        <StatTile label="Mean health score" value={String(round(mean(parcels.map((p) => p.healthScore)), 1))} />
        <StatTile label="Under dispute" value={String(parcels.filter((p) => p.legalStatus !== 'Clear').length)} tone="red" />
        <StatTile label="Area deviation > 12%" value={String(parcels.filter((p) => Math.abs(p.area - p.gisArea) / p.area > 0.12).length)} tone="amber" />
        <StatTile label="Under acquisition" value={String(parcels.filter((p) => p.projectId).length)} />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <ChartCard
          title="Land classification mix"
          subtitle="Parcels by recorded classification"
          height={260}
          isEmpty={landUse.every((l) => l.value === 0)}
          option={donutOption(landUse, { colors: CHART_PALETTE, centerValue: String(parcels.length), centerLabel: 'parcels' })}
          exportName="land-classification"
          exportRows={landUse.map((l) => ({ classification: l.name, parcels: l.value }))}
        />
        <ChartCard
          title="Trust score distribution"
          subtitle="Parcels per trust band"
          height={260}
          isEmpty={trustBands.every((b) => b.count === 0)}
          option={horizontalBarOption(
            trustBands.map((b) => b.label),
            trustBands.map((b) => b.count),
            { valueName: 'parcels', color: THEME.teal },
          )}
          exportName="trust-distribution"
          exportRows={trustBands}
          footer={<ScoreDisclaimer />}
        />
      </div>

      <Card
        dense
        title={`Parcel register (${parcels.length.toLocaleString('en-IN')})`}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <TextInput
              className="w-56 py-1 text-2xs"
              placeholder="Search parcel, survey, khasra, khata, owner…"
              value={search}
              aria-label="Search parcels"
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              className="w-40 py-1 text-2xs"
              aria-label="Filter classification"
              value={landType}
              onChange={(e) => setLandType(e.target.value as LandClassification | 'ALL')}
              options={[
                { value: 'ALL', label: 'All classifications' },
                ...['Agricultural', 'Non-Agricultural', 'Residential', 'Commercial', 'Government', 'Forest', 'Water Body'].map((v) => ({ value: v, label: v })),
              ]}
            />
            <Select
              className="w-36 py-1 text-2xs"
              aria-label="Filter trust band"
              value={trustBand}
              onChange={(e) => setTrustBand(e.target.value as typeof trustBand)}
              options={[
                { value: 'ALL', label: 'All trust bands' },
                { value: 'high', label: 'Trust ≥ 80' },
                { value: 'medium', label: 'Trust 55-79' },
                { value: 'low', label: 'Trust < 55' },
              ]}
            />
          </div>
        }
      >
        <DataTable
          rows={parcels}
          columns={columns}
          rowKey={(p) => p.id}
          pageSize={14}
          onRowClick={(p) => navigate(`/twins/${p.parcelId}`)}
        />
      </Card>
    </div>
  );
}
