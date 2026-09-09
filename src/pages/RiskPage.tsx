import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { ChartCard } from '@/components/charts/ChartCard';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { RiskBadge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Form';
import { StatTile } from '@/components/kpi/KpiCard';
import {
  ModelExplanationPanel,
  RiskContributorPanel,
  RiskScoreHeader,
  StageProbabilityChart,
  WhatIfSimulator,
} from '@/components/risk/RiskPanel';
import { getDataset } from '@/data/dataset';
import { useScope } from '@/hooks/useScope';
import { filterProjects, riskDistribution } from '@/services/analytics';
import { bubbleScatterOption, horizontalBarOption, riskDonutOption } from '@/components/charts/presets';
import { DELAY_DRIVERS, STAGE_LABEL, THEME } from '@/config/constants';
import { formatDate, relativeDays } from '@/lib/format';
import { mean, round } from '@/lib/stats';
import { PredictionDisclaimer } from '@/components/ui/Disclaimers';
import type { Project } from '@/types';

export default function RiskPage() {
  const navigate = useNavigate();
  const scope = useScope();
  const dataset = getDataset();
  const [params, setParams] = useSearchParams();

  const projects = useMemo(
    () => filterProjects(dataset.projects, scope).sort((a, b) => b.riskScore - a.riskScore),
    [dataset.projects, scope],
  );

  const selectedCode = params.get('project') ?? projects[0]?.code ?? '';
  const project = projects.find((p) => p.code === selectedCode) ?? projects[0];
  const prediction = project ? dataset.riskPredictions.find((r) => r.projectId === project.id) : undefined;

  const distribution = useMemo(() => riskDistribution(scope), [scope]);

  const driverImpact = useMemo(() => {
    return DELAY_DRIVERS.map((driver) => {
      const rows = projects.filter((p) => p.primaryDelayDriver === driver);
      return {
        driver,
        projects: rows.length,
        avgRisk: round(mean(rows.map((p) => p.riskScore)), 1),
        familiesAffected: rows.reduce((s, p) => s + p.affectedFamilies, 0),
      };
    }).sort((a, b) => a.avgRisk - b.avgRisk);
  }, [projects]);

  const [levelFilter, setLevelFilter] = useState<'ALL' | 'critical' | 'high' | 'medium' | 'low'>('ALL');
  const tableRows = projects.filter((p) => levelFilter === 'ALL' || p.riskLevel === levelFilter);

  const columns: Column<Project>[] = [
    { key: 'code', header: 'Code', accessor: (p) => p.code, render: (p) => <span className="metric">{p.code}</span> },
    { key: 'name', header: 'Project', accessor: (p) => p.name },
    { key: 'district', header: 'District', accessor: (p) => p.district },
    { key: 'stage', header: 'Stage', accessor: (p) => p.currentStage, render: (p) => STAGE_LABEL[p.currentStage] },
    { key: 'score', header: 'Risk score', accessor: (p) => p.riskScore, align: 'center', render: (p) => <RiskBadge level={p.riskLevel} score={p.riskScore} /> },
    { key: 'delay', header: 'Delay probability', accessor: (p) => p.delayProbability, align: 'right', render: (p) => <span className="metric">{p.delayProbability}%</span> },
    { key: 'driver', header: 'Primary driver', accessor: (p) => p.primaryDelayDriver },
    { key: 'pending', header: 'Pending', accessor: (p) => p.pendingDays, align: 'right', render: (p) => relativeDays(p.pendingDays) },
    { key: 'predicted', header: 'Predicted completion', accessor: (p) => p.predictedCompletion, render: (p) => formatDate(p.predictedCompletion) },
  ];

  if (!project || !prediction) {
    return (
      <Card>
        <p className="p-4 text-[13px] text-muted">No projects in the current scope.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Predictive Risk Intelligence"
        description="A transparent decision-support system. Every score is decomposed into named, measurable contributors so that administrators can act on causes rather than symptoms."
        trail={[{ label: 'Risk Intelligence' }]}
        actions={
          <>
            <Select
              className="w-72 py-1.5"
              aria-label="Select project"
              value={project.code}
              onChange={(e) => setParams({ project: e.target.value })}
              options={projects.slice(0, 250).map((p) => ({ value: p.code, label: `${p.code} · ${p.name}` }))}
            />
            <button className="btn-secondary" onClick={() => navigate('/scenario')}>
              National scenario simulator
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
        <StatTile label="Projects in scope" value={String(projects.length)} />
        <StatTile label="Critical" value={String(projects.filter((p) => p.riskLevel === 'critical').length)} tone="red" />
        <StatTile label="High" value={String(projects.filter((p) => p.riskLevel === 'high').length)} tone="amber" />
        <StatTile label="Medium" value={String(projects.filter((p) => p.riskLevel === 'medium').length)} />
        <StatTile label="Low" value={String(projects.filter((p) => p.riskLevel === 'low').length)} tone="green" />
        <StatTile label="Mean delay probability" value={`${round(mean(projects.map((p) => p.delayProbability)), 1)}%`} />
      </div>

      <RiskScoreHeader prediction={prediction} project={project} />

      <div className="grid gap-3 xl:grid-cols-2">
        <RiskContributorPanel prediction={prediction} />
        <div className="space-y-3">
          <StageProbabilityChart prediction={prediction} />
          <ModelExplanationPanel prediction={prediction} project={project} />
        </div>
      </div>

      <WhatIfSimulator project={project} />

      <div className="grid gap-3 xl:grid-cols-3">
        <ChartCard
          title="Risk distribution"
          subtitle="Projects by risk category"
          height={260}
          isEmpty={distribution.every((d) => d.value === 0)}
          option={riskDonutOption(distribution)}
          exportName="risk-distribution"
          exportRows={distribution.map((d) => ({ level: d.name, projects: d.value }))}
          footer={<PredictionDisclaimer />}
        />
        <ChartCard
          title="Average risk by delay driver"
          subtitle="Where systemic intervention has the largest effect"
          height={260}
          isEmpty={!driverImpact.length}
          option={horizontalBarOption(
            driverImpact.map((d) => d.driver),
            driverImpact.map((d) => d.avgRisk),
            { valueName: 'mean risk score', color: THEME.amber },
          )}
          exportName="risk-by-driver"
          exportRows={driverImpact}
        />
        <ChartCard
          title="Portfolio risk map"
          subtitle="Completion versus delay probability"
          height={260}
          isEmpty={!projects.length}
          option={bubbleScatterOption(
            projects.slice(0, 500).map((p) => ({
              value: [p.completionPercent, p.delayProbability, p.affectedFamilies],
              name: `${p.code} · ${p.name}`,
              risk: p.riskLevel,
            })),
          )}
          exportName="portfolio-risk-map"
          exportRows={projects.slice(0, 500).map((p) => ({
            code: p.code,
            completion: p.completionPercent,
            delayProbability: p.delayProbability,
            affectedFamilies: p.affectedFamilies,
            riskLevel: p.riskLevel,
          }))}
          onEvent={{
            click: (e) => {
              const data = (e as { data?: { name?: string } }).data;
              const codeValue = data?.name?.split(' · ')[0];
              if (codeValue) setParams({ project: codeValue });
            },
          }}
        />
      </div>

      <Card
        dense
        title="Risk register"
        actions={
          <Select
            className="w-32 py-1 text-2xs"
            aria-label="Filter risk level"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as typeof levelFilter)}
            options={[
              { value: 'ALL', label: 'All levels' },
              { value: 'critical', label: 'Critical' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ]}
          />
        }
        footer="Simulated prediction for prototype demonstration. Not a legal determination."
      >
        <DataTable
          rows={tableRows}
          columns={columns}
          rowKey={(p) => p.id}
          pageSize={12}
          onRowClick={(p) => setParams({ project: p.code })}
        />
      </Card>
    </div>
  );
}
