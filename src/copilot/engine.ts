import { getDataset } from '@/data/dataset';
import { appConfig } from '@/config/appConfig';
import { hasPermission } from '@/auth/roles';
import { formatCompact, formatCurrency, formatDate, formatPercent } from '@/lib/format';
import { STAGE_LABEL } from '@/config/constants';
import type { Permission, RoleId } from '@/types';

export interface CopilotCitation {
  label: string;
  route: string;
  kind: string;
}

export interface CopilotAnswer {
  intent: string;
  headline: string;
  facts: string[];
  predictions: string[];
  citations: CopilotCitation[];
  calculation?: string;
  confidence: number;
  followUps: string[];
  denied?: boolean;
}

interface Intent {
  id: string;
  permission: Permission;
  match: RegExp;
  run: (query: string, groups: RegExpMatchArray) => CopilotAnswer;
}

const NO_INVENTION_NOTE =
  'Answers are generated only from records present in this environment. No external policies, judgements or citations are produced.';

function answer(partial: Partial<CopilotAnswer> & Pick<CopilotAnswer, 'intent' | 'headline'>): CopilotAnswer {
  return {
    facts: [],
    predictions: [],
    citations: [],
    confidence: 82,
    followUps: [],
    ...partial,
  };
}

const INTENTS: Intent[] = [
  {
    id: 'high_risk_by_state',
    permission: 'risk.view',
    match: /(high[- ]risk|critical).*(project|projects)(?:\s+in\s+([a-z ]+))?/i,
    run: (_q, g) => {
      const ds = getDataset();
      const stateQuery = (g[3] ?? '').trim().toLowerCase();
      const rows = ds.projects
        .filter((p) => p.riskLevel === 'high' || p.riskLevel === 'critical')
        .filter((p) => !stateQuery || p.state.toLowerCase().includes(stateQuery))
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 8);
      return answer({
        intent: 'high_risk_by_state',
        headline: `${rows.length} high or critical risk projects${stateQuery ? ` in ${rows[0]?.state ?? stateQuery}` : ' nationally (top 8 shown)'}`,
        facts: rows.map(
          (p) =>
            `${p.code} · ${p.name} — ${p.district}: risk ${p.riskScore}/100 (${p.riskLevel}), primary driver ${p.primaryDelayDriver}.`,
        ),
        predictions: rows
          .slice(0, 3)
          .map((p) => `${p.code}: delay probability ${p.delayProbability}%, predicted completion ${formatDate(p.predictedCompletion)}.`),
        citations: rows.map((p) => ({ label: p.code, route: `/projects/${p.code}`, kind: 'Project' })),
        calculation:
          'Risk = weighted sum of ten normalised delay factors (compensation gap, litigation, approval aging, record completeness, stakeholder response, R&R gap, survey discrepancy, GIS conflicts, verification and field capacity).',
        confidence: 88,
        followUps: ['Why is NH-48 Expansion Package 3 high-risk?', 'Generate district intervention report'],
      });
    },
  },
  {
    id: 'why_delayed',
    permission: 'risk.view',
    match: /why\s+is\s+(.+?)\s+(high[- ]risk|delayed|at risk)/i,
    run: (_q, g) => {
      const ds = getDataset();
      const needle = g[1].trim().toLowerCase();
      const project =
        ds.projects.find((p) => p.name.toLowerCase().includes(needle)) ??
        ds.projects.find((p) => p.code.toLowerCase() === needle);
      if (!project) {
        return answer({
          intent: 'why_delayed',
          headline: 'No matching project found in this environment',
          facts: [`No project name or code matches "${g[1].trim()}".`],
          confidence: 40,
          followUps: ['Show high-risk projects in Rajasthan'],
        });
      }
      const prediction = ds.riskPredictions.find((r) => r.projectId === project.id);
      const top = prediction?.contributors.slice(0, 4) ?? [];
      return answer({
        intent: 'why_delayed',
        headline: `${project.name} scores ${project.riskScore}/100 (${project.riskLevel})`,
        facts: [
          `Current stage: ${STAGE_LABEL[project.currentStage]}, pending ${project.pendingDays} days.`,
          `Compensation: ${formatCurrency(project.compensationPaid)} disbursed of ${formatCurrency(project.compensationAssessed)} assessed.`,
          `Open legal cases: ${project.openLegalCases}; document conflicts: ${project.openDocumentConflicts}; GIS discrepancies: ${project.gisDiscrepancies}.`,
          ...top.map((c) => `${c.factor}: contributes ${c.contribution} risk points — ${c.explanation}`),
        ],
        predictions: [
          `Delay probability ${project.delayProbability}% against a district baseline of ${prediction?.districtBaseline ?? '—'}%.`,
          `Predicted completion ${formatDate(project.predictedCompletion)} versus planned ${formatDate(project.plannedCompletion)}.`,
        ],
        citations: [
          { label: project.code, route: `/projects/${project.code}`, kind: 'Project' },
          { label: 'Risk model explanation', route: `/risk?project=${project.code}`, kind: 'Model' },
        ],
        calculation: `Model ${prediction?.modelVersion ?? 'n/a'}; data completeness ${prediction?.dataCompleteness ?? '—'}%; confidence ${prediction?.modelConfidence ?? '—'}%.`,
        confidence: prediction?.modelConfidence ?? 80,
        followUps: ['Generate an intervention note', 'Show unresolved legal conflicts'],
      });
    },
  },
  {
    id: 'low_confidence_fields',
    permission: 'document.view',
    match: /(low|poor).*(confidence|ocr)/i,
    run: () => {
      const ds = getDataset();
      const rows = ds.documents
        .filter((d) => d.ocrConfidence < 72)
        .sort((a, b) => a.ocrConfidence - b.ocrConfidence)
        .slice(0, 8);
      return answer({
        intent: 'low_confidence_fields',
        headline: `${ds.documents.filter((d) => d.ocrConfidence < 72).length} documents below the 72% confidence threshold`,
        facts: rows.map(
          (d) => `${d.code} · ${d.documentType} (${d.language.toUpperCase()}, ${d.isHandwritten ? 'handwritten' : 'printed'}) — ${d.ocrConfidence}% confidence, ${d.district}.`,
        ),
        citations: rows.map((d) => ({ label: d.code, route: `/digitization/${d.code}`, kind: 'Document' })),
        calculation: 'Confidence is the page-weighted mean OCR score reported by the extraction pipeline.',
        confidence: 90,
        followUps: ['Find owner conflicts above 85% confidence', 'Show records pending verification'],
      });
    },
  },
  {
    id: 'boundary_overlap',
    permission: 'gis.view',
    match: /(boundary|overlap|gis).*(conflict|overlap|mismatch|discrepan)/i,
    run: () => {
      const ds = getDataset();
      const rows = ds.parcels
        .filter((p) => Math.abs(p.area - p.gisArea) / p.area > 0.12)
        .slice(0, 8);
      return answer({
        intent: 'boundary_overlap',
        headline: `${ds.parcels.filter((p) => Math.abs(p.area - p.gisArea) / p.area > 0.12).length} parcels show an area deviation above 12%`,
        facts: rows.map(
          (p) =>
            `${p.parcelId} (survey ${p.surveyNumber}, ${p.village}): recorded ${p.area} ha vs GIS ${p.gisArea} ha — deviation ${formatPercent(Math.abs((p.area - p.gisArea) / p.area) * 100)}.`,
        ),
        citations: rows.map((p) => ({ label: p.parcelId, route: `/twins/${p.parcelId}`, kind: 'Parcel' })),
        calculation: 'Deviation = |recorded area − polygon area| ÷ recorded area, using the cadastral polygon in the GIS layer.',
        confidence: 86,
        followUps: ['Explain the trust score for parcel BL-184', 'Open GIS Explorer'],
      });
    },
  },
  {
    id: 'pending_compensation',
    permission: 'compensation.view',
    match: /(pending|outstanding|unpaid).*(compensation|payment|disburse)/i,
    run: () => {
      const ds = getDataset();
      const pending = ds.compensation.filter((c) => c.amountPaid < c.amountAssessed);
      const assessed = pending.reduce((s, c) => s + c.amountAssessed, 0);
      const paid = pending.reduce((s, c) => s + c.amountPaid, 0);
      const byDistrict = new Map<string, number>();
      pending.forEach((c) => byDistrict.set(c.district, (byDistrict.get(c.district) ?? 0) + (c.amountAssessed - c.amountPaid)));
      const top = [...byDistrict.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
      return answer({
        intent: 'pending_compensation',
        headline: `${formatCompact(pending.length)} beneficiary records carry an outstanding balance`,
        facts: [
          `Outstanding amount: ${formatCurrency(assessed - paid)} of ${formatCurrency(assessed)} assessed.`,
          ...top.map(([district, amount]) => `${district}: ${formatCurrency(amount)} outstanding.`),
        ],
        citations: [{ label: 'Compensation & R&R', route: '/compensation', kind: 'Module' }],
        calculation: 'Outstanding = Σ(amount assessed − amount paid) over records with a positive balance.',
        confidence: 92,
        followUps: ['Show payment failures by reason', 'Generate district intervention report'],
      });
    },
  },
  {
    id: 'legal_conflicts',
    permission: 'project.view',
    match: /(legal|court|litigation).*(conflict|case|dispute)/i,
    run: () => {
      const ds = getDataset();
      const open = ds.legalCases.filter((c) => c.status !== 'disposed');
      const critical = open.filter((c) => c.impact === 'critical' || c.impact === 'high').slice(0, 8);
      return answer({
        intent: 'legal_conflicts',
        headline: `${formatCompact(open.length)} legal cases are unresolved`,
        facts: critical.map((c) => {
          const project = ds.projects.find((p) => p.id === c.projectId);
          return `${c.caseNumber} · ${c.court} — ${c.subject} (${c.status}); project ${project?.code ?? '—'}.`;
        }),
        citations: critical
          .map((c) => ds.projects.find((p) => p.id === c.projectId))
          .filter(Boolean)
          .slice(0, 6)
          .map((p) => ({ label: p!.code, route: `/projects/${p!.code}`, kind: 'Project' })),
        confidence: 84,
        followUps: ['Show high-risk projects in Rajasthan'],
      });
    },
  },
  {
    id: 'trust_score',
    permission: 'parcel.view',
    match: /trust score.*(bl-?\s?\d+)|(bl-?\s?\d+).*trust/i,
    run: (query) => {
      const ds = getDataset();
      const match = query.match(/bl-?\s?(\d+)/i);
      const parcel = ds.parcels.find((p) => p.parcelId.toLowerCase() === `bl-${match?.[1]}`);
      if (!parcel) {
        return answer({
          intent: 'trust_score',
          headline: 'Parcel not found',
          facts: ['No parcel with that identifier exists in this environment.'],
          confidence: 35,
        });
      }
      const deviation = Math.abs(parcel.area - parcel.gisArea) / parcel.area;
      return answer({
        intent: 'trust_score',
        headline: `${parcel.parcelId} trust score ${parcel.trustScore}/100, health score ${parcel.healthScore}/100`,
        facts: [
          `Owner of record: ${parcel.owner}; ownership type ${parcel.ownershipType}; legal status ${parcel.legalStatus}.`,
          `Area deviation between record and cadastral polygon: ${formatPercent(deviation * 100)}.`,
          `Acquisition status ${parcel.acquisitionStatus}; possession ${parcel.possessionStatus}; tax ${parcel.taxStatus}.`,
          `Signals: ownership consistency, mutation continuity, registry match, document authenticity, duplicate claims, litigation, GIS match.`,
        ],
        citations: [{ label: parcel.parcelId, route: `/twins/${parcel.parcelId}`, kind: 'Parcel' }],
        calculation: 'Trust score penalises area deviation, litigation and unverified mutations; it is an administrative indicator, not a title certification.',
        confidence: 87,
        followUps: ['Show parcels with boundary overlap'],
      });
    },
  },
  {
    id: 'district_comparison',
    permission: 'reports.view',
    match: /(compare|comparison|across).*(district|state)/i,
    run: () => {
      const ds = getDataset();
      const top = [...ds.districtMetrics].sort((a, b) => b.digitizationProgress - a.digitizationProgress).slice(0, 5);
      const bottom = [...ds.districtMetrics].sort((a, b) => a.digitizationProgress - b.digitizationProgress).slice(0, 5);
      return answer({
        intent: 'district_comparison',
        headline: 'Digitisation progress varies widely across districts',
        facts: [
          ...top.map((d) => `Leading: ${d.district} (${d.state}) — ${formatPercent(d.digitizationProgress)} digitised, accuracy ${formatPercent(d.digitizationAccuracy)}.`),
          ...bottom.map((d) => `Lagging: ${d.district} (${d.state}) — ${formatPercent(d.digitizationProgress)} digitised, backlog ${d.reviewBacklog} tasks.`),
        ],
        citations: [{ label: 'District performance report', route: '/reports', kind: 'Report' }],
        confidence: 89,
        followUps: ['Generate district intervention report'],
      });
    },
  },
  {
    id: 'intervention_note',
    permission: 'project.intervene',
    match: /(generate|draft|create).*(intervention|note|report)/i,
    run: () => {
      const ds = getDataset();
      const worst = [...ds.projects].sort((a, b) => b.riskScore - a.riskScore)[0];
      const prediction = ds.riskPredictions.find((r) => r.projectId === worst.id);
      return answer({
        intent: 'intervention_note',
        headline: `Draft intervention note for ${worst.name}`,
        facts: [
          `Subject: administrative intervention for ${worst.code} (${worst.district}, ${worst.state}).`,
          `Observed position: stage ${STAGE_LABEL[worst.currentStage]} pending ${worst.pendingDays} days; ${worst.openLegalCases} legal cases; ${formatCurrency(worst.compensationAssessed - worst.compensationPaid)} compensation outstanding.`,
          `Recommended action: ${prediction?.recommendedIntervention ?? 'Assign a nodal officer and review weekly.'}`,
          `Expected effect: ${prediction?.expectedEffect ?? 'Risk reduction on the next model run.'}`,
        ],
        predictions: [`Current delay probability ${worst.delayProbability}%.`],
        citations: [
          { label: worst.code, route: `/projects/${worst.code}`, kind: 'Project' },
          { label: 'Report centre', route: '/reports', kind: 'Report' },
        ],
        confidence: 80,
        followUps: ['Open the report centre to export this note'],
      });
    },
  },
  {
    id: 'anomalies',
    permission: 'fraud.view',
    match: /(fraud|anomal|duplicate|suspicious)/i,
    run: () => {
      const ds = getDataset();
      const open = ds.fraudAlerts.filter((a) => a.status === 'new' || a.status === 'under_investigation');
      const top = [...open].sort((a, b) => b.anomalyScore - a.anomalyScore).slice(0, 6);
      return answer({
        intent: 'anomalies',
        headline: `${formatCompact(open.length)} potential anomalies are open`,
        facts: top.map((a) => `${a.code} · ${a.category} (${a.severity}) — ${a.summary}`),
        citations: top.map((a) => ({ label: a.code, route: '/fraud', kind: 'Alert' })),
        calculation: 'Anomaly score is derived from parcel trust signals and rule detections; every item remains a potential anomaly until officially investigated.',
        confidence: 83,
        followUps: ['Show parcels with boundary overlap'],
      });
    },
  },
];

