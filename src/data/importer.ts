import { z } from 'zod';
import { applyOverride } from '@/data/dataset';
import type { Dataset } from '@/types';

/**
 * Contracts for user-supplied mock data. Import validates against these schemas
 * before replacing a collection, so a bad file can never corrupt the UI state.
 */

const projectSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  state: z.string(),
  district: z.string(),
  projectType: z.enum(['highway', 'railway', 'irrigation', 'industrial_corridor', 'urban_development']),
  proposedArea: z.number(),
  acquiredArea: z.number(),
  affectedFamilies: z.number(),
  compensationAssessed: z.number(),
  compensationPaid: z.number(),
  possessionPercent: z.number(),
  rrProgressPercent: z.number(),
  currentStage: z.string(),
  delayProbability: z.number(),
  riskScore: z.number(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
});

const parcelSchema = z.object({
  parcelId: z.string(),
  surveyNumber: z.string(),
  khasraNumber: z.string(),
  khataNumber: z.string(),
  owner: z.string(),
  area: z.number(),
  village: z.string(),
  district: z.string(),
  landType: z.string(),
  trustScore: z.number(),
  healthScore: z.number(),
});

const compensationSchema = z.object({
  beneficiaryId: z.string(),
  familySize: z.number().optional(),
  amountAssessed: z.number(),
  amountPaid: z.number(),
  status: z.string(),
});

const districtMetricSchema = z.object({
  district: z.string(),
  state: z.string(),
  digitizationProgress: z.number(),
  fraudAlerts: z.number(),
  reviewBacklog: z.number(),
  compensationProgress: z.number(),
  acquisitionProgress: z.number(),
  delayProbability: z.number(),
});

const monthlyMetricSchema = z.object({
  period: z.string(),
  documentsUploaded: z.number(),
  documentsProcessed: z.number(),
  documentsValidated: z.number(),
  documentsSentForReview: z.number(),
});

export interface ImportTarget {
  key: keyof Dataset;
  file: string;
  label: string;
  description: string;
  schema: z.ZodTypeAny;
  requiredColumns: string[];
}

