import {
  AGENCIES,
  HIGHWAY_CORRIDORS,
  INDUSTRIAL_NODES,
  IRRIGATION_SCHEMES,
  RAIL_CORRIDORS,
  URBAN_SCHEMES,
} from '@/data/catalog';
import { LIFECYCLE_STAGES, PROJECT_TYPES, STAGE_LABEL, STAGE_STATUTORY_DAYS } from '@/config/constants';
import { addDays, iso } from '@/lib/format';
import { clamp, round } from '@/lib/stats';
import { padCode, type Rng } from '@/lib/rng';
import { featuresFromProject, riskLevelOf, scoreRisk } from '@/risk/model';
import type {
  DelayDriver,
  DistrictEntity,
  LifecycleStage,
  Project,
  ProjectMilestone,
  ProjectStage,
  ProjectType,
} from '@/types';
import { officerName } from './people';

export const FLAGSHIP_PROJECT_CODE = 'PRJ-0001';
export const FLAGSHIP_PROJECT_NAME = 'NH-48 Expansion Package 3';

const NOW = new Date('2026-09-09T09:00:00.000Z');

function projectName(rng: Rng, type: ProjectType, district: string, index: number): string {
  switch (type) {
    case 'highway':
      return `${rng.pick(HIGHWAY_CORRIDORS)} ${rng.pick(['Expansion', 'Widening', 'Bypass', 'Greenfield'])} Package ${rng.int(1, 9)}`;
    case 'railway':
      return `${district} ${rng.pick(RAIL_CORRIDORS)} Phase ${rng.int(1, 4)}`;
    case 'irrigation':
      return `${district} ${rng.pick(IRRIGATION_SCHEMES)}`;
    case 'industrial_corridor':
      return `${district} ${rng.pick(INDUSTRIAL_NODES)} ${String.fromCharCode(65 + (index % 6))}`;
    default:
      return `${district} ${rng.pick(URBAN_SCHEMES)}`;
  }
}

function primaryDriver(project: Omit<Project, 'primaryDelayDriver'>): DelayDriver {
  const compGap =
    project.compensationAssessed > 0
      ? (project.compensationAssessed - project.compensationPaid) / project.compensationAssessed
      : 0;
  const scores: Array<[DelayDriver, number]> = [
    ['Compensation Delays', compGap * 100],
    ['Legal Disputes', project.openLegalCases * 5],
    ['Approval Delays', project.pendingDays / 5],
    ['Missing Records', project.openDocumentConflicts / 3],
    ['R&R Delays', (100 - project.rrProgressPercent) * 0.8],
    ['GIS Conflicts', project.gisDiscrepancies * 0.9],
  ];
  return scores.sort((a, b) => b[1] - a[1])[0][0];
}

export interface ProjectBundle {
  projects: Project[];
  stages: ProjectStage[];
  milestones: ProjectMilestone[];
}

