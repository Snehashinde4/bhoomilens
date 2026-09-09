import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { ProgressBar, TextInput } from '@/components/ui/Form';
import { StatTile } from '@/components/kpi/KpiCard';
import { ChartCard } from '@/components/charts/ChartCard';
import { MapView, type MapLayerSpec } from '@/components/map/MapView';
import { multiLineOption, stackedBarOption } from '@/components/charts/presets';
import { PredictionDisclaimer } from '@/components/ui/Disclaimers';
import { getDataset } from '@/data/dataset';
import { appConfig } from '@/config/appConfig';
import { THEME } from '@/config/constants';
import { formatArea, formatCurrency, formatDate } from '@/lib/format';
import { parcelsToGeoJson } from '@/lib/geo';
import { clamp, round } from '@/lib/stats';

const { from: YEAR_FROM, to: YEAR_TO } = appConfig.timeMachineRange;
const YEARS = Array.from({ length: YEAR_TO - YEAR_FROM + 1 }, (_, i) => YEAR_FROM + i);

export default function TimeMachinePage() {
  const navigate = useNavigate();
  const dataset = getDataset();

  const [year, setYear] = useState<number>(YEAR_TO);
  const [parcelId, setParcelId] = useState('BL-184');

  const parcel = useMemo(
    () => dataset.parcels.find((p) => p.parcelId.toLowerCase() === parcelId.trim().toLowerCase()),
    [dataset.parcels, parcelId],
  );

  const ownership = useMemo(
    () =>
      parcel
        ? dataset.ownershipRecords.filter((o) => o.parcelId === parcel.parcelId).sort((a, b) => a.fromYear - b.fromYear)
        : [],
    [dataset.ownershipRecords, parcel],
  );

  const ownerAtYear = useMemo(
    () => ownership.filter((o) => o.fromYear <= year).slice(-1)[0],
    [ownership, year],
  );

  const mutationsToYear = useMemo(
    () =>
      parcel
        ? dataset.mutations
            .filter((m) => m.parcelId === parcel.parcelId && new Date(m.mutationDate).getFullYear() <= year)
            .sort((a, b) => a.mutationDate.localeCompare(b.mutationDate))
        : [],
    [dataset.mutations, parcel, year],
  );

  const project = useMemo(
    () => (parcel?.projectId ? dataset.projects.find((p) => p.id === parcel.projectId) : undefined),
    [dataset.projects, parcel],
  );

  const compensation = useMemo(
    () => (parcel ? dataset.compensation.find((c) => c.parcelId === parcel.parcelId) : undefined),
    [dataset.compensation, parcel],
  );

  const watershed = useMemo(
    () => (parcel?.watershedId ? dataset.watersheds.find((w) => w.id === parcel.watershedId) : undefined),
    [dataset.watersheds, parcel],
  );

  /**
   * National series reconstructed for the selected year. Progress before the
   * observed period is interpolated from the current position, which is why the
   * whole view is labelled as a reconstruction.
   */
  const national = useMemo(() => {
    const share = clamp((year - YEAR_FROM + 1) / (YEAR_TO - YEAR_FROM + 1), 0.08, 1);
    const projectsStarted = dataset.projects.filter((p) => new Date(p.startDate).getFullYear() <= year);
    const notified = projectsStarted.reduce((s, p) => s + p.proposedArea, 0);
    const acquired = projectsStarted.reduce((s, p) => s + p.acquiredArea * share, 0);
    const assessed = projectsStarted.reduce((s, p) => s + p.compensationAssessed * share, 0);
    const paid = projectsStarted.reduce((s, p) => s + p.compensationPaid * share, 0);
    const digitized = Math.round(dataset.documents.length * share);
    return {
      projects: projectsStarted.length,
      notified: round(notified, 0),
      acquired: round(acquired, 0),
      assessed,
      paid,
      digitized,
      possession: round(
        projectsStarted.reduce((s, p) => s + p.possessionPercent * share, 0) / Math.max(1, projectsStarted.length),
        1,
      ),
      rr: round(
        projectsStarted.reduce((s, p) => s + p.rrProgressPercent * share, 0) / Math.max(1, projectsStarted.length),
        1,
      ),
    };
  }, [dataset, year]);

  const timeline = useMemo(
    () =>
      YEARS.map((y) => {
        const share = clamp((y - YEAR_FROM + 1) / (YEAR_TO - YEAR_FROM + 1), 0.08, 1);
        const started = dataset.projects.filter((p) => new Date(p.startDate).getFullYear() <= y);
        return {
          year: String(y),
          projects: started.length,
          acquiredHa: round(started.reduce((s, p) => s + p.acquiredArea * share, 0), 0),
          compensationCr: round(started.reduce((s, p) => s + p.compensationPaid * share, 0) / 1e7, 0),
          documents: Math.round(dataset.documents.length * share),
          mutations: dataset.mutations.filter((m) => new Date(m.mutationDate).getFullYear() <= y).length,
        };
      }),
    [dataset],
  );

  const ndviAtYear = useMemo(() => {
    if (!watershed) return null;
    const index = clamp(
      Math.round(((year - YEAR_FROM) / (YEAR_TO - YEAR_FROM)) * (watershed.ndviTrend.length - 1)),
      0,
      watershed.ndviTrend.length - 1,
    );
    return watershed.ndviTrend[index];
  }, [watershed, year]);

  const layers: MapLayerSpec[] = useMemo(
    () =>
      parcel
        ? [
            {
              id: 'parcel',
              label: 'Parcel geometry',
              group: 'cadastral',
              visible: true,
              kind: 'polygon',
              data: parcelsToGeoJson([parcel]),
              style: {
                color: THEME.ink,
                weight: 2,
                fillColor:
                  year >= 2024 ? THEME.red : year >= 2021 ? THEME.amber : THEME.teal,
                fillOpacity: 0.28,
              },
              popup: (p) => `<b>${p.parcelId}</b><br/>State as reconstructed for ${year}`,
            },
          ]
        : [],
    [parcel, year],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Administrative Time Machine"
        description="Move through time to reconstruct the state of land records, acquisition delivery, compensation and environmental observations. This is a digital twin timeline, not a legal record of past states."
        trail={[{ label: 'Time Machine' }]}
        actions={
          parcel && (
            <button className="btn-secondary" onClick={() => navigate(`/twins/${parcel.parcelId}`)}>
              Open current twin
            </button>
          )
        }
      />

      <Card title={`Timeline position: ${year}`} subtitle={`${YEAR_FROM} — ${YEAR_TO}`}>
        <input
          type="range"
          min={YEAR_FROM}
          max={YEAR_TO}
          value={year}
          className="w-full accent-teal"
          aria-label="Timeline year"
          onChange={(e) => setYear(Number(e.target.value))}
        />
        <div className="mt-1 flex justify-between">
          {YEARS.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              className={`metric text-2xs ${y === year ? 'font-bold text-teal' : 'text-muted hover:text-ink'}`}
            >
              {y}
            </button>
          ))}
        </div>
        <PredictionDisclaimer className="mt-2" />
      </Card>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <StatTile label={`Projects by ${year}`} value={String(national.projects)} />
        <StatTile label="Area notified" value={formatArea(national.notified, 0)} />
        <StatTile label="Area acquired" value={formatArea(national.acquired, 0)} tone="teal" />
        <StatTile label="Compensation assessed" value={formatCurrency(national.assessed)} />
        <StatTile label="Compensation paid" value={formatCurrency(national.paid)} tone="green" />
        <StatTile label="Documents digitised" value={national.digitized.toLocaleString('en-IN')} />
        <StatTile label="Mean possession" value={`${national.possession}%`} />
        <StatTile label="Mean R&R progress" value={`${national.rr}%`} />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <ChartCard
          title="National progression"
          subtitle="Reconstructed cumulative position by year"
          height={280}
          option={multiLineOption(
            timeline.map((t) => t.year),
            [
              { name: 'Projects', data: timeline.map((t) => t.projects), color: THEME.blue },
              { name: 'Mutations recorded', data: timeline.map((t) => t.mutations), color: THEME.olive },
              { name: 'Documents digitised', data: timeline.map((t) => t.documents), color: THEME.teal },
            ],
            { yName: 'count' },
          )}
          exportName="time-machine-national"
          exportRows={timeline}
        />
        <ChartCard
          title="Acquisition and compensation over time"
          subtitle="Hectares acquired and ₹ crore disbursed"
          height={280}
          option={stackedBarOption(
            timeline.map((t) => t.year),
            [
              { name: 'Acquired (ha)', data: timeline.map((t) => t.acquiredHa) },
              { name: 'Compensation paid (₹ Cr)', data: timeline.map((t) => t.compensationCr) },
            ],
          )}
          exportName="time-machine-acquisition"
          exportRows={timeline}
        />
      </div>

      <Card title="Parcel time machine" subtitle="Reconstruct the record state of a single parcel">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-2xs font-semibold uppercase tracking-wide text-muted">Parcel identifier</span>
            <TextInput
              className="w-48"
              value={parcelId}
              onChange={(e) => setParcelId(e.target.value)}
              placeholder="BL-184"
            />
          </label>
          <Badge tone="teal">Year {year}</Badge>
          {parcel && <Badge tone="neutral">{parcel.village}, {parcel.district}</Badge>}
        </div>

        {!parcel ? (
          <p className="mt-3 text-[13px] text-muted">No parcel matches that identifier.</p>
        ) : (
          <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_1fr]">
            <div className="space-y-3">
              <div className="rounded-md border border-line/70 bg-paper/50 p-3">
                <p className="text-2xs font-bold uppercase tracking-wide text-muted">Ownership at {year}</p>
                <p className="text-[16px] font-semibold">{ownerAtYear?.ownerName ?? 'No recorded holder'}</p>
                <p className="text-2xs text-muted">
                  {ownerAtYear
                    ? `Held from ${ownerAtYear.fromYear}${ownerAtYear.toYear ? ` to ${ownerAtYear.toYear}` : ' to date'} · acquired by ${ownerAtYear.acquisitionMode}`
                    : 'Ownership chain begins later than the selected year.'}
                </p>
              </div>

              <div className="rounded-md border border-line/70 bg-paper/50 p-3">
                <p className="mb-1 text-2xs font-bold uppercase tracking-wide text-muted">Ownership timeline</p>
                <ol className="relative space-y-2 border-l border-line pl-4">
                  {ownership.map((o) => (
                    <li key={o.id} className={o.fromYear <= year ? '' : 'opacity-40'}>
                      <span
                        className={`absolute -left-[19px] mt-1.5 h-2 w-2 rounded-full ${
                          o.fromYear <= year ? 'bg-teal' : 'bg-line'
                        }`}
                      />
                      <p className="text-[13px]">
                        <span className="metric font-semibold">{o.fromYear}</span> · {o.ownerName}
                      </p>
                      <p className="text-2xs text-muted">{o.acquisitionMode}</p>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-md border border-line/70 bg-paper/50 p-3">
                <p className="mb-1 text-2xs font-bold uppercase tracking-wide text-muted">
                  Mutations recorded by {year} ({mutationsToYear.length})
                </p>
                {mutationsToYear.length === 0 ? (
                  <p className="text-2xs text-muted">No mutation had been recorded by this year.</p>
                ) : (
                  <ul className="space-y-1">
                    {mutationsToYear.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-2 text-2xs">
                        <span>
                          <span className="metric">{m.mutationNumber}</span> · {m.fromOwner} → {m.toOwner}
                        </span>
                        <span className="flex gap-1">
                          <span className="text-muted">{formatDate(m.mutationDate)}</span>
                          <StatusBadge status={m.status} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="overflow-hidden rounded-md border border-line/70">
                <MapView
                  layers={layers}
                  center={[parcel.centroid[1], parcel.centroid[0]]}
                  zoom={16}
                  satellite={year >= 2022}
                  height={260}
                />
              </div>

              <div className="rounded-md border border-line/70 bg-paper/50 p-3">
                <p className="text-2xs font-bold uppercase tracking-wide text-muted">Acquisition position at {year}</p>
                {project ? (
                  <>
                    <p className="text-[13px]">
                      {project.name} ({project.code}) started {formatDate(project.startDate)}.
                    </p>
                    <p className="text-2xs text-muted">
                      {new Date(project.startDate).getFullYear() > year
                        ? 'The project had not yet commenced in the selected year.'
                        : `Stage as at ${year}: ${estimateStage(project.currentStage, new Date(project.startDate).getFullYear(), year)}.`}
                    </p>
                    <div className="mt-1.5">
                      <ProgressBar
                        value={
                          new Date(project.startDate).getFullYear() > year
                            ? 0
                            : clamp(
                                (project.completionPercent * (year - new Date(project.startDate).getFullYear() + 1)) /
                                  Math.max(1, YEAR_TO - new Date(project.startDate).getFullYear() + 1),
                                0,
                                100,
                              )
                        }
                        tone="teal"
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-2xs text-muted">This parcel is not part of any acquisition project.</p>
                )}
              </div>

              <div className="rounded-md border border-line/70 bg-paper/50 p-3">
                <p className="text-2xs font-bold uppercase tracking-wide text-muted">Compensation position</p>
                {compensation ? (
                  <>
                    <p className="text-[13px]">
                      {formatCurrency(compensation.amountPaid)} of {formatCurrency(compensation.amountAssessed)} disbursed
                      ({compensation.status}).
                    </p>
                    <p className="text-2xs text-muted">
                      Assessed {formatDate(compensation.assessedOn)}
                      {compensation.paidOn ? ` · paid ${formatDate(compensation.paidOn)}` : ' · payment pending'}
                    </p>
                  </>
                ) : (
                  <p className="text-2xs text-muted">No compensation record exists for this parcel.</p>
                )}
              </div>

              <div className="rounded-md border border-line/70 bg-paper/50 p-3">
                <p className="text-2xs font-bold uppercase tracking-wide text-muted">Environmental observation</p>
                {watershed && ndviAtYear ? (
                  <>
                    <p className="text-[13px]">
                      {watershed.name}: NDVI {ndviAtYear.value} at period {ndviAtYear.period}.
                    </p>
                    <p className="text-2xs text-muted">
                      Erosion risk moved from {watershed.erosionRiskBefore} to {watershed.erosionRiskAfter};
                      intervention coverage {watershed.interventionCoveragePercent}%.
                    </p>
                    <p className="text-2xs text-muted">
                      Satellite base map switches to imagery for years from 2022 onwards.
                    </p>
                  </>
                ) : (
                  <p className="text-2xs text-muted">No watershed observation is linked to this parcel.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/** Approximates which lifecycle stage a project would have been in at a year. */
function estimateStage(currentStage: string, startYear: number, year: number): string {
  const order = [
    'proposal',
    'scrutiny',
    'approval',
    'notification',
    'objection_handling',
    'survey',
    'award',
    'compensation',
    'possession',
    'rehabilitation',
    'closure',
  ];
  const currentIndex = order.indexOf(currentStage);
  const elapsed = Math.max(0, year - startYear);
  const total = Math.max(1, YEAR_TO - startYear);
  const index = clamp(Math.round((elapsed / total) * currentIndex), 0, currentIndex);
  return order[index].replace(/_/g, ' ');
}
