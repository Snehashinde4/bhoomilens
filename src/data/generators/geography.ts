import { STATE_SEEDS, TEHSIL_SUFFIXES, VILLAGE_STEMS } from '@/data/catalog';
import type { Rng } from '@/lib/rng';
import type { DistrictEntity, StateEntity } from '@/types';

export interface Geography {
  states: StateEntity[];
  districts: DistrictEntity[];
  byDistrict: Map<string, DistrictEntity>;
}

export function generateGeography(rng: Rng, districtTarget: number): Geography {
  const states: StateEntity[] = [];
  const districts: DistrictEntity[] = [];

  for (const seed of STATE_SEEDS) {
    const stateId = rng.uuid();
    const districtNames: string[] = [];

    for (const dName of seed.districts) {
      const dOffset: [number, number] = [
        seed.center[0] + rng.float(-1.4, 1.4, 4),
        seed.center[1] + rng.float(-1.2, 1.2, 4),
      ];
      const villages = rng.sample(VILLAGE_STEMS, 8).map((v, i) => (i % 3 === 2 ? `${v} Khurd` : v));
      const tehsils = rng.sample(TEHSIL_SUFFIXES, 3).map((s) => `${dName} ${s}`);
      districts.push({
        id: rng.uuid(),
        code: `${seed.code}-${dName.slice(0, 3).toUpperCase()}`,
        name: dName,
        state: seed.name,
        center: dOffset,
        tehsils,
        villages,
      });
      districtNames.push(dName);
    }

    states.push({
      id: stateId,
      code: seed.code,
      name: seed.name,
      zone: seed.zone,
      center: seed.center,
      districts: districtNames,
    });
  }

  // Top up to the configured district target with additional sub-divisions.
  let i = 1;
  while (districts.length < districtTarget) {
    const state = rng.pick(states);
    const name = `${state.name.split(' ')[0]} Division ${i}`;
    const center: [number, number] = [
      state.center[0] + rng.float(-1.6, 1.6, 4),
      state.center[1] + rng.float(-1.4, 1.4, 4),
    ];
    districts.push({
      id: rng.uuid(),
      code: `${state.code}-D${String(i).padStart(2, '0')}`,
      name,
      state: state.name,
      center,
      tehsils: rng.sample(TEHSIL_SUFFIXES, 2).map((s) => `${name} ${s}`),
      villages: rng.sample(VILLAGE_STEMS, 6),
    });
    state.districts.push(name);
    i += 1;
  }

  const byDistrict = new Map(districts.map((d) => [d.name, d]));
  return { states, districts, byDistrict };
}

export function stateLanguage(stateName: string): string {
  return STATE_SEEDS.find((s) => s.name === stateName)?.language ?? 'hi';
}
