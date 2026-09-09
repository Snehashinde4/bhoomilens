import type {
  ConflictSeverity,
  ExtractedField,
  Mutation,
  OwnershipRecord,
  Parcel,
  Registration,
  ValidationCategory,
  ValidationIssue,
} from '@/types';
import { round } from '@/lib/stats';

export interface ValidationContext {
  documentId: string;
  parcel: Parcel | null;
  fields: ExtractedField[];
  ownership: OwnershipRecord[];
  mutations: Mutation[];
  registrations: Registration[];
}

export interface ValidationRule {
  id: string;
  category: ValidationCategory;
  title: string;
  evaluate: (ctx: ValidationContext) => ValidationIssue[];
}

function issue(
  ctx: ValidationContext,
  rule: Pick<ValidationRule, 'id' | 'category'>,
  partial: Partial<ValidationIssue> & { title: string; detail: string; severity: ConflictSeverity },
): ValidationIssue {
  return {
    id: `${ctx.documentId}-${rule.id}`,
    documentId: ctx.documentId,
    parcelId: ctx.parcel?.parcelId ?? null,
    projectId: ctx.parcel?.projectId ?? null,
    field: null,
    category: rule.category,
    ocrValue: '—',
    lrmsValue: '—',
    registryValue: '—',
    mutationValue: '—',
    gisValue: '—',
    confidence: 90,
    recommendedResolution: 'Verify against the authoritative source and record the decision.',
    status: 'open',
    assignedTo: null,
    detectedAt: new Date().toISOString(),
    resolvedAt: null,
    ...partial,
  };
}

/**
 * Deterministic rule set. Every rule is pure so the engine can be re-executed
 * after a reviewer correction and produce an auditable before/after comparison.
 */