export function askLandGpt(query: string, role: RoleId): CopilotAnswer {
  const trimmed = query.trim();
  if (!trimmed) {
    return answer({
      intent: 'empty',
      headline: 'Ask a question about projects, parcels, documents or compensation',
      facts: [NO_INVENTION_NOTE],
      confidence: 100,
      followUps: SUGGESTED_QUERIES.slice(0, 4),
    });
  }

  for (const intent of INTENTS) {
    const groups = trimmed.match(intent.match);
    if (!groups) continue;
    if (!hasPermission(role, intent.permission)) {
      return answer({
        intent: intent.id,
        headline: 'Your role does not have access to this information',
        facts: [
          `Answering this question requires the "${intent.permission}" permission, which is not granted to your role.`,
        ],
        confidence: 100,
        denied: true,
        followUps: ['Switch to another demo role using the header control'],
      });
    }
    return intent.run(trimmed, groups);
  }

  return fallbackSearch(trimmed, role);
}

function fallbackSearch(query: string, role: RoleId): CopilotAnswer {
  const ds = getDataset();
  const q = query.toLowerCase();
  const citations: CopilotCitation[] = [];
  const facts: string[] = [];

  if (hasPermission(role, 'project.view')) {
    ds.projects
      .filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.district.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((p) => {
        facts.push(`${p.code} · ${p.name} — ${p.district}, ${p.state}; stage ${STAGE_LABEL[p.currentStage]}; risk ${p.riskScore}.`);
        citations.push({ label: p.code, route: `/projects/${p.code}`, kind: 'Project' });
      });
  }
  if (hasPermission(role, 'parcel.view')) {
    ds.parcels
      .filter((p) => p.parcelId.toLowerCase() === q || p.owner.toLowerCase().includes(q) || p.surveyNumber.toLowerCase() === q)
      .slice(0, 4)
      .forEach((p) => {
        facts.push(`${p.parcelId} · ${p.owner} — survey ${p.surveyNumber}, ${p.village}; trust ${p.trustScore}.`);
        citations.push({ label: p.parcelId, route: `/twins/${p.parcelId}`, kind: 'Parcel' });
      });
  }

  if (!facts.length) {
    return answer({
      intent: 'unknown',
      headline: 'No records in this environment match that question',
      facts: [
        NO_INVENTION_NOTE,
        'Try one of the supported question patterns listed below.',
      ],
      confidence: 30,
      followUps: SUGGESTED_QUERIES.slice(0, 5),
    });
  }

  return answer({
    intent: 'search',
    headline: `${facts.length} matching record(s)`,
    facts,
    citations,
    confidence: 74,
    followUps: SUGGESTED_QUERIES.slice(0, 3),
  });
}

export const SUGGESTED_QUERIES = [
  'Show high-risk projects in Rajasthan',
  'Why is NH-48 Expansion Package 3 high-risk?',
  'Find records with low owner-name confidence',
  'Show parcels with boundary overlap',
  'Summarize pending compensation cases',
  'Generate an intervention note',
  'Show unresolved legal conflicts',
  'Explain the trust score for parcel BL-184',
  'Compare digitization progress across districts',
  'Show potential anomalies under investigation',
];

export const COPILOT_DISCLAIMER = `${appConfig.predictionDisclaimer} ${NO_INVENTION_NOTE}`;
