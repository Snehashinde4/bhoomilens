import { getDataset } from '@/data/dataset';
import { buildDocumentDetail } from '@/data/generators/documents';
import { useAppStore } from '@/store/appStore';
import { remoteOrLocal } from './http';
import type {
  AuditEvent,
  Beneficiary,
  CompensationRecord,
  DocumentRecord,
  ExtractedField,
  FraudAlert,
  Intervention,
  LegalCase,
  Mutation,
  Owner,
  OwnershipRecord,
  PageResult,
  Parcel,
  Project,
  ProjectMilestone,
  ProjectStage,
  Registration,
  ResearchDocument,
  ReviewTask,
  RiskPrediction,
  ValidationIssue,
  Watershed,
} from '@/types';

export interface QueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  filters?: Record<string, string | number | boolean | undefined>;
}

const DEFAULT_PAGE_SIZE = 25;

export function paginate<T extends Record<string, unknown>>(
  rows: T[],
  params: QueryParams = {},
  searchKeys: Array<keyof T> = [],
): PageResult<T> {
  let out = rows;

  if (params.search?.trim()) {
    const q = params.search.trim().toLowerCase();
    const keys = searchKeys.length ? searchKeys : (Object.keys(rows[0] ?? {}) as Array<keyof T>);
    out = out.filter((row) =>
      keys.some((k) => String(row[k] ?? '').toLowerCase().includes(q)),
    );
  }

  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value === undefined || value === '' || value === 'ALL') continue;
      out = out.filter((row) => String((row as Record<string, unknown>)[key]) === String(value));
    }
  }

  if (params.sortBy) {
    const dir = params.sortDir === 'asc' ? 1 : -1;
    const key = params.sortBy;
    out = [...out].sort((a, b) => {
      const av = (a as Record<string, unknown>)[key];
      const bv = (b as Record<string, unknown>)[key];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
    });
  }

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const start = (page - 1) * pageSize;
  return { rows: out.slice(start, start + pageSize), total: out.length, page, pageSize };
}

/* -------------------------------------------------------------------------- */
/* Projects                                                                   */
/* -------------------------------------------------------------------------- */

export function listProjects(params: QueryParams = {}): Promise<PageResult<Project>> {
  return remoteOrLocal('/projects', { ...params }, () =>
    paginate(getDataset().projects as unknown as Array<Record<string, unknown>>, params, [
      'code',
      'name',
      'state',
      'district',
      'implementingAgency',
      'projectOfficer',
    ]) as unknown as PageResult<Project>,
  );
}

export function getProject(code: string): Promise<Project | undefined> {
  return remoteOrLocal(`/projects/${code}`, {}, () =>
    getDataset().projects.find((p) => p.code === code || p.id === code),
  );
}

export function getProjectStages(projectId: string): Promise<ProjectStage[]> {
  return remoteOrLocal(`/projects/${projectId}/stages`, {}, () =>
    getDataset().projectStages.filter((s) => s.projectId === projectId),
  );
}

export function getProjectMilestones(projectId: string): Promise<ProjectMilestone[]> {
  return remoteOrLocal(`/projects/${projectId}/milestones`, {}, () =>
    getDataset().milestones.filter((m) => m.projectId === projectId),
  );
}

export function getProjectRisk(projectId: string): Promise<RiskPrediction | undefined> {
  return remoteOrLocal(`/projects/${projectId}/risk`, {}, () =>
    getDataset().riskPredictions.find((r) => r.projectId === projectId),
  );
}

export function getProjectParcels(projectId: string, limit = 300): Promise<Parcel[]> {
  return remoteOrLocal(`/projects/${projectId}/parcels`, { limit }, () =>
    getDataset().parcels.filter((p) => p.projectId === projectId).slice(0, limit),
  );
}

export function getProjectDocuments(projectId: string, limit = 200): Promise<DocumentRecord[]> {
  return remoteOrLocal(`/projects/${projectId}/documents`, { limit }, () =>
    getDataset().documents.filter((d) => d.projectId === projectId).slice(0, limit),
  );
}

export function getProjectLegalCases(projectId: string): Promise<LegalCase[]> {
  return remoteOrLocal(`/projects/${projectId}/legal-cases`, {}, () =>
    getDataset().legalCases.filter((c) => c.projectId === projectId),
  );
}

export function getProjectCompensation(projectId: string, limit = 400): Promise<CompensationRecord[]> {
  return remoteOrLocal(`/projects/${projectId}/compensation`, { limit }, () =>
    getDataset().compensation.filter((c) => c.projectId === projectId).slice(0, limit),
  );
}

