import { DOCUMENT_TYPES, PROCESSING_STAGES } from '@/config/constants';
import { NATIVE_SAMPLES } from '@/data/catalog';
import { addDays, iso } from '@/lib/format';
import { clamp, round } from '@/lib/stats';
import { hashString, padCode, Rng } from '@/lib/rng';
import type {
  DocumentPage,
  DocumentRecord,
  ExtractedField,
  FieldName,
  LanguageCode,
  Parcel,
  ProcessingStage,
  Project,
  ValidationCategory,
  ValidationIssue,
} from '@/types';
import { FIELD_LABEL } from '@/config/constants';
import { officerName } from './people';
import { stateLanguage } from './geography';

export const FLAGSHIP_DOCUMENT_CODE = 'DOC-000001';

const FIELD_SET: FieldName[] = [
  'ownerName',
  'guardianName',
  'surveyNumber',
  'khasraNumber',
  'khataNumber',
  'plotArea',
  'village',
  'tehsil',
  'district',
  'state',
  'landClassification',
  'ownershipType',
  'mutationNumber',
  'mutationDate',
  'registrationNumber',
  'registrationDate',
  'compensationAmount',
  'awardNumber',
  'possessionStatus',
  'legalCaseReference',
];

export interface DocumentBundle {
  documents: DocumentRecord[];
  pages: DocumentPage[];
  fields: ExtractedField[];
  validations: ValidationIssue[];
}

/** Fields are materialised for a hot subset; the rest are derived on demand. */
const MATERIALISED_DOCUMENT_DETAIL = 500;

export function generateDocuments(
  rng: Rng,
  parcels: Parcel[],
  projects: Project[],
  count: number,
): DocumentBundle {
  const documents: DocumentRecord[] = [];
  const pages: DocumentPage[] = [];
  const fields: ExtractedField[] = [];
  const validations: ValidationIssue[] = [];

  for (let i = 1; i <= count; i += 1) {
    const isFlagship = i === 1;
    const parcel = isFlagship
      ? parcels.find((p) => p.parcelId === 'BL-184') ?? parcels[0]
      : rng.pick(parcels);
    const project = parcel.projectId
      ? projects.find((p) => p.id === parcel.projectId) ?? null
      : rng.bool(0.35)
        ? rng.pick(projects)
        : null;

    const language = (isFlagship ? 'hi' : rng.bool(0.2) ? 'en' : stateLanguage(parcel.state)) as LanguageCode;
    const documentType = isFlagship ? 'Mutation Register' : rng.pick(DOCUMENT_TYPES);
    const stageIndex = isFlagship
      ? PROCESSING_STAGES.indexOf('validated')
      : rng.weighted(
          PROCESSING_STAGES.map((_, idx) => idx),
          [6, 8, 12, 16, 18, 16, 24],
        );
    const processingStage = PROCESSING_STAGES[stageIndex];
    const isHandwritten = isFlagship ? true : rng.bool(0.38);
    const ocrConfidence = isFlagship
      ? 82.4
      : round(clamp(rng.normal(isHandwritten ? 79 : 92, 9, 42, 99.4), 42, 99.4), 1);
    const imageQuality = round(clamp(rng.normal(78, 13, 30, 99), 30, 99), 0);
    const validationIssues = isFlagship ? 4 : Math.max(0, Math.round((100 - ocrConfidence) / 8 + rng.int(-1, 3)));

    const status: DocumentRecord['status'] =
      processingStage === 'approved'
        ? 'approved'
        : processingStage === 'validated'
          ? validationIssues > 0
            ? 'needs_review'
            : 'validated'
          : processingStage === 'human_reviewed'
            ? 'validated'
            : rng.bool(0.03)
              ? 'failed'
              : 'processing';

    const uploadedAt = rng.dateBetween(new Date('2024-10-01'), new Date('2026-09-08'));
    const doc: DocumentRecord = {
      id: rng.uuid(),
      code: padCode('DOC', i, 6),
      fileName: `${documentType.replace(/[^A-Za-z]/g, '')}_${parcel.village}_${parcel.khasraNumber}.pdf`,
      documentType,
      language,
      script: NATIVE_SAMPLES[language] ? scriptOf(language) : 'Latin',
      isHandwritten,
      pages: isFlagship ? 4 : rng.int(1, 9),
      state: parcel.state,
      district: parcel.district,
      village: parcel.village,
      projectId: project?.id ?? null,
      parcelId: parcel.parcelId,
      uploadedBy: officerName(rng),
      uploadedAt: iso(uploadedAt),
      processingStage,
      status,
      ocrConfidence,
      imageQuality,
      validationIssues,
      assignedReviewer: status === 'needs_review' ? officerName(rng) : null,
      sizeKb: rng.int(180, 9800),
      createdAt: iso(uploadedAt),
      updatedAt: iso(addDays(uploadedAt, rng.int(0, 40))),
      createdBy: 'system.seed',
      version: rng.int(1, 5),
    };
    documents.push(doc);

    if (i <= MATERIALISED_DOCUMENT_DETAIL) {
      const detail = buildDocumentDetail(doc, parcel);
      pages.push(...detail.pages);
      fields.push(...detail.fields);
    }

    if (validationIssues > 0 && validations.length < 9000) {
      validations.push(...buildValidations(doc, parcel, validationIssues, isFlagship));
    }
  }

  return { documents, pages, fields, validations };
}

