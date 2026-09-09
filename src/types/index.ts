/**
 * BhoomiLens domain model.
 * Every entity carries a UUID `id` plus a human-readable business code where the
 * public sector workflow requires one (PRJ-0001, BL-184, DOC-000123 ...).
 */

export type UUID = string;
export type ISODate = string;

export interface AuditableEntity {
  id: UUID;
  createdAt: ISODate;
  updatedAt: ISODate;
  createdBy: string;
  version: number;
}

/* -------------------------------------------------------------------------- */
/* Identity, roles and permissions                                            */
/* -------------------------------------------------------------------------- */

export type RoleId =
  | 'national_admin'
  | 'state_admin'
  | 'district_collector'
  | 'acquisition_officer'
  | 'revenue_officer'
  | 'verification_officer'
  | 'gis_analyst'
  | 'legal_reviewer'
  | 'compensation_officer'
  | 'rr_officer'
  | 'auditor'
  | 'researcher'
  | 'field_officer'
  | 'citizen';

export type Permission =
  | 'overview.view'
  | 'project.view'
  | 'project.edit'
  | 'project.intervene'
  | 'risk.view'
  | 'risk.simulate'
  | 'document.view'
  | 'document.upload'
  | 'document.process'
  | 'validation.view'
  | 'validation.decide'
  | 'parcel.view'
  | 'graph.view'
  | 'fraud.view'
  | 'fraud.investigate'
  | 'gis.view'
  | 'gis.edit'
  | 'watershed.view'
  | 'compensation.view'
  | 'compensation.approve'
  | 'review.view'
  | 'review.assign'
  | 'research.view'
  | 'citizen.view'
  | 'reports.view'
  | 'reports.export'
  | 'integrations.view'
  | 'integrations.manage'
  | 'governance.view'
  | 'audit.view'
  | 'settings.manage'
  | 'pii.unmask';

export interface Role {
  id: RoleId;
  label: string;
  scope: 'national' | 'state' | 'district' | 'project' | 'citizen';
  description: string;
  permissions: Permission[];
  landingRoute: string;
}

export interface User {
  id: UUID;
  employeeCode: string;
  name: string;
  role: RoleId;
  designation: string;
  office: string;
  state?: string;
  district?: string;
  email: string;
  avatarInitials: string;
}

/* -------------------------------------------------------------------------- */
/* Administrative geography                                                   */
/* -------------------------------------------------------------------------- */

export interface StateEntity {
  id: UUID;
  code: string;
  name: string;
  zone: string;
  center: [number, number];
  districts: string[];
}

export interface DistrictEntity {
  id: UUID;
  code: string;
  name: string;
  state: string;
  center: [number, number];
  tehsils: string[];
  villages: string[];
}

/* -------------------------------------------------------------------------- */
/* Land acquisition                                                           */
/* -------------------------------------------------------------------------- */

export type ProjectType =
  | 'highway'
  | 'railway'
  | 'irrigation'
  | 'industrial_corridor'
  | 'urban_development';

export type LifecycleStage =
  | 'proposal'
  | 'scrutiny'
  | 'approval'
  | 'notification'
  | 'objection_handling'
  | 'survey'
  | 'award'
  | 'compensation'
  | 'possession'
  | 'rehabilitation'
  | 'closure';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type DelayDriver =
  | 'Legal Disputes'
  | 'Compensation Delays'
  | 'Approval Delays'
  | 'Missing Records'
  | 'R&R Delays'
  | 'GIS Conflicts'
  | 'Stakeholder Response';

