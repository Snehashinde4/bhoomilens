import { iso } from '@/lib/format';
import { clamp, round } from '@/lib/stats';
import type { Rng } from '@/lib/rng';
import type { DistrictEntity, Parcel, Project, Watershed } from '@/types';

const LAND_USE = [
  'Cropland',
  'Fallow',
  'Scrub / Wasteland',
  'Forest',
  'Built-up',
  'Water body',
  'Plantation',
];

const STRUCTURE_TYPES = [
  'Check dam',
  'Farm pond',
  'Percolation tank',
  'Contour bund',
  'Recharge shaft',
  'Gabion structure',
];

const PERIODS = ['2022-Q1', '2022-Q3', '2023-Q1', '2023-Q3', '2024-Q1', '2024-Q3', '2025-Q1', '2025-Q3', '2026-Q1'];

export function generateWatersheds(
  rng: Rng,
  districts: DistrictEntity[],
  projects: Project[],
  parcels: Parcel[],
  count: number,
): Watershed[] {
  const out: Watershed[] = [];

  for (let i = 1; i <= count; i += 1) {
    const district = rng.pick(districts);
    const center: [number, number] = [
      district.center[0] + rng.float(-0.5, 0.5, 4),
      district.center[1] + rng.float(-0.45, 0.45, 4),
    ];
    const radius = rng.float(0.08, 0.22, 4);
    const vertices = rng.int(7, 11);
    const boundary: [number, number][] = Array.from({ length: vertices }, (_, idx) => {
      const angle = (idx / vertices) * Math.PI * 2;
      const r = radius * rng.float(0.7, 1.3, 4);
      return [
        round(center[0] + Math.cos(angle) * r, 5),
        round(center[1] + Math.sin(angle) * r * 0.9, 5),
      ] as [number, number];
    });

    // Land-use percentages are normalised so the distribution chart always sums to 100.
    const rawUse = LAND_USE.map(() => rng.float(2, 40, 2));
    const total = rawUse.reduce((s, v) => s + v, 0);
    const landUse = LAND_USE.map((category, idx) => ({
      category,
      percent: round((rawUse[idx] / total) * 100, 1),
    }));

    const baseNdvi = rng.float(0.24, 0.46, 3);
    const improvement = rng.float(-0.03, 0.16, 3);
    const ndviTrend = PERIODS.map((period, idx) => ({
      period,
      value: round(clamp(baseNdvi + (improvement * idx) / PERIODS.length + rng.float(-0.02, 0.02, 3), 0.08, 0.86), 3),
    }));

    const baseMoisture = rng.float(12, 30, 1);
    const soilMoistureTrend = PERIODS.map((period, idx) => ({
      period,
      value: round(clamp(baseMoisture + Math.sin(idx) * 3 + idx * rng.float(-0.3, 0.9, 2), 5, 48), 1),
    }));

    const structures = rng.sample(STRUCTURE_TYPES, rng.int(3, 5)).map((type) => {
      const planned = rng.int(12, 180);
      const verified = rng.int(Math.floor(planned * 0.3), planned);
      return { type, planned, verified, pending: planned - verified };
    });

    const erosionRiskBefore = rng.int(45, 92);
    const districtProjects = projects.filter((p) => p.district === district.name).map((p) => p.id);

    out.push({
      id: rng.uuid(),
      code: `WS-${String(i).padStart(4, '0')}`,
      name: `${district.name} ${rng.pick(['Micro-Watershed', 'Sub-Watershed', 'Catchment'])} ${rng.int(1, 22)}`,
      state: district.state,
      district: district.name,
      areaHa: rng.int(800, 12_000),
      boundary,
      landUse,
      ndviTrend,
      soilMoistureTrend,
      structures,
      erosionRiskBefore,
      erosionRiskAfter: clamp(erosionRiskBefore - rng.int(2, 34), 8, 95),
      encroachmentAlerts: rng.int(0, 28),
      interventionCoveragePercent: rng.int(12, 96),
      observationDate: iso(rng.dateBetween(new Date('2026-01-01'), new Date('2026-08-31'))),
      confidence: rng.int(62, 96),
      verificationStatus: rng.weighted(
        ['verified', 'partially_verified', 'unverified'] as const,
        [42, 38, 20],
      ),
      affectedProjects: rng.sample(districtProjects, Math.min(3, districtProjects.length)),
    });
  }

  // Attach parcels to the watershed of their district for cross-module linkage.
  const byDistrict = new Map<string, Watershed[]>();
  for (const w of out) {
    const list = byDistrict.get(w.district);
    if (list) list.push(w);
    else byDistrict.set(w.district, [w]);
  }
  for (const parcel of parcels) {
    const list = byDistrict.get(parcel.district);
    if (list?.length) parcel.watershedId = list[0].id;
  }

  return out;
}