export function generateProjects(
  rng: Rng,
  districts: DistrictEntity[],
  count: number,
): ProjectBundle {
  const projects: Project[] = [];
  const stages: ProjectStage[] = [];
  const milestones: ProjectMilestone[] = [];

  for (let i = 1; i <= count; i += 1) {
    const isFlagship = i === 1;
    const district = isFlagship
      ? districts.find((d) => d.name === 'Jaipur' && d.state === 'Rajasthan') ?? districts[0]
      : rng.pick(districts);
    const type: ProjectType = isFlagship
      ? 'highway'
      : rng.weighted(PROJECT_TYPES, [30, 18, 20, 16, 16]);

    const proposedArea = isFlagship ? 4820 : rng.int(180, 9800);
    const acquiredRatio = isFlagship ? 3940 / 4820 : rng.float(0.08, 0.98, 3);
    const acquiredArea = isFlagship ? 3940 : round(proposedArea * acquiredRatio, 0);
    const affectedFamilies = isFlagship ? 2418 : Math.max(24, Math.round(proposedArea * rng.float(0.25, 0.9, 2)));
    const compensationAssessed = isFlagship
      ? 1_850_000_000
      : Math.round(proposedArea * rng.int(180_000, 900_000));
    const paidRatio = isFlagship ? 1_180_000_000 / 1_850_000_000 : rng.float(0.05, 0.99, 3);
    const compensationPaid = isFlagship ? 1_180_000_000 : Math.round(compensationAssessed * paidRatio);

    const stageIndex = isFlagship
      ? LIFECYCLE_STAGES.indexOf('compensation')
      : rng.weighted(
          LIFECYCLE_STAGES.map((_, idx) => idx),
          [6, 7, 9, 11, 8, 10, 12, 14, 10, 8, 5],
        );
    const currentStage = LIFECYCLE_STAGES[stageIndex];

    const startDate = isFlagship
      ? new Date('2021-06-14T00:00:00.000Z')
      : rng.dateBetween(new Date('2018-01-01'), new Date('2025-06-30'));
    const plannedDurationDays = rng.int(900, 2400);
    const plannedCompletion = addDays(startDate, isFlagship ? 1980 : plannedDurationDays);

    const openLegalCases = isFlagship ? 18 : rng.weighted([0, 1, 3, 6, 11, 17, 24], [22, 20, 18, 15, 12, 8, 5]);
    const pendingDays = isFlagship ? 300 : rng.weighted([12, 45, 90, 180, 300, 450, 620], [18, 20, 18, 16, 14, 9, 5]);
    const openDocumentConflicts = isFlagship ? 260 : rng.int(0, 340);
    const gisDiscrepancies = isFlagship ? 96 : rng.int(0, 130);
    const rrProgressPercent = isFlagship ? 38 : rng.int(0, 100);
    const possessionPercent = isFlagship ? 52 : clamp(Math.round(acquiredRatio * 100 * rng.float(0.5, 1.05, 2)), 0, 100);

    const id = rng.uuid();
    const base: Omit<Project, 'primaryDelayDriver'> = {
      id,
      code: padCode('PRJ', i),
      name: isFlagship ? FLAGSHIP_PROJECT_NAME : projectName(rng, type, district.name, i),
      state: district.state,
      district: district.name,
      projectType: type,
      implementingAgency: isFlagship ? 'National Highways Authority of India' : rng.pick(AGENCIES),
      projectOfficer: officerName(rng),
      proposedArea,
      acquiredArea,
      affectedVillages: isFlagship ? 27 : rng.int(2, 48),
      affectedFamilies,
      compensationAssessed,
      compensationPaid,
      possessionPercent,
      rrProgressPercent,
      currentStage,
      completionPercent: clamp(
        Math.round(((stageIndex + 1) / LIFECYCLE_STAGES.length) * 100 * rng.float(0.82, 1.06, 2)),
        2,
        100,
      ),
      delayProbability: 0,
      riskScore: 0,
      riskLevel: 'low',
      pendingDays,
      responsibleOffice: `${STAGE_LABEL[currentStage]} Cell, ${district.name}`,
      startDate: iso(startDate),
      plannedCompletion: iso(plannedCompletion),
      predictedCompletion: iso(plannedCompletion),
      openLegalCases,
      openDocumentConflicts,
      gisDiscrepancies,
      budgetCrore: round(compensationAssessed / 1e7 + rng.int(50, 3200), 1),
      centroid: [
        district.center[0] + rng.float(-0.25, 0.25, 4),
        district.center[1] + rng.float(-0.25, 0.25, 4),
      ],
      createdAt: iso(startDate),
      updatedAt: iso(rng.dateBetween(new Date('2026-06-01'), NOW)),
      createdBy: 'system.seed',
      version: rng.int(1, 12),
    };

    const scored = scoreRisk(featuresFromProject(base as Project));
    const project: Project = {
      ...base,
      riskScore: scored.score,
      riskLevel: riskLevelOf(scored.score),
      delayProbability: scored.delayProbability,
      predictedCompletion: iso(addDays(plannedCompletion, Math.round((scored.delayProbability / 100) * 540))),
      primaryDelayDriver: primaryDriver(base),
    };
    projects.push(project);

    stages.push(...generateStages(rng, project, startDate));
    milestones.push(...generateMilestones(rng, project));
  }

  return { projects, stages, milestones };
}