export interface Project extends AuditableEntity {
  code: string;
  name: string;
  state: string;
  district: string;
  projectType: ProjectType;
  implementingAgency: string;
  projectOfficer: string;
  proposedArea: number;
  acquiredArea: number;
  affectedVillages: number;
  affectedFamilies: number;
  compensationAssessed: number;
  compensationPaid: number;
  possessionPercent: number;
  rrProgressPercent: number;
  currentStage: LifecycleStage;
  completionPercent: number;
  delayProbability: number;
  riskScore: number;
  riskLevel: RiskLevel;
  primaryDelayDriver: DelayDriver;
  pendingDays: number;
  responsibleOffice: string;
  startDate: ISODate;
  plannedCompletion: ISODate;
  predictedCompletion: ISODate;
  openLegalCases: number;
  openDocumentConflicts: number;
  gisDiscrepancies: number;
  budgetCrore: number;
  centroid: [number, number];
}

export interface ProjectStage {
  id: UUID;
  projectId: UUID;
  stage: LifecycleStage;
  status: 'completed' | 'in_progress' | 'pending' | 'delayed';
  completedCases: number;
  pendingCases: number;
  delayedCases: number;
  averageDurationDays: number;
  statutoryDeadlineDays: number;
  daysRemaining: number;
  responsibleOfficer: string;
  pendingDocuments: number;
  riskContribution: number;
  dependsOn: LifecycleStage[];
  plannedStart: ISODate;
  plannedEnd: ISODate;
  actualStart: ISODate | null;
  actualEnd: ISODate | null;
  onCriticalPath: boolean;
}

export interface ProjectMilestone {
  id: UUID;
  projectId: UUID;
  title: string;
  stage: LifecycleStage;
  dueDate: ISODate;
  completedDate: ISODate | null;
  status: 'completed' | 'upcoming' | 'overdue';
  note: string;
}

/* -------------------------------------------------------------------------- */
/* Parcels, owners, ownership chain                                           */
/* -------------------------------------------------------------------------- */

export type LandClassification =
  | 'Agricultural'
  | 'Non-Agricultural'
  | 'Residential'
  | 'Commercial'
  | 'Government'
  | 'Forest'
  | 'Water Body';

export interface Parcel extends AuditableEntity {
  parcelId: string;
  surveyNumber: string;
  khasraNumber: string;
  khataNumber: string;
  ownerId: UUID;
  owner: string;
  area: number;
  gisArea: number;
  village: string;
  tehsil: string;
  district: string;
  state: string;
  landType: LandClassification;
  ownershipType: 'Individual' | 'Joint' | 'Government' | 'Institutional' | 'Trust';
  taxStatus: 'Paid' | 'Partially Paid' | 'Pending';
  acquisitionStatus: 'Not Notified' | 'Notified' | 'Awarded' | 'Compensated' | 'Possessed';
  possessionStatus: 'Not Taken' | 'Partial' | 'Complete';
  legalStatus: 'Clear' | 'Under Dispute' | 'Stayed';
  projectId: UUID | null;
  trustScore: number;
  healthScore: number;
  fraudRiskScore: number;
  disputeRiskScore: number;
  centroid: [number, number];
  boundary: [number, number][];
  watershedId: UUID | null;
}

export interface Owner {
  id: UUID;
  name: string;
  guardianName: string;
  ownershipType: Parcel['ownershipType'];
  village: string;
  district: string;
  state: string;
  aadhaarMasked: string;
  parcels: number;
}

export interface OwnershipRecord {
  id: UUID;
  parcelId: string;
  ownerId: UUID;
  ownerName: string;
  fromYear: number;
  toYear: number | null;
  acquisitionMode: 'Inheritance' | 'Sale' | 'Gift' | 'Partition' | 'Government Allotment' | 'Court Decree';
  sharePercent: number;
  evidenceDocumentId: UUID | null;
  verified: boolean;
}

export interface Mutation {
  id: UUID;
  mutationNumber: string;
  parcelId: string;
  fromOwner: string;
  toOwner: string;
  mutationDate: ISODate;
  status: 'Approved' | 'Pending' | 'Rejected' | 'Under Objection';
  reason: OwnershipRecord['acquisitionMode'];
  officer: string;
  registrationId: UUID | null;
  anomalyFlag: boolean;
}

