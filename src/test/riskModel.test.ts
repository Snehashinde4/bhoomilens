import { describe, expect, it } from 'vitest';
import { FACTORS, riskLevelOf, scoreRisk, simulate, type RiskFeatures, type SimulationInput } from '@/risk/model';

const WORST: RiskFeatures = {
  compensationGap: 100,
  legalCaseLoad: 40,
  approvalAgingDays: 900,
  missingDocuments: 600,
  stakeholderResponse: 0,
  rrGap: 100,
  surveyDiscrepancy: 40,
  gisConflict: 200,
  verificationCapacity: 1,
  fieldTeamCapacity: 1,
};

const BEST: RiskFeatures = {
  compensationGap: 0,
  legalCaseLoad: 0,
  approvalAgingDays: 0,
  missingDocuments: 0,
  stakeholderResponse: 100,
  rrGap: 0,
  surveyDiscrepancy: 0,
  gisConflict: 0,
  verificationCapacity: 14,
  fieldTeamCapacity: 12,
};

describe('delay-risk model', () => {
  it('bounds the score between 1 and 99', () => {
    expect(scoreRisk(WORST).score).toBeLessThanOrEqual(99);
    expect(scoreRisk(BEST).score).toBeGreaterThanOrEqual(1);
  });

  it('scores a fully degraded project higher than a healthy one', () => {
    expect(scoreRisk(WORST).score).toBeGreaterThan(scoreRisk(BEST).score);
  });

  it('explains the score with one contributor per factor', () => {
    const result = scoreRisk(WORST);
    expect(result.contributors).toHaveLength(FACTORS.length);
    result.contributors.forEach((c) => {
      expect(c.explanation.length).toBeGreaterThan(0);
      expect(c.contribution).toBeGreaterThanOrEqual(0);
    });
  });

  it('sorts contributors by descending contribution', () => {
    const contributions = scoreRisk(WORST).contributors.map((c) => c.contribution);
    const sorted = [...contributions].sort((a, b) => b - a);
    expect(contributions).toEqual(sorted);
  });

  it('maps scores to the documented risk bands', () => {
    expect(riskLevelOf(10)).toBe('low');
    expect(riskLevelOf(50)).toBe('medium');
    expect(riskLevelOf(70)).toBe('high');
    expect(riskLevelOf(85)).toBe('critical');
  });

  it('reduces risk when capacity increases in the simulator', () => {
    const base: SimulationInput = {
      compensationCompletion: 40,
      pendingApprovalDays: 400,
      legalCases: 15,
      missingDocuments: 250,
      verificationCapacity: 3,
      fieldTeamCapacity: 3,
      rrProgress: 30,
      stakeholderResponse: 45,
      gisConflicts: 90,
    };
    const improved: SimulationInput = {
      ...base,
      compensationCompletion: 95,
      legalCases: 2,
      missingDocuments: 20,
      verificationCapacity: 14,
      fieldTeamCapacity: 12,
      rrProgress: 90,
    };
    expect(simulate(improved).score).toBeLessThan(simulate(base).score);
  });

  it('keeps delay probability inside a plausible band', () => {
    const { delayProbability } = scoreRisk(WORST);
    expect(delayProbability).toBeGreaterThan(50);
    expect(delayProbability).toBeLessThanOrEqual(98);
  });
});
