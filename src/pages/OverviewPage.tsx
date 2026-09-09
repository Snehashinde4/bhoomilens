import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { KpiGrid } from '@/components/kpi/KpiCard';
import { ChartCard } from '@/components/charts/ChartCard';
import {
  areaCompareOption,
  bubbleScatterOption,
  funnelOption,
  gaugeOption,
  heatMapOption,
  horizontalBarOption,
  multiLineOption,
  rankingOption,
  riskDonutOption,
  stackedBarOption,
} from '@/components/charts/presets';
import { PriorityInterventionQueue } from '@/components/dashboard/PriorityInterventionQueue';
import { EChart } from '@/components/charts/EChart';
import { useScope } from '@/hooks/useScope';
import { PROCESSING_STAGE_LABEL, THEME } from '@/config/constants';
import {
  acquisitionByState,
  buildNationalKpis,
  compensationOverTime,
  completionVsDelayScatter,
  delayDriverSeries,
  districtHeatMap,
  districtRanking,
  documentPipelineSeries,
  gaugeMetrics,
  processingFunnel,
  riskDistribution,
  type HeatMapMetric,
} from '@/services/analytics';
import { PredictionDisclaimer } from '@/components/ui/Disclaimers';
import { Card } from '@/components/ui/Card';

const HEAT_METRICS: Array<{ value: HeatMapMetric; label: string; unit: string; max: number }> = [
  { value: 'digitizationProgress', label: 'Digitization progress', unit: '%', max: 100 },
  { value: 'delayProbability', label: 'Project-risk density', unit: '%', max: 100 },
  { value: 'reviewBacklog', label: 'Verification backlog', unit: ' tasks', max: 120 },
  { value: 'compensationProgress', label: 'Compensation progress', unit: '%', max: 100 },
];

const RANK_METRICS = [
  { value: 'processingSpeedDocsPerDay', label: 'Processing speed (docs/day)', dir: 'desc' as const },
  { value: 'digitizationAccuracy', label: 'Digitization accuracy (%)', dir: 'desc' as const },
  { value: 'riskReduction', label: 'Risk reduction (points)', dir: 'desc' as const },
  { value: 'reviewBacklog', label: 'Review backlog (lowest first)', dir: 'asc' as const },
  { value: 'interventionClosureRate', label: 'Intervention closure (%)', dir: 'desc' as const },
] as const;

