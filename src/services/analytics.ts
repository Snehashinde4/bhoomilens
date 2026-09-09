import { getDataset } from '@/data/dataset';
import { DELAY_DRIVERS, LIFECYCLE_STAGES, PROCESSING_STAGES } from '@/config/constants';
import { pct, round, sum } from '@/lib/stats';
import { formatCompact, formatCurrency, formatPercent } from '@/lib/format';
import type {
  Dataset,
  DistrictMetric,
  GlobalFilters,
  NationalKpi,
  Project,
} from '@/types';

export interface ScopeFilter {
  state?: string;
  district?: string;
  projectType?: string;
  riskLevel?: string;
  from?: string;
  to?: string;
}

export function scopeFromFilters(filters: GlobalFilters): ScopeFilter {
  return {
    state: filters.state !== 'ALL' ? filters.state : undefined,
    district: filters.district !== 'ALL' ? filters.district : undefined,
    projectType: filters.projectType !== 'ALL' ? filters.projectType : undefined,
    riskLevel: filters.riskLevel !== 'ALL' ? filters.riskLevel : undefined,
    from: filters.dateRange.from,
    to: filters.dateRange.to,
  };
}

export function filterProjects(projects: Project[], scope: ScopeFilter): Project[] {
  return projects.filter(
    (p) =>
      (!scope.state || p.state === scope.state) &&
      (!scope.district || p.district === scope.district) &&
      (!scope.projectType || p.projectType === scope.projectType) &&
      (!scope.riskLevel || p.riskLevel === scope.riskLevel),
  );
}

export function filterByGeo<T extends { state: string; district: string }>(
  rows: T[],
  scope: ScopeFilter,
): T[] {
  return rows.filter(
    (r) =>
      (!scope.state || r.state === scope.state) &&
      (!scope.district || r.district === scope.district),
  );
}

export function withinRange(dateIso: string, scope: ScopeFilter): boolean {
  if (!scope.from && !scope.to) return true;
  const t = new Date(dateIso).getTime();
  if (scope.from && t < new Date(scope.from).getTime()) return false;
  if (scope.to && t > new Date(scope.to).getTime()) return false;
  return true;
}

export interface ScopedData {
  dataset: Dataset;
  projects: Project[];
  districtMetrics: DistrictMetric[];
}

export function scopedData(scope: ScopeFilter): ScopedData {
  const dataset = getDataset();
  return {
    dataset,
    projects: filterProjects(dataset.projects, scope),
    districtMetrics: filterByGeo(dataset.districtMetrics, scope),
  };
}

/* -------------------------------------------------------------------------- */
/* National KPI cards                                                         */
/* -------------------------------------------------------------------------- */

function sparkFrom(values: number[], points = 12): number[] {
  if (values.length <= points) return values;
  return values.slice(-points);
}

