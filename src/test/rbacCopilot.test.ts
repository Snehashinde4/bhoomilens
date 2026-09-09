import { describe, expect, it } from 'vitest';
import { hasPermission, inScope, ROLES } from '@/auth/roles';
import { askLandGpt } from '@/copilot/engine';

describe('role-based access control', () => {
  it('grants the national administrator every module', () => {
    expect(hasPermission('national_admin', 'settings.manage')).toBe(true);
    expect(hasPermission('national_admin', 'audit.view')).toBe(true);
    expect(hasPermission('national_admin', 'pii.unmask')).toBe(true);
  });

  it('restricts the citizen role to public services', () => {
    expect(hasPermission('citizen', 'citizen.view')).toBe(true);
    expect(hasPermission('citizen', 'project.view')).toBe(false);
    expect(hasPermission('citizen', 'audit.view')).toBe(false);
  });

  it('prevents an auditor from mutating records', () => {
    expect(hasPermission('auditor', 'audit.view')).toBe(true);
    expect(hasPermission('auditor', 'validation.decide')).toBe(false);
    expect(hasPermission('auditor', 'project.edit')).toBe(false);
  });

  it('gives every role a reachable landing route', () => {
    Object.values(ROLES).forEach((role) => {
      expect(role.landingRoute.startsWith('/')).toBe(true);
      expect(role.permissions.length).toBeGreaterThan(0);
    });
  });

  it('applies district scope to district-scoped roles', () => {
    const ctx = { role: 'district_collector' as const, state: 'Rajasthan', district: 'Jaipur' };
    expect(inScope(ctx, { state: 'Rajasthan', district: 'Jaipur' })).toBe(true);
    expect(inScope(ctx, { state: 'Rajasthan', district: 'Kota' })).toBe(false);
  });

  it('lets national roles see every record', () => {
    expect(inScope({ role: 'national_admin' }, { state: 'Kerala', district: 'Kollam' })).toBe(true);
  });
});

describe('LandGPT copilot', () => {
  it('answers high-risk project questions for permitted roles', () => {
    const answer = askLandGpt('Show high-risk projects in Rajasthan', 'national_admin');
    expect(answer.intent).toBe('high_risk_by_state');
    expect(answer.facts.length).toBeGreaterThan(0);
    expect(answer.citations.length).toBeGreaterThan(0);
  });

  it('separates model estimates from facts', () => {
    const answer = askLandGpt('Why is NH-48 Expansion Package 3 high-risk', 'national_admin');
    expect(answer.facts.length).toBeGreaterThan(0);
    expect(answer.predictions.length).toBeGreaterThan(0);
  });

  it('denies answers the role is not permitted to see', () => {
    const answer = askLandGpt('Summarize pending compensation cases', 'citizen');
    expect(answer.denied).toBe(true);
    expect(answer.facts.join(' ')).toContain('permission');
  });

  it('does not invent records for unknown questions', () => {
    const answer = askLandGpt('zzz unknown query about nothing', 'national_admin');
    expect(answer.intent).toBe('unknown');
    expect(answer.citations).toHaveLength(0);
    expect(answer.confidence).toBeLessThan(50);
  });

  it('explains the trust score for the reference parcel', () => {
    const answer = askLandGpt('Explain the trust score for parcel BL-184', 'national_admin');
    expect(answer.headline).toContain('BL-184');
    expect(answer.citations[0]?.route).toBe('/twins/BL-184');
  });
});