function scriptOf(language: LanguageCode): string {
  const map: Record<string, string> = {
    hi: 'Devanagari',
    mr: 'Devanagari',
    kn: 'Kannada',
    ta: 'Tamil',
    te: 'Telugu',
    gu: 'Gujarati',
    pa: 'Gurmukhi',
    bn: 'Bengali',
    or: 'Odia',
    ur: 'Perso-Arabic',
    en: 'Latin',
  };
  return map[language] ?? 'Latin';
}

export interface DocumentDetail {
  pages: DocumentPage[];
  fields: ExtractedField[];
}

/**
 * Deterministic per-document detail. Seeding from the document code means the
 * Digitization Studio can open any of the 50,000 documents without the whole
 * field corpus being materialised in memory.
 */
export function buildDocumentDetail(doc: DocumentRecord, parcel: Parcel | null): DocumentDetail {
  const rng = new Rng(hashString(doc.code));
  const isFlagship = doc.code === FLAGSHIP_DOCUMENT_CODE;

  const pages: DocumentPage[] = Array.from({ length: doc.pages }, (_, idx) => ({
    id: `${doc.id}-p${idx + 1}`,
    documentId: doc.id,
    pageNumber: idx + 1,
    status: rng.weighted(['clean', 'noisy', 'skewed', 'faded', 'torn'] as const, [46, 22, 14, 12, 6]),
    rotation: rng.weighted([0, 0, 0, 90, 180, 270], [70, 8, 6, 8, 4, 4]),
    ocrConfidence: round(clamp(doc.ocrConfidence + rng.float(-9, 7, 1), 35, 99.6), 1),
    textBlocks: rng.int(6, 42),
    tables: rng.int(0, 4),
    annotations: rng.bool(0.3) ? ['Stamp detected', 'Signature region detected'] : [],
  }));

  const native = NATIVE_SAMPLES[doc.language] ?? NATIVE_SAMPLES.en;
  const fields: ExtractedField[] = FIELD_SET.map((field, idx) => {
    const page = rng.int(1, doc.pages);
    const flagshipOwner = isFlagship && field === 'ownerName';
    const confidence = flagshipOwner
      ? 61.2
      : round(clamp(rng.normal(doc.ocrConfidence, 11, 34, 99.6), 34, 99.6), 1);

    const truth = truthValue(field, parcel, rng);
    const ocrNoise = confidence < 75 && rng.bool(0.65);
    const normalized = flagshipOwner ? 'Ram Lai Meena' : ocrNoise ? corrupt(truth, rng) : truth;
    const lrms = flagshipOwner ? 'Ram Lal Meena' : rng.bool(0.86) ? truth : corrupt(truth, rng);

    return {
      id: `${doc.id}-f${idx}`,
      documentId: doc.id,
      pageNumber: page,
      field,
      label: FIELD_LABEL[field],
      originalText: flagshipOwner ? 'राम लाल मीणा' : nativeFor(field, native, truth, rng),
      transliterated: flagshipOwner ? 'Ram Lal Meena' : truth,
      translated: truth,
      normalizedValue: normalized,
      suggestedValue: lrms,
      lrmsValue: rng.bool(0.92) ? lrms : null,
      registryValue: rng.bool(0.74) ? (rng.bool(0.88) ? truth : corrupt(truth, rng)) : null,
      mutationValue: rng.bool(0.66) ? truth : null,
      gisValue: field === 'plotArea' && parcel ? `${parcel.gisArea}` : null,
      confidence,
      status:
        confidence >= 88 ? 'auto_accepted' : confidence >= 70 ? 'needs_review' : 'needs_review',
      bbox: {
        x: round(rng.float(6, 58, 2), 2),
        y: round(6 + (idx % 12) * 7.2, 2),
        w: round(rng.float(20, 36, 2), 2),
        h: 4.6,
      },
      reviewerComment: null,
      correctionHistory: [],
    };
  });

  return { pages, fields };
}