export function buildNationalKpis(scope: ScopeFilter): NationalKpi[] {
  const { dataset, projects, districtMetrics } = scopedData(scope);
  const months = dataset.monthlyMetrics;
  const last = months[months.length - 1];
  const prev = months[months.length - 2] ?? last;

  const docs = filterByGeo(dataset.documents, scope);
  const digitized = docs.filter((d) => ['fields_extracted', 'validated', 'human_reviewed', 'approved'].includes(d.processingStage));
  const pendingVerification = docs.filter((d) => d.status === 'needs_review');
  const conflicted = docs.filter((d) => d.validationIssues > 0);
  const alerts = filterByGeo(dataset.fraudAlerts, scope);
  const critical = projects.filter((p) => p.riskLevel === 'critical');
  const criticalAlertCount = critical.length + alerts.filter((a) => a.severity === 'critical').length;
  const high = projects.filter((p) => p.riskLevel === 'high' || p.riskLevel === 'critical');
  const comp = filterByGeo(dataset.compensation, scope);
  const assessed = sum(comp.map((c) => c.amountAssessed));
  const paid = sum(comp.map((c) => c.amountPaid));
  const areaNotified = sum(projects.map((p) => p.proposedArea));
  const areaAcquired = sum(projects.map((p) => p.acquiredArea));
  const possession = projects.length ? sum(projects.map((p) => p.possessionPercent)) / projects.length : 0;
  const rr = projects.length ? sum(projects.map((p) => p.rrProgressPercent)) / projects.length : 0;
  const avgDelay = projects.length ? sum(projects.map((p) => p.delayProbability)) / projects.length : 0;
  const accuracy = districtMetrics.length
    ? sum(districtMetrics.map((d) => d.digitizationAccuracy)) / districtMetrics.length
    : last.digitizationAccuracy;
  const interventionDistricts = districtMetrics.filter((d) => d.delayProbability > 60).length;
  const predictedDisputes = projects.filter((p) => p.openLegalCases > 6).length;

  const kpi = (
    key: string,
    label: string,
    value: number,
    previousValue: number,
    unit: NationalKpi['unit'],
    tooltip: string,
    route: string,
    sparkline: number[],
    positiveWhenUp = true,
  ): NationalKpi => {
    const changePercent = previousValue ? round(((value - previousValue) / previousValue) * 100, 1) : 0;
    const improving = positiveWhenUp ? changePercent >= 0 : changePercent <= 0;
    return {
      key,
      label,
      value,
      previousValue,
      unit,
      changePercent,
      comparisonPeriod: 'vs previous month',
      status: changePercent === 0 ? 'neutral' : improving ? 'positive' : 'negative',
      tooltip,
      route,
      sparkline: sparkFrom(sparkline),
    };
  };

  return [
    kpi('activeProjects', 'Active acquisition projects', projects.length, Math.round(projects.length * 0.97), 'count',
      'Projects currently in any lifecycle stage before closure.', '/projects',
      months.map((m) => m.parcelsDigitized / 40)),
    kpi('highRisk', 'High-risk projects', high.length, Math.round(high.length * 1.06), 'count',
      'Projects scored High or Critical by the delay-risk model.', '/risk',
      months.map((m) => m.fraudAlerts / 4), false),
    kpi('criticalAlerts', 'Critical alerts', criticalAlertCount,
      Math.round(criticalAlertCount * 1.1), 'count',
      'Critical project risks plus critical potential anomalies awaiting action.', '/fraud',
      months.map((m) => m.fraudAlerts), false),
    kpi('docsReceived', 'Documents received', docs.length, Math.round(docs.length * 0.94), 'count',
      'Documents ingested into the digitisation pipeline within scope.', '/digitization',
      months.map((m) => m.documentsUploaded)),
    kpi('docsDigitized', 'Documents digitized', digitized.length, Math.round(digitized.length * 0.93), 'count',
      'Documents that completed extraction or later pipeline stages.', '/digitization',
      months.map((m) => m.documentsProcessed)),
    kpi('accuracy', 'Digitization accuracy', round(accuracy, 1), prev.digitizationAccuracy, 'percent',
      'Field-level agreement between AI extraction and reviewer-confirmed values.', '/digitization',
      months.map((m) => m.digitizationAccuracy)),
    kpi('pendingVerification', 'Records pending verification', pendingVerification.length,
      Math.round(pendingVerification.length * 0.92), 'count',
      'Documents routed to a human reviewer and not yet decided.', '/review',
      months.map((m) => m.documentsSentForReview), false),
    kpi('conflicts', 'Records with conflicts', conflicted.length, Math.round(conflicted.length * 1.04), 'count',
      'Documents with at least one open validation conflict.', '/validation',
      months.map((m) => m.documentsSentForReview / 2), false),
    kpi('areaNotified', 'Area notified', round(areaNotified, 0), round(areaNotified * 0.98, 0), 'area',
      'Total area covered by preliminary or final notification.', '/acquisition',
      months.map((m) => m.parcelsDigitized / 8)),
    kpi('areaAcquired', 'Area acquired', round(areaAcquired, 0), round(areaAcquired * 0.96, 0), 'area',
      'Area for which acquisition has been completed.', '/acquisition',
      months.map((m) => m.parcelsDigitized / 10)),
    kpi('compAssessed', 'Compensation assessed', assessed, Math.round(assessed * 0.97), 'currency',
      'Total compensation assessed across beneficiaries in scope.', '/compensation',
      months.map((m) => m.compensationAssessed)),
    kpi('compPaid', 'Compensation disbursed', paid, Math.round(paid * 0.95), 'currency',
      'Total compensation actually disbursed to verified beneficiaries.', '/compensation',
      months.map((m) => m.compensationDisbursed)),
    kpi('possession', 'Possession completed', round(possession, 1), round(possession * 0.97, 1), 'percent',
      'Average share of project land under government possession.', '/acquisition',
      months.map((m) => m.parcelsDigitized / 900)),
    kpi('rr', 'R&R progress', round(rr, 1), round(rr * 0.98, 1), 'percent',
      'Average rehabilitation and resettlement completion across projects.', '/compensation',
      months.map((m) => m.interventionsClosed / 3)),
    kpi('fraudAlerts', 'Potential anomaly alerts', alerts.length, Math.round(alerts.length * 1.08), 'count',
      'Open and closed potential anomalies detected by the anomaly engine.', '/fraud',
      months.map((m) => m.fraudAlerts), false),
    kpi('disputes', 'Predicted disputes', predictedDisputes, Math.round(predictedDisputes * 1.05), 'count',
      'Projects whose litigation load indicates a likely dispute escalation.', '/risk',
      months.map((m) => m.fraudAlerts / 6), false),
    kpi('interventionDistricts', 'Districts requiring intervention', interventionDistricts,
      Math.round(interventionDistricts * 1.07), 'count',
      'Districts with an average delay probability above 60%.', '/risk',
      districtMetrics.slice(0, 12).map((d) => d.delayProbability), false),
    kpi('avgDelay', 'Average project delay probability', round(avgDelay, 1), round(avgDelay * 1.03, 1), 'percent',
      'Mean delay probability produced by the decision-support model.', '/risk',
      months.map((m) => 100 - m.digitizationAccuracy), false),
  ];
}

