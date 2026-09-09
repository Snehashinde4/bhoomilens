import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Slider } from '@/components/ui/Form';
import { StatTile } from '@/components/kpi/KpiCard';
import { ChartCard } from '@/components/charts/ChartCard';
import { EChart } from '@/components/charts/EChart';
import { gaugeOption, groupedBarOption, horizontalBarOption } from '@/components/charts/presets';
import { PredictionDisclaimer } from '@/components/ui/Disclaimers';
import { getDataset } from '@/data/dataset';
import { useScope } from '@/hooks/useScope';
import { filterProjects } from '@/services/analytics';
import { featuresFromProject, riskLevelOf, scoreRisk } from '@/risk/model';
import { addDays, formatCurrency, formatDate } from '@/lib/format';
import { clamp, mean, round } from '@/lib/stats';
import { THEME } from '@/config/constants';
import { exportCsv } from '@/lib/export';

interface Levers {
  compensationOfficers: number;
  verificationOfficers: number;
  fieldTeams: number;
  legalCells: number;
  pendingCaseReduction: number;
  approvalFastTrackDays: number;
  documentDriveCoverage: number;
  gisReconciliationCoverage: number;
  outreachIntensity: number;
  rrAcceleration: number;
}

const BASELINE: Levers = {
  compensationOfficers: 5,
  verificationOfficers: 6,
  fieldTeams: 5,
  legalCells: 1,
  pendingCaseReduction: 0,
  approvalFastTrackDays: 0,
  documentDriveCoverage: 0,
  gisReconciliationCoverage: 0,
  outreachIntensity: 0,
  rrAcceleration: 0,
};

/**
 * Translates administrative capacity levers into the feature deltas consumed by
 * the risk model. Elasticities are declared here so the assumptions behind the
 * simulation stay auditable.
 */
const ELASTICITY = {
  compensationPerOfficer: 3.4, // % of outstanding compensation cleared per extra officer
  verificationPerOfficer: 14, // missing documents cleared per extra officer
  fieldPerTeam: 1, // field capacity units per team
  legalPerCell: 2.2, // cases disposed per extra cell
  approvalDaysPerFastTrack: 1,
  outreachResponsePoints: 0.42,
  gisPerCoveragePoint: 0.9,
  rrPerAccelerationPoint: 0.55,
};