export function getProjectInterventions(projectId: string): Promise<Intervention[]> {
  return remoteOrLocal(`/projects/${projectId}/interventions`, {}, () => {
    const local = useAppStore.getState().workspace.interventions.filter((i) => i.projectId === projectId);
    return [...local, ...getDataset().interventions.filter((i) => i.projectId === projectId)];
  });
}

/* -------------------------------------------------------------------------- */
/* Documents                                                                  */
/* -------------------------------------------------------------------------- */

export function listDocuments(params: QueryParams = {}): Promise<PageResult<DocumentRecord>> {
  return remoteOrLocal('/documents', { ...params }, () => {
    const uploaded = useAppStore.getState().workspace.uploadedDocuments;
    const rows = [...uploaded, ...getDataset().documents];
    return paginate(rows as unknown as Array<Record<string, unknown>>, params, [
      'code',
      'fileName',
      'documentType',
      'district',
      'state',
      'village',
    ]) as unknown as PageResult<DocumentRecord>;
  });
}

export function getDocument(code: string): Promise<DocumentRecord | undefined> {
  return remoteOrLocal(`/documents/${code}`, {}, () => {
    const uploaded = useAppStore.getState().workspace.uploadedDocuments;
    return (
      uploaded.find((d) => d.code === code || d.id === code) ??
      getDataset().documents.find((d) => d.code === code || d.id === code)
    );
  });
}

export interface DocumentDetailResponse {
  document: DocumentRecord;
  pages: ReturnType<typeof buildDocumentDetail>['pages'];
  fields: ExtractedField[];
  parcel: Parcel | null;
  validations: ValidationIssue[];
}

