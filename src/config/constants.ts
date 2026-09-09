import type {
  ConflictSeverity,
  DelayDriver,
  DocumentType,
  LanguageCode,
  LifecycleStage,
  ProcessingStage,
  ProjectType,
  RiskLevel,
} from '@/types';

export const THEME = {
  ink: '#102a43',
  inkDeep: '#071a2b',
  paper: '#f6f1e8',
  surface: '#fffdf8',
  sand: '#d8c4a5',
  teal: '#168a8a',
  olive: '#718355',
  red: '#d95d39',
  amber: '#d99b32',
  green: '#32866b',
  blue: '#3978a8',
  line: '#c9bda9',
  muted: '#66788a',
} as const;

/** Ordered, colour-blind-considerate categorical palette shared by every chart. */
export const CHART_PALETTE = [
  THEME.teal,
  THEME.blue,
  THEME.amber,
  THEME.olive,
  THEME.red,
  '#7b6ca6',
  '#8c6d4f',
  THEME.green,
  '#4b8ea8',
  '#a8577a',
];

export const RISK_COLORS: Record<RiskLevel, string> = {
  low: THEME.green,
  medium: THEME.amber,
  high: THEME.red,
  critical: '#96281b',
};

export const RISK_LEVELS: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

export const SEVERITY_COLORS: Record<ConflictSeverity, string> = {
  blocking: THEME.red,
  review: THEME.amber,
  informational: THEME.blue,
  validated: THEME.green,
};

export const SEVERITY_LABEL: Record<ConflictSeverity, string> = {
  blocking: 'Blocking conflict',
  review: 'Human review needed',
  informational: 'Informational difference',
  validated: 'Validated match',
};

export const LIFECYCLE_STAGES: LifecycleStage[] = [
  'proposal',
  'scrutiny',
  'approval',
  'notification',
  'objection_handling',
  'survey',
  'award',
  'compensation',
  'possession',
  'rehabilitation',
  'closure',
];

export const STAGE_LABEL: Record<LifecycleStage, string> = {
  proposal: 'Proposal',
  scrutiny: 'Scrutiny',
  approval: 'Approval',
  notification: 'Notification',
  objection_handling: 'Objection Handling',
  survey: 'Survey',
  award: 'Award',
  compensation: 'Compensation',
  possession: 'Possession',
  rehabilitation: 'Rehabilitation & Resettlement',
  closure: 'Closure',
};

/** Statutory / administrative reference durations in days (RFCTLARR-inspired). */
export const STAGE_STATUTORY_DAYS: Record<LifecycleStage, number> = {
  proposal: 45,
  scrutiny: 60,
  approval: 90,
  notification: 365,
  objection_handling: 60,
  survey: 120,
  award: 730,
  compensation: 180,
  possession: 120,
  rehabilitation: 365,
  closure: 90,
};

export const PROJECT_TYPES: ProjectType[] = [
  'highway',
  'railway',
  'irrigation',
  'industrial_corridor',
  'urban_development',
];

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  highway: 'Highway',
  railway: 'Railway',
  irrigation: 'Irrigation',
  industrial_corridor: 'Industrial Corridor',
  urban_development: 'Urban Development',
};

export const DELAY_DRIVERS: DelayDriver[] = [
  'Legal Disputes',
  'Compensation Delays',
  'Approval Delays',
  'Missing Records',
  'R&R Delays',
  'GIS Conflicts',
  'Stakeholder Response',
];

export const PROCESSING_STAGES: ProcessingStage[] = [
  'uploaded',
  'preprocessed',
  'ocr_completed',
  'fields_extracted',
  'validated',
  'human_reviewed',
  'approved',
];

export const PROCESSING_STAGE_LABEL: Record<ProcessingStage, string> = {
  uploaded: 'Uploaded',
  preprocessed: 'Preprocessed',
  ocr_completed: 'OCR completed',
  fields_extracted: 'Fields extracted',
  validated: 'Validated',
  human_reviewed: 'Human reviewed',
  approved: 'Approved',
};

export const DOCUMENT_TYPES: DocumentType[] = [
  'Mutation Register',
  'Record of Rights',
  'Khasra Register',
  'Khata Register',
  'Sale Deed',
  'Registration Record',
  'Award File',
  'Compensation Register',
  'Possession Certificate',
  'R&R Register',
  'Survey Map',
  'Cadastral Map',
  'Field Report',
];

export const LANGUAGES: Array<{ code: LanguageCode; label: string; script: string; native: string }> = [
  { code: 'en', label: 'English', script: 'Latin', native: 'English' },
  { code: 'hi', label: 'Hindi', script: 'Devanagari', native: 'हिन्दी' },
  { code: 'kn', label: 'Kannada', script: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'mr', label: 'Marathi', script: 'Devanagari', native: 'मराठी' },
  { code: 'ta', label: 'Tamil', script: 'Tamil', native: 'தமிழ்' },
  { code: 'te', label: 'Telugu', script: 'Telugu', native: 'తెలుగు' },
  { code: 'gu', label: 'Gujarati', script: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'pa', label: 'Punjabi', script: 'Gurmukhi', native: 'ਪੰਜਾਬੀ' },
  { code: 'bn', label: 'Bengali', script: 'Bengali', native: 'বাংলা' },
  { code: 'or', label: 'Odia', script: 'Odia', native: 'ଓଡ଼ିଆ' },
  { code: 'ur', label: 'Urdu', script: 'Perso-Arabic', native: 'اردو' },
];

export const VALIDATION_CATEGORY_LABEL: Record<string, string> = {
  business_rule: 'Business-rule validation',
  data_type: 'Data-type validation',
  master_data: 'Master-data matching',
  duplicate: 'Duplicate detection',
  cross_document: 'Cross-document consistency',
  ownership_history: 'Ownership-history validation',
  registration_record: 'Registration-record validation',
  mutation_chain: 'Mutation-chain validation',
  compensation: 'Compensation validation',
  gis_parcel_match: 'GIS parcel matching',
  area_consistency: 'Area-consistency validation',
  legal_reference: 'Legal-reference validation',
};

export const FIELD_LABEL: Record<string, string> = {
  ownerName: 'Owner name',
  guardianName: 'Guardian name',
  surveyNumber: 'Survey number',
  khasraNumber: 'Khasra number',
  khataNumber: 'Khata number',
  plotNumber: 'Plot number',
  plotArea: 'Plot area',
  village: 'Village',
  tehsil: 'Tehsil',
  district: 'District',
  state: 'State',
  landClassification: 'Land classification',
  ownershipType: 'Ownership type',
  mutationNumber: 'Mutation number',
  mutationDate: 'Mutation date',
  registrationNumber: 'Registration number',
  registrationDate: 'Registration date',
  compensationAmount: 'Compensation amount',
  awardNumber: 'Award number',
  possessionStatus: 'Possession status',
  legalCaseReference: 'Legal case reference',
};

export const DATE_RANGE_PRESETS = [
  { label: 'Last 30 days', months: 1 },
  { label: 'Last 90 days', months: 3 },
  { label: 'Last 6 months', months: 6 },
  { label: 'Last 12 months', months: 12 },
  { label: 'Last 24 months', months: 24 },
];
