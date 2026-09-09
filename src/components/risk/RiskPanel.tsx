import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { RiskBadge, Badge } from '@/components/ui/Badge';
import { ProgressBar, Slider } from '@/components/ui/Form';
import { EChart } from '@/components/charts/EChart';
import { horizontalBarOption, waterfallOption } from '@/components/charts/presets';
import { PredictionDisclaimer } from '@/components/ui/Disclaimers';
import { STAGE_LABEL, THEME } from '@/config/constants';
import { formatDate } from '@/lib/format';
import {
  projectedCompletion,
  riskLevelOf,
  simulate,
  simulationInputFromProject,
  type SimulationInput,
} from '@/risk/model';
import type { Project, RiskPrediction } from '@/types';

export function RiskScoreHeader({ prediction, project }: { prediction: RiskPrediction; project: Project }) {
  return (
    <Card title="Project delay risk" subtitle={`Model ${prediction.modelVersion} · last run ${formatDate(prediction.lastRunAt)}`}>
      <div className="flex flex-wrap items-end gap-5">
        <div>
          <p className="metric text-[42px] font-semibold leading-none text-ink">
            {project.riskScore}
            <span className="text-lg text-muted"> / 100</span>
          </p>
          <div className="mt-1">
            <RiskBadge level={project.riskLevel} />
          </div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Delay probability" value={`${project.delayProbability}%`} />
          <Metric label="District baseline" value={`${prediction.districtBaseline}%`} />
          <Metric label="Model confidence" value={`${prediction.modelConfidence}%`} />
          <Metric label="Data completeness" value={`${prediction.dataCompleteness}%`} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-line/70 bg-paper/50 p-2">
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted">Planned completion</p>
          <p className="metric text-[14px]">{formatDate(project.plannedCompletion)}</p>
        </div>
        <div className="rounded-md border border-signal-amber/40 bg-signal-amber/8 p-2">
          <p className="text-2xs font-semibold uppercase tracking-wide text-[#8a5f10]">Predicted completion</p>
          <p className="metric text-[14px]">{formatDate(prediction.predictedCompletion)}</p>
        </div>
      </div>
      <PredictionDisclaimer className="mt-2" />
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="metric text-lg font-semibold leading-tight">{value}</p>
    </div>
  );
}

export function StageProbabilityChart({ prediction }: { prediction: RiskPrediction }) {
  const option = useMemo(
    () =>
      horizontalBarOption(
        prediction.stageProbabilities.map((s) => STAGE_LABEL[s.stage]).reverse(),
        prediction.stageProbabilities.map((s) => s.probability).reverse(),
        { valueName: '% probability of slippage', color: THEME.amber },
      ),
    [prediction],
  );
  return (
    <Card title="Stage-wise delay probability" subtitle="Probability that each lifecycle stage slips beyond its reference duration">
      <EChart option={option} height={300} ariaLabel="Stage-wise delay probability" />
      <PredictionDisclaimer className="mt-1" />
    </Card>
  );
}