function truthValue(field: FieldName, parcel: Parcel | null, rng: Rng): string {
  if (!parcel) return '—';
  switch (field) {
    case 'ownerName':
      return parcel.owner;
    case 'guardianName':
      return `S/o ${parcel.owner.split(' ')[0]} Singh`;
    case 'surveyNumber':
      return parcel.surveyNumber;
    case 'khasraNumber':
      return parcel.khasraNumber;
    case 'khataNumber':
      return parcel.khataNumber;
    case 'plotNumber':
      return `${rng.int(1, 240)}`;
    case 'plotArea':
      return `${parcel.area}`;
    case 'village':
      return parcel.village;
    case 'tehsil':
      return parcel.tehsil;
    case 'district':
      return parcel.district;
    case 'state':
      return parcel.state;
    case 'landClassification':
      return parcel.landType;
    case 'ownershipType':
      return parcel.ownershipType;
    case 'mutationNumber':
      return `MUT-${rng.int(100, 9999)}`;
    case 'mutationDate':
      return `${rng.int(1, 28)}/${rng.int(1, 12)}/20${rng.int(10, 25)}`;
    case 'registrationNumber':
      return `REG/20${rng.int(10, 25)}/${rng.int(1000, 9999)}`;
    case 'registrationDate':
      return `${rng.int(1, 28)}/${rng.int(1, 12)}/20${rng.int(10, 25)}`;
    case 'compensationAmount':
      return `${Math.round(parcel.area * rng.int(400_000, 2_600_000))}`;
    case 'awardNumber':
      return `AWD/${rng.int(100, 999)}/20${rng.int(19, 26)}`;
    case 'possessionStatus':
      return parcel.possessionStatus;
    case 'legalCaseReference':
      return parcel.legalStatus === 'Clear' ? 'NIL' : `CS/${rng.int(100, 999)}/20${rng.int(18, 26)}`;
    default:
      return '—';
  }
}

function nativeFor(
  field: FieldName,
  native: { owner: string[]; village: string[]; classification: string[] },
  fallback: string,
  rng: Rng,
): string {
  if (field === 'ownerName' || field === 'guardianName') return rng.pick(native.owner);
  if (field === 'village') return rng.pick(native.village);
  if (field === 'landClassification') return rng.pick(native.classification);
  return fallback;
}

/** Emulates typical OCR confusions on Indic transliterations and digits. */
function corrupt(value: string, rng: Rng): string {
  if (!value || value === '—') return value;
  const swaps: Array<[RegExp, string]> = [
    [/l/g, 'i'],
    [/0/g, 'O'],
    [/1/g, 'l'],
    [/5/g, 'S'],
    [/rn/g, 'm'],
    [/a$/g, 'aa'],
  ];
  const [pattern, replacement] = rng.pick(swaps);
  const mutated = value.replace(pattern, replacement);
  return mutated === value ? `${value.slice(0, -1)}${rng.pick(['a', 'i', 'e', 'u'])}` : mutated;
}

const VALIDATION_CATEGORIES: ValidationCategory[] = [
  'business_rule',
  'data_type',
  'master_data',
  'duplicate',
  'cross_document',
  'ownership_history',
  'registration_record',
  'mutation_chain',
  'compensation',
  'gis_parcel_match',
  'area_consistency',
  'legal_reference',
];