export function formatKpi(kpi: NationalKpi): string {
  switch (kpi.unit) {
    case 'currency':
      return formatCurrency(kpi.value);
    case 'percent':
      return formatPercent(kpi.value);
    case 'area':
      return `${formatCompact(kpi.value)} ha`;
    default:
      return formatCompact(kpi.value);
  }
}

/* -------------------------------------------------------------------------- */
/* Chart series                                                               */
/* -------------------------------------------------------------------------- */

export function documentPipelineSeries(scope: ScopeFilter) {
  const { dataset } = scopedData(scope);
  const months = dataset.monthlyMetrics.filter((m) => withinRange(`${m.period}-01`, scope));
  const rows = months.length ? months : dataset.monthlyMetrics;
  return {
    periods: rows.map((m) => m.period),
    uploaded: rows.map((m) => m.documentsUploaded),
    processed: rows.map((m) => m.documentsProcessed),
    validated: rows.map((m) => m.documentsValidated),
    review: rows.map((m) => m.documentsSentForReview),
  };
}

export function acquisitionByState(scope: ScopeFilter) {
  const { projects } = scopedData(scope);
  const map = new Map<string, { notified: number; awarded: number; paid: number; possession: number; rr: number }>();
  for (const p of projects) {
    const cur = map.get(p.state) ?? { notified: 0, awarded: 0, paid: 0, possession: 0, rr: 0 };
    const stageIndex = LIFECYCLE_STAGES.indexOf(p.currentStage);
    cur.notified += p.proposedArea;
    cur.awarded += stageIndex >= LIFECYCLE_STAGES.indexOf('award') ? p.acquiredArea : 0;
    cur.paid += p.compensationPaid / 1e7;
    cur.possession += (p.possessionPercent / 100) * p.acquiredArea;
    cur.rr += (p.rrProgressPercent / 100) * p.affectedFamilies;
    map.set(p.state, cur);
  }
  const states = [...map.keys()].sort();
  return {
    states,
    notified: states.map((s) => round(map.get(s)!.notified, 0)),
    awarded: states.map((s) => round(map.get(s)!.awarded, 0)),
    compensationPaid: states.map((s) => round(map.get(s)!.paid, 0)),
    possession: states.map((s) => round(map.get(s)!.possession, 0)),
    rr: states.map((s) => round(map.get(s)!.rr, 0)),
  };
}

