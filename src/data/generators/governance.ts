import { COURTS, RESEARCH_TAGS } from '@/data/catalog';
import { DELAY_DRIVERS } from '@/config/constants';
import { addDays, iso } from '@/lib/format';
import { round } from '@/lib/stats';
import type { Rng } from '@/lib/rng';
import { recommendIntervention } from '@/risk/model';
import type {
  AuditEvent,
  FieldInspection,
  IntegrationStatus,
  Intervention,
  LegalCase,
  Notification,
  Parcel,
  Project,
  ResearchDocument,
  RoleId,
} from '@/types';
import { officerName } from './people';

export function generateLegalCases(rng: Rng, projects: Project[], parcels: Parcel[]): LegalCase[] {
  const out: LegalCase[] = [];
  let counter = 1;
  for (const project of projects) {
    for (let i = 0; i < project.openLegalCases; i += 1) {
      const parcel = rng.bool(0.7)
        ? parcels.find((p) => p.projectId === project.id) ?? null
        : null;
      const filedOn = rng.dateBetween(new Date(project.startDate), new Date('2026-08-01'));
      const status = rng.weighted(
        ['pending', 'stayed', 'disposed', 'under_appeal'] as const,
        [44, 22, 24, 10],
      );
      out.push({
        id: rng.uuid(),
        caseNumber: `CS/${String(counter).padStart(4, '0')}/${filedOn.getFullYear()}`,
        projectId: project.id,
        parcelId: parcel?.parcelId ?? null,
        court: `${rng.pick(COURTS)}, ${project.district}`,
        subject: rng.pick([
          'Challenge to compensation quantum',
          'Objection to preliminary notification',
          'Dispute over ownership share',
          'Claim of adverse possession',
          'Challenge to land classification',
          'Objection to R&R entitlement',
          'Boundary demarcation dispute',
        ]),
        filedOn: iso(filedOn),
        status,
        nextHearing:
          status === 'disposed' ? null : iso(addDays(new Date('2026-09-09'), rng.int(3, 180))),
        impact: rng.weighted(['low', 'medium', 'high', 'critical'] as const, [22, 38, 30, 10]),
      });
      counter += 1;
    }
  }
  return out;
}

export function generateInspections(
  rng: Rng,
  parcels: Parcel[],
  count: number,
): FieldInspection[] {
  return Array.from({ length: count }, (_, i) => {
    const parcel = rng.pick(parcels);
    const inspectedOn = rng.dateBetween(new Date('2025-06-01'), new Date('2026-09-01'));
    return {
      id: rng.uuid(),
      code: `FI-${String(i + 1).padStart(5, '0')}`,
      parcelId: parcel.parcelId,
      projectId: parcel.projectId,
      officer: officerName(rng),
      inspectedOn: iso(inspectedOn),
      findings: rng.pick([
        'Boundary stones located and photographed; matches cadastral sheet.',
        'Standing crop observed; possession not yet handed over.',
        'Temporary structure observed within the acquisition corridor.',
        'Access road encroachment observed on the northern edge.',
        'Parcel found vacant; possession memo can be executed.',
        'Occupant claims tenancy rights not reflected in the record of rights.',
      ]),
      possessionObserved: rng.bool(0.44),
      encroachmentObserved: rng.bool(0.21),
      photographs: Array.from({ length: rng.int(1, 4) }, (_, k) => ({
        id: rng.uuid(),
        type: rng.weighted(['photograph', 'drone', 'satellite', 'survey'] as const, [60, 16, 16, 8]),
        caption: `Field evidence ${k + 1} for ${parcel.parcelId}`,
        capturedOn: iso(inspectedOn),
        location: [
          round(parcel.centroid[0] + rng.float(-0.002, 0.002, 6), 6),
          round(parcel.centroid[1] + rng.float(-0.002, 0.002, 6), 6),
        ] as [number, number],
        source: rng.pick(['Field mobile app', 'Drone survey', 'Sentinel-2', 'Total station survey']),
        confidence: rng.int(64, 98),
      })),
      verificationStatus: rng.weighted(
        ['verified', 'pending', 'disputed'] as const,
        [58, 30, 12],
      ),
    };
  });
}

export function generateInterventions(rng: Rng, projects: Project[]): Intervention[] {
  const out: Intervention[] = [];
  const atRisk = projects.filter((p) => p.riskLevel === 'high' || p.riskLevel === 'critical');
  atRisk.forEach((project, index) => {
    const count = project.riskLevel === 'critical' ? rng.int(1, 3) : rng.int(0, 2);
    for (let i = 0; i < count; i += 1) {
      const driver = i === 0 ? project.primaryDelayDriver : rng.pick(DELAY_DRIVERS);
      const createdAt = rng.dateBetween(new Date('2026-01-01'), new Date('2026-09-01'));
      out.push({
        id: rng.uuid(),
        code: `INT-${String(index * 3 + i + 1).padStart(5, '0')}`,
        projectId: project.id,
        title: `${driver} mitigation for ${project.name}`,
        description: recommendIntervention(driverToFactor(driver)),
        driver,
        priority: project.riskLevel,
        status: rng.weighted(
          ['proposed', 'assigned', 'in_progress', 'resolved', 'escalated'] as const,
          [26, 22, 26, 18, 8],
        ),
        assignedOffice: project.responsibleOffice,
        assignedOfficer: rng.bool(0.75) ? officerName(rng) : null,
        createdAt: iso(createdAt),
        dueDate: iso(addDays(createdAt, rng.int(15, 120))),
        expectedRiskReduction: rng.int(4, 22),
        notes: [
          {
            at: iso(createdAt),
            by: officerName(rng),
            text: 'Case reviewed in the weekly district monitoring meeting.',
          },
        ],
      });
    }
  });
  return out;
}

