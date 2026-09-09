export type DataScale = 'demo' | 'standard' | 'national';

export interface ScaleProfile {
  key: DataScale;
  label: string;
  description: string;
  projects: number;
  districts: number;
  parcels: number;
  documents: number;
  beneficiaries: number;
  reviewItems: number;
  fraudAlerts: number;
  watersheds: number;
}

/**
 * Generation volumes. The `national` profile matches the specification target
 * (100k parcels / 50k documents) and is only recommended on 8GB+ machines,
 * because the whole dataset is materialised in browser memory in mock mode.
 */
export const SCALE_PROFILES: Record<DataScale, ScaleProfile> = {
  demo: {
    key: 'demo',
    label: 'Demo (fast)',
    description: 'Light dataset for laptops and live presentations.',
    projects: 400,
    districts: 150,
    parcels: 4_000,
    documents: 2_500,
    beneficiaries: 3_000,
    reviewItems: 1_200,
    fraudAlerts: 400,
    watersheds: 40,
  },
  standard: {
    key: 'standard',
    label: 'Standard (recommended)',
    description: '1,500 projects across 28 states and 150 districts.',
    projects: 1_500,
    districts: 150,
    parcels: 12_000,
    documents: 8_000,
    beneficiaries: 9_000,
    reviewItems: 3_500,
    fraudAlerts: 1_200,
    watersheds: 90,
  },
  national: {
    key: 'national',
    label: 'National (heavy)',
    description: 'Full specification volume: 100k parcels, 50k documents, 50k beneficiaries.',
    projects: 1_500,
    districts: 150,
    parcels: 100_000,
    documents: 50_000,
    beneficiaries: 50_000,
    reviewItems: 20_000,
    fraudAlerts: 6_000,
    watersheds: 150,
  },
};

const env = import.meta.env ?? ({} as Record<string, string>);

export const appConfig = {
  productName: 'BhoomiLens',
  productTagline: 'National Land Governance Intelligence Platform',
  dataSource: (env.VITE_DATA_SOURCE as 'mock' | 'api') ?? 'mock',
  apiBaseUrl: (env.VITE_API_BASE_URL as string) ?? 'http://localhost:8000/api/v1',
  seed: Number(env.VITE_DATA_SEED ?? 20260909),
  scale: ((env.VITE_DATA_SCALE as DataScale) ?? 'standard') as DataScale,
  tileUrl: (env.VITE_TILE_URL as string) ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution:
    (env.VITE_TILE_ATTRIBUTION as string) ?? '&copy; OpenStreetMap contributors',
  demoBadge: 'Demonstration environment using synthetic data.',
  predictionDisclaimer:
    'Simulated prediction for prototype demonstration. Not a legal determination.',
  anomalyDisclaimer:
    'Flagged as a potential anomaly. Not a confirmed case of fraud until officially investigated.',
  scoreDisclaimer:
    'Administrative decision-support score. Not a certification of legal ownership or title.',
  timeMachineRange: { from: 2018, to: 2026 },
  storageKeys: {
    session: 'bhoomilens.session',
    filters: 'bhoomilens.filters',
    overrides: 'bhoomilens.dataOverrides',
    scale: 'bhoomilens.scale',
    savedViews: 'bhoomilens.savedViews',
  },
} as const;

export function resolveScale(): ScaleProfile {
  const stored =
    typeof localStorage !== 'undefined'
      ? (localStorage.getItem(appConfig.storageKeys.scale) as DataScale | null)
      : null;
  const key = stored && SCALE_PROFILES[stored] ? stored : appConfig.scale;
  return SCALE_PROFILES[key] ?? SCALE_PROFILES.standard;
}
