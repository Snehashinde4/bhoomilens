import { iso } from '@/lib/format';
import { clamp, round } from '@/lib/stats';
import type { Rng } from '@/lib/rng';
import type { FraudAlert, FraudCategory, Parcel, Project, RiskLevel } from '@/types';
import { officerName } from './people';

const CATEGORIES: FraudCategory[] = [
  'Duplicate Survey Record',
  'Duplicate Registration',
  'Multiple Active Ownership Claims',
  'Inconsistent Mutation Entry',
  'Suspicious Transfer Chain',
  'Circular Ownership Transfer',
  'Missing Registration Reference',
  'Unusual Compensation Change',
  'Reused Document Identifier',
  'Area Mismatch',
  'GIS Boundary Overlap',
  'Parcel Geometry Duplication',
  'Sudden Record Modification',
  'Repeated Bank Account',
  'Unusual Approval Pattern',
];

const CATEGORY_WEIGHTS = [9, 8, 7, 9, 6, 3, 8, 5, 4, 12, 10, 4, 6, 5, 4];

function summaryFor(category: FraudCategory, parcel: Parcel, rng: Rng): { summary: string; evidence: string[] } {
  switch (category) {
    case 'Duplicate Survey Record':
      return {
        summary: `Survey number ${parcel.surveyNumber} appears on two active records in ${parcel.village}.`,
        evidence: [`Record of Rights entry A · ${parcel.parcelId}`, `Record of Rights entry B · BL-${rng.int(1, 9999)}`],
      };
    case 'Duplicate Registration':
      return {
        summary: `Two registration entries quote the same deed number for parcel ${parcel.parcelId}.`,
        evidence: ['Sub-registrar index 2019', 'Sub-registrar index 2021'],
      };
    case 'Multiple Active Ownership Claims':
      return {
        summary: `Parcel ${parcel.parcelId} shows two owners recorded as currently active.`,
        evidence: [`Owner A · ${parcel.owner}`, `Owner B · claimant on mutation register`],
      };
    case 'Inconsistent Mutation Entry':
      return {
        summary: `Mutation entry for ${parcel.parcelId} references a transferor absent from the ownership chain.`,
        evidence: ['Mutation register page 14', 'Ownership chain 2009-2017'],
      };
    case 'Suspicious Transfer Chain':
      return {
        summary: `Three transfers of ${parcel.parcelId} within ${rng.int(4, 11)} months before notification.`,
        evidence: ['Transfer timeline', 'Notification gazette date'],
      };
    case 'Circular Ownership Transfer':
      return {
        summary: `Ownership of ${parcel.parcelId} returned to an earlier holder after two transfers.`,
        evidence: ['Ownership graph cycle detected'],
      };
    case 'Missing Registration Reference':
      return {
        summary: `Mutation approved for ${parcel.parcelId} without a linked registration reference.`,
        evidence: ['Mutation record', 'Registry index lookup: NOT FOUND'],
      };
    case 'Unusual Compensation Change':
      return {
        summary: `Assessed compensation for ${parcel.parcelId} revised upward by ${rng.int(38, 190)}% after award.`,
        evidence: ['Original award statement', 'Revised assessment note'],
      };
    case 'Reused Document Identifier':
      return {
        summary: `Document identifier reused across ${rng.int(2, 5)} unrelated parcels in ${parcel.district}.`,
        evidence: ['Document register extract'],
      };
    case 'Area Mismatch':
      return {
        summary: `Recorded area ${parcel.area} ha versus GIS-calculated area ${parcel.gisArea} ha.`,
        evidence: ['Record of Rights', 'Cadastral polygon measurement'],
      };
    case 'GIS Boundary Overlap':
      return {
        summary: `Parcel ${parcel.parcelId} geometry overlaps a neighbouring parcel by ${rng.int(4, 38)}%.`,
        evidence: ['Cadastral overlay analysis'],
      };
    case 'Parcel Geometry Duplication':
      return {
        summary: `Identical polygon geometry recorded for ${parcel.parcelId} and another survey number.`,
        evidence: ['Geometry hash match'],
      };
    case 'Sudden Record Modification':
      return {
        summary: `Ownership field for ${parcel.parcelId} modified ${rng.int(3, 9)} times within 30 days.`,
        evidence: ['Field-change audit log'],
      };
    case 'Repeated Bank Account':
      return {
        summary: `One bank account is linked to ${rng.int(3, 11)} distinct compensation beneficiaries.`,
        evidence: ['Masked beneficiary account cluster'],
      };
    default:
      return {
        summary: `Approval pattern for ${parcel.district} shows ${rng.int(12, 60)} approvals by one officer within an hour.`,
        evidence: ['Approval timestamp distribution'],
      };
  }
}

export function generateFraudAlerts(
  rng: Rng,
  parcels: Parcel[],
  projects: Project[],
  count: number,
): FraudAlert[] {
  const alerts: FraudAlert[] = [];
  // Bias sampling toward low-trust parcels so alerts correlate with trust scores.
  const risky = parcels.filter((p) => p.trustScore < 70);
  const pool = risky.length > count / 2 ? risky : parcels;

  for (let i = 1; i <= count; i += 1) {
    const parcel = i === 1 ? parcels.find((p) => p.parcelId === 'BL-184') ?? pool[0] : rng.pick(pool);
    const category = i === 1 ? 'Area Mismatch' : rng.weighted(CATEGORIES, CATEGORY_WEIGHTS);
    const anomalyScore = clamp(
      Math.round(100 - parcel.trustScore + rng.int(-8, 18)),
      12,
      99,
    );
    const severity: RiskLevel =
      anomalyScore >= 82 ? 'critical' : anomalyScore >= 66 ? 'high' : anomalyScore >= 45 ? 'medium' : 'low';
    const { summary, evidence } = summaryFor(category, parcel, rng);
    const status = rng.weighted(
      ['new', 'under_investigation', 'resolved', 'false_positive'] as const,
      [38, 30, 22, 10],
    );

    alerts.push({
      id: rng.uuid(),
      code: `FA-${String(i).padStart(5, '0')}`,
      category,
      severity,
      parcelId: parcel.parcelId,
      projectId: parcel.projectId,
      district: parcel.district,
      state: parcel.state,
      summary,
      evidence,
      anomalyScore,
      detectedAt: iso(rng.dateBetween(new Date('2025-01-01'), new Date('2026-09-08'))),
      status,
      investigator: status === 'new' ? null : officerName(rng),
      relatedEntities: [
        parcel.parcelId,
        parcel.khasraNumber,
        parcel.projectId
          ? projects.find((p) => p.id === parcel.projectId)?.code ?? '—'
          : '—',
      ].filter((v) => v !== '—'),
    });
  }
  return alerts;
}

export function falsePositiveRate(alerts: FraudAlert[]): number {
  const closed = alerts.filter((a) => a.status === 'resolved' || a.status === 'false_positive');
  if (!closed.length) return 0;
  return round((closed.filter((a) => a.status === 'false_positive').length / closed.length) * 100, 1);
}
