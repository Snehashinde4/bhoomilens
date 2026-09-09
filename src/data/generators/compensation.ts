import { BANK_NAMES } from '@/data/catalog';
import { addDays, iso, maskIdentifier } from '@/lib/format';
import { clamp, round } from '@/lib/stats';
import type { Rng } from '@/lib/rng';
import type {
  Beneficiary,
  CompensationRecord,
  Parcel,
  Project,
  RRRecord,
} from '@/types';
import { personName } from './people';

const FAILURE_REASONS = [
  'Bank account number mismatch',
  'IFSC code invalid',
  'Account dormant',
  'Name mismatch with land record',
  'Joint holder consent pending',
  'Court attachment on account',
  'Aadhaar seeding not completed',
];

const ENTITLEMENTS = [
  'Housing assistance',
  'Resettlement plot',
  'Transportation allowance',
  'Subsistence grant',
  'Employment/one-time grant',
  'Cattle shed allowance',
  'Artisan/self-employment grant',
];

export interface CompensationBundle {
  beneficiaries: Beneficiary[];
  compensation: CompensationRecord[];
  rrRecords: RRRecord[];
}

export function generateCompensation(
  rng: Rng,
  projects: Project[],
  parcels: Parcel[],
  count: number,
): CompensationBundle {
  const beneficiaries: Beneficiary[] = [];
  const compensation: CompensationRecord[] = [];
  const rrRecords: RRRecord[] = [];

  const acquiringParcels = parcels.filter((p) => p.projectId);
  const pool = acquiringParcels.length ? acquiringParcels : parcels;

  for (let i = 1; i <= count; i += 1) {
    const parcel = rng.pick(pool);
    const project =
      projects.find((p) => p.id === parcel.projectId) ?? rng.pick(projects);
    const beneficiaryId = `BEN${String(i).padStart(6, '0')}`;
    const bankVerification = rng.weighted(
      ['verified', 'pending', 'failed'] as const,
      [72, 20, 8],
    );

    beneficiaries.push({
      id: rng.uuid(),
      beneficiaryId,
      name: personName(rng),
      guardianName: personName(rng),
      familySize: rng.weighted([2, 3, 4, 5, 6, 7, 9], [10, 18, 24, 22, 14, 8, 4]),
      category: rng.weighted(['General', 'SC', 'ST', 'OBC'] as const, [38, 20, 14, 28]),
      parcelId: parcel.parcelId,
      projectId: project.id,
      district: parcel.district,
      state: parcel.state,
      bankAccountMasked: `${rng.pick(BANK_NAMES)} · ${maskIdentifier(String(rng.int(100000000000, 999999999999)), 4)}`,
      bankVerification,
      vulnerable: rng.bool(0.16),
    });

    const amountAssessed = Math.round(parcel.area * rng.int(450_000, 3_200_000));
    const status = rng.weighted(
      ['Assessed', 'Approved', 'Partially Paid', 'Paid', 'Failed', 'Withheld'] as const,
      [16, 14, 22, 34, 8, 6],
    );
    const paidRatio =
      status === 'Paid' ? 1 : status === 'Partially Paid' ? rng.float(0.2, 0.85, 2) : status === 'Approved' ? rng.float(0, 0.2, 2) : 0;
    const assessedOn = rng.dateBetween(new Date('2023-01-01'), new Date('2026-08-01'));
    const delay = rng.weighted([8, 25, 60, 120, 260, 420], [22, 24, 22, 16, 10, 6]);

    compensation.push({
      id: rng.uuid(),
      beneficiaryId,
      projectId: project.id,
      parcelId: parcel.parcelId,
      district: parcel.district,
      state: parcel.state,
      amountAssessed,
      amountPaid: Math.round(amountAssessed * paidRatio),
      status,
      assessedOn: iso(assessedOn),
      paidOn: paidRatio > 0 ? iso(addDays(assessedOn, delay)) : null,
      disbursementDelayDays: paidRatio > 0 ? delay : clamp(delay + rng.int(0, 120), 0, 720),
      failureReason: status === 'Failed' ? rng.pick(FAILURE_REASONS) : null,
      grievanceRaised: rng.bool(status === 'Failed' ? 0.6 : 0.12),
    });

    const eligibility = rng.weighted(
      ['eligible', 'not_eligible', 'under_assessment'] as const,
      [64, 18, 18],
    );
    const disbursed = eligibility === 'eligible' ? rng.int(0, 100) : 0;
    rrRecords.push({
      id: rng.uuid(),
      beneficiaryId,
      projectId: project.id,
      eligibility,
      entitlements: eligibility === 'eligible' ? rng.sample(ENTITLEMENTS, rng.int(2, 5)) : [],
      siteAllotted: eligibility === 'eligible' && rng.bool(0.55),
      siteCode: eligibility === 'eligible' && rng.bool(0.55) ? `RR-${rng.int(100, 999)}` : null,
      benefitsDisbursedPercent: disbursed,
      status: disbursed >= 100 ? 'completed' : disbursed > 0 ? 'in_progress' : 'pending',
      updatedAt: iso(addDays(assessedOn, rng.int(10, 400))),
    });
  }

  return { beneficiaries, compensation, rrRecords };
}

export function summariseCompensation(records: CompensationRecord[]) {
  const assessed = records.reduce((s, r) => s + r.amountAssessed, 0);
  const paid = records.reduce((s, r) => s + r.amountPaid, 0);
  return {
    assessed,
    paid,
    pending: assessed - paid,
    progress: round(assessed ? (paid / assessed) * 100 : 0, 1),
  };
}