export const IMPORT_TARGETS: ImportTarget[] = [
  {
    key: 'projects',
    file: 'projects.json',
    label: 'Land acquisition projects',
    description: 'Project register driving the dashboards, acquisition monitor and risk engine.',
    schema: projectSchema,
    requiredColumns: ['id', 'code', 'name', 'state', 'district', 'projectType'],
  },
  {
    key: 'projectStages',
    file: 'projectStages.json',
    label: 'Project stages',
    description: 'Stage-level workload, statutory durations and critical-path flags.',
    schema: z.object({ projectId: z.string(), stage: z.string() }).passthrough(),
    requiredColumns: ['projectId', 'stage'],
  },
  {
    key: 'documents',
    file: 'documents.json',
    label: 'Documents',
    description: 'Document register with pipeline stage, confidence and validation counts.',
    schema: z.object({ code: z.string(), documentType: z.string() }).passthrough(),
    requiredColumns: ['code', 'documentType'],
  },
  {
    key: 'extractedFields',
    file: 'extractedFields.json',
    label: 'Extracted fields',
    description: 'Field-level OCR output with confidence and reference values.',
    schema: z.object({ documentId: z.string(), field: z.string() }).passthrough(),
    requiredColumns: ['documentId', 'field'],
  },
  {
    key: 'parcels',
    file: 'parcels.geojson',
    label: 'Parcels (GeoJSON or JSON)',
    description: 'Cadastral parcels including geometry, ownership and scores.',
    schema: parcelSchema,
    requiredColumns: ['parcelId', 'surveyNumber', 'owner', 'area'],
  },
  {
    key: 'ownershipRecords',
    file: 'ownershipRecords.json',
    label: 'Ownership records',
    description: 'Historical ownership chain per parcel.',
    schema: z.object({ parcelId: z.string(), ownerName: z.string(), fromYear: z.number() }).passthrough(),
    requiredColumns: ['parcelId', 'ownerName', 'fromYear'],
  },
  {
    key: 'validations',
    file: 'validations.json',
    label: 'Validation issues',
    description: 'Conflicts between OCR, LRMS, registry, mutation and GIS values.',
    schema: z.object({ category: z.string(), severity: z.string() }).passthrough(),
    requiredColumns: ['category', 'severity'],
  },
  {
    key: 'fraudAlerts',
    file: 'fraudAlerts.json',
    label: 'Potential anomaly alerts',
    description: 'Anomaly detections with evidence and investigation status.',
    schema: z.object({ code: z.string(), category: z.string() }).passthrough(),
    requiredColumns: ['code', 'category'],
  },
  {
    key: 'compensation',
    file: 'compensation.json',
    label: 'Compensation records',
    description: 'Beneficiary-level assessment and disbursement.',
    schema: compensationSchema,
    requiredColumns: ['beneficiaryId', 'amountAssessed', 'amountPaid', 'status'],
  },
  {
    key: 'watersheds',
    file: 'watershed.json',
    label: 'Watersheds',
    description: 'Watershed boundaries, land use and environmental trends.',
    schema: z.object({ code: z.string(), name: z.string() }).passthrough(),
    requiredColumns: ['code', 'name'],
  },
  {
    key: 'reviewQueue',
    file: 'reviewQueue.json',
    label: 'Review queue',
    description: 'Prioritised human verification tasks.',
    schema: z.object({ code: z.string(), reason: z.string() }).passthrough(),
    requiredColumns: ['code', 'reason'],
  },
  {
    key: 'monthlyMetrics',
    file: 'monthlyMetrics.json',
    label: 'Monthly metrics',
    description: 'Time series behind the throughput and compensation charts.',
    schema: monthlyMetricSchema,
    requiredColumns: ['period', 'documentsUploaded', 'documentsProcessed'],
  },
  {
    key: 'districtMetrics',
    file: 'districtMetrics.json',
    label: 'District metrics',
    description: 'District scorecards behind the heat maps and rankings.',
    schema: districtMetricSchema,
    requiredColumns: ['district', 'state', 'digitizationProgress'],
  },
  {
    key: 'auditLogs',
    file: 'auditLogs.json',
    label: 'Audit logs',
    description: 'Historical audit trail entries.',
    schema: z.object({ actor: z.string(), action: z.string() }).passthrough(),
    requiredColumns: ['actor', 'action'],
  },
];

export interface ImportIssue {
  row: number;
  path: string;
  message: string;
}

export interface ImportResult {
  target: ImportTarget;
  accepted: number;
  rejected: number;
  issues: ImportIssue[];
  applied: boolean;
}

/** Extracts rows from JSON arrays, GeoJSON feature collections or CSV output. */
export function normaliseRows(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
      return (obj.features as Array<Record<string, unknown>>).map((f) => ({
        ...(f.properties as Record<string, unknown>),
        geometry: f.geometry,
      }));
    }
    for (const value of Object.values(obj)) {
      if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
    }
  }
  return [];
}

/** Applies a user-defined column mapping before validation. */
export function applyMapping(
  rows: Array<Record<string, unknown>>,
  mapping: Record<string, string>,
): Array<Record<string, unknown>> {
  const entries = Object.entries(mapping).filter(([, target]) => target);
  if (!entries.length) return rows;
  return rows.map((row) => {
    const out: Record<string, unknown> = { ...row };
    entries.forEach(([source, target]) => {
      if (source in row) out[target] = row[source];
    });
    return out;
  });
}

export function validateRows(target: ImportTarget, rows: Array<Record<string, unknown>>): ImportResult {
  const issues: ImportIssue[] = [];
  const valid: Array<Record<string, unknown>> = [];

  rows.forEach((row, index) => {
    const result = target.schema.safeParse(row);
    if (result.success) {
      valid.push(row);
    } else {
      result.error.issues.slice(0, 3).forEach((i) =>
        issues.push({ row: index + 1, path: i.path.join('.') || '(root)', message: i.message }),
      );
    }
  });

  return {
    target,
    accepted: valid.length,
    rejected: rows.length - valid.length,
    issues: issues.slice(0, 40),
    applied: false,
  };
}

export function commitImport(target: ImportTarget, rows: Array<Record<string, unknown>>): void {
  applyOverride(target.key, rows as never);
}
