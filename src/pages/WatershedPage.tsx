import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { ProgressBar, Select } from '@/components/ui/Form';
import { StatTile } from '@/components/kpi/KpiCard';
import { ChartCard } from '@/components/charts/ChartCard';
import { MapView, type MapLayerSpec } from '@/components/map/MapView';
import { donutOption, groupedBarOption, multiLineOption, stackedBarOption } from '@/components/charts/presets';
import { getDataset } from '@/data/dataset';
import { useScope } from '@/hooks/useScope';
import { filterByGeo } from '@/services/analytics';
import { CHART_PALETTE, THEME } from '@/config/constants';
import { formatDate } from '@/lib/format';
import { watershedsToGeoJson } from '@/lib/geo';
import { exportCsv } from '@/lib/export';
import { round } from '@/lib/stats';

export default function WatershedPage() {
  const scope = useScope();
  const dataset = getDataset();

  const watersheds = useMemo(() => filterByGeo(dataset.watersheds, scope), [dataset.watersheds, scope]);
  const [code, setCode] = useState(watersheds[0]?.code ?? '');
  const watershed = watersheds.find((w) => w.code === code) ?? watersheds[0];

  const layers: MapLayerSpec[] = useMemo(
    () =>
      watershed
        ? [
            {
              id: 'watershed',
              label: 'Watershed boundary',
              group: 'environment',
              visible: true,
              kind: 'polygon',
              data: watershedsToGeoJson([watershed]),
              style: { color: THEME.teal, weight: 2, fillColor: THEME.teal, fillOpacity: 0.16 },
              popup: (p) => `<b>${p.name}</b><br/>${p.areaHa} ha`,
            },
            {
              id: 'others',
              label: 'Neighbouring watersheds',
              group: 'environment',
              visible: true,
              kind: 'polygon',
              data: watershedsToGeoJson(watersheds.filter((w) => w.code !== watershed.code).slice(0, 40)),
              style: { color: THEME.olive, weight: 1, fillColor: THEME.olive, fillOpacity: 0.08, dashArray: '4 3' },
              popup: (p) => `<b>${p.name}</b><br/>${p.code}`,
            },
          ]
        : [],
    [watershed, watersheds],
  );

  if (!watershed) {
    return (
      <Card>
        <p className="p-6 text-[13px] text-muted">No watersheds available in the current scope.</p>
      </Card>
    );
  }

  const ndviChange = round(
    watershed.ndviTrend[watershed.ndviTrend.length - 1].value - watershed.ndviTrend[0].value,
    3,
  );
  const structureTotals = watershed.structures.reduce(
    (acc, s) => ({ planned: acc.planned + s.planned, verified: acc.verified + s.verified, pending: acc.pending + s.pending }),
    { planned: 0, verified: 0, pending: 0 },
  );

  const affectedProjects = dataset.projects.filter((p) => watershed.affectedProjects.includes(p.id));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Watershed and Environmental Insights"
        description="Remote-sensing and field evidence describing land use, vegetation, moisture, conservation structures and environmental risk to acquisition parcels."
        trail={[{ label: 'Watershed Insights' }]}
        actions={
          <>
            <Select
              className="w-72 py-1.5"
              aria-label="Select watershed"
              value={watershed.code}
              onChange={(e) => setCode(e.target.value)}
              options={watersheds.map((w) => ({ value: w.code, label: `${w.code} · ${w.name}` }))}
            />
            <button
              className="btn-secondary"
              onClick={() =>
                exportCsv(
                  watersheds.map((w) => ({
                    code: w.code,
                    name: w.name,
                    state: w.state,
                    district: w.district,
                    areaHa: w.areaHa,
                    erosionRiskBefore: w.erosionRiskBefore,
                    erosionRiskAfter: w.erosionRiskAfter,
                    encroachmentAlerts: w.encroachmentAlerts,
                    interventionCoveragePercent: w.interventionCoveragePercent,
                    confidence: w.confidence,
                    verificationStatus: w.verificationStatus,
                  })),
                  'watershed-summary',
                )
              }
            >
              Export watershed data
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Watershed area" value={`${watershed.areaHa.toLocaleString('en-IN')} ha`} />
        <StatTile label="NDVI change" value={`${ndviChange > 0 ? '+' : ''}${ndviChange}`} tone={ndviChange >= 0 ? 'green' : 'red'} />
        <StatTile label="Erosion risk" value={`${watershed.erosionRiskBefore} → ${watershed.erosionRiskAfter}`} tone={watershed.erosionRiskAfter < watershed.erosionRiskBefore ? 'green' : 'red'} />
        <StatTile label="Encroachment alerts" value={String(watershed.encroachmentAlerts)} tone={watershed.encroachmentAlerts > 10 ? 'red' : 'amber'} />
        <StatTile label="Intervention coverage" value={`${watershed.interventionCoveragePercent}%`} />
        <StatTile label="Structures verified" value={`${structureTotals.verified} / ${structureTotals.planned}`} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.1fr_1fr]">
        <Card dense title={`${watershed.name}`} subtitle={`${watershed.code} · ${watershed.district}, ${watershed.state}`}>
          <MapView
            layers={layers}
            center={[watershed.boundary[0][1], watershed.boundary[0][0]]}
            zoom={11}
            height={380}
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-line/60 px-3 py-2">
            <Badge tone="blue">Observation date {formatDate(watershed.observationDate)}</Badge>
            <Badge tone="teal">Confidence {watershed.confidence}%</Badge>
            <StatusBadge status={watershed.verificationStatus} />
            <Badge tone="neutral">Coverage: {watershed.areaHa.toLocaleString('en-IN')} ha</Badge>
          </div>
        </Card>

        <div className="space-y-3">
          <ChartCard
            title="Vegetation index trend"
            subtitle="Normalised difference vegetation index by period"
            height={220}
            option={multiLineOption(
              watershed.ndviTrend.map((n) => n.period),
              [{ name: 'NDVI', data: watershed.ndviTrend.map((n) => n.value), color: THEME.olive, area: true }],
              { yName: 'NDVI' },
            )}
            exportName={`${watershed.code}-ndvi`}
            exportRows={watershed.ndviTrend}
          />
          <ChartCard
            title="Soil moisture trend"
            subtitle="Percentage volumetric soil moisture"
            height={220}
            option={multiLineOption(
              watershed.soilMoistureTrend.map((n) => n.period),
              [{ name: 'Soil moisture', data: watershed.soilMoistureTrend.map((n) => n.value), color: THEME.blue, area: true }],
              { yName: '%' },
            )}
            exportName={`${watershed.code}-soil-moisture`}
            exportRows={watershed.soilMoistureTrend}
          />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <ChartCard
          title="Land-use distribution"
          subtitle="Share of watershed area"
          height={260}
          option={donutOption(
            watershed.landUse.map((l) => ({ name: l.category, value: l.percent })),
            { colors: CHART_PALETTE, centerValue: `${watershed.areaHa.toLocaleString('en-IN')}`, centerLabel: 'hectares' },
          )}
          exportName={`${watershed.code}-land-use`}
          exportRows={watershed.landUse}
        />
        <ChartCard
          title="Water-structure verification"
          subtitle="Planned, verified and pending structures"
          height={260}
          option={stackedBarOption(
            watershed.structures.map((s) => s.type),
            [
              { name: 'Verified', data: watershed.structures.map((s) => s.verified) },
              { name: 'Pending', data: watershed.structures.map((s) => s.pending) },
            ],
          )}
          exportName={`${watershed.code}-structures`}
          exportRows={watershed.structures}
        />
        <ChartCard
          title="Erosion risk before and after intervention"
          subtitle="Lower is better"
          height={260}
          option={groupedBarOption(
            ['Erosion risk'],
            [
              { name: 'Before', data: [watershed.erosionRiskBefore], color: THEME.red },
              { name: 'After', data: [watershed.erosionRiskAfter], color: THEME.green },
            ],
            'risk index',
          )}
          exportName={`${watershed.code}-erosion`}
          exportRows={[{ before: watershed.erosionRiskBefore, after: watershed.erosionRiskAfter }]}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card title="Evidence-based insights">
          <ul className="space-y-2">
            <Insight
              title={ndviChange >= 0 ? 'Vegetation cover is recovering' : 'Vegetation cover is declining'}
              body={`NDVI moved from ${watershed.ndviTrend[0].value} to ${watershed.ndviTrend[watershed.ndviTrend.length - 1].value} across ${watershed.ndviTrend.length} observation periods.`}
              source="Multispectral satellite composite"
              date={watershed.observationDate}
              confidence={watershed.confidence}
              status={watershed.verificationStatus}
            />
            <Insight
              title={`${structureTotals.pending} conservation structures await verification`}
              body={`${structureTotals.verified} of ${structureTotals.planned} planned structures have been field-verified across ${watershed.structures.length} structure types.`}
              source="Field verification register"
              date={watershed.observationDate}
              confidence={Math.max(60, watershed.confidence - 8)}
              status={watershed.verificationStatus}
            />
            <Insight
              title={`Erosion risk reduced by ${watershed.erosionRiskBefore - watershed.erosionRiskAfter} points`}
              body={`Treatment coverage of ${watershed.interventionCoveragePercent}% is associated with the observed reduction. Association is not proof of causation.`}
              source="Erosion susceptibility model"
              date={watershed.observationDate}
              confidence={Math.max(55, watershed.confidence - 12)}
              status={watershed.verificationStatus}
            />
            {watershed.encroachmentAlerts > 0 && (
              <Insight
                title={`${watershed.encroachmentAlerts} encroachment alerts detected`}
                body="Change detection identified built-up expansion inside the watershed boundary requiring field confirmation."
                source="Change-detection analysis"
                date={watershed.observationDate}
                confidence={Math.max(50, watershed.confidence - 18)}
                status="unverified"
              />
            )}
          </ul>
        </Card>

        <Card title="Environmental risk to acquisition parcels" subtitle="Projects intersecting this watershed">
          {affectedProjects.length === 0 ? (
            <p className="text-[13px] text-muted">No acquisition projects are linked to this watershed.</p>
          ) : (
            <ul className="space-y-2">
              {affectedProjects.map((p) => (
                <li key={p.id} className="rounded border border-line/60 bg-paper/40 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold">{p.name}</span>
                    <Badge tone={p.riskLevel === 'critical' || p.riskLevel === 'high' ? 'red' : 'neutral'}>
                      {p.riskLevel}
                    </Badge>
                  </div>
                  <p className="text-2xs text-muted">
                    {p.code} · {p.district} · possession {p.possessionPercent}%
                  </p>
                  <div className="mt-1">
                    <ProgressBar value={p.completionPercent} tone="teal" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Insight({
  title,
  body,
  source,
  date,
  confidence,
  status,
}: {
  title: string;
  body: string;
  source: string;
  date: string;
  confidence: number;
  status: string;
}) {
  return (
    <li className="rounded-md border border-line/70 bg-paper/50 p-2.5">
      <p className="text-[13.5px] font-semibold">{title}</p>
      <p className="mt-0.5 text-2xs text-muted">{body}</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <Badge tone="neutral">Source: {source}</Badge>
        <Badge tone="blue">Observed {formatDate(date)}</Badge>
        <Badge tone={confidence >= 75 ? 'green' : 'amber'}>Confidence {confidence}%</Badge>
        <StatusBadge status={status} />
      </div>
    </li>
  );
}
