import { DOCUMENT_TYPES } from '@/config/constants';
import { iso } from '@/lib/format';
import { clamp, round } from '@/lib/stats';
import type { Rng } from '@/lib/rng';
import type {
  ConflictSeverity,
  DocumentRecord,
  Parcel,
  ReviewReason,
  ReviewTask,
} from '@/types';
import { officerName } from './people';

const REASONS: ReviewReason[] = [
  'Owner Mismatch',
  'Area Conflict',
  'Low OCR Confidence',
  'Boundary Conflict',
  'Duplicate Suspicion',
  'Missing Registration',
  'Mutation Chain Break',
  'Compensation Mismatch',
];
const REASON_WEIGHTS = [18, 16, 22, 12, 9, 8, 8, 7];

export function generateReviewQueue(
  rng: Rng,
  documents: DocumentRecord[],
  parcels: Parcel[],
  count: number,
): ReviewTask[] {
  const tasks: ReviewTask[] = [];
  const reviewable = documents.filter((d) => d.status === 'needs_review' || d.validationIssues > 0);
  const pool = reviewable.length > 50 ? reviewable : documents;

  for (let i = 1; i <= count; i += 1) {
    const isFlagship = i === 1;
    const doc = isFlagship ? documents[0] : rng.pick(pool);
    const parcel =
      parcels.find((p) => p.parcelId === doc.parcelId) ?? rng.pick(parcels);
    const reason = isFlagship ? 'Owner Mismatch' : rng.weighted(REASONS, REASON_WEIGHTS);
    const severity: ConflictSeverity = rng.weighted(
      ['blocking', 'review', 'informational', 'validated'] as const,
      [16, 46, 28, 10],
    );
    const confidence = isFlagship ? 61.2 : round(rng.float(38, 96, 1), 1);
    const pendingDays = rng.weighted([1, 4, 9, 18, 35, 62, 110], [16, 20, 20, 18, 12, 9, 5]);
    const slaDays = severity === 'blocking' ? 3 : severity === 'review' ? 7 : 14;

    const priorityScore = clamp(
      Math.round(
        (100 - confidence) * 0.5 +
          pendingDays * 0.6 +
          (severity === 'blocking' ? 28 : severity === 'review' ? 14 : 4) +
          (doc.projectId ? 10 : 0),
      ),
      1,
      100,
    );
    const status = rng.weighted(
      ['unassigned', 'assigned', 'in_progress', 'completed', 'escalated'] as const,
      [30, 26, 20, 18, 6],
    );

    tasks.push({
      id: rng.uuid(),
      code: `RVW-${String(i).padStart(6, '0')}`,
      documentId: doc.id,
      parcelId: parcel.parcelId,
      projectId: doc.projectId,
      reason,
      severity,
      language: doc.language,
      documentType: rng.bool(0.8) ? doc.documentType : rng.pick(DOCUMENT_TYPES),
      district: doc.district,
      state: doc.state,
      confidence,
      priorityScore,
      pendingDays,
      slaDays,
      assignedTo: status === 'unassigned' ? null : officerName(rng),
      status,
      createdAt: iso(rng.dateBetween(new Date('2026-04-01'), new Date('2026-09-08'))),
    });
  }

  return tasks.sort((a, b) => b.priorityScore - a.priorityScore);
}