export const RULES: ValidationRule[] = [
  {
    id: 'field-confidence',
    category: 'business_rule',
    title: 'Low-confidence extraction must be reviewed',
    evaluate: (ctx) =>
      ctx.fields
        .filter((f) => f.confidence < 70 && f.status !== 'corrected')
        .map((f) =>
          issue(ctx, { id: `conf-${f.field}`, category: 'business_rule' }, {
            title: `${f.label} extracted with low confidence`,
            detail: `Confidence ${f.confidence}% is below the 70% auto-acceptance threshold.`,
            severity: 'review',
            field: f.field,
            ocrValue: f.normalizedValue,
            lrmsValue: f.lrmsValue ?? '—',
            confidence: f.confidence,
            recommendedResolution: 'Open the highlighted region and confirm or correct the value.',
          }),
        ),
  },
  {
    id: 'master-data',
    category: 'master_data',
    title: 'Extracted value must match the reference record',
    evaluate: (ctx) =>
      ctx.fields
        .filter((f) => f.lrmsValue && f.lrmsValue !== f.normalizedValue && f.status !== 'corrected')
        .map((f) =>
          issue(ctx, { id: `master-${f.field}`, category: 'master_data' }, {
            title: `${f.label} differs from the LRMS record`,
            detail: `OCR produced "${f.normalizedValue}" while LRMS holds "${f.lrmsValue}".`,
            severity: f.field === 'ownerName' ? 'review' : 'informational',
            field: f.field,
            ocrValue: f.normalizedValue,
            lrmsValue: f.lrmsValue ?? '—',
            registryValue: f.registryValue ?? '—',
            mutationValue: f.mutationValue ?? '—',
            confidence: f.confidence,
            recommendedResolution: 'Accept the reference value after visual verification.',
          }),
        ),
  },
  {
    id: 'area-consistency',
    category: 'area_consistency',
    title: 'Recorded area must reconcile with GIS geometry',
    evaluate: (ctx) => {
      if (!ctx.parcel) return [];
      const deviation = Math.abs(ctx.parcel.area - ctx.parcel.gisArea) / ctx.parcel.area;
      if (deviation <= 0.05) return [];
      return [
        issue(ctx, { id: 'area', category: 'area_consistency' }, {
          title: 'Recorded area differs from GIS-calculated area',
          detail: `Deviation of ${round(deviation * 100, 1)}% between the record of rights and the cadastral polygon.`,
          severity: deviation > 0.12 ? 'blocking' : 'review',
          field: 'plotArea',
          ocrValue: `${ctx.parcel.area}`,
          lrmsValue: `${ctx.parcel.area}`,
          gisValue: `${ctx.parcel.gisArea}`,
          confidence: 94,
          recommendedResolution: 'Order a joint re-survey and reconcile the parcel geometry.',
        }),
      ];
    },
  },
  {
    id: 'mutation-chain',
    category: 'mutation_chain',
    title: 'Mutation chain must be continuous',
    evaluate: (ctx) => {
      const out: ValidationIssue[] = [];
      const sorted = [...ctx.ownership].sort((a, b) => a.fromYear - b.fromYear);
      for (let i = 1; i < sorted.length; i += 1) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        const link = ctx.mutations.find((m) => m.toOwner === cur.ownerName && m.fromOwner === prev.ownerName);
        if (!link) {
          out.push(
            issue(ctx, { id: `chain-${i}`, category: 'mutation_chain' }, {
              title: 'Mutation chain break detected',
              detail: `No mutation links "${prev.ownerName}" (${prev.fromYear}) to "${cur.ownerName}" (${cur.fromYear}).`,
              severity: 'blocking',
              ocrValue: cur.ownerName,
              mutationValue: 'NOT FOUND',
              confidence: 88,
              recommendedResolution: 'Retrieve the intervening mutation order from the tehsil record room.',
            }),
          );
        }
      }
      return out;
    },
  },
  {
    id: 'registration-record',
    category: 'registration_record',
    title: 'Approved mutations require a registration reference',
    evaluate: (ctx) =>
      ctx.mutations
        .filter((m) => m.status === 'Approved' && !m.registrationId)
        .map((m) =>
          issue(ctx, { id: `reg-${m.mutationNumber}`, category: 'registration_record' }, {
            title: 'Registration reference missing for an approved mutation',
            detail: `Mutation ${m.mutationNumber} dated ${new Date(m.mutationDate).getFullYear()} has no linked registration entry.`,
            severity: 'review',
            ocrValue: m.mutationNumber,
            registryValue: 'NOT FOUND',
            confidence: 82,
            recommendedResolution: 'Request a certified copy from the sub-registrar office.',
          }),
        ),
  },
  {
    id: 'duplicate-mutation',
    category: 'duplicate',
    title: 'Mutation numbers must be unique within a tehsil',
    evaluate: (ctx) => {
      const seen = new Map<string, number>();
      ctx.mutations.forEach((m) => seen.set(m.mutationNumber, (seen.get(m.mutationNumber) ?? 0) + 1));
      return [...seen.entries()]
        .filter(([, n]) => n > 1)
        .map(([number]) =>
          issue(ctx, { id: `dup-${number}`, category: 'duplicate' }, {
            title: 'Duplicate mutation number detected',
            detail: `Mutation number ${number} appears more than once for this parcel.`,
            severity: 'review',
            ocrValue: number,
            mutationValue: number,
            confidence: 90,
            recommendedResolution: 'Verify the mutation register pages and raise a correction memo.',
          }),
        );
    },
  },
  {
    id: 'legal-reference',
    category: 'legal_reference',
    title: 'Disputed parcels must quote a legal case reference',
    evaluate: (ctx) => {
      if (!ctx.parcel || ctx.parcel.legalStatus === 'Clear') return [];
      const ref = ctx.fields.find((f) => f.field === 'legalCaseReference');
      if (ref && ref.normalizedValue !== 'NIL') return [];
      return [
        issue(ctx, { id: 'legal', category: 'legal_reference' }, {
          title: 'Legal case reference missing on a disputed parcel',
          detail: `Parcel is marked "${ctx.parcel.legalStatus}" but no case reference was extracted.`,
          severity: 'review',
          field: 'legalCaseReference',
          confidence: 86,
          recommendedResolution: 'Attach the court case reference before proceeding to award.',
        }),
      ];
    },
  },
];

export interface ValidationRunResult {
  issues: ValidationIssue[];
  bySeverity: Record<ConflictSeverity, number>;
  passedRules: string[];
  ranAt: string;
}

export function runValidation(ctx: ValidationContext): ValidationRunResult {
  const issues: ValidationIssue[] = [];
  const passedRules: string[] = [];
  for (const rule of RULES) {
    const produced = rule.evaluate(ctx);
    if (produced.length === 0) passedRules.push(rule.title);
    issues.push(...produced);
  }
  const bySeverity: Record<ConflictSeverity, number> = {
    blocking: 0,
    review: 0,
    informational: 0,
    validated: passedRules.length,
  };
  issues.forEach((i) => {
    bySeverity[i.severity] += 1;
  });
  return { issues, bySeverity, passedRules, ranAt: new Date().toISOString() };
}