function buildValidations(
  doc: DocumentRecord,
  parcel: Parcel,
  count: number,
  isFlagship: boolean,
): ValidationIssue[] {
  const rng = new Rng(hashString(`${doc.code}-val`));
  const out: ValidationIssue[] = [];

  if (isFlagship) {
    out.push({
      id: `${doc.id}-v-owner`,
      documentId: doc.id,
      parcelId: parcel.parcelId,
      projectId: doc.projectId,
      field: 'ownerName',
      category: 'master_data',
      severity: 'review',
      title: 'Owner name does not match the LRMS record',
      detail:
        'OCR produced "Ram Lai Meena" while the Land Records Management System holds "Ram Lal Meena". Low-confidence handwriting region on page 2.',
      ocrValue: 'Ram Lai Meena',
      lrmsValue: 'Ram Lal Meena',
      registryValue: 'Ram Lal Meena',
      mutationValue: 'Ram Lal Meena',
      gisValue: '—',
      confidence: 61.2,
      recommendedResolution: 'Accept the LRMS value after visual verification of the highlighted region.',
      status: 'open',
      assignedTo: null,
      detectedAt: doc.updatedAt,
      resolvedAt: null,
    });
    out.push({
      id: `${doc.id}-v-area`,
      documentId: doc.id,
      parcelId: parcel.parcelId,
      projectId: doc.projectId,
      field: 'plotArea',
      category: 'area_consistency',
      severity: 'blocking',
      title: 'Recorded area differs from GIS-calculated area',
      detail:
        'Record of Rights states 2.48 ha whereas the cadastral polygon computes 2.09 ha, a deviation of 15.7%.',
      ocrValue: '2.48',
      lrmsValue: '2.48',
      registryValue: '2.48',
      mutationValue: '2.48',
      gisValue: '2.09',
      confidence: 94.1,
      recommendedResolution: 'Order a joint re-survey and reconcile the parcel geometry before award.',
      status: 'open',
      assignedTo: null,
      detectedAt: doc.updatedAt,
      resolvedAt: null,
    });
    out.push({
      id: `${doc.id}-v-mut`,
      documentId: doc.id,
      parcelId: parcel.parcelId,
      projectId: doc.projectId,
      field: 'mutationNumber',
      category: 'mutation_chain',
      severity: 'review',
      title: 'Mutation number reused across two parcels',
      detail: 'Mutation MUT-441 appears against two distinct khasra numbers in the same tehsil.',
      ocrValue: 'MUT-441',
      lrmsValue: 'MUT-441',
      registryValue: '—',
      mutationValue: 'MUT-441',
      gisValue: '—',
      confidence: 88.6,
      recommendedResolution: 'Verify the mutation register page and raise a correction memo if duplicated.',
      status: 'open',
      assignedTo: null,
      detectedAt: doc.updatedAt,
      resolvedAt: null,
    });
    out.push({
      id: `${doc.id}-v-reg`,
      documentId: doc.id,
      parcelId: parcel.parcelId,
      projectId: doc.projectId,
      field: 'registrationNumber',
      category: 'registration_record',
      severity: 'informational',
      title: 'Registration reference not found in the sub-registrar index',
      detail: 'The quoted registration number could not be matched in the 2017 index for this office.',
      ocrValue: 'REG/2017/4412',
      lrmsValue: 'REG/2017/4412',
      registryValue: 'NOT FOUND',
      mutationValue: 'REG/2017/4412',
      gisValue: '—',
      confidence: 72.4,
      recommendedResolution: 'Request a certified copy from the sub-registrar office.',
      status: 'open',
      assignedTo: null,
      detectedAt: doc.updatedAt,
      resolvedAt: null,
    });
    return out;
  }

  for (let i = 0; i < count; i += 1) {
    const category = rng.pick(VALIDATION_CATEGORIES);
    const severity = rng.weighted(
      ['blocking', 'review', 'informational', 'validated'] as const,
      [14, 42, 30, 14],
    );
    const field = rng.pick(FIELD_SET);
    const truth = truthValue(field, parcel, rng);
    const ocrValue = corrupt(truth, rng);
    out.push({
      id: `${doc.id}-v${i}`,
      documentId: doc.id,
      parcelId: parcel.parcelId,
      projectId: doc.projectId,
      field,
      category,
      severity,
      title: titleFor(category, field),
      detail: `${FIELD_LABEL[field]} extracted from ${doc.documentType} does not reconcile with the reference source for parcel ${parcel.parcelId}.`,
      ocrValue,
      lrmsValue: truth,
      registryValue: rng.bool(0.7) ? truth : '—',
      mutationValue: rng.bool(0.6) ? truth : '—',
      gisValue: field === 'plotArea' ? `${parcel.gisArea}` : '—',
      confidence: round(rng.float(48, 98, 1), 1),
      recommendedResolution:
        severity === 'blocking'
          ? 'Block downstream processing and route to the district verification cell.'
          : 'Confirm against the authoritative source and record the reviewer decision.',
      status: rng.weighted(['open', 'in_progress', 'resolved', 'escalated'] as const, [46, 22, 24, 8]),
      assignedTo: rng.bool(0.4) ? officerName(rng) : null,
      detectedAt: doc.updatedAt,
      resolvedAt: null,
    });
  }
  return out;
}

function titleFor(category: ValidationCategory, field: FieldName): string {
  const map: Record<ValidationCategory, string> = {
    business_rule: `${FIELD_LABEL[field]} violates a business rule`,
    data_type: `${FIELD_LABEL[field]} has an unexpected format`,
    master_data: `${FIELD_LABEL[field]} not found in master data`,
    duplicate: `Duplicate ${FIELD_LABEL[field]} detected`,
    cross_document: `${FIELD_LABEL[field]} differs across documents`,
    ownership_history: 'Ownership history is discontinuous',
    registration_record: 'Registration record could not be matched',
    mutation_chain: 'Mutation chain break detected',
    compensation: 'Compensation figure does not reconcile',
    gis_parcel_match: 'Parcel could not be matched to a GIS polygon',
    area_consistency: 'Recorded area differs from GIS-calculated area',
    legal_reference: 'Legal case reference could not be verified',
  };
  return map[category];
}
