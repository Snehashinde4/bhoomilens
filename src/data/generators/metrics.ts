import { clamp, round } from '@/lib/stats';
import type { Rng } from '@/lib/rng';
import type {
  CompensationRecord,
  DistrictEntity,
  DistrictMetric,
  DocumentRecord,
  FraudAlert,
  MonthlyMetric,
  Parcel,
  Project,
  ReviewTask,
} from '@/types';

/** Rolling 24-month operational series ending at the demo reference date. */
export function generateMonthlyMetrics(rng: Rng, months = 24, end = new Date('2026-09-01')): MonthlyMetric[] {
  const out: MonthlyMetric[] = [];
  let uploadBase = 42_000;
  let accuracy = 88.4;

  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const seasonal = 1 + Math.sin((d.getMonth() / 12) * Math.PI * 2) * 0.12;
    uploadBase = clamp(uploadBase * rng.float(0.99, 1.06, 3), 24_000, 190_000);

    const uploaded = Math.round(uploadBase * seasonal);
    const processed = Math.round(uploaded * rng.float(0.82, 0.97, 3));
    const validated = Math.round(processed * rng.float(0.74, 0.93, 3));
    const review = processed - validated;
    accuracy = clamp(accuracy + rng.float(-0.5, 0.85, 2), 84, 97.5);

    const assessed = Math.round(rng.float(1.1, 3.4, 2) * 1e9 * seasonal);
    out.push({
      period,
      documentsUploaded: uploaded,
      documentsProcessed: processed,
      documentsValidated: validated,
      documentsSentForReview: review,
      compensationAssessed: assessed,
      compensationDisbursed: Math.round(assessed * rng.float(0.48, 0.86, 3)),
      digitizationAccuracy: round(accuracy, 1),
      parcelsDigitized: Math.round(uploaded * rng.float(0.6, 1.1, 2)),
      fraudAlerts: Math.round(rng.int(140, 620) * seasonal),
      interventionsClosed: rng.int(40, 260),
    });
  }
  return out;
}

export function generateDistrictMetrics(
  rng: Rng,
  districts: DistrictEntity[],
  projects: Project[],
  parcels: Parcel[],
  documents: DocumentRecord[],
  fraudAlerts: FraudAlert[],
  reviewQueue: ReviewTask[],
  compensation: CompensationRecord[],
): DistrictMetric[] {
  const projectsBy = countKey(projects, (p) => p.district);
  const parcelsBy = countKey(parcels, (p) => p.district);
  const docsBy = countKey(documents, (d) => d.district);
  const alertsBy = countKey(fraudAlerts, (a) => a.district);
  const reviewBy = countKey(
    reviewQueue.filter((r) => r.status !== 'completed'),
    (r) => r.district,
  );

  const compBy = new Map<string, { assessed: number; paid: number }>();
  for (const c of compensation) {
    const cur = compBy.get(c.district) ?? { assessed: 0, paid: 0 };
    cur.assessed += c.amountAssessed;
    cur.paid += c.amountPaid;
    compBy.set(c.district, cur);
  }

  const delayBy = new Map<string, number[]>();
  for (const p of projects) {
    const list = delayBy.get(p.district) ?? [];
    list.push(p.delayProbability);
    delayBy.set(p.district, list);
  }

  return districts.map((d) => {
    const comp = compBy.get(d.name) ?? { assessed: 0, paid: 0 };
    const delays = delayBy.get(d.name) ?? [];
    const acquisition = projects
      .filter((p) => p.district === d.name)
      .map((p) => (p.proposedArea ? (p.acquiredArea / p.proposedArea) * 100 : 0));

    return {
      id: rng.uuid(),
      district: d.name,
      state: d.state,
      digitizationProgress: round(clamp(rng.normal(64, 18, 8, 99), 8, 99), 1),
      digitizationAccuracy: round(clamp(rng.normal(91, 4.5, 74, 99), 74, 99), 1),
      fraudAlerts: alertsBy.get(d.name) ?? 0,
      reviewBacklog: reviewBy.get(d.name) ?? 0,
      compensationProgress: round(comp.assessed ? (comp.paid / comp.assessed) * 100 : rng.float(10, 90, 1), 1),
      acquisitionProgress: round(acquisition.length ? avg(acquisition) : rng.float(5, 88, 1), 1),
      delayProbability: round(delays.length ? avg(delays) : rng.float(18, 82, 1), 1),
      processingSpeedDocsPerDay: rng.int(40, 720),
      riskReduction: round(rng.float(-8, 26, 1), 1),
      interventionClosureRate: round(rng.float(18, 96, 1), 1),
      projects: projectsBy.get(d.name) ?? 0,
      parcels: parcelsBy.get(d.name) ?? 0,
      center: d.center,
    };
  });
}

function countKey<T>(items: T[], keyFn: (item: T) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = keyFn(item);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}