function driverToFactor(driver: string): string {
  const map: Record<string, string> = {
    'Compensation Delays': 'Compensation pending',
    'Legal Disputes': 'Legal disputes',
    'Approval Delays': 'Approval aging',
    'Missing Records': 'Incomplete documents',
    'R&R Delays': 'R&R delays',
    'GIS Conflicts': 'GIS boundary conflict',
    'Stakeholder Response': 'Low stakeholder response',
  };
  return map[driver] ?? 'Compensation pending';
}

const RESEARCH_TITLES = [
  'Impact of compensation verification delays on highway acquisition timelines',
  'Digitisation of handwritten mutation registers: an accuracy benchmark',
  'Cadastral GIS reconciliation in semi-arid districts',
  'Rehabilitation outcomes for irrigation projects: a five-state review',
  'Multilingual OCR for Indian land records: error taxonomy',
  'Predictive analytics for land acquisition delay management',
  'Watershed treatment and land degradation reversal: evidence review',
  'Title guarantee readiness of state land record systems',
  'Reducing ownership disputes through mutation-chain validation',
  'Effect of stakeholder outreach on objection disposal time',
  'Remote sensing evidence for possession verification',
  'Beneficiary bank verification failures: causes and remedies',
  'District-level performance variation in land record modernisation',
  'Fraud typologies in land transactions: a data-driven taxonomy',
  'Cost of delay in national infrastructure land acquisition',
];

export function generateResearch(rng: Rng, count: number, stateNames: string[]): ResearchDocument[] {
  return Array.from({ length: count }, (_, i) => {
    const title = i < RESEARCH_TITLES.length
      ? RESEARCH_TITLES[i]
      : `${rng.pick(RESEARCH_TITLES)} (Vol. ${rng.int(2, 9)})`;
    return {
      id: rng.uuid(),
      title,
      category: rng.weighted(
        [
          'Research Paper',
          'Policy Document',
          'Government Circular',
          'Dataset',
          'Case Study',
          'GIS Study',
          'Pilot',
          'Innovation Challenge',
          'Research Grant',
        ] as const,
        [24, 16, 14, 12, 10, 8, 6, 5, 5],
      ),
      authors: [officerName(rng), officerName(rng)],
      publishedOn: iso(rng.dateBetween(new Date('2019-01-01'), new Date('2026-08-01'))),
      abstract:
        'Synthetic abstract prepared for the prototype knowledge base. Findings summarise observed relationships in the demonstration dataset and must not be cited as an official publication.',
      tags: rng.sample(RESEARCH_TAGS, rng.int(3, 6)),
      states: rng.sample(stateNames, rng.int(1, 4)),
      citations: rng.int(0, 240),
      accessLevel: rng.bool(0.82) ? 'public' : 'restricted',
      sourceRef: `BL-KB/${2019 + (i % 8)}/${String(i + 1).padStart(4, '0')}`,
    };
  });
}

export function generateNotifications(rng: Rng, projects: Project[]): Notification[] {
  const critical = projects.filter((p) => p.riskLevel === 'critical').slice(0, 10);
  const items: Notification[] = critical.map((p) => ({
    id: rng.uuid(),
    title: `Critical risk: ${p.name}`,
    body: `${p.district}, ${p.state} · delay probability ${p.delayProbability}% driven by ${p.primaryDelayDriver.toLowerCase()}.`,
    severity: 'critical',
    createdAt: iso(rng.dateBetween(new Date('2026-08-20'), new Date('2026-09-09'))),
    read: false,
    route: `/projects/${p.code}`,
    roles: ['national_admin', 'state_admin', 'district_collector', 'acquisition_officer'],
  }));

  items.push(
    {
      id: rng.uuid(),
      title: 'Review backlog above SLA',
      body: '412 verification tasks have exceeded their service-level target in 9 districts.',
      severity: 'warning',
      createdAt: iso(new Date('2026-09-08T06:30:00Z')),
      read: false,
      route: '/review',
      roles: ['national_admin', 'state_admin', 'district_collector', 'verification_officer'],
    },
    {
      id: rng.uuid(),
      title: 'Integration degraded',
      body: 'State Registration Gateway is responding slowly; retry queue is growing.',
      severity: 'warning',
      createdAt: iso(new Date('2026-09-09T04:10:00Z')),
      read: false,
      route: '/integrations',
      roles: ['national_admin', 'auditor'],
    },
    {
      id: rng.uuid(),
      title: 'Model refresh completed',
      body: 'Delay-risk model bhoomilens-delay-risk-v2.4.1 completed a scheduled run.',
      severity: 'info',
      createdAt: iso(new Date('2026-09-09T02:00:00Z')),
      read: true,
      route: '/risk',
      roles: ['national_admin', 'state_admin', 'auditor', 'researcher'],
    },
  );
  return items;
}

