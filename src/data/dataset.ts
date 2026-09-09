import { appConfig, resolveScale, type ScaleProfile } from '@/config/appConfig';
import { Rng } from '@/lib/rng';
import { iso } from '@/lib/format';
import { buildPrediction } from '@/risk/model';
import type { Dataset } from '@/types';
import { generateGeography } from './generators/geography';
import { generateUsers } from './generators/people';
import { generateProjects } from './generators/projects';
import { generateParcels } from './generators/parcels';
import { generateDocuments } from './generators/documents';
import { generateCompensation } from './generators/compensation';
import { generateFraudAlerts } from './generators/fraud';
import { generateReviewQueue } from './generators/review';
import { generateWatersheds } from './generators/watershed';
import {
  generateAuditLogs,
  generateInspections,
  generateIntegrations,
  generateInterventions,
  generateLegalCases,
  generateNotifications,
  generateResearch,
} from './generators/governance';
import { generateDistrictMetrics, generateMonthlyMetrics } from './generators/metrics';

let cache: Dataset | null = null;

export function buildDataset(profile: ScaleProfile = resolveScale(), seed = appConfig.seed): Dataset {
  const rng = new Rng(seed);
  const generatedAt = iso(new Date('2026-09-09T09:00:00.000Z'));

  const geo = generateGeography(rng, profile.districts);
  const users = generateUsers(rng, geo.districts);
  const { projects, stages, milestones } = generateProjects(rng, geo.districts, profile.projects);
  const parcelBundle = generateParcels(rng, geo.districts, projects, profile.parcels);
  const documentBundle = generateDocuments(rng, parcelBundle.parcels, projects, profile.documents);
  const compensationBundle = generateCompensation(
    rng,
    projects,
    parcelBundle.parcels,
    profile.beneficiaries,
  );
  const fraudAlerts = generateFraudAlerts(rng, parcelBundle.parcels, projects, profile.fraudAlerts);
  const reviewQueue = generateReviewQueue(
    rng,
    documentBundle.documents,
    parcelBundle.parcels,
    profile.reviewItems,
  );
  const watersheds = generateWatersheds(
    rng,
    geo.districts,
    projects,
    parcelBundle.parcels,
    profile.watersheds,
  );
  const legalCases = generateLegalCases(rng, projects, parcelBundle.parcels);
  const inspections = generateInspections(
    rng,
    parcelBundle.parcels,
    Math.min(2_500, Math.round(profile.parcels * 0.25)),
  );
  const interventions = generateInterventions(rng, projects);
  const research = generateResearch(rng, 64, geo.states.map((s) => s.name));
  const notifications = generateNotifications(rng, projects);
  const auditLogs = generateAuditLogs(rng, 1_800, projects);
  const integrations = generateIntegrations(rng);
  const monthlyMetrics = generateMonthlyMetrics(rng);
  const districtMetrics = generateDistrictMetrics(
    rng,
    geo.districts,
    projects,
    parcelBundle.parcels,
    documentBundle.documents,
    fraudAlerts,
    reviewQueue,
    compensationBundle.compensation,
  );

  const baselineByDistrict = new Map(districtMetrics.map((d) => [d.district, d.delayProbability]));
  const riskPredictions = projects.map((p) =>
    buildPrediction(
      p,
      baselineByDistrict.get(p.district) ?? 48,
      Math.max(40, 100 - p.openDocumentConflicts / 5),
    ),
  );

  return {
    generatedAt,
    seed,
    scale: profile.key,
    states: geo.states,
    districts: geo.districts,
    users,
    projects,
    projectStages: stages,
    milestones,
    parcels: parcelBundle.parcels,
    owners: parcelBundle.owners,
    ownershipRecords: parcelBundle.ownershipRecords,
    mutations: parcelBundle.mutations,
    registrations: parcelBundle.registrations,
    documents: documentBundle.documents,
    documentPages: documentBundle.pages,
    extractedFields: documentBundle.fields,
    validations: documentBundle.validations,
    fraudAlerts,
    riskPredictions,
    interventions,
    beneficiaries: compensationBundle.beneficiaries,
    compensation: compensationBundle.compensation,
    rrRecords: compensationBundle.rrRecords,
    legalCases,
    inspections,
    watersheds,
    reviewQueue,
    research,
    notifications,
    auditLogs,
    integrations,
    monthlyMetrics,
    districtMetrics,
  };
}

export function getDataset(): Dataset {
  if (!cache) cache = buildDataset();
  return cache;
}

export function resetDataset(profile?: ScaleProfile, seed?: number): Dataset {
  cache = buildDataset(profile ?? resolveScale(), seed ?? appConfig.seed);
  return cache;
}

/** Replaces one collection with user-supplied mock data (import workflow). */
export function applyOverride<K extends keyof Dataset>(key: K, rows: Dataset[K]): Dataset {
  const ds = getDataset();
  cache = { ...ds, [key]: rows };
  return cache;
}
