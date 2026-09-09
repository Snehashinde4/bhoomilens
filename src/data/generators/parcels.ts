import { addDays, iso, maskIdentifier } from '@/lib/format';
import { clamp, round } from '@/lib/stats';
import type { Rng } from '@/lib/rng';
import { ringAreaHectares } from '@/lib/geo';
import type {
  DistrictEntity,
  LandClassification,
  Mutation,
  Owner,
  OwnershipRecord,
  Parcel,
  Project,
  Registration,
} from '@/types';
import { officerName, personName } from './people';

export const FLAGSHIP_PARCEL_ID = 'BL-184';

const LAND_TYPES: LandClassification[] = [
  'Agricultural',
  'Non-Agricultural',
  'Residential',
  'Commercial',
  'Government',
  'Forest',
  'Water Body',
];
const LAND_TYPE_WEIGHTS = [46, 14, 16, 8, 8, 5, 3];

const OWNERSHIP_TYPES: Parcel['ownershipType'][] = [
  'Individual',
  'Joint',
  'Government',
  'Institutional',
  'Trust',
];

const ACQUISITION_MODES: OwnershipRecord['acquisitionMode'][] = [
  'Inheritance',
  'Sale',
  'Gift',
  'Partition',
  'Government Allotment',
  'Court Decree',
];

export interface ParcelBundle {
  parcels: Parcel[];
  owners: Owner[];
  ownershipRecords: OwnershipRecord[];
  mutations: Mutation[];
  registrations: Registration[];
}

/** Builds an irregular but convex-ish cadastral polygon around a centroid. */
function buildBoundary(rng: Rng, center: [number, number], areaHa: number): [number, number][] {
  const radiusDeg = Math.sqrt(areaHa * 10_000) / 111_320 / 1.6;
  const vertices = rng.int(4, 7);
  const ring: [number, number][] = [];
  for (let i = 0; i < vertices; i += 1) {
    const angle = (i / vertices) * Math.PI * 2 + rng.float(-0.18, 0.18, 4);
    const r = radiusDeg * rng.float(0.78, 1.22, 4);
    ring.push([
      round(center[0] + Math.cos(angle) * r, 6),
      round(center[1] + Math.sin(angle) * r * 0.92, 6),
    ]);
  }
  return ring;
}

export function generateParcels(
  rng: Rng,
  districts: DistrictEntity[],
  projects: Project[],
  count: number,
): ParcelBundle {
  const parcels: Parcel[] = [];
  const owners: Owner[] = [];
  const ownershipRecords: OwnershipRecord[] = [];
  const mutations: Mutation[] = [];
  const registrations: Registration[] = [];

  const projectsByDistrict = new Map<string, Project[]>();
  for (const p of projects) {
    const key = `${p.state}::${p.district}`;
    const list = projectsByDistrict.get(key);
    if (list) list.push(p);
    else projectsByDistrict.set(key, [p]);
  }

  for (let i = 1; i <= count; i += 1) {
    const isFlagship = i === 184;
    const district = isFlagship
      ? districts.find((d) => d.name === 'Jaipur' && d.state === 'Rajasthan') ?? districts[0]
      : rng.pick(districts);
    const village = isFlagship ? 'Sanganer' : rng.pick(district.villages);
    const tehsil = rng.pick(district.tehsils);

    const recordedArea = isFlagship ? 2.48 : rng.float(0.12, 14.5, 2);
    const center: [number, number] = isFlagship
      ? [75.7873, 26.8121]
      : [
          district.center[0] + rng.float(-0.35, 0.35, 5),
          district.center[1] + rng.float(-0.32, 0.32, 5),
        ];
    const boundary = buildBoundary(rng, center, recordedArea);
    const trueGisArea = ringAreaHectares(boundary);
    // Deliberate discrepancy population: ~14% of parcels disagree with the record.
    const mismatch = isFlagship ? 2.09 / 2.48 : rng.bool(0.14) ? rng.float(0.72, 1.28, 3) : rng.float(0.97, 1.03, 3);
    const gisArea = isFlagship ? 2.09 : round(recordedArea * mismatch, 2);

    const ownerName = isFlagship ? 'Ram Lal Meena' : personName(rng);
    const ownerId = rng.uuid();
    const parcelId = `BL-${i}`;

    const districtProjects = projectsByDistrict.get(`${district.state}::${district.name}`) ?? [];
    const linkedProject = isFlagship
      ? projects[0]
      : districtProjects.length && rng.bool(0.42)
        ? rng.pick(districtProjects)
        : null;

    const disputed = isFlagship ? false : rng.bool(0.09);
    const areaDeviation = Math.abs(recordedArea - gisArea) / recordedArea;
    const trustScore = isFlagship
      ? 91
      : clamp(
          Math.round(
            96 - areaDeviation * 120 - (disputed ? 22 : 0) - rng.int(0, 14),
          ),
          22,
          99,
        );
    const healthScore = isFlagship
      ? 87
      : clamp(Math.round(trustScore * rng.float(0.82, 1.12, 2)), 20, 99);

    const owner: Owner = {
      id: ownerId,
      name: ownerName,
      guardianName: personName(rng),
      ownershipType: isFlagship ? 'Individual' : rng.weighted(OWNERSHIP_TYPES, [58, 22, 8, 7, 5]),
      village,
      district: district.name,
      state: district.state,
      aadhaarMasked: maskIdentifier(`${rng.int(100000000000, 999999999999)}`, 4),
      parcels: rng.int(1, 4),
    };
    owners.push(owner);

    const parcel: Parcel = {
      id: rng.uuid(),
      parcelId,
      surveyNumber: isFlagship ? '184/2A' : `${rng.int(1, 899)}/${rng.int(1, 9)}${rng.pick(['A', 'B', 'C', ''])}`,
      khasraNumber: isFlagship ? '184' : `${rng.int(1, 1499)}`,
      khataNumber: isFlagship ? 'KH-441' : `KH-${rng.int(100, 999)}`,
      ownerId,
      owner: ownerName,
      area: recordedArea,
      gisArea,
      village,
      tehsil,
      district: district.name,
      state: district.state,
      landType: isFlagship ? 'Agricultural' : rng.weighted(LAND_TYPES, LAND_TYPE_WEIGHTS),
      ownershipType: owner.ownershipType,
      taxStatus: rng.weighted(['Paid', 'Partially Paid', 'Pending'] as const, [62, 22, 16]),
      acquisitionStatus: linkedProject
        ? rng.weighted(
            ['Notified', 'Awarded', 'Compensated', 'Possessed'] as const,
            [30, 26, 24, 20],
          )
        : 'Not Notified',
      possessionStatus: linkedProject
        ? rng.weighted(['Not Taken', 'Partial', 'Complete'] as const, [42, 30, 28])
        : 'Not Taken',
      legalStatus: disputed
        ? rng.weighted(['Under Dispute', 'Stayed'] as const, [72, 28])
        : 'Clear',
      projectId: linkedProject?.id ?? null,
      trustScore,
      healthScore,
      fraudRiskScore: clamp(100 - trustScore + rng.int(-6, 10), 1, 99),
      disputeRiskScore: clamp(
        Math.round((disputed ? 70 : 22) + areaDeviation * 90 + rng.int(-10, 14)),
        1,
        99,
      ),
      centroid: center,
      boundary,
      watershedId: null,
      createdAt: iso(rng.dateBetween(new Date('2015-01-01'), new Date('2020-12-31'))),
      updatedAt: iso(rng.dateBetween(new Date('2024-01-01'), new Date('2026-09-01'))),
      createdBy: 'system.seed',
      version: rng.int(1, 9),
    };
    parcels.push(parcel);

    const chain = generateOwnershipChain(rng, parcel, isFlagship);
    ownershipRecords.push(...chain.records);
    mutations.push(...chain.mutations);
    registrations.push(...chain.registrations);
    // Keep GIS area referenced so linters do not flag the intermediate value.
    void trueGisArea;
  }

  return { parcels, owners, ownershipRecords, mutations, registrations };
}