export default function OverviewPage() {
  const scope = useScope();
  const navigate = useNavigate();
  const [heatMetric, setHeatMetric] = useState<HeatMapMetric>('digitizationProgress');
  const [rankMetric, setRankMetric] = useState<(typeof RANK_METRICS)[number]['value']>(
    'processingSpeedDocsPerDay',
  );

  const kpis = useMemo(() => buildNationalKpis(scope), [scope]);
  const pipeline = useMemo(() => documentPipelineSeries(scope), [scope]);
  const acquisition = useMemo(() => acquisitionByState(scope), [scope]);
  const drivers = useMemo(() => delayDriverSeries(scope), [scope]);
  const risk = useMemo(() => riskDistribution(scope), [scope]);
  const funnel = useMemo(() => processingFunnel(scope), [scope]);
  const heat = useMemo(() => districtHeatMap(scope, heatMetric), [scope, heatMetric]);
  const compensation = useMemo(() => compensationOverTime(scope), [scope]);
  const scatter = useMemo(() => completionVsDelayScatter(scope), [scope]);
  const gauges = useMemo(() => gaugeMetrics(scope), [scope]);
  const ranking = useMemo(() => {
    const meta = RANK_METRICS.find((m) => m.value === rankMetric)!;
    return { rows: districtRanking(scope, rankMetric, meta.dir), meta };
  }, [scope, rankMetric]);

  const heatMeta = HEAT_METRICS.find((m) => m.value === heatMetric)!;

  return (
    <div className="space-y-4">
      <PageHeader
        title="National Land Governance Command Centre"
        description="Live operational picture of land-record digitisation, acquisition delivery, risk, compensation and anomaly signals. Every figure below responds to the state, district and period filters in the header."
        trail={[{ label: 'Overview' }]}
        actions={
          <>
            <button className="btn-secondary" onClick={() => navigate('/reports')}>
              Report centre
            </button>
            <button className="btn-primary" onClick={() => navigate('/risk')}>
              Open risk intelligence
            </button>
          </>
        }
      />

      <KpiGrid kpis={kpis} />

      <div className="grid gap-3 xl:grid-cols-2">
        <ChartCard
          title="Document processing throughput"
          subtitle="Uploaded · processed · validated · routed for review"
          tooltip="Monthly operational volumes from the digitisation pipeline. Use the period filter to change the window."
          height={280}
          isEmpty={!pipeline.periods.length}
          option={multiLineOption(
            pipeline.periods,
            [
              { name: 'Uploaded', data: pipeline.uploaded, color: THEME.blue },
              { name: 'Processed', data: pipeline.processed, color: THEME.teal },
              { name: 'Validated', data: pipeline.validated, color: THEME.green },
              { name: 'Sent for review', data: pipeline.review, color: THEME.amber },
            ],
            { asMonths: true, yName: 'documents' },
          )}
          exportName="document-throughput"
          exportRows={pipeline.periods.map((p, i) => ({
            period: p,
            uploaded: pipeline.uploaded[i],
            processed: pipeline.processed[i],
            validated: pipeline.validated[i],
            sentForReview: pipeline.review[i],
          }))}
        />

        <ChartCard
          title="Acquisition progress by state"
          subtitle="Notified, awarded, compensation paid, possession and R&R"
          tooltip="Stacked view of physical and financial acquisition progress. Compensation is shown in ₹ crore."
          height={280}
          isEmpty={!acquisition.states.length}
          option={stackedBarOption(acquisition.states, [
            { name: 'Notified (ha)', data: acquisition.notified },
            { name: 'Awarded (ha)', data: acquisition.awarded },
            { name: 'Compensation paid (₹ Cr)', data: acquisition.compensationPaid },
            { name: 'Possession (ha)', data: acquisition.possession },
            { name: 'R&R families', data: acquisition.rr },
          ])}
          exportName="acquisition-by-state"
          exportRows={acquisition.states.map((s, i) => ({
            state: s,
            notifiedHa: acquisition.notified[i],
            awardedHa: acquisition.awarded[i],
            compensationPaidCr: acquisition.compensationPaid[i],
            possessionHa: acquisition.possession[i],
            rrFamilies: acquisition.rr[i],
          }))}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <ChartCard
          title="Major delay drivers"
          subtitle="Primary driver assigned to each project"
          tooltip="Each project is attributed to its dominant delay driver by the risk engine."
          height={260}
          isEmpty={drivers.every((d) => d.count === 0)}
          option={horizontalBarOption(
            drivers.map((d) => d.driver),
            drivers.map((d) => d.count),
            { valueName: 'projects', color: THEME.red },
          )}
          exportName="delay-drivers"
          exportRows={drivers.map((d) => ({ driver: d.driver, projects: d.count }))}
        />

        <ChartCard
          title="Project-risk distribution"
          subtitle="Low · Medium · High · Critical"
          tooltip="Distribution of the decision-support risk score across projects in scope."
          height={260}
          isEmpty={risk.every((r) => r.value === 0)}
          option={riskDonutOption(risk)}
          exportName="risk-distribution"
          exportRows={risk.map((r) => ({ riskLevel: r.name, projects: r.value }))}
          footer={<PredictionDisclaimer />}
          onEvent={{
            click: () => navigate('/risk'),
          }}
        />

        <ChartCard
          title="Document processing pipeline"
          subtitle="Uploaded → approved"
          tooltip="Funnel of documents reaching each pipeline stage. Drop-off between stages indicates where capacity is constrained."
          height={260}
          isEmpty={funnel.every((f) => f.value === 0)}
          option={funnelOption(
            funnel.map((f) => ({ name: PROCESSING_STAGE_LABEL[f.stage], value: f.value })),
          )}
          exportName="processing-funnel"
          exportRows={funnel.map((f) => ({ stage: PROCESSING_STAGE_LABEL[f.stage], documents: f.value }))}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.35fr_1fr]">
        <ChartCard
          title="District performance heat map"
          subtitle={heatMeta.label}
          tooltip="Districts on the horizontal axis, states on the vertical axis. Darker cells indicate a higher value."
          height={330}
          isEmpty={!heat.points.length}
          option={heatMapOption(heat.districts, heat.states, heat.points, {
            max: heatMeta.max,
            unit: heatMeta.unit,
          })}
          exportName={`heatmap-${heatMetric}`}
          exportRows={heat.points.map(([x, y, v]) => ({
            district: heat.districts[x],
            state: heat.states[y],
            value: v,
          }))}
          actions={
            <select
              className="field w-44 py-1 text-2xs"
              value={heatMetric}
              aria-label="Heat map metric"
              onChange={(e) => setHeatMetric(e.target.value as HeatMapMetric)}
            >
              {HEAT_METRICS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          }
        />

        <ChartCard
          title="Compensation assessed versus disbursed"
          subtitle="₹ crore per month"
          tooltip="Gap between the two areas is the outstanding compensation liability."
          height={330}
          isEmpty={!compensation.length}
          option={areaCompareOption(
            compensation.map((c) => c.period),
            { name: 'Assessed', data: compensation.map((c) => c.assessed) },
            { name: 'Disbursed', data: compensation.map((c) => c.disbursed) },
            '₹ crore',
          )}
          exportName="compensation-trend"
          exportRows={compensation}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr]">
        <ChartCard
          title="Completion versus delay probability"
          subtitle="Bubble size = affected families · colour = risk category"
          tooltip="Projects in the upper-left quadrant are early-stage with a high predicted delay and deserve the earliest intervention."
          height={330}
          isEmpty={!scatter.length}
          option={bubbleScatterOption(
            scatter.map((s) => ({
              value: s.point,
              name: `${s.project.code} · ${s.project.name}`,
              risk: s.project.riskLevel,
            })),
          )}
          exportName="completion-vs-delay"
          exportRows={scatter.map((s) => ({
            code: s.project.code,
            name: s.project.name,
            completionPercent: s.point[0],
            delayProbability: s.point[1],
            affectedFamilies: s.point[2],
            riskLevel: s.project.riskLevel,
          }))}
          footer={<PredictionDisclaimer />}
          onEvent={{
            click: (params) => {
              const p = params as { data?: { name?: string } };
              const code = p.data?.name?.split(' · ')[0];
              if (code) navigate(`/projects/${code}`);
            },
          }}
        />

        <Card title="National performance gauges" subtitle="Programme health at a glance">
          <div className="grid grid-cols-2 gap-1">
            <Gauge value={gauges.accuracy} label="Digitization accuracy" color={THEME.teal} />
            <Gauge value={gauges.acquisition} label="Acquisition completion" color={THEME.blue} />
            <Gauge value={gauges.compensation} label="Compensation progress" color={THEME.green} />
            <Gauge value={gauges.verificationHealth} label="Verification health" color={THEME.amber} />
          </div>
        </Card>
      </div>

      <ChartCard
        title="District ranking"
        subtitle={ranking.meta.label}
        tooltip="Ranks districts in scope on the selected operational metric."
        height={300}
        isEmpty={!ranking.rows.length}
        option={rankingOption(
          ranking.rows.map((d) => `${d.district} (${d.state})`).reverse(),
          ranking.rows.map((d) => Number(d[rankMetric])).reverse(),
          ranking.meta.label,
        )}
        exportName={`district-ranking-${rankMetric}`}
        exportRows={ranking.rows.map((d) => ({
          district: d.district,
          state: d.state,
          value: d[rankMetric],
        }))}
        actions={
          <select
            className="field w-56 py-1 text-2xs"
            value={rankMetric}
            aria-label="Ranking metric"
            onChange={(e) => setRankMetric(e.target.value as typeof rankMetric)}
          >
            {RANK_METRICS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        }
      />

      <PriorityInterventionQueue />
    </div>
  );
}

function Gauge({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="rounded-md border border-line/60 bg-paper/40 p-1">
      <EChart option={gaugeOption(value, label, color)} height={140} ariaLabel={label} />
    </div>
  );
}
