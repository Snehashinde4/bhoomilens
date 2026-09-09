/**
 * Standalone generation smoke test.
 * Run with:  npx vite-node scripts/generate-smoke.ts
 * Prints record counts for each collection so the engine can be profiled
 * without the test runner in the loop.
 */
import { performance } from 'node:perf_hooks';
import { buildDataset } from '../src/data/dataset';
import { SCALE_PROFILES } from '../src/config/appConfig';

const scaleKey = (process.argv[2] ?? 'demo') as keyof typeof SCALE_PROFILES;
const profile = SCALE_PROFILES[scaleKey] ?? SCALE_PROFILES.demo;

console.log(`Generating "${profile.key}" dataset…`);
const start = performance.now();
const dataset = buildDataset(profile, 20260909);
const elapsed = ((performance.now() - start) / 1000).toFixed(2);

const counts: Array<[string, number]> = [
  ['states', dataset.states.length],
  ['districts', dataset.districts.length],
  ['projects', dataset.projects.length],
  ['projectStages', dataset.projectStages.length],
  ['milestones', dataset.milestones.length],
  ['parcels', dataset.parcels.length],
  ['ownershipRecords', dataset.ownershipRecords.length],
  ['mutations', dataset.mutations.length],
  ['registrations', dataset.registrations.length],
  ['documents', dataset.documents.length],
  ['extractedFields', dataset.extractedFields.length],
  ['validations', dataset.validations.length],
  ['fraudAlerts', dataset.fraudAlerts.length],
  ['beneficiaries', dataset.beneficiaries.length],
  ['compensation', dataset.compensation.length],
  ['rrRecords', dataset.rrRecords.length],
  ['legalCases', dataset.legalCases.length],
  ['inspections', dataset.inspections.length],
  ['watersheds', dataset.watersheds.length],
  ['reviewQueue', dataset.reviewQueue.length],
  ['research', dataset.research.length],
  ['auditLogs', dataset.auditLogs.length],
  ['districtMetrics', dataset.districtMetrics.length],
  ['monthlyMetrics', dataset.monthlyMetrics.length],
];

counts.forEach(([name, n]) => console.log(`  ${name.padEnd(18)} ${n.toLocaleString('en-IN')}`));
console.log(`Completed in ${elapsed}s`);
console.log(`Flagship project: ${dataset.projects[0].code} ${dataset.projects[0].name} (risk ${dataset.projects[0].riskScore})`);
const bl184 = dataset.parcels.find((p) => p.parcelId === 'BL-184');
console.log(`Reference parcel: ${bl184?.parcelId} ${bl184?.owner} ${bl184?.area}ha vs GIS ${bl184?.gisArea}ha`);