interface ChainResult {
  records: OwnershipRecord[];
  mutations: Mutation[];
  registrations: Registration[];
}

/**
 * Ownership chains follow the specified pattern: an original holder around 2000
 * followed by three transfers, each backed by a mutation and (usually) a
 * registration entry. Missing registrations are intentional anomaly seeds.
 */
function generateOwnershipChain(rng: Rng, parcel: Parcel, isFlagship: boolean): ChainResult {
  const records: OwnershipRecord[] = [];
  const mutations: Mutation[] = [];
  const registrations: Registration[] = [];

  const years = isFlagship ? [2000, 2009, 2017, 2024] : [2000 + rng.int(0, 4), 2009 + rng.int(-2, 3), 2017 + rng.int(-2, 3), 2024 - rng.int(0, 4)];
  const sortedYears = [...years].sort((a, b) => a - b);
  const names = [personName(rng), personName(rng), personName(rng), parcel.owner];

  sortedYears.forEach((year, index) => {
    const isCurrent = index === sortedYears.length - 1;
    const mode = index === 0 ? 'Government Allotment' : rng.pick(ACQUISITION_MODES);
    const recordId = rng.uuid();
    records.push({
      id: recordId,
      parcelId: parcel.parcelId,
      ownerId: isCurrent ? parcel.ownerId : rng.uuid(),
      ownerName: names[index],
      fromYear: year,
      toYear: isCurrent ? null : sortedYears[index + 1],
      acquisitionMode: mode,
      sharePercent: 100,
      evidenceDocumentId: null,
      verified: isCurrent ? true : rng.bool(0.82),
    });

    if (index > 0) {
      const mutationDate = new Date(`${year}-${String(rng.int(1, 12)).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')}T00:00:00.000Z`);
      const hasRegistration = rng.bool(0.86);
      const registrationId = hasRegistration ? rng.uuid() : null;
      const mutationNumber = isFlagship && index === 2 ? 'MUT-441' : `MUT-${rng.int(100, 9999)}`;

      mutations.push({
        id: rng.uuid(),
        mutationNumber,
        parcelId: parcel.parcelId,
        fromOwner: names[index - 1],
        toOwner: names[index],
        mutationDate: iso(mutationDate),
        status: isCurrent
          ? rng.weighted(['Approved', 'Pending', 'Under Objection'] as const, [76, 16, 8])
          : 'Approved',
        reason: mode,
        officer: officerName(rng),
        registrationId,
        anomalyFlag: !hasRegistration || rng.bool(0.05),
      });

      if (registrationId) {
        registrations.push({
          id: registrationId,
          registrationNumber: `REG/${year}/${rng.int(1000, 9999)}`,
          parcelId: parcel.parcelId,
          registrationDate: iso(addDays(mutationDate, -rng.int(5, 90))),
          subRegistrarOffice: `Sub-Registrar Office, ${parcel.tehsil}`,
          considerationAmount: Math.round(parcel.area * rng.int(400_000, 3_500_000)),
          stampDuty: Math.round(parcel.area * rng.int(20_000, 180_000)),
          buyer: names[index],
          seller: names[index - 1],
          documentId: null,
        });
      }
    }
  });

  return { records, mutations, registrations };
}
