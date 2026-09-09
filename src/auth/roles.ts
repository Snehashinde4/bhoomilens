import type { Permission, Role, RoleId } from '@/types';

const ALL: Permission[] = [
  'overview.view', 'project.view', 'project.edit', 'project.intervene', 'risk.view', 'risk.simulate',
  'document.view', 'document.upload', 'document.process', 'validation.view', 'validation.decide',
  'parcel.view', 'graph.view', 'fraud.view', 'fraud.investigate', 'gis.view', 'gis.edit',
  'watershed.view', 'compensation.view', 'compensation.approve', 'review.view', 'review.assign',
  'research.view', 'citizen.view', 'reports.view', 'reports.export', 'integrations.view',
  'integrations.manage', 'governance.view', 'audit.view', 'settings.manage', 'pii.unmask',
];

const BASE: Permission[] = ['overview.view', 'project.view', 'risk.view', 'reports.view'];

export const ROLES: Record<RoleId, Role> = {
  national_admin: {
    id: 'national_admin',
    label: 'National Administrator',
    scope: 'national',
    description: 'Full national oversight across every state, project and module.',
    permissions: ALL,
    landingRoute: '/overview',
  },
  state_admin: {
    id: 'state_admin',
    label: 'State Administrator',
    scope: 'state',
    description: 'State-level programme oversight, interventions and reporting.',
    permissions: ALL.filter((p) => !['settings.manage', 'integrations.manage'].includes(p)),
    landingRoute: '/overview',
  },
  district_collector: {
    id: 'district_collector',
    label: 'District Collector',
    scope: 'district',
    description: 'District command centre: interventions, review capacity, escalations.',
    permissions: [
      ...BASE, 'project.edit', 'project.intervene', 'risk.simulate', 'document.view',
      'validation.view', 'validation.decide', 'parcel.view', 'graph.view', 'fraud.view',
      'gis.view', 'watershed.view', 'compensation.view', 'compensation.approve',
      'review.view', 'review.assign', 'reports.export', 'audit.view', 'integrations.view',
      'governance.view', 'research.view',
    ],
    landingRoute: '/overview',
  },
  acquisition_officer: {
    id: 'acquisition_officer',
    label: 'Land Acquisition Officer',
    scope: 'project',
    description: 'Owns the acquisition lifecycle for assigned projects.',
    permissions: [
      ...BASE, 'project.edit', 'project.intervene', 'document.view', 'document.upload',
      'validation.view', 'parcel.view', 'gis.view', 'compensation.view', 'review.view',
      'reports.export', 'graph.view',
    ],
    landingRoute: '/acquisition',
  },
  revenue_officer: {
    id: 'revenue_officer',
    label: 'Revenue Officer',
    scope: 'district',
    description: 'Maintains records of rights, mutations and registrations.',
    permissions: [
      ...BASE, 'document.view', 'document.upload', 'document.process', 'validation.view',
      'validation.decide', 'parcel.view', 'graph.view', 'gis.view', 'review.view',
    ],
    landingRoute: '/digitization',
  },
  verification_officer: {
    id: 'verification_officer',
    label: 'Document Verification Officer',
    scope: 'district',
    description: 'Reviews AI extraction output and resolves field-level conflicts.',
    permissions: [
      'overview.view', 'document.view', 'document.upload', 'document.process',
      'validation.view', 'validation.decide', 'review.view', 'parcel.view', 'reports.view',
    ],
    landingRoute: '/digitization',
  },
  gis_analyst: {
    id: 'gis_analyst',
    label: 'GIS Analyst',
    scope: 'state',
    description: 'Cadastral geometry, boundary conflicts and remote-sensing evidence.',
    permissions: [
      ...BASE, 'gis.view', 'gis.edit', 'parcel.view', 'watershed.view', 'validation.view',
      'fraud.view', 'reports.export',
    ],
    landingRoute: '/gis',
  },
  legal_reviewer: {
    id: 'legal_reviewer',
    label: 'Legal Reviewer',
    scope: 'state',
    description: 'Legal cases, objections and ownership-dispute analysis.',
    permissions: [
      ...BASE, 'document.view', 'validation.view', 'validation.decide', 'parcel.view',
      'graph.view', 'fraud.view', 'review.view', 'audit.view',
    ],
    landingRoute: '/ownership-graph',
  },
  compensation_officer: {
    id: 'compensation_officer',
    label: 'Compensation Officer',
    scope: 'district',
    description: 'Assessment, approval and disbursement of compensation.',
    permissions: [
      ...BASE, 'compensation.view', 'compensation.approve', 'parcel.view', 'document.view',
      'reports.export',
    ],
    landingRoute: '/compensation',
  },
  rr_officer: {
    id: 'rr_officer',
    label: 'R&R Officer',
    scope: 'district',
    description: 'Rehabilitation and resettlement entitlements and site allotment.',
    permissions: [...BASE, 'compensation.view', 'parcel.view', 'document.view', 'reports.export'],
    landingRoute: '/compensation',
  },
  auditor: {
    id: 'auditor',
    label: 'Auditor',
    scope: 'national',
    description: 'Read-only assurance across audit trails, decisions and models.',
    permissions: [
      'overview.view', 'project.view', 'risk.view', 'document.view', 'validation.view',
      'parcel.view', 'fraud.view', 'compensation.view', 'review.view', 'reports.view',
      'reports.export', 'audit.view', 'governance.view', 'integrations.view',
    ],
    landingRoute: '/audit',
  },
  researcher: {
    id: 'researcher',
    label: 'Researcher',
    scope: 'national',
    description: 'Aggregated, de-identified evidence for policy research.',
    permissions: ['overview.view', 'research.view', 'reports.view', 'reports.export', 'watershed.view', 'risk.view'],
    landingRoute: '/research',
  },
  field_officer: {
    id: 'field_officer',
    label: 'Field Officer',
    scope: 'district',
    description: 'Field inspections, evidence capture and mobile document upload.',
    permissions: [
      'overview.view', 'project.view', 'document.view', 'document.upload', 'parcel.view',
      'gis.view', 'watershed.view', 'review.view',
    ],
    landingRoute: '/gis',
  },
  citizen: {
    id: 'citizen',
    label: 'Citizen',
    scope: 'citizen',
    description: 'Public land transparency services with masked sensitive data.',
    permissions: ['citizen.view'],
    landingRoute: '/citizen',
  },
};

export const ROLE_LIST: Role[] = Object.values(ROLES);

export function hasPermission(role: RoleId, permission: Permission): boolean {
  return ROLES[role]?.permissions.includes(permission) ?? false;
}

export function hasAny(role: RoleId, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/** Data-scope guard: a district user must not read other districts' records. */
export interface ScopeContext {
  role: RoleId;
  state?: string;
  district?: string;
}

export function inScope(
  ctx: ScopeContext,
  record: { state?: string; district?: string },
): boolean {
  const scope = ROLES[ctx.role].scope;
  if (scope === 'national' || scope === 'citizen') return true;
  if (scope === 'state') return !ctx.state || record.state === ctx.state;
  return (
    (!ctx.state || record.state === ctx.state) &&
    (!ctx.district || record.district === ctx.district)
  );
}
