import { getDataset } from '@/data/dataset';
import type { Parcel } from '@/types';

export type NodeKind =
  | 'owner'
  | 'parcel'
  | 'survey'
  | 'khasra'
  | 'khata'
  | 'mutation'
  | 'registration'
  | 'transaction'
  | 'legal_case'
  | 'project'
  | 'compensation'
  | 'inspection'
  | 'gis_boundary'
  | 'office';

export type EdgeKind =
  | 'OWNS'
  | 'PREVIOUSLY_OWNED'
  | 'MUTATED_TO'
  | 'REGISTERED_UNDER'
  | 'LOCATED_IN'
  | 'ACQUIRED_FOR'
  | 'COMPENSATED_BY'
  | 'DISPUTED_BY'
  | 'VALIDATED_AGAINST'
  | 'OVERLAPS_WITH'
  | 'SUPPORTED_BY';

export interface GraphNode {
  id: string;
  name: string;
  kind: NodeKind;
  detail: string;
  conflict: boolean;
  route?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: EdgeKind;
  conflict: boolean;
}

export interface OwnershipGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Builds a bounded ego-network around one parcel for interactive exploration. */
export function buildParcelGraph(parcelId: string): OwnershipGraph {
  const ds = getDataset();
  const parcel = ds.parcels.find((p) => p.parcelId === parcelId);
  if (!parcel) return { nodes: [], edges: [] };

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const push = (node: GraphNode) => {
    if (!nodes.some((n) => n.id === node.id)) nodes.push(node);
  };

  const parcelNode = `parcel:${parcel.parcelId}`;
  push({
    id: parcelNode,
    name: parcel.parcelId,
    kind: 'parcel',
    detail: `${parcel.area} ha · ${parcel.village}, ${parcel.district}`,
    conflict: parcel.legalStatus !== 'Clear',
    route: `/twins/${parcel.parcelId}`,
  });

  push({ id: `survey:${parcel.surveyNumber}`, name: `Survey ${parcel.surveyNumber}`, kind: 'survey', detail: 'Survey record', conflict: false });
  push({ id: `khasra:${parcel.khasraNumber}`, name: `Khasra ${parcel.khasraNumber}`, kind: 'khasra', detail: 'Khasra register entry', conflict: false });
  push({ id: `khata:${parcel.khataNumber}`, name: parcel.khataNumber, kind: 'khata', detail: 'Khata account', conflict: false });
  push({ id: `gis:${parcel.parcelId}`, name: 'Cadastral polygon', kind: 'gis_boundary', detail: `${parcel.gisArea} ha computed`, conflict: Math.abs(parcel.area - parcel.gisArea) / parcel.area > 0.05 });
  push({ id: `office:${parcel.tehsil}`, name: parcel.tehsil, kind: 'office', detail: 'Tehsil record office', conflict: false });

  edges.push(
    { source: parcelNode, target: `survey:${parcel.surveyNumber}`, kind: 'VALIDATED_AGAINST', conflict: false },
    { source: parcelNode, target: `khasra:${parcel.khasraNumber}`, kind: 'VALIDATED_AGAINST', conflict: false },
    { source: parcelNode, target: `khata:${parcel.khataNumber}`, kind: 'REGISTERED_UNDER', conflict: false },
    { source: parcelNode, target: `gis:${parcel.parcelId}`, kind: 'OVERLAPS_WITH', conflict: Math.abs(parcel.area - parcel.gisArea) / parcel.area > 0.05 },
    { source: parcelNode, target: `office:${parcel.tehsil}`, kind: 'LOCATED_IN', conflict: false },
  );

  const ownership = ds.ownershipRecords
    .filter((o) => o.parcelId === parcelId)
    .sort((a, b) => a.fromYear - b.fromYear);
  ownership.forEach((record, index) => {
    const isCurrent = record.toYear === null;
    const id = `owner:${record.ownerName}:${record.fromYear}`;
    push({
      id,
      name: record.ownerName,
      kind: 'owner',
      detail: `${record.fromYear}–${record.toYear ?? 'present'} · ${record.acquisitionMode}`,
      conflict: !record.verified,
    });
    edges.push({
      source: id,
      target: parcelNode,
      kind: isCurrent ? 'OWNS' : 'PREVIOUSLY_OWNED',
      conflict: !record.verified,
    });
    if (index > 0) {
      const prev = ownership[index - 1];
      edges.push({
        source: `owner:${prev.ownerName}:${prev.fromYear}`,
        target: id,
        kind: 'MUTATED_TO',
        conflict: false,
      });
    }
  });

  ds.mutations
    .filter((m) => m.parcelId === parcelId)
    .forEach((m) => {
      const id = `mutation:${m.id}`;
      push({
        id,
        name: m.mutationNumber,
        kind: 'mutation',
        detail: `${m.fromOwner} → ${m.toOwner} · ${m.status}`,
        conflict: m.anomalyFlag || m.status !== 'Approved',
      });
      edges.push({ source: id, target: parcelNode, kind: 'SUPPORTED_BY', conflict: m.anomalyFlag });
    });

  ds.registrations
    .filter((r) => r.parcelId === parcelId)
    .forEach((r) => {
      const id = `registration:${r.id}`;
      push({
        id,
        name: r.registrationNumber,
        kind: 'registration',
        detail: `${r.subRegistrarOffice}`,
        conflict: false,
      });
      edges.push({ source: parcelNode, target: id, kind: 'REGISTERED_UNDER', conflict: false });
    });

  ds.legalCases
    .filter((c) => c.parcelId === parcelId)
    .slice(0, 6)
    .forEach((c) => {
      const id = `legal:${c.id}`;
      push({ id, name: c.caseNumber, kind: 'legal_case', detail: `${c.court} · ${c.status}`, conflict: true });
      edges.push({ source: id, target: parcelNode, kind: 'DISPUTED_BY', conflict: true });
    });

  if (parcel.projectId) {
    const project = ds.projects.find((p) => p.id === parcel.projectId);
    if (project) {
      const id = `project:${project.code}`;
      push({
        id,
        name: project.name,
        kind: 'project',
        detail: `${project.code} · ${project.currentStage}`,
        conflict: project.riskLevel === 'critical',
        route: `/projects/${project.code}`,
      });
      edges.push({ source: parcelNode, target: id, kind: 'ACQUIRED_FOR', conflict: false });

      const comp = ds.compensation.find((c) => c.parcelId === parcelId);
      if (comp) {
        const cid = `compensation:${comp.id}`;
        push({
          id: cid,
          name: comp.beneficiaryId,
          kind: 'compensation',
          detail: `${comp.status}`,
          conflict: comp.status === 'Failed',
        });
        edges.push({ source: parcelNode, target: cid, kind: 'COMPENSATED_BY', conflict: comp.status === 'Failed' });
      }
    }
  }

  ds.inspections
    .filter((i) => i.parcelId === parcelId)
    .slice(0, 4)
    .forEach((i) => {
      const id = `inspection:${i.id}`;
      push({
        id,
        name: i.code,
        kind: 'inspection',
        detail: `${i.officer} · ${i.verificationStatus}`,
        conflict: i.encroachmentObserved,
      });
      edges.push({ source: id, target: parcelNode, kind: 'SUPPORTED_BY', conflict: i.encroachmentObserved });
    });

  return { nodes, edges };
}

