import { LIFECYCLE_STAGES, STAGE_LABEL } from '@/config/constants';
import { appConfig } from '@/config/appConfig';
import { clamp, round } from '@/lib/stats';
import { addDays, iso } from '@/lib/format';
import type {
  DelayDriver,
  LifecycleStage,
  Project,
  RiskContributor,
  RiskLevel,
  RiskPrediction,
} from '@/types';

export const MODEL_VERSION = 'bhoomilens-delay-risk-v2.4.1';

/**
 * Feature vector consumed by the delay-risk scorer. Every feature is normalised
 * to 0..1 where 1 always means "worse for the project", so the weighted sum is
 * directly interpretable and can be explained factor by factor.
 */
export interface RiskFeatures {
  compensationGap: number;
  legalCaseLoad: number;
  approvalAgingDays: number;
  missingDocuments: number;
  stakeholderResponse: number;
  rrGap: number;
  surveyDiscrepancy: number;
  gisConflict: number;
  verificationCapacity: number;
  fieldTeamCapacity: number;
}

interface FactorDefinition {
  key: keyof RiskFeatures;
  label: string;
  weight: number;
  unit: string;
  normalise: (value: number) => number;
  explain: (value: number) => string;
  driver: DelayDriver;
}

/**
 * Weights are calibrated against the delay-driver distribution used by the
 * synthetic engine. In production these come from the trained model registry.
 */
export const FACTORS: FactorDefinition[] = [
  {
    key: 'compensationGap',
    label: 'Compensation pending',
    weight: 22,
    unit: '% unpaid',
    driver: 'Compensation Delays',
    normalise: (v) => clamp(v / 70, 0, 1),
    explain: (v) => `${round(v, 1)}% of assessed compensation is still undisbursed.`,
  },
  {
    key: 'legalCaseLoad',
    label: 'Legal disputes',
    weight: 19,
    unit: 'open cases',
    driver: 'Legal Disputes',
    normalise: (v) => clamp(v / 18, 0, 1),
    explain: (v) => `${Math.round(v)} open legal cases are attached to this project.`,
  },
  {
    key: 'approvalAgingDays',
    label: 'Approval aging',
    weight: 14,
    unit: 'days pending',
    driver: 'Approval Delays',
    normalise: (v) => clamp(v / 400, 0, 1),
    explain: (v) => `Current stage has been pending for ${Math.round(v)} days.`,
  },
  {
    key: 'missingDocuments',
    label: 'Incomplete documents',
    weight: 12,
    unit: 'records',
    driver: 'Missing Records',
    normalise: (v) => clamp(v / 260, 0, 1),
    explain: (v) => `${Math.round(v)} land records are missing or unverified.`,
  },
  {
    key: 'stakeholderResponse',
    label: 'Low stakeholder response',
    weight: 8,
    unit: '% response',
    driver: 'Stakeholder Response',
    normalise: (v) => clamp((100 - v) / 55, 0, 1),
    explain: (v) => `Affected-family response rate is ${round(v, 1)}%.`,
  },
  {
    key: 'rrGap',
    label: 'R&R delays',
    weight: 10,
    unit: '% pending',
    driver: 'R&R Delays',
    normalise: (v) => clamp(v / 75, 0, 1),
    explain: (v) => `${round(v, 1)}% of rehabilitation entitlements are outstanding.`,
  },
  {
    key: 'surveyDiscrepancy',
    label: 'Survey discrepancy',
    weight: 6,
    unit: '% parcels',
    driver: 'Missing Records',
    normalise: (v) => clamp(v / 28, 0, 1),
    explain: (v) => `${round(v, 1)}% of parcels show survey/record discrepancies.`,
  },
  {
    key: 'gisConflict',
    label: 'GIS boundary conflict',
    weight: 9,
    unit: 'parcels',
    driver: 'GIS Conflicts',
    normalise: (v) => clamp(v / 90, 0, 1),
    explain: (v) => `${Math.round(v)} parcels have unresolved boundary overlaps.`,
  },
  {
    key: 'verificationCapacity',
    label: 'Verification capacity',
    weight: 6,
    unit: 'officers',
    driver: 'Missing Records',
    normalise: (v) => clamp((14 - v) / 11, 0, 1),
    explain: (v) => `${Math.round(v)} verification officers assigned against the district norm of 14.`,
  },
  {
    key: 'fieldTeamCapacity',
    label: 'Field-team capacity',
    weight: 4,
    unit: 'teams',
    driver: 'Stakeholder Response',
    normalise: (v) => clamp((12 - v) / 9, 0, 1),
    explain: (v) => `${Math.round(v)} field teams deployed against the sanctioned strength of 12.`,
  },
];

