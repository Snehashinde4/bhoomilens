import { beforeAll, describe, expect, it } from 'vitest';
import { buildDataset } from '@/data/dataset';
import { SCALE_PROFILES } from '@/config/appConfig';
import { FLAGSHIP_PROJECT_NAME } from '@/data/generators/projects';
import { buildParcelGraph } from '@/graph/ownershipGraph';
import { ringAreaHectares } from '@/lib/geo';
import type { Dataset } from '@/types';

let dataset: Dataset;

beforeAll(() => {
  dataset = buildDataset(SCALE_PROFILES.demo, 20260909);
});

describe('synthetic dataset', () => {
  it('generates every collection', () => {
    expect(dataset.states.length).toBe(28);
    expect(dataset.districts.length).toBeGreaterThanOrEqual(150);
    expect(dataset.projects.length).toBe(SCALE_PROFILES.demo.projects);
    expect(dataset.parcels.length).toBe(SCALE_PROFILES.demo.parcels);
    expect(dataset.documents.length).toBe(SCALE_PROFILES.demo.documents);
    expect(dataset.districtMetrics.length).toBe(dataset.districts.length);
    expect(dataset.monthlyMetrics.length).toBe(24);
  });

  it('creates the flagship demo project in Jaipur, Rajasthan', () => {
    const project = dataset.projects[0];
    expect(project.code).toBe('PRJ-0001');
    expect(project.name).toBe(FLAGSHIP_PROJECT_NAME);
    expect(project.state).toBe('Rajasthan');
    expect(project.district).toBe('Jaipur');
    expect(project.proposedArea).toBe(4820);
    expect(project.acquiredArea).toBe(3940);
    expect(project.affectedFamilies).toBe(2418);
    expect(project.riskLevel).toBe('high');
    expect(project.riskScore).toBeGreaterThanOrEqual(70);
  });

  it('creates the reference parcel BL-184 with a GIS mismatch', () => {
    const parcel = dataset.parcels.find((p) => p.parcelId === 'BL-184');
    expect(parcel).toBeDefined();
    expect(parcel?.surveyNumber).toBe('184/2A');
    expect(parcel?.khataNumber).toBe('KH-441');
    expect(parcel?.owner).toBe('Ram Lal Meena');
    expect(parcel?.area).toBe(2.48);
    expect(parcel?.gisArea).toBe(2.09);
    expect(parcel?.trustScore).toBe(91);
    expect(parcel?.healthScore).toBe(87);
  });

  it('links the flagship document to the reference parcel', () => {
    const doc = dataset.documents[0];
    expect(doc.code).toBe('DOC-000001');
    expect(doc.documentType).toBe('Mutation Register');
    expect(doc.parcelId).toBe('BL-184');
    const validations = dataset.validations.filter((v) => v.documentId === doc.id);
    expect(validations.length).toBeGreaterThan(0);
    expect(validations.some((v) => v.field === 'ownerName')).toBe(true);
  });

  it('is reproducible for a fixed seed', () => {
    const again = buildDataset(SCALE_PROFILES.demo, 20260909);
    expect(again.projects[10].code).toBe(dataset.projects[10].code);
    expect(again.parcels[100].owner).toBe(dataset.parcels[100].owner);
  });

  it('produces closed cadastral polygons with a positive area', () => {
    dataset.parcels.slice(0, 50).forEach((p) => {
      expect(p.boundary.length).toBeGreaterThanOrEqual(4);
      expect(ringAreaHectares(p.boundary)).toBeGreaterThan(0);
    });
  });

  it('builds a four-step ownership chain per parcel', () => {
    const records = dataset.ownershipRecords.filter((o) => o.parcelId === 'BL-184');
    expect(records).toHaveLength(4);
    expect(records[0].fromYear).toBe(2000);
    expect(records[3].toYear).toBeNull();
  });

  it('produces a connected knowledge graph for the reference parcel', () => {
    const graph = buildParcelGraph('BL-184');
    expect(graph.nodes.length).toBeGreaterThan(6);
    expect(graph.edges.length).toBeGreaterThan(6);
    expect(graph.nodes.some((n) => n.kind === 'owner')).toBe(true);
    expect(graph.edges.some((e) => e.kind === 'OWNS')).toBe(true);
  });

  it('keeps risk levels consistent with risk scores', () => {
    dataset.projects.slice(0, 200).forEach((p) => {
      if (p.riskScore >= 80) expect(p.riskLevel).toBe('critical');
      else if (p.riskScore >= 65) expect(p.riskLevel).toBe('high');
      else if (p.riskScore >= 40) expect(p.riskLevel).toBe('medium');
      else expect(p.riskLevel).toBe('low');
    });
  });

  it('never disburses more compensation than assessed', () => {
    dataset.compensation.slice(0, 500).forEach((c) => {
      expect(c.amountPaid).toBeLessThanOrEqual(c.amountAssessed);
    });
  });

  it('masks every beneficiary bank identifier', () => {
    dataset.beneficiaries.slice(0, 200).forEach((b) => {
      expect(b.bankAccountMasked).toContain('X');
    });
  });
});