export function RiskContributorPanel({ prediction }: { prediction: RiskPrediction }) {
  const top = prediction.contributors.filter((c) => c.contribution > 0).slice(0, 8);
  const option = useMemo(
    () => waterfallOption(top.map((c) => ({ name: c.factor, contribution: c.contribution }))),
    [top],
  );

  return (
    <Card
      title="Explainable risk contributors"
      subtitle="Cumulative build-up of the risk score, factor by factor"
    >
      <EChart option={option} height={300} ariaLabel="Risk contributor waterfall" />
      <ul className="mt-3 space-y-1.5">
        {top.map((c) => (
          <li key={c.factor} className="rounded-md border border-line/60 bg-paper/40 px-2.5 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium">{c.factor}</span>
              <span className="metric text-2xs text-muted">
                {c.value} {c.unit} · +{c.contribution} pts
              </span>
            </div>
            <div className="mt-1">
              <ProgressBar value={(c.contribution / (top[0]?.contribution || 1)) * 100} tone="amber" showLabel={false} height={4} />
            </div>
            <p className="mt-1 text-2xs text-muted">{c.explanation}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ModelExplanationPanel({
  prediction,
  project,
}: {
  prediction: RiskPrediction;
  project: Project;
}) {
  const top = prediction.contributors.slice(0, 3);
  return (
    <Card title="Model explanation" subtitle="Why this project is scored the way it is">
      <div className="space-y-3 text-[13px]">
        <section>
          <p className="text-2xs font-bold uppercase tracking-wide text-muted">Assessment</p>
          <p className="mt-0.5 leading-relaxed">
            {project.name} is currently in the <b>{STAGE_LABEL[project.currentStage]}</b> stage and has
            been pending for <b>{project.pendingDays} days</b>. The model scores it{' '}
            <b>{project.riskScore}/100 ({project.riskLevel})</b> against a district baseline of{' '}
            <b>{prediction.districtBaseline}%</b>.
          </p>
        </section>

        <section>
          <p className="text-2xs font-bold uppercase tracking-wide text-muted">Main contributing variables</p>
          <ol className="mt-0.5 list-decimal space-y-0.5 pl-4">
            {top.map((c) => (
              <li key={c.factor}>
                <b>{c.factor}</b> — {c.explanation} (+{c.contribution} points)
              </li>
            ))}
          </ol>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <div className="rounded border border-line/70 bg-paper/50 p-2">
            <p className="text-2xs font-semibold uppercase text-muted">Model confidence</p>
            <ProgressBar value={prediction.modelConfidence} tone="teal" />
          </div>
          <div className="rounded border border-line/70 bg-paper/50 p-2">
            <p className="text-2xs font-semibold uppercase text-muted">Data completeness</p>
            <ProgressBar value={prediction.dataCompleteness} tone="blue" />
          </div>
        </section>

        <section className="rounded-md border border-teal/40 bg-teal/8 p-2.5">
          <p className="text-2xs font-bold uppercase tracking-wide text-teal">Recommended intervention</p>
          <p className="mt-0.5 leading-relaxed">{prediction.recommendedIntervention}</p>
          <p className="mt-1 text-2xs text-muted">{prediction.expectedEffect}</p>
        </section>

        <div className="flex flex-wrap gap-1.5">
          <Badge tone="neutral">Model {prediction.modelVersion}</Badge>
          <Badge tone="neutral">Last run {formatDate(prediction.lastRunAt)}</Badge>
        </div>
        <PredictionDisclaimer />
      </div>
    </Card>
  );
}

export function WhatIfSimulator({ project }: { project: Project }) {
  const baseline = useMemo(() => simulationInputFromProject(project), [project]);
  const [input, setInput] = useState<SimulationInput>(baseline);
  const result = useMemo(() => simulate(input), [input]);
  const completion = useMemo(
    () => projectedCompletion(project, result.delayProbability),
    [project, result.delayProbability],
  );

  const delta = result.score - project.riskScore;

  const option = useMemo(
    () =>
      waterfallOption(
        result.contributors.filter((c) => c.contribution > 0).slice(0, 8).map((c) => ({
          name: c.factor,
          contribution: c.contribution,
        })),
      ),
    [result],
  );

  const set = (patch: Partial<SimulationInput>) => setInput((cur) => ({ ...cur, ...patch }));

  return (
    <Card
      title="What-if simulator"
      subtitle="Adjust operational variables to see the modelled effect on delay risk"
      actions={
        <button className="btn-secondary py-1 text-2xs" onClick={() => setInput(baseline)}>
          Reset to current position
        </button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3">
          <Slider label="Compensation completion" suffix="%" min={0} max={100} value={input.compensationCompletion} onChange={(v) => set({ compensationCompletion: v })} />
          <Slider label="Pending approval days" min={0} max={600} step={5} value={input.pendingApprovalDays} onChange={(v) => set({ pendingApprovalDays: v })} />
          <Slider label="Open legal cases" min={0} max={30} value={input.legalCases} onChange={(v) => set({ legalCases: v })} />
          <Slider label="Missing document count" min={0} max={400} step={5} value={input.missingDocuments} onChange={(v) => set({ missingDocuments: v })} />
          <Slider label="Verification capacity (officers)" min={1} max={14} value={input.verificationCapacity} onChange={(v) => set({ verificationCapacity: v })} />
          <Slider label="Field-team capacity (teams)" min={1} max={12} value={input.fieldTeamCapacity} onChange={(v) => set({ fieldTeamCapacity: v })} />
          <Slider label="R&R progress" suffix="%" min={0} max={100} value={input.rrProgress} onChange={(v) => set({ rrProgress: v })} />
          <Slider label="Stakeholder response" suffix="%" min={0} max={100} value={input.stakeholderResponse} onChange={(v) => set({ stakeholderResponse: v })} />
          <Slider label="GIS boundary conflicts" min={0} max={140} value={input.gisConflicts} onChange={(v) => set({ gisConflicts: v })} />
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SimTile label="Current risk" value={`${project.riskScore}`} sub={project.riskLevel} />
            <SimTile
              label="Simulated risk"
              value={`${result.score}`}
              sub={riskLevelOf(result.score)}
              tone={delta < 0 ? 'green' : delta > 0 ? 'red' : 'ink'}
            />
            <SimTile
              label="Change"
              value={`${delta > 0 ? '+' : ''}${delta}`}
              sub="risk points"
              tone={delta < 0 ? 'green' : delta > 0 ? 'red' : 'ink'}
            />
            <SimTile
              label="Simulated completion"
              value={formatDate(completion).replace(/ \d{4}$/, '')}
              sub={formatDate(completion)}
            />
          </div>

          <EChart option={option} height={280} ariaLabel="Simulated risk contributors" />
          <PredictionDisclaimer />
          <p className="text-2xs text-muted">
            This is an administrative decision-support estimate produced by a transparent weighted
            model. It does not constitute a statutory finding or a legal determination.
          </p>
        </div>
      </div>
    </Card>
  );
}

function SimTile({
  label,
  value,
  sub,
  tone = 'ink',
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'ink' | 'green' | 'red';
}) {
  const toneClass = tone === 'green' ? 'text-signal-green' : tone === 'red' ? 'text-signal-red' : 'text-ink';
  return (
    <div className="rounded-md border border-line/70 bg-paper/50 px-3 py-2">
      <p className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`metric text-[22px] font-semibold leading-none ${toneClass}`}>{value}</p>
      <p className="text-2xs capitalize text-muted">{sub}</p>
    </div>
  );
}
