import { FIRST_NAMES, OFFICER_FIRST, OFFICES, SURNAMES } from '@/data/catalog';
import type { Rng } from '@/lib/rng';
import type { DistrictEntity, RoleId, User } from '@/types';
import { ROLE_LIST } from '@/auth/roles';

export function personName(rng: Rng): string {
  return `${rng.pick(FIRST_NAMES)} ${rng.pick(SURNAMES)}`;
}

export function officerName(rng: Rng): string {
  return `${rng.pick(OFFICER_FIRST) as string} ${rng.pick(SURNAMES)}`;
}

export function officeName(rng: Rng, district: string): string {
  return `${rng.pick(OFFICES)}, ${district}`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase())
    .join('');
}

/** One demo identity per role so the role switcher always resolves a user. */
export function generateUsers(rng: Rng, districts: DistrictEntity[]): User[] {
  return ROLE_LIST.map((role, index) => {
    const district = districts[index % districts.length];
    const name = role.id === 'citizen' ? personName(rng) : officerName(rng);
    const scoped = role.scope === 'national';
    return {
      id: rng.uuid(),
      employeeCode: role.id === 'citizen' ? `CIT-${1000 + index}` : `GOV-${2000 + index}`,
      name,
      role: role.id as RoleId,
      designation: role.label,
      office: role.id === 'citizen' ? `${district.name}, ${district.state}` : officeName(rng, district.name),
      state: scoped ? undefined : district.state,
      district: role.scope === 'district' || role.scope === 'project' ? district.name : undefined,
      email: `${role.id}@bhoomilens.gov.in`,
      avatarInitials: initials(name),
    };
  });
}
