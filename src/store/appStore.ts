import { create } from 'zustand';
import { appConfig, resolveScale, SCALE_PROFILES, type DataScale } from '@/config/appConfig';
import { getDataset, resetDataset } from '@/data/dataset';
import { iso } from '@/lib/format';
import type {
  AuditEvent,
  Dataset,
  DocumentRecord,
  ExtractedField,
  GlobalFilters,
  Intervention,
  LanguageCode,
  Notification,
  RoleId,
  User,
  ValidationIssue,
} from '@/types';

export interface FieldDecision {
  fieldId: string;
  documentId: string;
  value: string;
  status: ExtractedField['status'];
  comment: string | null;
  decidedBy: string;
  decidedAt: string;
}

export interface WorkspaceState {
  fieldDecisions: Record<string, FieldDecision>;
  validationStatus: Record<string, ValidationIssue['status']>;
  validationAssignee: Record<string, string>;
  reviewAssignee: Record<string, string>;
  reviewStatus: Record<string, string>;
  interventions: Intervention[];
  uploadedDocuments: DocumentRecord[];
  auditTrail: AuditEvent[];
  savedViews: Record<string, GlobalFilters>;
  readNotifications: string[];
}

interface AppState {
  ready: boolean;
  user: User | null;
  role: RoleId;
  language: LanguageCode;
  filters: GlobalFilters;
  scale: DataScale;
  workspace: WorkspaceState;
  copilotHistory: Array<{ id: string; query: string; at: string }>;

  initialize: () => void;
  login: (role: RoleId) => void;
  logout: () => void;
  switchRole: (role: RoleId) => void;
  setLanguage: (language: LanguageCode) => void;
  setFilters: (patch: Partial<GlobalFilters>) => void;
  resetFilters: () => void;
  saveView: (name: string) => void;
  applyView: (name: string) => void;
  setScale: (scale: DataScale) => void;
  regenerate: (seed?: number) => void;

  recordAudit: (event: Omit<AuditEvent, 'id' | 'timestamp' | 'correlationId' | 'sourceIp'>) => void;
  decideField: (decision: Omit<FieldDecision, 'decidedBy' | 'decidedAt'>) => void;
  setValidationStatus: (id: string, status: ValidationIssue['status'], reason?: string) => void;
  assignValidation: (id: string, officer: string) => void;
  assignReview: (ids: string[], officer: string) => void;
  setReviewStatus: (id: string, status: string) => void;
  addIntervention: (intervention: Intervention) => void;
  updateIntervention: (id: string, patch: Partial<Intervention>) => void;
  addUploadedDocument: (doc: DocumentRecord) => void;
  markNotificationRead: (id: string) => void;
  pushCopilotQuery: (query: string) => void;
}

const DEFAULT_FILTERS: GlobalFilters = {
  workspace: 'national',
  state: 'ALL',
  district: 'ALL',
  projectType: 'ALL',
  riskLevel: 'ALL',
  dateRange: { from: '2024-10-01', to: '2026-09-09', label: 'Last 24 months' },
  search: '',
  timeMachineYear: null,
};

const EMPTY_WORKSPACE: WorkspaceState = {
  fieldDecisions: {},
  validationStatus: {},
  validationAssignee: {},
  reviewAssignee: {},
  reviewStatus: {},
  interventions: [],
  uploadedDocuments: [],
  auditTrail: [],
  savedViews: {},
  readNotifications: [],
};

function readSession(): RoleId | null {
  try {
    return localStorage.getItem(appConfig.storageKeys.session) as RoleId | null;
  } catch {
    return null;
  }
}

function userForRole(dataset: Dataset, role: RoleId): User {
  return dataset.users.find((u) => u.role === role) ?? dataset.users[0];
}