export interface Registration {
  id: UUID;
  registrationNumber: string;
  parcelId: string;
  registrationDate: ISODate;
  subRegistrarOffice: string;
  considerationAmount: number;
  stampDuty: number;
  buyer: string;
  seller: string;
  documentId: UUID | null;
}

/* -------------------------------------------------------------------------- */
/* Documents and extraction                                                   */
/* -------------------------------------------------------------------------- */

export type DocumentType =
  | 'Mutation Register'
  | 'Record of Rights'
  | 'Khasra Register'
  | 'Khata Register'
  | 'Sale Deed'
  | 'Registration Record'
  | 'Award File'
  | 'Compensation Register'
  | 'Possession Certificate'
  | 'R&R Register'
  | 'Survey Map'
  | 'Cadastral Map'
  | 'Field Report';

export type ProcessingStage =
  | 'uploaded'
  | 'preprocessed'
  | 'ocr_completed'
  | 'fields_extracted'
  | 'validated'
  | 'human_reviewed'
  | 'approved';

export type LanguageCode =
  | 'hi'
  | 'kn'
  | 'mr'
  | 'ta'
  | 'te'
  | 'gu'
  | 'pa'
  | 'bn'
  | 'or'
  | 'ur'
  | 'en';

export interface DocumentRecord extends AuditableEntity {
  code: string;
  fileName: string;
  documentType: DocumentType;
  language: LanguageCode;
  script: string;
  isHandwritten: boolean;
  pages: number;
  state: string;
  district: string;
  village: string;
  projectId: UUID | null;
  parcelId: string | null;
  uploadedBy: string;
  uploadedAt: ISODate;
  processingStage: ProcessingStage;
  status: 'processing' | 'needs_review' | 'validated' | 'approved' | 'rejected' | 'failed';
  ocrConfidence: number;
  imageQuality: number;
  validationIssues: number;
  assignedReviewer: string | null;
  sizeKb: number;
}

export interface DocumentPage {
  id: UUID;
  documentId: UUID;
  pageNumber: number;
  status: 'clean' | 'noisy' | 'skewed' | 'faded' | 'torn';
  rotation: number;
  ocrConfidence: number;
  textBlocks: number;
  tables: number;
  annotations: string[];
}

export type FieldName =
  | 'ownerName'
  | 'guardianName'
  | 'surveyNumber'
  | 'khasraNumber'
  | 'khataNumber'
  | 'plotNumber'
  | 'plotArea'
  | 'village'
  | 'tehsil'
  | 'district'
  | 'state'
  | 'landClassification'
  | 'ownershipType'
  | 'mutationNumber'
  | 'mutationDate'
  | 'registrationNumber'
  | 'registrationDate'
  | 'compensationAmount'
  | 'awardNumber'
  | 'possessionStatus'
  | 'legalCaseReference';

export interface ExtractedField {
  id: UUID;
  documentId: UUID;
  pageNumber: number;
  field: FieldName;
  label: string;
  originalText: string;
  transliterated: string;
  translated: string;
  normalizedValue: string;
  suggestedValue: string;
  lrmsValue: string | null;
  registryValue: string | null;
  mutationValue: string | null;
  gisValue: string | null;
  confidence: number;
  status: 'auto_accepted' | 'needs_review' | 'corrected' | 'rejected';
  bbox: { x: number; y: number; w: number; h: number };
  reviewerComment: string | null;
  correctionHistory: Array<{ at: ISODate; by: string; from: string; to: string }>;
}

/* -------------------------------------------------------------------------- */
/* Validation and conflicts                                                   */
/* -------------------------------------------------------------------------- */

export type ValidationCategory =
  | 'business_rule'
  | 'data_type'
  | 'master_data'
  | 'duplicate'
  | 'cross_document'
  | 'ownership_history'
  | 'registration_record'
  | 'mutation_chain'
  | 'compensation'
  | 'gis_parcel_match'
  | 'area_consistency'
  | 'legal_reference';

