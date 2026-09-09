import { describe, expect, it } from 'vitest';
import { runValidation, RULES, type ValidationContext } from '@/validation/engine';
import type { ExtractedField, Mutation, OwnershipRecord, Parcel } from '@/types';

function parcel(overrides: Partial<Parcel> = {}): Parcel {
  return {
    id: 'p1',
    parcelId: 'BL-184',
    surveyNumber: '184/2A',
    khasraNumber: '184',
    khataNumber: 'KH-441',
    ownerId: 'o1',
    owner: 'Ram Lal Meena',
    area: 2.48,
    gisArea: 2.48,
    village: 'Sanganer',
    tehsil: 'Jaipur Sadar',
    district: 'Jaipur',
    state: 'Rajasthan',
    landType: 'Agricultural',
    ownershipType: 'Individual',
    taxStatus: 'Paid',
    acquisitionStatus: 'Notified',
    possessionStatus: 'Not Taken',
    legalStatus: 'Clear',
    projectId: null,
    trustScore: 91,
    healthScore: 87,
    fraudRiskScore: 12,
    disputeRiskScore: 18,
    centroid: [75.78, 26.81],
    boundary: [
      [75.78, 26.81],
      [75.79, 26.81],
      [75.79, 26.82],
    ],
    watershedId: null,
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'test',
    version: 1,
    ...overrides,
  };
}

function field(overrides: Partial<ExtractedField> = {}): ExtractedField {
  return {
    id: 'f1',
    documentId: 'd1',
    pageNumber: 1,
    field: 'ownerName',
    label: 'Owner name',
    originalText: 'राम लाल मीणा',
    transliterated: 'Ram Lal Meena',
    translated: 'Ram Lal Meena',
    normalizedValue: 'Ram Lal Meena',
    suggestedValue: 'Ram Lal Meena',
    lrmsValue: 'Ram Lal Meena',
    registryValue: 'Ram Lal Meena',
    mutationValue: 'Ram Lal Meena',
    gisValue: null,
    confidence: 95,
    status: 'auto_accepted',
    bbox: { x: 10, y: 10, w: 20, h: 5 },
    reviewerComment: null,
    correctionHistory: [],
    ...overrides,
  };
}

function context(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    documentId: 'd1',
    parcel: parcel(),
    fields: [field()],
    ownership: [],
    mutations: [],
    registrations: [],
    ...overrides,
  };
}

describe('validation engine', () => {
  it('passes every rule for a fully consistent record', () => {
    const result = runValidation(context());
    expect(result.issues).toHaveLength(0);
    expect(result.passedRules).toHaveLength(RULES.length);
  });

  it('raises a review issue for low-confidence extraction', () => {
    const result = runValidation(context({ fields: [field({ confidence: 55 })] }));
    expect(result.issues.some((i) => i.category === 'business_rule')).toBe(true);
    expect(result.bySeverity.review).toBeGreaterThan(0);
  });

  it('flags a master-data mismatch on the owner name', () => {
    const result = runValidation(
      context({ fields: [field({ normalizedValue: 'Ram Lai Meena', lrmsValue: 'Ram Lal Meena' })] }),
    );
    const issue = result.issues.find((i) => i.category === 'master_data');
    expect(issue).toBeDefined();
    expect(issue?.ocrValue).toBe('Ram Lai Meena');
    expect(issue?.lrmsValue).toBe('Ram Lal Meena');
  });

  it('blocks when the recorded area deviates materially from the polygon', () => {
    const result = runValidation(context({ parcel: parcel({ area: 2.48, gisArea: 2.09 }) }));
    const issue = result.issues.find((i) => i.category === 'area_consistency');
    expect(issue?.severity).toBe('blocking');
  });

  it('detects a break in the mutation chain', () => {
    const ownership: OwnershipRecord[] = [
      { id: '1', parcelId: 'BL-184', ownerId: 'a', ownerName: 'Owner A', fromYear: 2000, toYear: 2009, acquisitionMode: 'Government Allotment', sharePercent: 100, evidenceDocumentId: null, verified: true },
      { id: '2', parcelId: 'BL-184', ownerId: 'b', ownerName: 'Owner B', fromYear: 2009, toYear: null, acquisitionMode: 'Sale', sharePercent: 100, evidenceDocumentId: null, verified: true },
    ];
    const result = runValidation(context({ ownership, mutations: [] }));
    expect(result.issues.some((i) => i.category === 'mutation_chain')).toBe(true);
  });

  it('detects a duplicated mutation number', () => {
    const mutation = (n: string, id: string): Mutation => ({
      id,
      mutationNumber: n,
      parcelId: 'BL-184',
      fromOwner: 'A',
      toOwner: 'B',
      mutationDate: '2017-05-01T00:00:00.000Z',
      status: 'Approved',
      reason: 'Sale',
      officer: 'X',
      registrationId: 'r1',
      anomalyFlag: false,
    });
    const result = runValidation(context({ mutations: [mutation('MUT-441', 'm1'), mutation('MUT-441', 'm2')] }));
    expect(result.issues.some((i) => i.category === 'duplicate')).toBe(true);
  });

  it('requires a registration reference for approved mutations', () => {
    const result = runValidation(
      context({
        mutations: [
          {
            id: 'm1',
            mutationNumber: 'MUT-900',
            parcelId: 'BL-184',
            fromOwner: 'A',
            toOwner: 'B',
            mutationDate: '2017-05-01T00:00:00.000Z',
            status: 'Approved',
            reason: 'Sale',
            officer: 'X',
            registrationId: null,
            anomalyFlag: true,
          },
        ],
      }),
    );
    expect(result.issues.some((i) => i.category === 'registration_record')).toBe(true);
  });

  it('is deterministic across runs', () => {
    const ctx = context({ parcel: parcel({ area: 2.48, gisArea: 2.0 }) });
    const first = runValidation(ctx).issues.map((i) => i.id);
    const second = runValidation(ctx).issues.map((i) => i.id);
    expect(first).toEqual(second);
  });
});