export default function ScenarioPage() {
  const scope = useScope();
  const dataset = getDataset();
  const [levers, setLevers] = useState<Levers>(BASELINE);

  const projects = useMemo(() => filterProjects(dataset.projects, scope), [dataset.projects, scope]);

  const result = useMemo(() => {
    const rows = projects.map((project) => {
      const base = featuresFromProject(project);
      const extraComp = (levers.compensationOfficers - BASELINE.compensationOfficers) * ELASTICITY.compensationPerOfficer;
      const extraVerification = (levers.verificationOfficers - BASELINE.verificationOfficers) * ELASTICITY.verificationPerOfficer;
      const simulatedFeatures = {
        ...base,
        compensationGap: clamp(base.compensationGap - extraComp - levers.documentDriveCoverage * 0.12, 0, 100),
        missingDocuments: clamp(
          base.missingDocuments - extraVerification - (levers.documentDriveCoverage / 100) * base.missingDocuments,
          0,
          1000,
        ),
        legalCaseLoad: clamp(
          base.legalCaseLoad - (levers.legalCells - BASELINE.legalCells) * ELASTICITY.legalPerCell - (levers.pendingCaseReduction / 100) * base.legalCaseLoad,
          0,
          100,
        ),
        approvalAgingDays: clamp(
          base.approvalAgingDays - levers.approvalFastTrackDays * ELASTICITY.approvalDaysPerFastTrack,
          0,
          900,
        ),
        stakeholderResponse: clamp(base.stakeholderResponse + levers.outreachIntensity * ELASTICITY.outreachResponsePoints, 0, 99),
        gisConflict: clamp(base.gisConflict - (levers.gisReconciliationCoverage / 100) * base.gisConflict * ELASTICITY.gisPerCoveragePoint, 0, 500),
        rrGap: clamp(base.rrGap - levers.rrAcceleration * ELASTICITY.rrPerAccelerationPoint, 0, 100),
        verificationCapacity: clamp(levers.verificationOfficers + 2, 1, 14),
        fieldTeamCapacity: clamp(levers.fieldTeams * ELASTICITY.fieldPerTeam + 1, 1, 12),
      };
      const simulated = scoreRisk(simulatedFeatures);
      return {
        project,
        baselineScore: project.riskScore,
        baselineDelay: project.delayProbability,
        simulatedScore: simulated.score,
        simulatedDelay: simulated.delayProbability,
        simulatedCompletion: addDays(
          project.plannedCompletion,
          Math.round((simulated.delayProbability / 100) * 540),
        ),
        contributors: simulated.contributors,
      };
    });

    const baselineDelay = round(mean(rows.map((r) => r.baselineDelay)), 1);
    const simulatedDelay = round(mean(rows.map((r) => r.simulatedDelay)), 1);
    const baselineCritical = rows.filter((r) => riskLevelOf(r.baselineScore) === 'critical').length;
    const simulatedCritical = rows.filter((r) => riskLevelOf(r.simulatedScore) === 'critical').length;
    const baselineHigh = rows.filter((r) => ['high', 'critical'].includes(riskLevelOf(r.baselineScore))).length;
    const simulatedHigh = rows.filter((r) => ['high', 'critical'].includes(riskLevelOf(r.simulatedScore))).length;

    const outstanding = projects.reduce((s, p) => s + (p.compensationAssessed - p.compensationPaid), 0);
    const clearedShare = clamp(
      ((levers.compensationOfficers - BASELINE.compensationOfficers) * ELASTICITY.compensationPerOfficer) / 100,
      0,
      1,
    );

    return {
      rows,
      baselineDelay,
      simulatedDelay,
      baselineCritical,
      simulatedCritical,
      baselineHigh,
      simulatedHigh,
      outstanding,
      unlocked: outstanding * clearedShare,
    };
  }, [projects, levers]);

  const worst = useMemo(
    () => [...result.rows].sort((a, b) => b.baselineScore - a.baselineScore).slice(0, 12),
    [result.rows],
  );

  const set = (patch: Partial<Levers>) => setLevers((cur) => ({ ...cur, ...patch }));
  const delta = round(result.simulatedDelay - result.baselineDelay, 1);

  return (
    <div className="space-y-4">
      <PageHeader
        title="National Scenario Simulator"
        description="Model the portfolio-wide effect of administrative capacity and policy decisions before committing resources. Every lever maps to a declared elasticity in the risk model."
        trail={[{ label: 'Scenario Simulator' }]}
        actions={
          <>
            <button className="btn-secondary" onClick={() => setLevers(BASELINE)}>
              Reset to current position
            </button>
            <button
              className="btn-secondary"
              onClick={() =>
                exportCsv(
                  result.rows.map((r) => ({
                    code: r.project.code,
                    project: r.project.name,
                    district: r.project.district,
                    state: r.project.state,
                    baselineRisk: r.baselineScore,
                    simulatedRisk: r.simulatedScore,
                    baselineDelayProbability: r.baselineDelay,
                    simulatedDelayProbability: r.simulatedDelay,
                    simulatedCompletion: r.simulatedCompletion.toISOString().slice(0, 10),
                  })),
                  'scenario-simulation',
                )
              }
            >
              Export scenario
            </button>
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-[340px_1fr]">
        <Card title="Administrative levers" subtitle="Adjust deployed capacity and programme decisions">
          <div className="space-y-3">
            <Slider label="Compensation team (officers)" min={1} max={20} value={levers.compensationOfficers} onChange={(v) => set({ compensationOfficers: v })} />
            <Slider label="Verification cell (officers)" min={1} max={20} value={levers.verificationOfficers} onChange={(v) => set({ verificationOfficers: v })} />
            <Slider label="Field survey teams" min={1} max={12} value={levers.fieldTeams} onChange={(v) => set({ fieldTeams: v })} />
            <Slider label="Dedicated legal cells" min={0} max={6} value={levers.legalCells} onChange={(v) => set({ legalCells: v })} />
            <Slider label="Pending case reduction" suffix="%" min={0} max={90} step={5} value={levers.pendingCaseReduction} onChange={(v) => set({ pendingCaseReduction: v })} />
            <Slider label="Approval fast-track" suffix=" days saved" min={0} max={240} step={10} value={levers.approvalFastTrackDays} onChange={(v) => set({ approvalFastTrackDays: v })} />
            <Slider label="Document digitisation drive coverage" suffix="%" min={0} max={100} step={5} value={levers.documentDriveCoverage} onChange={(v) => set({ documentDriveCoverage: v })} />
            <Slider label="GIS reconciliation coverage" suffix="%" min={0} max={100} step={5} value={levers.gisReconciliationCoverage} onChange={(v) => set({ gisReconciliationCoverage: v })} />
            <Slider label="Stakeholder outreach intensity" min={0} max={100} step={5} value={levers.outreachIntensity} onChange={(v) => set({ outreachIntensity: v })} />
            <Slider label="R&R acceleration" min={0} max={100} step={5} value={levers.rrAcceleration} onChange={(v) => set({ rrAcceleration: v })} />
          </div>
          <PredictionDisclaimer className="mt-3" />
        </Card>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            <StatTile label="Projects in scope" value={String(projects.length)} />
            <StatTile label="Baseline delay risk" value={`${result.baselineDelay}%`} />
            <StatTile
              label="Simulated delay risk"
              value={`${result.simulatedDelay}%`}
              tone={delta < 0 ? 'green' : delta > 0 ? 'red' : 'ink'}
              hint={`${delta > 0 ? '+' : ''}${delta} points`}
            />
            <StatTile label="High/critical (baseline)" value={String(result.baselineHigh)} tone="amber" />
            <StatTile label="High/critical (simulated)" value={String(result.simulatedHigh)} tone={result.simulatedHigh < result.baselineHigh ? 'green' : 'red'} />
            <StatTile label="Compensation unlocked" value={formatCurrency(result.unlocked)} tone="green" hint={`of ${formatCurrency(result.outstanding)} outstanding`} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Card title="Portfolio delay risk" subtitle="Baseline versus simulated">
              <div className="grid grid-cols-2 gap-1">
                <EChart option={gaugeOption(result.baselineDelay, 'Baseline', THEME.muted)} height={160} ariaLabel="Baseline delay risk" />
                <EChart
                  option={gaugeOption(result.simulatedDelay, 'Simulated', delta < 0 ? THEME.green : THEME.red)}
                  height={160}
                  ariaLabel="Simulated delay risk"
                />
              </div>
              <p className="mt-1 text-center text-[13px]">
                Delay risk{' '}
                <span className="metric font-semibold">{result.baselineDelay}%</span> →{' '}
                <span className={`metric font-semibold ${delta < 0 ? 'text-signal-green' : 'text-signal-red'}`}>
                  {result.simulatedDelay}%
                </span>
              </p>
            </Card>

            <ChartCard
              title="Risk category shift"
              subtitle="Projects moving between categories under the scenario"
              height={220}
              option={groupedBarOption(
                ['Low', 'Medium', 'High', 'Critical'],
                [
                  {
                    name: 'Baseline',
                    color: THEME.muted,
                    data: ['low', 'medium', 'high', 'critical'].map(
                      (l) => result.rows.filter((r) => riskLevelOf(r.baselineScore) === l).length,
                    ),
                  },
                  {
                    name: 'Simulated',
                    color: THEME.teal,
                    data: ['low', 'medium', 'high', 'critical'].map(
                      (l) => result.rows.filter((r) => riskLevelOf(r.simulatedScore) === l).length,
                    ),
                  },
                ],
                'projects',
              )}
              exportName="scenario-risk-shift"
              exportRows={['low', 'medium', 'high', 'critical'].map((l) => ({
                level: l,
                baseline: result.rows.filter((r) => riskLevelOf(r.baselineScore) === l).length,
                simulated: result.rows.filter((r) => riskLevelOf(r.simulatedScore) === l).length,
              }))}
            />
          </div>

          <ChartCard
            title="Highest-risk projects under the scenario"
            subtitle="Baseline risk versus simulated risk"
            height={320}
            isEmpty={!worst.length}
            option={groupedBarOption(
              worst.map((r) => r.project.code),
              [
                { name: 'Baseline risk', data: worst.map((r) => r.baselineScore), color: THEME.muted },
                { name: 'Simulated risk', data: worst.map((r) => r.simulatedScore), color: THEME.teal },
              ],
              'risk score',
            )}
            exportName="scenario-top-projects"
            exportRows={worst.map((r) => ({
              code: r.project.code,
              name: r.project.name,
              baselineRisk: r.baselineScore,
              simulatedRisk: r.simulatedScore,
              baselineDelay: r.baselineDelay,
              simulatedDelay: r.simulatedDelay,
              simulatedCompletion: formatDate(r.simulatedCompletion),
            }))}
          />

          <Card title="Scenario narrative" subtitle="What the model expects to change">
            <ul className="space-y-1.5 text-[13px]">
              <li>
                • Compensation team {BASELINE.compensationOfficers} → {levers.compensationOfficers} officers:
                clears an additional{' '}
                <b>
                  {round((levers.compensationOfficers - BASELINE.compensationOfficers) * ELASTICITY.compensationPerOfficer, 1)}%
                </b>{' '}
                of outstanding compensation.
              </li>
              <li>
                • Verification cell {BASELINE.verificationOfficers} → {levers.verificationOfficers} officers:
                closes roughly{' '}
                <b>{Math.max(0, (levers.verificationOfficers - BASELINE.verificationOfficers) * ELASTICITY.verificationPerOfficer)}</b>{' '}
                missing-record cases per project.
              </li>
              <li>
                • Pending case reduction of <b>{levers.pendingCaseReduction}%</b> and{' '}
                <b>{levers.legalCells}</b> legal cell(s) lower litigation exposure.
              </li>
              <li>
                • Portfolio delay risk moves from <b>{result.baselineDelay}%</b> to{' '}
                <b>{result.simulatedDelay}%</b>; projects in the high or critical band move from{' '}
                <b>{result.baselineHigh}</b> to <b>{result.simulatedHigh}</b>.
              </li>
              <li>
                • Median simulated completion for the twelve highest-risk projects:{' '}
                <b>{formatDate(worst[Math.floor(worst.length / 2)]?.simulatedCompletion ?? new Date())}</b>.
              </li>
            </ul>
            <PredictionDisclaimer className="mt-2" />
          </Card>

          <ChartCard
            title="Residual risk drivers after the scenario"
            subtitle="Mean contribution across the portfolio"
            height={280}
            option={horizontalBarOption(
              aggregateContributors(result.rows).map((c) => c.factor),
              aggregateContributors(result.rows).map((c) => c.value),
              { valueName: 'mean risk points', color: THEME.amber },
            )}
            exportName="scenario-residual-drivers"
            exportRows={aggregateContributors(result.rows).map((c) => ({ factor: c.factor, meanPoints: c.value }))}
          />
        </div>
      </div>
    </div>
  );
}

function aggregateContributors(rows: Array<{ contributors: Array<{ factor: string; contribution: number }> }>) {
  const map = new Map<string, number[]>();
  rows.forEach((r) =>
    r.contributors.forEach((c) => {
      const list = map.get(c.factor) ?? [];
      list.push(c.contribution);
      map.set(c.factor, list);
    }),
  );
  return [...map.entries()]
    .map(([factor, values]) => ({ factor, value: round(mean(values), 2) }))
    .sort((a, b) => a.value - b.value);
}