function generateStages(rng: Rng, project: Project, startDate: Date): ProjectStage[] {
  const currentIndex = LIFECYCLE_STAGES.indexOf(project.currentStage);
  let cursor = new Date(startDate.getTime());
  return LIFECYCLE_STAGES.map((stage, index) => {
    const statutory = STAGE_STATUTORY_DAYS[stage];
    const planned = Math.round(statutory * rng.float(0.7, 1.2, 2));
    const plannedStart = new Date(cursor.getTime());
    const plannedEnd = addDays(plannedStart, planned);
    const isPast = index < currentIndex;
    const isCurrent = index === currentIndex;
    const actualDuration = Math.round(planned * rng.float(0.9, 2.1, 2));
    const actualStart = index <= currentIndex ? plannedStart : null;
    const actualEnd = isPast ? addDays(plannedStart, actualDuration) : null;
    cursor = addDays(plannedStart, isPast ? actualDuration : planned);

    const delayed = isPast ? actualDuration > statutory : isCurrent && project.pendingDays > statutory;
    const status: ProjectStage['status'] = isPast
      ? 'completed'
      : isCurrent
        ? delayed
          ? 'delayed'
          : 'in_progress'
        : 'pending';

    return {
      id: rng.uuid(),
      projectId: project.id,
      stage,
      status,
      completedCases: isPast ? rng.int(60, 900) : isCurrent ? rng.int(10, 400) : 0,
      pendingCases: isPast ? rng.int(0, 20) : isCurrent ? rng.int(20, 620) : rng.int(0, 180),
      delayedCases: delayed ? rng.int(5, 220) : rng.int(0, 30),
      averageDurationDays: isPast ? actualDuration : planned,
      statutoryDeadlineDays: statutory,
      daysRemaining: isCurrent ? statutory - project.pendingDays : isPast ? 0 : statutory,
      responsibleOfficer: officerName(rng),
      pendingDocuments: isCurrent ? rng.int(4, 260) : rng.int(0, 60),
      riskContribution: round(rng.float(0, 18, 1) * (isCurrent ? 1.6 : 1), 1),
      dependsOn: index > 0 ? [LIFECYCLE_STAGES[index - 1]] : [],
      plannedStart: iso(plannedStart),
      plannedEnd: iso(plannedEnd),
      actualStart: actualStart ? iso(actualStart) : null,
      actualEnd: actualEnd ? iso(actualEnd) : null,
      onCriticalPath: ['approval', 'notification', 'award', 'compensation', 'possession'].includes(stage),
    };
  });
}

const MILESTONE_TITLES: Partial<Record<LifecycleStage, string[]>> = {
  proposal: ['Alignment proposal submitted', 'Feasibility report accepted'],
  scrutiny: ['Technical scrutiny completed', 'Inter-departmental comments received'],
  approval: ['Administrative approval issued', 'Financial sanction accorded'],
  notification: ['Preliminary notification published', 'Gazette notification issued'],
  objection_handling: ['Objection hearing scheduled', 'Objection disposal order issued'],
  survey: ['Joint measurement survey started', 'Survey report countersigned'],
  award: ['Draft award circulated', 'Award declared under Section 23'],
  compensation: ['Compensation assessment approved', 'Disbursement camp conducted'],
  possession: ['Possession notice served', 'Physical possession handed over'],
  rehabilitation: ['R&R entitlement matrix published', 'Resettlement site allotted'],
  closure: ['Utilisation certificate submitted', 'Project closure report filed'],
};

function generateMilestones(rng: Rng, project: Project): ProjectMilestone[] {
  const currentIndex = LIFECYCLE_STAGES.indexOf(project.currentStage);
  const out: ProjectMilestone[] = [];
  LIFECYCLE_STAGES.forEach((stage, index) => {
    const titles = MILESTONE_TITLES[stage] ?? [`${STAGE_LABEL[stage]} milestone`];
    titles.forEach((title) => {
      const due = rng.dateBetween(new Date(project.startDate), new Date(project.plannedCompletion));
      const completed = index < currentIndex;
      const overdue = index === currentIndex && rng.bool(0.45);
      out.push({
        id: rng.uuid(),
        projectId: project.id,
        title,
        stage,
        dueDate: iso(due),
        completedDate: completed ? iso(addDays(due, rng.int(-20, 120))) : null,
        status: completed ? 'completed' : overdue ? 'overdue' : 'upcoming',
        note: completed
          ? 'Closed with departmental sign-off.'
          : overdue
            ? 'Pending beyond the statutory reference duration.'
            : 'Scheduled as per approved implementation plan.',
      });
    });
  });
  return out;
}