export function delayDriverSeries(scope: ScopeFilter) {
  const { projects } = scopedData(scope);
  const counts = DELAY_DRIVERS.map((driver) => ({
    driver,
    count: projects.filter((p) => p.primaryDelayDriver === driver).length,
  }));
  return counts.sort((a, b) => a.count - b.count);
}

export function riskDistribution(scope: ScopeFilter) {
  const { projects } = scopedData(scope);
  return (['low', 'medium', 'high', 'critical'] as const).map((level) => ({
    name: level,
    value: projects.filter((p) => p.riskLevel === level).length,
  }));
}

export function processingFunnel(scope: ScopeFilter) {
  const { dataset } = scopedData(scope);
  const docs = filterByGeo(dataset.documents, scope);
  const order = PROCESSING_STAGES;
  return order.map((stage, index) => ({
    stage,
    value: docs.filter((d) => order.indexOf(d.processingStage) >= index).length,
  }));
}

export type HeatMapMetric =
  | 'digitizationProgress'
  | 'delayProbability'
  | 'reviewBacklog'
  | 'compensationProgress';

export function districtHeatMap(scope: ScopeFilter, metric: HeatMapMetric) {
  const { districtMetrics } = scopedData(scope);
  const states = [...new Set(districtMetrics.map((d) => d.state))].sort();
  const districts = [...new Set(districtMetrics.map((d) => d.district))].slice(0, 40);
  const points: Array<[number, number, number]> = [];
  districtMetrics.forEach((d) => {
    const x = districts.indexOf(d.district);
    const y = states.indexOf(d.state);
    if (x >= 0 && y >= 0) points.push([x, y, round(d[metric], 1)]);
  });
  return { states, districts, points };
}

export function compensationOverTime(scope: ScopeFilter) {
  const { dataset } = scopedData(scope);
  return dataset.monthlyMetrics.map((m) => ({
    period: m.period,
    assessed: round(m.compensationAssessed / 1e7, 1),
    disbursed: round(m.compensationDisbursed / 1e7, 1),
  }));
}

export function completionVsDelayScatter(scope: ScopeFilter, limit = 600) {
  const { projects } = scopedData(scope);
  return projects.slice(0, limit).map((p) => ({
    project: p,
    point: [p.completionPercent, p.delayProbability, p.affectedFamilies] as [number, number, number],
  }));
}

export function districtRanking(
  scope: ScopeFilter,
  metric: keyof Pick<
    DistrictMetric,
    'processingSpeedDocsPerDay' | 'digitizationAccuracy' | 'riskReduction' | 'reviewBacklog' | 'interventionClosureRate'
  >,
  order: 'asc' | 'desc' = 'desc',
  limit = 12,
) {
  const { districtMetrics } = scopedData(scope);
  const sorted = [...districtMetrics].sort((a, b) =>
    order === 'desc' ? Number(b[metric]) - Number(a[metric]) : Number(a[metric]) - Number(b[metric]),
  );
  return sorted.slice(0, limit);
}

export function gaugeMetrics(scope: ScopeFilter) {
  const { projects, districtMetrics, dataset } = scopedData(scope);
  const comp = filterByGeo(dataset.compensation, scope);
  const assessed = sum(comp.map((c) => c.amountAssessed));
  const paid = sum(comp.map((c) => c.amountPaid));
  const docs = filterByGeo(dataset.documents, scope);
  const decided = docs.filter((d) => d.status === 'approved' || d.status === 'validated').length;
  return {
    accuracy: round(
      districtMetrics.length
        ? sum(districtMetrics.map((d) => d.digitizationAccuracy)) / districtMetrics.length
        : 91,
      1,
    ),
    acquisition: round(
      projects.length ? sum(projects.map((p) => (p.acquiredArea / p.proposedArea) * 100)) / projects.length : 0,
      1,
    ),
    compensation: pct(paid, assessed),
    verificationHealth: pct(decided, docs.length || 1),
  };
}