export function getDocumentDetail(code: string): Promise<DocumentDetailResponse | null> {
  return remoteOrLocal(`/documents/${code}/detail`, {}, () => {
    const ds = getDataset();
    const uploaded = useAppStore.getState().workspace.uploadedDocuments;
    const document =
      uploaded.find((d) => d.code === code || d.id === code) ??
      ds.documents.find((d) => d.code === code || d.id === code);
    if (!document) return null;

    const parcel = document.parcelId
      ? ds.parcels.find((p) => p.parcelId === document.parcelId) ?? null
      : null;

    const materialisedFields = ds.extractedFields.filter((f) => f.documentId === document.id);
    const materialisedPages = ds.documentPages.filter((p) => p.documentId === document.id);
    const detail =
      materialisedFields.length && materialisedPages.length
        ? { fields: materialisedFields, pages: materialisedPages }
        : buildDocumentDetail(document, parcel);

    const decisions = useAppStore.getState().workspace.fieldDecisions;
    const fields = detail.fields.map((f) => {
      const decision = decisions[f.id];
      if (!decision) return f;
      return {
        ...f,
        normalizedValue: decision.value,
        status: decision.status,
        reviewerComment: decision.comment,
        correctionHistory: [
          ...f.correctionHistory,
          { at: decision.decidedAt, by: decision.decidedBy, from: f.normalizedValue, to: decision.value },
        ],
      };
    });

    return {
      document,
      pages: detail.pages,
      fields,
      parcel,
      validations: ds.validations.filter((v) => v.documentId === document.id),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

export function listValidations(params: QueryParams = {}): Promise<PageResult<ValidationIssue>> {
  return remoteOrLocal('/validations', { ...params }, () => {
    const overrides = useAppStore.getState().workspace.validationStatus;
    const assignees = useAppStore.getState().workspace.validationAssignee;
    const rows = getDataset().validations.map((v) => ({
      ...v,
      status: overrides[v.id] ?? v.status,
      assignedTo: assignees[v.id] ?? v.assignedTo,
    }));
    return paginate(rows as unknown as Array<Record<string, unknown>>, params, [
      'title',
      'parcelId',
      'detail',
      'ocrValue',
      'lrmsValue',
    ]) as unknown as PageResult<ValidationIssue>;
  });
}

/* -------------------------------------------------------------------------- */
/* Parcels / ownership                                                        */
/* -------------------------------------------------------------------------- */

export function listParcels(params: QueryParams = {}): Promise<PageResult<Parcel>> {
  return remoteOrLocal('/parcels', { ...params }, () =>
    paginate(getDataset().parcels as unknown as Array<Record<string, unknown>>, params, [
      'parcelId',
      'surveyNumber',
      'khasraNumber',
      'khataNumber',
      'owner',
      'village',
      'district',
    ]) as unknown as PageResult<Parcel>,
  );
}

export interface ParcelDetailResponse {
  parcel: Parcel;
  owner: Owner | undefined;
  ownership: OwnershipRecord[];
  mutations: Mutation[];
  registrations: Registration[];
  documents: DocumentRecord[];
  validations: ValidationIssue[];
  alerts: FraudAlert[];
  inspections: ReturnType<typeof getDataset>['inspections'];
  project: Project | null;
  watershed: Watershed | null;
}

export function getParcelDetail(parcelId: string): Promise<ParcelDetailResponse | null> {
  return remoteOrLocal(`/parcels/${parcelId}`, {}, () => {
    const ds = getDataset();
    const parcel = ds.parcels.find((p) => p.parcelId === parcelId);
    if (!parcel) return null;
    return {
      parcel,
      owner: ds.owners.find((o) => o.id === parcel.ownerId),
      ownership: ds.ownershipRecords.filter((o) => o.parcelId === parcelId).sort((a, b) => a.fromYear - b.fromYear),
      mutations: ds.mutations.filter((m) => m.parcelId === parcelId),
      registrations: ds.registrations.filter((r) => r.parcelId === parcelId),
      documents: ds.documents.filter((d) => d.parcelId === parcelId),
      validations: ds.validations.filter((v) => v.parcelId === parcelId),
      alerts: ds.fraudAlerts.filter((a) => a.parcelId === parcelId),
      inspections: ds.inspections.filter((i) => i.parcelId === parcelId),
      project: parcel.projectId ? ds.projects.find((p) => p.id === parcel.projectId) ?? null : null,
      watershed: parcel.watershedId ? ds.watersheds.find((w) => w.id === parcel.watershedId) ?? null : null,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Review, fraud, compensation, research, audit                               */
/* -------------------------------------------------------------------------- */

export function listReviewTasks(params: QueryParams = {}): Promise<PageResult<ReviewTask>> {
  return remoteOrLocal('/review-tasks', { ...params }, () => {
    const { reviewAssignee, reviewStatus } = useAppStore.getState().workspace;
    const rows = getDataset().reviewQueue.map((t) => ({
      ...t,
      assignedTo: reviewAssignee[t.id] ?? t.assignedTo,
      status: (reviewStatus[t.id] as ReviewTask['status']) ?? t.status,
    }));
    return paginate(rows as unknown as Array<Record<string, unknown>>, params, [
      'code',
      'reason',
      'district',
      'state',
      'parcelId',
      'assignedTo',
    ]) as unknown as PageResult<ReviewTask>;
  });
}

export function listFraudAlerts(params: QueryParams = {}): Promise<PageResult<FraudAlert>> {
  return remoteOrLocal('/fraud-alerts', { ...params }, () =>
    paginate(getDataset().fraudAlerts as unknown as Array<Record<string, unknown>>, params, [
      'code',
      'category',
      'summary',
      'district',
      'state',
      'parcelId',
    ]) as unknown as PageResult<FraudAlert>,
  );
}

export function listCompensation(params: QueryParams = {}): Promise<PageResult<CompensationRecord>> {
  return remoteOrLocal('/compensation', { ...params }, () =>
    paginate(getDataset().compensation as unknown as Array<Record<string, unknown>>, params, [
      'beneficiaryId',
      'parcelId',
      'district',
      'state',
      'status',
    ]) as unknown as PageResult<CompensationRecord>,
  );
}

export function listBeneficiaries(params: QueryParams = {}): Promise<PageResult<Beneficiary>> {
  return remoteOrLocal('/beneficiaries', { ...params }, () =>
    paginate(getDataset().beneficiaries as unknown as Array<Record<string, unknown>>, params, [
      'beneficiaryId',
      'name',
      'parcelId',
      'district',
    ]) as unknown as PageResult<Beneficiary>,
  );
}

export function listResearch(params: QueryParams = {}): Promise<PageResult<ResearchDocument>> {
  return remoteOrLocal('/research', { ...params }, () =>
    paginate(getDataset().research as unknown as Array<Record<string, unknown>>, params, [
      'title',
      'category',
      'abstract',
      'sourceRef',
    ]) as unknown as PageResult<ResearchDocument>,
  );
}

export function listAuditEvents(params: QueryParams = {}): Promise<PageResult<AuditEvent>> {
  return remoteOrLocal('/audit-events', { ...params }, () => {
    const local = useAppStore.getState().workspace.auditTrail;
    const rows = [...local, ...getDataset().auditLogs];
    return paginate(rows as unknown as Array<Record<string, unknown>>, params, [
      'actor',
      'action',
      'entityType',
      'entityId',
      'reason',
      'correlationId',
    ]) as unknown as PageResult<AuditEvent>;
  });
}