const AUDIT_ACTIONS = [
  ['document.viewed', 'DocumentRecord'],
  ['field.corrected', 'ExtractedField'],
  ['validation.resolved', 'ValidationIssue'],
  ['review.assigned', 'ReviewTask'],
  ['project.updated', 'Project'],
  ['intervention.created', 'Intervention'],
  ['compensation.approved', 'CompensationRecord'],
  ['report.downloaded', 'Report'],
  ['prediction.generated', 'RiskPrediction'],
  ['integration.sync', 'IntegrationStatus'],
  ['login.failed', 'User'],
  ['permission.denied', 'User'],
] as const;

const AUDIT_ROLES: RoleId[] = [
  'national_admin',
  'state_admin',
  'district_collector',
  'verification_officer',
  'revenue_officer',
  'compensation_officer',
  'gis_analyst',
  'auditor',
];

export function generateAuditLogs(rng: Rng, count: number, projects: Project[]): AuditEvent[] {
  return Array.from({ length: count }, () => {
    const [action, entityType] = rng.pick(AUDIT_ACTIONS);
    const project = rng.pick(projects);
    return {
      id: rng.uuid(),
      correlationId: `COR-${rng.int(100000, 999999)}`,
      actor: officerName(rng),
      role: rng.pick(AUDIT_ROLES),
      action,
      entityType,
      entityId: action.startsWith('project') ? project.code : `${entityType.slice(0, 3).toUpperCase()}-${rng.int(1000, 99999)}`,
      oldValue: action.includes('corrected') ? 'Ram Lai Meena' : null,
      newValue: action.includes('corrected') ? 'Ram Lal Meena' : null,
      reason: rng.pick([
        'Routine verification',
        'District review meeting decision',
        'Citizen correction request',
        'Audit sampling',
        'Automated pipeline event',
        'Escalation from review queue',
      ]),
      timestamp: iso(rng.dateBetween(new Date('2026-06-01'), new Date('2026-09-09'))),
      sourceIp: `10.${rng.int(0, 255)}.${rng.int(0, 255)}.${rng.int(1, 254)}`,
    };
  }).sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

const INTEGRATION_SEEDS: Array<[string, IntegrationStatus['category'], string]> = [
  ['Land Records Management System (LRMS)', 'records', '/adapters/lrms/v2'],
  ['DILRMP National Exchange', 'records', '/adapters/dilrmp/v1'],
  ['State Land Records Portal', 'records', '/adapters/state-lr/v3'],
  ['Property Registration Gateway', 'registration', '/adapters/registration/v2'],
  ['Revenue Database Service', 'records', '/adapters/revenue/v1'],
  ['National GIS Platform', 'gis', '/adapters/gis/v4'],
  ['Cadastral Map Repository', 'gis', '/adapters/cadastral/v1'],
  ['Identity Verification Service', 'identity', '/adapters/identity/v1'],
  ['Compensation Payment Gateway', 'payments', '/adapters/payments/v2'],
  ['Court Case Reference Service', 'legal', '/adapters/legal/v1'],
  ['Satellite Imagery Service', 'remote_sensing', '/adapters/rs/v2'],
  ['Government Document Repository', 'repository', '/adapters/docs/v1'],
];

export function generateIntegrations(rng: Rng): IntegrationStatus[] {
  return INTEGRATION_SEEDS.map(([system, category, endpoint]) => {
    const status = rng.weighted(
      ['connected', 'syncing', 'degraded', 'error', 'offline'] as const,
      [58, 14, 14, 8, 6],
    );
    const failed = status === 'connected' ? rng.int(0, 60) : rng.int(40, 2400);
    return {
      id: rng.uuid(),
      system,
      category,
      status,
      lastSyncAt: iso(rng.dateBetween(new Date('2026-09-07'), new Date('2026-09-09T08:00:00Z'))),
      recordsSynced: rng.int(12_000, 4_800_000),
      failedRecords: failed,
      latencyMs: status === 'degraded' ? rng.int(1400, 6200) : rng.int(60, 900),
      endpoint,
      errorLog:
        status === 'connected'
          ? []
          : Array.from({ length: rng.int(1, 4) }, () => ({
              at: iso(rng.dateBetween(new Date('2026-09-06'), new Date('2026-09-09'))),
              code: rng.pick(['E-TIMEOUT', 'E-SCHEMA', 'E-AUTH', 'E-RATE-LIMIT', 'E-PARTIAL']),
              message: rng.pick([
                'Upstream response exceeded the configured timeout.',
                'Record rejected: mandatory field khasra_number missing.',
                'Token refresh failed; falling back to cached credentials.',
                'Rate limit reached for the district batch window.',
                'Partial batch committed; remaining records queued for retry.',
              ]),
            })),
    };
  });
}