/** Owner-centric view: every parcel held now or previously by one owner. */
export function buildOwnerGraph(ownerName: string, limit = 8): OwnershipGraph {
  const ds = getDataset();
  const records = ds.ownershipRecords.filter((o) => o.ownerName === ownerName).slice(0, limit);
  const nodes: GraphNode[] = [
    { id: `owner:${ownerName}`, name: ownerName, kind: 'owner', detail: 'Owner', conflict: false },
  ];
  const edges: GraphEdge[] = [];
  const parcelMap = new Map<string, Parcel>();
  ds.parcels.forEach((p) => parcelMap.set(p.parcelId, p));

  records.forEach((r) => {
    const parcel = parcelMap.get(r.parcelId);
    if (!parcel) return;
    nodes.push({
      id: `parcel:${parcel.parcelId}`,
      name: parcel.parcelId,
      kind: 'parcel',
      detail: `${parcel.village}, ${parcel.district}`,
      conflict: parcel.legalStatus !== 'Clear',
      route: `/twins/${parcel.parcelId}`,
    });
    edges.push({
      source: `owner:${ownerName}`,
      target: `parcel:${parcel.parcelId}`,
      kind: r.toYear === null ? 'OWNS' : 'PREVIOUSLY_OWNED',
      conflict: parcel.legalStatus !== 'Clear',
    });
  });

  return { nodes, edges };
}

export const NODE_COLORS: Record<NodeKind, string> = {
  owner: '#168a8a',
  parcel: '#102a43',
  survey: '#3978a8',
  khasra: '#3978a8',
  khata: '#718355',
  mutation: '#d99b32',
  registration: '#7b6ca6',
  transaction: '#8c6d4f',
  legal_case: '#d95d39',
  project: '#32866b',
  compensation: '#4b8ea8',
  inspection: '#a8577a',
  gis_boundary: '#66788a',
  office: '#8c6d4f',
};