export type ConflictSeverity = 'blocking' | 'review' | 'informational' | 'validated';

export interface ValidationIssue {
  id: UUID;
  documentId: UUID | null;
  parcelId: string | null;
  projectId: UUID | null;
  field: FieldName | null;
  category: ValidationCategory;
  severity: ConflictSeverity;
  title: string;
  detail: string;
  ocrValue: string;
  lrmsValue: string;
  registryValue: string;
  mutationValue: string;
  gisValue: string;
  confidence: number;
  recommendedResolution: string;
  status: 'open' | 'in_progress' | 'resolved' | 'escalated';
  assignedTo: string | null;
  detectedAt: ISODate;
  resolvedAt: ISODate | null;
}

/* -------------------------------------------------------------------------- */
/* Fraud and risk                                                             */
/* -------------------------------------------------------------------------- */

export type FraudCategory =
  | 'Duplicate Survey Record'
  | 'Duplicate Registration'
  | 'Multiple Active Ownership Claims'
  | 'Inconsistent Mutation Entry'
  | 'Suspicious Transfer Chain'
  | 'Circular Ownership Transfer'
  | 'Missing Registration Reference'
  | 'Unusual Compensation Change'
  | 'Reused Document Identifier'
  | 'Area Mismatch'
  | 'GIS Boundary Overlap'
  | 'Parcel Geometry Duplication'
  | 'Sudden Record Modification'
  | 'Repeated Bank Account'
  | 'Unusual Approval Pattern';

export interface FraudAlert {
  id: UUID;
  code: string;
  category: FraudCategory;
  severity: RiskLevel;
  parcelId: string | null;
  projectId: UUID | null;
  district: string;
  state: string;
  summary: string;
  evidence: string[];
  anomalyScore: number;
  detectedAt: ISODate;
  status: 'new' | 'under_investigation' | 'resolved' | 'false_positive';
  investigator: string | null;
  relatedEntities: string[];
}

export interface RiskContributor {
  factor: string;
  contribution: number;
  value: number;
  unit: string;
  direction: 'increases' | 'reduces';
  explanation: string;
}

export interface RiskPrediction {
  id: UUID;
  projectId: UUID;
  riskScore: number;
  riskLevel: RiskLevel;
  delayProbability: number;
  predictedCompletion: ISODate;
  districtBaseline: number;
  modelConfidence: number;
  dataCompleteness: number;
  modelVersion: string;
  lastRunAt: ISODate;
  stageProbabilities: Array<{ stage: LifecycleStage; probability: number }>;
  contributors: RiskContributor[];
  recommendedIntervention: string;
  expectedEffect: string;
  disclaimer: string;
}

export interface Intervention {
  id: UUID;
  code: string;
  projectId: UUID;
  title: string;
  description: string;
  driver: DelayDriver;
  priority: RiskLevel;
  status: 'proposed' | 'assigned' | 'in_progress' | 'resolved' | 'escalated';
  assignedOffice: string;
  assignedOfficer: string | null;
  createdAt: ISODate;
  dueDate: ISODate;
  expectedRiskReduction: number;
  notes: Array<{ at: ISODate; by: string; text: string }>;
}

/* -------------------------------------------------------------------------- */
/* Compensation, R&R, legal, field                                            */
/* -------------------------------------------------------------------------- */

export interface Beneficiary {
  id: UUID;
  beneficiaryId: string;
  name: string;
  guardianName: string;
  familySize: number;
  category: 'General' | 'SC' | 'ST' | 'OBC';
  parcelId: string;
  projectId: UUID;
  district: string;
  state: string;
  bankAccountMasked: string;
  bankVerification: 'verified' | 'pending' | 'failed';
  vulnerable: boolean;
}