let auditCounter = 0;

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  user: null,
  role: 'national_admin',
  language: 'en',
  filters: DEFAULT_FILTERS,
  scale: resolveScale().key,
  workspace: EMPTY_WORKSPACE,
  copilotHistory: [],

  initialize: () => {
    const dataset = getDataset();
    const stored = readSession();
    set({
      ready: true,
      scale: dataset.scale as DataScale,
      user: stored ? userForRole(dataset, stored) : null,
      role: stored ?? 'national_admin',
    });
  },

  login: (role) => {
    const dataset = getDataset();
    try {
      localStorage.setItem(appConfig.storageKeys.session, role);
    } catch {
      /* storage unavailable in private mode */
    }
    const user = userForRole(dataset, role);
    set({
      user,
      role,
      filters: {
        ...get().filters,
        workspace: role === 'citizen' ? 'citizen' : get().filters.workspace,
        state: user.state ?? 'ALL',
        district: user.district ?? 'ALL',
      },
    });
    get().recordAudit({
      actor: user.name,
      role,
      action: 'session.login',
      entityType: 'User',
      entityId: user.employeeCode,
      oldValue: null,
      newValue: role,
      reason: 'Demo role sign-in',
    });
  },

  logout: () => {
    try {
      localStorage.removeItem(appConfig.storageKeys.session);
    } catch {
      /* ignore */
    }
    set({ user: null });
  },

  switchRole: (role) => {
    const dataset = getDataset();
    const user = userForRole(dataset, role);
    try {
      localStorage.setItem(appConfig.storageKeys.session, role);
    } catch {
      /* ignore */
    }
    set({
      role,
      user,
      filters: {
        ...get().filters,
        workspace: role === 'citizen' ? 'citizen' : 'national',
        state: user.state ?? 'ALL',
        district: user.district ?? 'ALL',
      },
    });
    get().recordAudit({
      actor: user.name,
      role,
      action: 'session.role_switched',
      entityType: 'User',
      entityId: user.employeeCode,
      oldValue: null,
      newValue: role,
      reason: 'Demo role switcher',
    });
  },

  setLanguage: (language) => set({ language }),

  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),

  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  saveView: (name) =>
    set((s) => ({
      workspace: { ...s.workspace, savedViews: { ...s.workspace.savedViews, [name]: s.filters } },
    })),

  applyView: (name) => {
    const view = get().workspace.savedViews[name];
    if (view) set({ filters: view });
  },

  setScale: (scale) => {
    try {
      localStorage.setItem(appConfig.storageKeys.scale, scale);
    } catch {
      /* ignore */
    }
    resetDataset(SCALE_PROFILES[scale]);
    set({ scale, workspace: EMPTY_WORKSPACE });
  },

  regenerate: (seed) => {
    resetDataset(SCALE_PROFILES[get().scale], seed);
    set({ workspace: EMPTY_WORKSPACE });
  },

  recordAudit: (event) => {
    auditCounter += 1;
    const entry: AuditEvent = {
      ...event,
      id: `local-audit-${auditCounter}`,
      correlationId: `COR-L${String(auditCounter).padStart(6, '0')}`,
      timestamp: iso(new Date()),
      sourceIp: '10.0.0.1',
    };
    set((s) => ({ workspace: { ...s.workspace, auditTrail: [entry, ...s.workspace.auditTrail] } }));
  },

  decideField: (decision) => {
    const { user, role } = get();
    const full: FieldDecision = {
      ...decision,
      decidedBy: user?.name ?? 'Demo user',
      decidedAt: iso(new Date()),
    };
    set((s) => ({
      workspace: {
        ...s.workspace,
        fieldDecisions: { ...s.workspace.fieldDecisions, [decision.fieldId]: full },
      },
    }));
    get().recordAudit({
      actor: user?.name ?? 'Demo user',
      role,
      action: `field.${decision.status}`,
      entityType: 'ExtractedField',
      entityId: decision.fieldId,
      oldValue: null,
      newValue: decision.value,
      reason: decision.comment ?? 'Reviewer decision recorded in Digitization Studio',
    });
  },

  setValidationStatus: (id, status, reason) => {
    const { user, role } = get();
    set((s) => ({
      workspace: { ...s.workspace, validationStatus: { ...s.workspace.validationStatus, [id]: status } },
    }));
    get().recordAudit({
      actor: user?.name ?? 'Demo user',
      role,
      action: `validation.${status}`,
      entityType: 'ValidationIssue',
      entityId: id,
      oldValue: null,
      newValue: status,
      reason: reason ?? 'Validation workspace decision',
    });
  },

  assignValidation: (id, officer) => {
    const { user, role } = get();
    set((s) => ({
      workspace: {
        ...s.workspace,
        validationAssignee: { ...s.workspace.validationAssignee, [id]: officer },
      },
    }));
    get().recordAudit({
      actor: user?.name ?? 'Demo user',
      role,
      action: 'validation.assigned',
      entityType: 'ValidationIssue',
      entityId: id,
      oldValue: null,
      newValue: officer,
      reason: 'Reviewer assignment',
    });
  },

  assignReview: (ids, officer) => {
    const { user, role } = get();
    set((s) => {
      const next = { ...s.workspace.reviewAssignee };
      const status = { ...s.workspace.reviewStatus };
      ids.forEach((id) => {
        next[id] = officer;
        status[id] = 'assigned';
      });
      return { workspace: { ...s.workspace, reviewAssignee: next, reviewStatus: status } };
    });
    get().recordAudit({
      actor: user?.name ?? 'Demo user',
      role,
      action: 'review.assigned',
      entityType: 'ReviewTask',
      entityId: ids.join(','),
      oldValue: null,
      newValue: officer,
      reason: `Bulk assignment of ${ids.length} task(s)`,
    });
  },

  setReviewStatus: (id, status) => {
    const { user, role } = get();
    set((s) => ({
      workspace: { ...s.workspace, reviewStatus: { ...s.workspace.reviewStatus, [id]: status } },
    }));
    get().recordAudit({
      actor: user?.name ?? 'Demo user',
      role,
      action: `review.${status}`,
      entityType: 'ReviewTask',
      entityId: id,
      oldValue: null,
      newValue: status,
      reason: 'Review queue action',
    });
  },

  addIntervention: (intervention) => {
    const { user, role } = get();
    set((s) => ({
      workspace: { ...s.workspace, interventions: [intervention, ...s.workspace.interventions] },
    }));
    get().recordAudit({
      actor: user?.name ?? 'Demo user',
      role,
      action: 'intervention.created',
      entityType: 'Intervention',
      entityId: intervention.code,
      oldValue: null,
      newValue: intervention.title,
      reason: intervention.description.slice(0, 120),
    });
  },

  updateIntervention: (id, patch) => {
    const { user, role } = get();
    set((s) => ({
      workspace: {
        ...s.workspace,
        interventions: s.workspace.interventions.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      },
    }));
    get().recordAudit({
      actor: user?.name ?? 'Demo user',
      role,
      action: 'intervention.updated',
      entityType: 'Intervention',
      entityId: id,
      oldValue: null,
      newValue: JSON.stringify(patch).slice(0, 120),
      reason: 'Intervention lifecycle update',
    });
  },

  addUploadedDocument: (doc) => {
    const { user, role } = get();
    set((s) => ({
      workspace: { ...s.workspace, uploadedDocuments: [doc, ...s.workspace.uploadedDocuments] },
    }));
    get().recordAudit({
      actor: user?.name ?? 'Demo user',
      role,
      action: 'document.uploaded',
      entityType: 'DocumentRecord',
      entityId: doc.code,
      oldValue: null,
      newValue: doc.fileName,
      reason: 'Digitization Studio upload',
    });
  },

  markNotificationRead: (id) =>
    set((s) => ({
      workspace: {
        ...s.workspace,
        readNotifications: [...new Set([...s.workspace.readNotifications, id])],
      },
    })),

  pushCopilotQuery: (query) =>
    set((s) => ({
      copilotHistory: [
        { id: `q-${s.copilotHistory.length + 1}`, query, at: iso(new Date()) },
        ...s.copilotHistory,
      ].slice(0, 30),
    })),
}));

export function visibleNotifications(all: Notification[], role: RoleId, read: string[]): Notification[] {
  return all
    .filter((n) => n.roles.includes(role))
    .map((n) => ({ ...n, read: n.read || read.includes(n.id) }));
}
