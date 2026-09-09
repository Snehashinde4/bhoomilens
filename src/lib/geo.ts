import type { Parcel, Watershed } from '@/types';

export type Position = [number, number];
export type Ring = Position[];

export interface Feature<P = Record<string, unknown>> {
  type: 'Feature';
  id?: string;
  geometry: { type: 'Polygon'; coordinates: Ring[] } | { type: 'Point'; coordinates: Position };
  properties: P;
}

export interface FeatureCollection<P = Record<string, unknown>> {
  type: 'FeatureCollection';
  features: Feature<P>[];
}

/** Shoelace area on a lon/lat ring, converted to hectares (equirectangular approx). */
export function ringAreaHectares(ring: Ring): number {
  if (ring.length < 3) return 0;
  const latRef = (ring.reduce((s, p) => s + p[1], 0) / ring.length) * (Math.PI / 180);
  const mPerDegLat = 110_574;
  const mPerDegLon = 111_320 * Math.cos(latRef);
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * mPerDegLon * (y2 * mPerDegLat) - x2 * mPerDegLon * (y1 * mPerDegLat);
  }
  return Math.abs(sum / 2) / 10_000;
}

export function centroidOf(ring: Ring): Position {
  const x = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const y = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return [x, y];
}

export function bboxOf(ring: Ring): [number, number, number, number] {
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function bboxIntersects(
  a: [number, number, number, number],
  b: [number, number, number, number],
): boolean {
  return !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);
}

export function pointInRing(point: Position, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function haversineKm(a: Position, b: Position): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function parcelsToGeoJson(parcels: Parcel[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: parcels.map((p) => ({
      type: 'Feature' as const,
      id: p.parcelId,
      geometry: { type: 'Polygon' as const, coordinates: [closeRing(p.boundary)] },
      properties: {
        parcelId: p.parcelId,
        surveyNumber: p.surveyNumber,
        khasraNumber: p.khasraNumber,
        khataNumber: p.khataNumber,
        owner: p.owner,
        area: p.area,
        gisArea: p.gisArea,
        village: p.village,
        district: p.district,
        state: p.state,
        landType: p.landType,
        trustScore: p.trustScore,
        healthScore: p.healthScore,
        legalStatus: p.legalStatus,
        acquisitionStatus: p.acquisitionStatus,
        possessionStatus: p.possessionStatus,
        projectId: p.projectId,
        areaMismatchPercent: Number((((p.area - p.gisArea) / p.area) * 100).toFixed(2)),
      },
    })),
  };
}

export function watershedsToGeoJson(watersheds: Watershed[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: watersheds.map((w) => ({
      type: 'Feature' as const,
      id: w.code,
      geometry: { type: 'Polygon' as const, coordinates: [closeRing(w.boundary)] },
      properties: {
        code: w.code,
        name: w.name,
        district: w.district,
        state: w.state,
        areaHa: w.areaHa,
        erosionRiskAfter: w.erosionRiskAfter,
        encroachmentAlerts: w.encroachmentAlerts,
        interventionCoveragePercent: w.interventionCoveragePercent,
      },
    })),
  };
}

export function closeRing(ring: Ring): Ring {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}

/** Leaflet consumes [lat, lng]; GeoJSON stores [lng, lat]. */
export function toLatLngRing(ring: Ring): Array<[number, number]> {
  return ring.map(([lng, lat]) => [lat, lng] as [number, number]);
}

export function downloadGeoJson(fc: FeatureCollection, fileName: string): void {
  const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' });
  triggerDownload(blob, fileName.endsWith('.geojson') ? fileName : `${fileName}.geojson`);
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