export interface CompensationRecord {
  id: UUID;
  beneficiaryId: string;
  projectId: UUID;
  parcelId: string;
  district: string;
  state: string;
  amountAssessed: number;
  amountPaid: number;
  status: 'Assessed' | 'Approved' | 'Partially Paid' | 'Paid' | 'Failed' | 'Withheld';
  assessedOn: ISODate;
  paidOn: ISODate | null;
  disbursementDelayDays: number;
  failureReason: string | null;
  grievanceRaised: boolean;
}

export interface RRRecord {
  id: UUID;
  beneficiaryId: string;
  projectId: UUID;
  eligibility: 'eligible' | 'not_eligible' | 'under_assessment';
  entitlements: string[];
  siteAllotted: boolean;
  siteCode: string | null;
  benefitsDisbursedPercent: number;
  status: 'pending' | 'in_progress' | 'completed';
  updatedAt: ISODate;
}

export interface LegalCase {
  id: UUID;
  caseNumber: string;
  projectId: UUID | null;
  parcelId: string | null;
  court: string;
  subject: string;
  filedOn: ISODate;
  status: 'pending' | 'stayed' | 'disposed' | 'under_appeal';
  nextHearing: ISODate | null;
  impact: RiskLevel;
}

export interface FieldInspection {
  id: UUID;
  code: string;
  parcelId: string;
  projectId: UUID | null;
  officer: string;
  inspectedOn: ISODate;
  findings: string;
  possessionObserved: boolean;
  encroachmentObserved: boolean;
  photographs: GeoEvidence[];
  verificationStatus: 'verified' | 'pending' | 'disputed';
}

export interface GeoEvidence {
  id: UUID;
  type: 'photograph' | 'satellite' | 'drone' | 'survey';
  caption: string;
  capturedOn: ISODate;
  location: [number, number];
  source: string;
  confidence: number;
}

/* -------------------------------------------------------------------------- */
/* Watershed / environment                                                    */
/* -------------------------------------------------------------------------- */

export interface Watershed {
  id: UUID;
  code: string;
  name: string;
  state: string;
  district: string;
  areaHa: number;
  boundary: [number, number][];
  landUse: Array<{ category: string; percent: number }>;
  ndviTrend: Array<{ period: string; value: number }>;
  soilMoistureTrend: Array<{ period: string; value: number }>;
  structures: Array<{ type: string; planned: number; verified: number; pending: number }>;
  erosionRiskBefore: number;
  erosionRiskAfter: number;
  encroachmentAlerts: number;
  interventionCoveragePercent: number;
  observationDate: ISODate;
  confidence: number;
  verificationStatus: 'verified' | 'partially_verified' | 'unverified';
  affectedProjects: UUID[];
}

/* -------------------------------------------------------------------------- */
/* Review queue, research, notifications, audit, integrations                 */
/* -------------------------------------------------------------------------- */

export type ReviewReason =
  | 'Owner Mismatch'
  | 'Area Conflict'
  | 'Low OCR Confidence'
  | 'Boundary Conflict'
  | 'Duplicate Suspicion'
  | 'Missing Registration'
  | 'Mutation Chain Break'
  | 'Compensation Mismatch';

export interface ReviewTask {
  id: UUID;
  code: string;
  documentId: UUID | null;
  parcelId: string | null;
  projectId: UUID | null;
  reason: ReviewReason;
  severity: ConflictSeverity;
  language: LanguageCode;
  documentType: DocumentType;
  district: string;
  state: string;
  confidence: number;
  priorityScore: number;
  pendingDays: number;
  slaDays: number;
  assignedTo: string | null;
  status: 'unassigned' | 'assigned' | 'in_progress' | 'completed' | 'escalated';
  createdAt: ISODate;
}

export interface ResearchDocument {
  id: UUID;
  title: string;
  category:
    | 'Research Paper'
    | 'Policy Document'
    | 'Government Circular'
    | 'Dataset'
    | 'Case Study'
    | 'GIS Study'
    | 'Pilot'
    | 'Innovation Challenge'
    | 'Research Grant';
  authors: string[];
  publishedOn: ISODate;
  abstract: string;
  tags: string[];
  states: string[];
  citations: number;
  accessLevel: 'public' | 'restricted';
  sourceRef: string;
}