const TOTAL_WEIGHT = FACTORS.reduce((s, f) => s + f.weight, 0);

export function riskLevelOf(score: number): RiskLevel {
  if (score >= 80) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export interface ScoreResult {
  score: number;
  level: RiskLevel;
  delayProbability: number;
  contributors: RiskContributor[];
}

export function scoreRisk(features: RiskFeatures): ScoreResult {
  const contributors: RiskContributor[] = FACTORS.map((f) => {
    const raw = features[f.key];
    const normalised = f.normalise(raw);
    return {
      factor: f.label,
      contribution: round((normalised * f.weight * 100) / TOTAL_WEIGHT, 1),
      value: round(raw, 1),
      unit: f.unit,
      direction: normalised > 0.5 ? 'increases' : 'reduces',
      explanation: f.explain(raw),
    };
  });
  const score = round(
    contributors.reduce((s, c) => s + c.contribution, 0),
    0,
  );
  // Delay probability is a logistic transform of the linear score.
  const delayProbability = round(100 / (1 + Math.exp(-(score - 50) / 22)), 0);
  return {
    score: clamp(score, 1, 99),
    level: riskLevelOf(score),
    delayProbability: clamp(delayProbability, 2, 98),
    contributors: contributors.sort((a, b) => b.contribution - a.contribution),
  };
}

export function featuresFromProject(project: Project, extra?: Partial<RiskFeatures>): RiskFeatures {
  const compGap =
    project.compensationAssessed > 0
      ? ((project.compensationAssessed - project.compensationPaid) / project.compensationAssessed) * 100
      : 0;
  return {
    compensationGap: compGap,
    legalCaseLoad: project.openLegalCases,
    approvalAgingDays: project.pendingDays,
    missingDocuments: project.openDocumentConflicts,
    stakeholderResponse: clamp(100 - project.pendingDays / 8, 25, 96),
    rrGap: 100 - project.rrProgressPercent,
    surveyDiscrepancy: clamp(project.gisDiscrepancies / 6, 0, 40),
    gisConflict: project.gisDiscrepancies,
    verificationCapacity: clamp(14 - project.openDocumentConflicts / 40, 2, 14),
    fieldTeamCapacity: clamp(12 - project.openLegalCases / 3, 2, 12),
    ...extra,
  };
}

export function stageProbabilities(
  project: Project,
  score: number,
): Array<{ stage: LifecycleStage; probability: number }> {
  const currentIndex = LIFECYCLE_STAGES.indexOf(project.currentStage);
  const stageBias: Partial<Record<LifecycleStage, number>> = {
    approval: 1.15,
    notification: 1.05,
    objection_handling: 1.2,
    award: 1.25,
    compensation: 1.3,
    possession: 1.1,
    rehabilitation: 1.18,
  };
  return LIFECYCLE_STAGES.map((stage, index) => {
    const distance = index - currentIndex;
    const base = distance < 0 ? score * 0.25 : score * (1 - Math.min(distance, 6) * 0.07);
    const probability = clamp(round(base * (stageBias[stage] ?? 1), 0), 3, 97);
    return { stage, probability };
  });
}

export function buildPrediction(
  project: Project,
  districtBaseline: number,
  dataCompleteness: number,
  now = new Date(),
): RiskPrediction {
  const features = featuresFromProject(project);
  const result = scoreRisk(features);
  const slipDays = Math.round((result.delayProbability / 100) * 540);
  const top = result.contributors[0];
  return {
    id: `${project.id}-risk`,
    projectId: project.id,
    riskScore: project.riskScore,
    riskLevel: project.riskLevel,
    delayProbability: project.delayProbability,
    predictedCompletion: iso(addDays(project.plannedCompletion, slipDays)),
    districtBaseline,
    modelConfidence: round(clamp(72 + dataCompleteness * 0.22, 60, 95), 0),
    dataCompleteness: round(dataCompleteness, 0),
    modelVersion: MODEL_VERSION,
    lastRunAt: iso(now),
    stageProbabilities: stageProbabilities(project, project.riskScore),
    contributors: result.contributors,
    recommendedIntervention: recommendIntervention(top?.factor ?? 'Compensation pending'),
    expectedEffect: `Expected reduction of ${Math.max(6, Math.round(top?.contribution ?? 8))} risk points within 60 days of action.`,
    disclaimer: appConfig.predictionDisclaimer,
  };
}

export function recommendIntervention(factor: string): string {
  const map: Record<string, string> = {
    'Compensation pending':
      'Convene a weekly disbursement camp with the treasury and bank nodal officers; clear verified beneficiaries first.',
    'Legal disputes':
      'Constitute a dedicated legal cell, seek early hearing dates and prioritise parcels with a single disputed field.',
    'Approval aging':
      'Escalate pending approvals to the divisional commissioner with a 15-day statutory reminder.',
    'Incomplete documents':
      'Deploy a mobile digitisation unit to the tehsil office and prioritise missing mutation registers.',
    'Low stakeholder response':
      'Run a gram-sabha outreach cycle with a village-level facilitation desk for objections.',
    'R&R delays':
      'Accelerate resettlement site allotment and publish the entitlement matrix at the panchayat office.',
    'Survey discrepancy':
      'Order a re-survey of flagged parcels using differential GNSS and reconcile with the record of rights.',
    'GIS boundary conflict':
      'Assign a GIS analyst to reconcile overlapping geometries against the cadastral base map.',
    'Verification capacity':
      'Temporarily augment the verification cell with two additional officers from adjoining tehsils.',
    'Field-team capacity':
      'Add one field survey team and re-sequence inspections by risk priority.',
  };
  return map[factor] ?? 'Assign a nodal officer and review the case at the weekly district review meeting.';
}

/** What-if inputs used by the Risk Simulator and National Scenario Simulator. */
export interface SimulationInput {
  compensationCompletion: number;
  pendingApprovalDays: number;
  legalCases: number;
  missingDocuments: number;
  verificationCapacity: number;
  fieldTeamCapacity: number;
  rrProgress: number;
  stakeholderResponse: number;
  gisConflicts: number;
}

export function simulationInputFromProject(project: Project): SimulationInput {
  const f = featuresFromProject(project);
  return {
    compensationCompletion: round(100 - f.compensationGap, 0),
    pendingApprovalDays: Math.round(f.approvalAgingDays),
    legalCases: Math.round(f.legalCaseLoad),
    missingDocuments: Math.round(f.missingDocuments),
    verificationCapacity: Math.round(f.verificationCapacity),
    fieldTeamCapacity: Math.round(f.fieldTeamCapacity),
    rrProgress: round(100 - f.rrGap, 0),
    stakeholderResponse: round(f.stakeholderResponse, 0),
    gisConflicts: Math.round(f.gisConflict),
  };
}

export function simulate(input: SimulationInput): ScoreResult {
  return scoreRisk({
    compensationGap: 100 - input.compensationCompletion,
    legalCaseLoad: input.legalCases,
    approvalAgingDays: input.pendingApprovalDays,
    missingDocuments: input.missingDocuments,
    stakeholderResponse: input.stakeholderResponse,
    rrGap: 100 - input.rrProgress,
    surveyDiscrepancy: clamp(input.gisConflicts / 6, 0, 40),
    gisConflict: input.gisConflicts,
    verificationCapacity: input.verificationCapacity,
    fieldTeamCapacity: input.fieldTeamCapacity,
  });
}

/** Projected completion date shift for a simulated scenario. */
export function projectedCompletion(baseline: Project, delayProbability: number): Date {
  return addDays(baseline.plannedCompletion, Math.round((delayProbability / 100) * 540));
}

export function stageLabel(stage: LifecycleStage): string {
  return STAGE_LABEL[stage];
}