export interface Notification {
  id: UUID;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: ISODate;
  read: boolean;
  route: string | null;
  roles: RoleId[];
}

export interface AuditEvent {
  id: UUID;
  correlationId: string;
  actor: string;
  role: RoleId;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string;
  timestamp: ISODate;
  sourceIp: string;
}

export interface IntegrationStatus {
  id: UUID;
  system: string;
  category: 'records' | 'registration' | 'gis' | 'payments' | 'identity' | 'legal' | 'remote_sensing' | 'repository';
  status: 'connected' | 'degraded' | 'offline' | 'syncing' | 'error';
  lastSyncAt: ISODate;
  recordsSynced: number;
  failedRecords: number;
  latencyMs: number;
  endpoint: string;
  errorLog: Array<{ at: ISODate; code: string; message: string }>;
}

/* -------------------------------------------------------------------------- */
/* Metrics                                                                    */
/* -------------------------------------------------------------------------- */

export interface MonthlyMetric {
  period: string;
  documentsUploaded: number;
  documentsProcessed: number;
  documentsValidated: number;
  documentsSentForReview: number;
  compensationAssessed: number;
  compensationDisbursed: number;
  digitizationAccuracy: number;
  parcelsDigitized: number;
  fraudAlerts: number;
  interventionsClosed: number;
}

export interface DistrictMetric {
  id: UUID;
  district: string;
  state: string;
  digitizationProgress: number;
  digitizationAccuracy: number;
  fraudAlerts: number;
  reviewBacklog: number;
  compensationProgress: number;
  acquisitionProgress: number;
  delayProbability: number;
  processingSpeedDocsPerDay: number;
  riskReduction: number;
  interventionClosureRate: number;
  projects: number;
  parcels: number;
  center: [number, number];
}

export interface NationalKpi {
  key: string;
  label: string;
  value: number;
  previousValue: number;
  unit: 'count' | 'percent' | 'currency' | 'area';
  changePercent: number;
  comparisonPeriod: string;
  status: 'positive' | 'negative' | 'neutral';
  tooltip: string;
  route: string;
  sparkline: number[];
}

/* -------------------------------------------------------------------------- */
/* Dataset container + filters                                                */
/* -------------------------------------------------------------------------- */

export interface Dataset {
  generatedAt: ISODate;
  seed: number;
  scale: string;
  states: StateEntity[];
  districts: DistrictEntity[];
  users: User[];
  projects: Project[];
  projectStages: ProjectStage[];
  milestones: ProjectMilestone[];
  parcels: Parcel[];
  owners: Owner[];
  ownershipRecords: OwnershipRecord[];
  mutations: Mutation[];
  registrations: Registration[];
  documents: DocumentRecord[];
  documentPages: DocumentPage[];
  extractedFields: ExtractedField[];
  validations: ValidationIssue[];
  fraudAlerts: FraudAlert[];
  riskPredictions: RiskPrediction[];
  interventions: Intervention[];
  beneficiaries: Beneficiary[];
  compensation: CompensationRecord[];
  rrRecords: RRRecord[];
  legalCases: LegalCase[];
  inspections: FieldInspection[];
  watersheds: Watershed[];
  reviewQueue: ReviewTask[];
  research: ResearchDocument[];
  notifications: Notification[];
  auditLogs: AuditEvent[];
  integrations: IntegrationStatus[];
  monthlyMetrics: MonthlyMetric[];
  districtMetrics: DistrictMetric[];
}

export interface GlobalFilters {
  workspace: 'national' | 'state' | 'district' | 'project' | 'citizen';
  state: string | 'ALL';
  district: string | 'ALL';
  projectType: ProjectType | 'ALL';
  riskLevel: RiskLevel | 'ALL';
  dateRange: { from: string; to: string; label: string };
  search: string;
  timeMachineYear: number | null;
}

export interface PageResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}
