import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge, ConfidenceBadge, SeverityBadge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Labelled, ProgressBar, TextInput } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Can } from '@/auth/PermissionGuard';
import { useAsync } from '@/hooks/useAsync';
import { getDocumentDetail } from '@/services/api';
import { useAppStore } from '@/store/appStore';
import { getDataset } from '@/data/dataset';
import { runValidation, type ValidationRunResult } from '@/validation/engine';
import { FIELD_LABEL, PROCESSING_STAGE_LABEL, SEVERITY_LABEL } from '@/config/constants';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { DocumentPage, ExtractedField } from '@/types';

export default function DocumentStudioPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const decideField = useAppStore((s) => s.decideField);
  const dataset = getDataset();

  const { data, loading, reload } = useAsync(() => getDocumentDetail(code), [code]);

  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [enhanced, setEnhanced] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [comment, setComment] = useState('');
  const [validation, setValidation] = useState<ValidationRunResult | null>(null);
  const [clarifyOpen, setClarifyOpen] = useState(false);

  const fields = data?.fields ?? [];
  const activeField = fields.find((f) => f.id === activeFieldId) ?? null;

  useEffect(() => {
    if (activeField) setEditValue(activeField.normalizedValue);
  }, [activeFieldId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageFields = useMemo(() => fields.filter((f) => f.pageNumber === page), [fields, page]);

  const rerunValidation = () => {
    if (!data) return;
    const ds = getDataset();
    const parcelId = data.parcel?.parcelId ?? '';
    setValidation(
      runValidation({
        documentId: data.document.id,
        parcel: data.parcel,
        fields: data.fields,
        ownership: ds.ownershipRecords.filter((o) => o.parcelId === parcelId),
        mutations: ds.mutations.filter((m) => m.parcelId === parcelId),
        registrations: ds.registrations.filter((r) => r.parcelId === parcelId),
      }),
    );
  };

  if (loading) {
    return (
      <Card>
        <p className="p-6 text-[13px] text-muted">Loading document workspace…</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <div className="surface-card">
        <EmptyState
          title="Document not found"
          description={`No document matches "${code}".`}
          action={
            <button className="btn-primary" onClick={() => navigate('/digitization')}>
              Back to Digitization Studio
            </button>
          }
        />
      </div>
    );
  }

  const { document: doc, pages, parcel, validations } = data;
  const currentPage = pages.find((p) => p.pageNumber === page) ?? pages[0];

  return (
    <div className="space-y-3">
      <PageHeader
        title={`${doc.code} · ${doc.documentType}`}
        description={`${doc.fileName} · ${doc.language.toUpperCase()} (${doc.script}) · ${doc.isHandwritten ? 'handwritten' : 'printed'} · ${doc.village}, ${doc.district}, ${doc.state}`}
        trail={[{ label: 'Digitization Studio', to: '/digitization' }, { label: doc.code }]}
        actions={
          <>
            {parcel && (
              <button className="btn-secondary" onClick={() => navigate(`/twins/${parcel.parcelId}`)}>
                Open land digital twin
              </button>
            )}
            {parcel && (
              <button className="btn-secondary" onClick={() => navigate(`/ownership-graph?parcel=${parcel.parcelId}`)}>
                Ownership conflict graph
              </button>
            )}
            <Can permission="validation.decide">
              <button className="btn-teal" onClick={rerunValidation}>
                Re-run validation
              </button>
            </Can>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[190px_minmax(0,1fr)_390px]">
        <ThumbnailRail
          pages={pages}
          active={page}
          onSelect={setPage}
          rotation={rotation}
          onRotate={() => setRotation((r) => (r + 90) % 360)}
        />

        <Card
          dense
          title={`Page ${page} of ${doc.pages}`}
          subtitle={`${currentPage?.status ?? 'clean'} · ${currentPage?.textBlocks ?? 0} text blocks · ${currentPage?.tables ?? 0} table(s)`}
          actions={
            <div className="flex flex-wrap items-center gap-1">
              <button className="btn-secondary px-2 py-0.5 text-2xs" onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}>
                −
              </button>
              <span className="metric w-10 text-center text-2xs">{Math.round(zoom * 100)}%</span>
              <button className="btn-secondary px-2 py-0.5 text-2xs" onClick={() => setZoom((z) => Math.min(2.4, z + 0.15))}>
                +
              </button>
              <button className="btn-secondary px-2 py-0.5 text-2xs" onClick={() => setRotation((r) => (r + 90) % 360)}>
                ⟳
              </button>
              <button
                className={cn('px-2 py-0.5 text-2xs', enhanced ? 'btn-teal' : 'btn-secondary')}
                onClick={() => setEnhanced((v) => !v)}
              >
                {enhanced ? 'Enhanced' : 'Original'}
              </button>
              <button
                className={cn('px-2 py-0.5 text-2xs', showOverlay ? 'btn-teal' : 'btn-secondary')}
                onClick={() => setShowOverlay((v) => !v)}
              >
                OCR overlay
              </button>
            </div>
          }
          footer={`Image quality ${doc.imageQuality}% · page OCR confidence ${currentPage?.ocrConfidence ?? doc.ocrConfidence}% · rotation ${rotation}°`}
        >
          <div className="max-h-[640px] overflow-auto scroll-thin bg-[#e9e2d5] p-4">
            <DocumentCanvas
              doc={doc}
              page={currentPage}
              fields={pageFields}
              zoom={zoom}
              rotation={rotation}
              enhanced={enhanced}
              showOverlay={showOverlay}
              activeFieldId={activeFieldId}
              onSelectField={setActiveFieldId}
            />
          </div>
        </Card>

        <div className="space-y-3">
          <Card
            dense
            title="Extracted fields"
            subtitle={`${fields.length} fields · ${fields.filter((f) => f.confidence < 70).length} below threshold`}
          >
            <ul className="max-h-[420px] divide-y divide-line/40 overflow-y-auto scroll-thin">
              {fields.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFieldId(f.id);
                      setPage(f.pageNumber);
                    }}
                    className={cn(
                      'flex w-full items-start justify-between gap-2 px-3 py-2 text-left hover:bg-teal/6',
                      activeFieldId === f.id && 'bg-teal/10',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-2xs font-semibold uppercase tracking-wide text-muted">
                        {FIELD_LABEL[f.field]}
                      </span>
                      <span className="block truncate text-[13px] font-medium">{f.normalizedValue}</span>
                      <span className="block truncate text-2xs text-muted">
                        Original: {f.originalText} · page {f.pageNumber}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <ConfidenceBadge value={f.confidence} />
                      <StatusBadge status={f.status} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {activeField && (
            <FieldInspector
              field={activeField}
              editValue={editValue}
              comment={comment}
              onEditValue={setEditValue}
              onComment={setComment}
              onDecide={(status, value) => {
                decideField({
                  fieldId: activeField.id,
                  documentId: doc.id,
                  value,
                  status,
                  comment: comment || null,
                });
                setComment('');
                reload();
              }}
              onClarify={() => setClarifyOpen(true)}
            />
          )}

          <Card dense title={`Validation conflicts (${validations.length})`}>
            {validations.length === 0 ? (
              <p className="px-3 py-4 text-2xs text-muted">No stored conflicts for this document.</p>
            ) : (
              <ul className="max-h-64 divide-y divide-line/40 overflow-y-auto scroll-thin">
                {validations.map((v) => (
                  <li key={v.id} className="px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-medium">{v.title}</span>
                      <SeverityBadge severity={v.severity} />
                    </div>
                    <p className="mt-0.5 text-2xs text-muted">{v.detail}</p>
                    <p className="mt-1 text-2xs">
                      <b>OCR:</b> {v.ocrValue} · <b>LRMS:</b> {v.lrmsValue} · <b>GIS:</b> {v.gisValue}
                    </p>
                    <p className="mt-0.5 text-2xs text-teal">{v.recommendedResolution}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {validation && (
            <Card dense title="Validation re-run result" subtitle={formatDateTime(validation.ranAt)}>
              <div className="grid grid-cols-4 gap-1 px-3 py-2">
                {(['blocking', 'review', 'informational', 'validated'] as const).map((s) => (
                  <div key={s} className="rounded border border-line/60 bg-paper/50 px-2 py-1 text-center">
                    <p className="metric text-lg font-semibold">{validation.bySeverity[s]}</p>
                    <p className="text-[10px] text-muted">{SEVERITY_LABEL[s]}</p>
                  </div>
                ))}
              </div>
              <ul className="max-h-56 divide-y divide-line/40 overflow-y-auto scroll-thin">
                {validation.issues.map((i) => (
                  <li key={i.id} className="px-3 py-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-2xs font-medium">{i.title}</span>
                      <SeverityBadge severity={i.severity} />
                    </div>
                    <p className="text-[11px] text-muted">{i.detail}</p>
                  </li>
                ))}
                {validation.issues.length === 0 && (
                  <li className="px-3 py-3 text-2xs text-signal-green">
                    All rules passed. The document can proceed to approval.
                  </li>
                )}
              </ul>
              <div className="border-t border-line/60 px-3 py-2">
                <p className="text-2xs font-semibold uppercase text-muted">Rules passed</p>
                <p className="text-2xs text-muted">{validation.passedRules.join(' · ') || 'None'}</p>
              </div>
            </Card>
          )}

          <Card dense title="Document status">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-3 py-2 text-[13px]">
              <Info label="Pipeline stage" value={PROCESSING_STAGE_LABEL[doc.processingStage]} />
              <Info label="Status" value={doc.status.replace(/_/g, ' ')} />
              <Info label="Uploaded by" value={doc.uploadedBy} />
              <Info label="Uploaded at" value={formatDateTime(doc.uploadedAt)} />
              <Info label="Assigned reviewer" value={doc.assignedReviewer ?? 'Unassigned'} />
              <Info label="Linked parcel" value={parcel?.parcelId ?? '—'} />
            </dl>
            <div className="px-3 pb-2">
              <p className="mb-0.5 text-2xs font-semibold uppercase text-muted">OCR confidence</p>
              <ProgressBar value={doc.ocrConfidence} tone={doc.ocrConfidence > 85 ? 'green' : 'amber'} />
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={clarifyOpen}
        onClose={() => setClarifyOpen(false)}
        title="Request clarification"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setClarifyOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                if (activeField) {
                  decideField({
                    fieldId: activeField.id,
                    documentId: doc.id,
                    value: activeField.normalizedValue,
                    status: 'needs_review',
                    comment: comment || 'Clarification requested from the originating office.',
                  });
                }
                setClarifyOpen(false);
                setComment('');
                reload();
              }}
            >
              Send request
            </button>
          </>
        }
      >
        <Labelled label="Clarification note" hint="The request and your identity are written to the audit trail.">
          <textarea className="field h-28" value={comment} onChange={(e) => setComment(e.target.value)} />
        </Labelled>
      </Modal>
    </div>
  );
}

function ThumbnailRail({
  pages,
  active,
  onSelect,
  rotation,
  onRotate,
}: {
  pages: DocumentPage[];
  active: number;
  onSelect: (n: number) => void;
  rotation: number;
  onRotate: () => void;
}) {
  return (
    <Card dense title="Pages" subtitle={`${pages.length} page(s)`}>
      <div className="max-h-[560px] space-y-2 overflow-y-auto scroll-thin p-2">
        {pages.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.pageNumber)}
            className={cn(
              'w-full rounded border p-1.5 text-left transition-colors',
              active === p.pageNumber ? 'border-teal bg-teal/8' : 'border-line/70 bg-paper/40 hover:border-teal/50',
            )}
          >
            <div className="mb-1 aspect-[3/4] w-full overflow-hidden rounded-sm border border-line/60 bg-[#fbf7ee]">
              <svg viewBox="0 0 60 80" className="h-full w-full" style={{ transform: `rotate(${rotation}deg)` }}>
                <rect width="60" height="80" fill="#fbf7ee" />
                {Array.from({ length: 12 }).map((_, i) => (
                  <rect key={i} x="8" y={12 + i * 5} width={i % 3 === 0 ? 30 : 44} height="2" fill="#c9bda9" />
                ))}
                <rect x="8" y="6" width="26" height="3" fill="#9c8f7a" />
              </svg>
            </div>
            <p className="metric text-2xs font-semibold">Page {p.pageNumber}</p>
            <p className="text-[10px] text-muted">
              {p.status} · {p.ocrConfidence}%
            </p>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 border-t border-line/60 p-2">
        <button className="btn-secondary px-2 py-0.5 text-2xs" onClick={onRotate}>
          Rotate
        </button>
        <button className="btn-secondary px-2 py-0.5 text-2xs" disabled title="Page deletion is disabled in the demo">
          Delete
        </button>
        <button className="btn-secondary px-2 py-0.5 text-2xs" disabled title="Page reordering is disabled in the demo">
          Reorder
        </button>
      </div>
    </Card>
  );
}

/**
 * Renders a facsimile of the scanned register page. The synthetic scan is drawn
 * as SVG so that OCR bounding boxes can be positioned in the same coordinate
 * space as the extracted fields (percentage based, 0-100).
 */
function DocumentCanvas({
  doc,
  page,
  fields,
  zoom,
  rotation,
  enhanced,
  showOverlay,
  activeFieldId,
  onSelectField,
}: {
  doc: { documentType: string; code: string; village: string; district: string; state: string; isHandwritten: boolean };
  page: DocumentPage | undefined;
  fields: ExtractedField[];
  zoom: number;
  rotation: number;
  enhanced: boolean;
  showOverlay: boolean;
  activeFieldId: string | null;
  onSelectField: (id: string) => void;
}) {
  const noise = page?.status === 'noisy' || page?.status === 'faded';
  return (
    <div
      className="mx-auto origin-top transition-transform"
      style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, width: 640 }}
    >
      <svg
        viewBox="0 0 100 130"
        className="w-full rounded-sm shadow-raised"
        style={{
          filter: enhanced
            ? 'contrast(1.28) brightness(1.06) saturate(0.85)'
            : noise
              ? 'sepia(0.35) contrast(0.92)'
              : 'none',
        }}
      >
        <rect width="100" height="130" fill={enhanced ? '#ffffff' : '#f7f1e4'} />
        <rect x="3" y="3" width="94" height="124" fill="none" stroke="#b8a98f" strokeWidth="0.4" />

        <text x="50" y="10" textAnchor="middle" fontSize="3.2" fill="#4a3f2f" fontFamily="serif">
          {doc.documentType.toUpperCase()}
        </text>
        <text x="50" y="14.5" textAnchor="middle" fontSize="2.1" fill="#6b6152" fontFamily="serif">
          {doc.village} · {doc.district} · {doc.state}
        </text>
        <line x1="8" y1="17" x2="92" y2="17" stroke="#b8a98f" strokeWidth="0.3" />

        {fields.map((f, i) => (
          <g key={f.id}>
            <text x={f.bbox.x} y={f.bbox.y + 3.2} fontSize="2.2" fill="#6b6152" fontFamily="serif">
              {FIELD_LABEL[f.field]}
            </text>
            <text
              x={f.bbox.x + f.bbox.w * 0.55}
              y={f.bbox.y + 3.2}
              fontSize="2.5"
              fill={doc.isHandwritten ? '#28405c' : '#2b2b2b'}
              fontFamily={doc.isHandwritten ? 'cursive' : 'serif'}
            >
              {f.originalText}
            </text>
            <line
              x1={f.bbox.x}
              y1={f.bbox.y + 4.4}
              x2={f.bbox.x + f.bbox.w + 12}
              y2={f.bbox.y + 4.4}
              stroke="#cdbfa6"
              strokeWidth="0.18"
            />
            {showOverlay && (
              <rect
                x={f.bbox.x - 0.6}
                y={f.bbox.y}
                width={f.bbox.w + 13}
                height={f.bbox.h}
                fill={
                  activeFieldId === f.id
                    ? 'rgba(22,138,138,0.28)'
                    : f.confidence < 70
                      ? 'rgba(217,93,57,0.16)'
                      : 'rgba(57,120,168,0.10)'
                }
                stroke={
                  activeFieldId === f.id ? '#168a8a' : f.confidence < 70 ? '#d95d39' : '#3978a8'
                }
                strokeWidth={activeFieldId === f.id ? 0.45 : 0.22}
                className="cursor-pointer"
                onClick={() => onSelectField(f.id)}
              >
                <title>{`${FIELD_LABEL[f.field]} · confidence ${f.confidence}%`}</title>
              </rect>
            )}
            {showOverlay && (
              <text x={f.bbox.x + f.bbox.w + 13.4} y={f.bbox.y + 3} fontSize="1.5" fill="#66788a">
                {f.confidence.toFixed(0)}%
              </text>
            )}
            {i === 0 && page?.annotations.length ? (
              <text x="72" y="122" fontSize="1.8" fill="#8a7c66" fontFamily="serif">
                {page.annotations.join(' · ')}
              </text>
            ) : null}
          </g>
        ))}

        <text x="8" y="124" fontSize="1.8" fill="#8a7c66" fontFamily="serif">
          {doc.code} · synthetic facsimile generated for demonstration
        </text>
      </svg>
    </div>
  );
}

function FieldInspector({
  field,
  editValue,
  comment,
  onEditValue,
  onComment,
  onDecide,
  onClarify,
}: {
  field: ExtractedField;
  editValue: string;
  comment: string;
  onEditValue: (v: string) => void;
  onComment: (v: string) => void;
  onDecide: (status: ExtractedField['status'], value: string) => void;
  onClarify: () => void;
}) {
  const sources = [
    { label: 'OCR value', value: field.normalizedValue },
    { label: 'LRMS value', value: field.lrmsValue ?? '—' },
    { label: 'Registry value', value: field.registryValue ?? '—' },
    { label: 'Mutation value', value: field.mutationValue ?? '—' },
    { label: 'GIS value', value: field.gisValue ?? '—' },
  ];
  const conflict = sources.filter((s) => s.value !== '—' && s.value !== field.normalizedValue).length > 0;

  return (
    <Card
      dense
      title={FIELD_LABEL[field.field]}
      subtitle={`Page ${field.pageNumber} · confidence ${field.confidence}%`}
      actions={conflict ? <Badge tone="amber">Conflict</Badge> : <Badge tone="green">Consistent</Badge>}
    >
      <div className="space-y-2.5 px-3 py-2">
        <div className="rounded border border-line/60 bg-paper/50 p-2">
          <p className="text-2xs font-semibold uppercase text-muted">Original language evidence</p>
          <p className="text-[15px]">{field.originalText}</p>
          <p className="text-2xs text-muted">Transliterated: {field.transliterated}</p>
          <p className="text-2xs text-muted">Translated: {field.translated}</p>
        </div>

        <table className="w-full border-collapse text-[13px]">
          <tbody>
            {sources.map((s) => (
              <tr key={s.label} className="border-b border-line/40">
                <td className="py-1 pr-2 text-2xs uppercase text-muted">{s.label}</td>
                <td
                  className={cn(
                    'py-1 text-right font-medium',
                    s.value !== '—' && s.value !== field.normalizedValue && 'text-signal-red',
                  )}
                >
                  {s.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Labelled label="Reviewer value">
          <TextInput value={editValue} onChange={(e) => onEditValue(e.target.value)} />
        </Labelled>
        {field.suggestedValue && field.suggestedValue !== editValue && (
          <button
            type="button"
            className="chip border-teal/40 bg-teal/10 text-teal"
            onClick={() => onEditValue(field.suggestedValue)}
          >
            Use suggested value: {field.suggestedValue}
          </button>
        )}

        <Labelled label="Reviewer comment">
          <TextInput value={comment} onChange={(e) => onComment(e.target.value)} placeholder="Optional note for the audit trail" />
        </Labelled>

        <Can
          permission="validation.decide"
          fallback={<p className="text-2xs text-muted">Your role can view but not decide field values.</p>}
        >
          <div className="flex flex-wrap gap-1.5">
            <button className="btn-teal py-1 text-2xs" onClick={() => onDecide('auto_accepted', editValue)}>
              Approve
            </button>
            <button className="btn-primary py-1 text-2xs" onClick={() => onDecide('corrected', editValue)}>
              Save correction
            </button>
            <button className="btn-danger py-1 text-2xs" onClick={() => onDecide('rejected', editValue)}>
              Reject
            </button>
            <button className="btn-secondary py-1 text-2xs" onClick={onClarify}>
              Request clarification
            </button>
          </div>
        </Can>

        {field.correctionHistory.length > 0 && (
          <div className="rounded border border-line/60 bg-paper/40 p-2">
            <p className="text-2xs font-semibold uppercase text-muted">Correction history</p>
            <ul className="mt-1 space-y-0.5">
              {field.correctionHistory.map((h, i) => (
                <li key={i} className="text-2xs text-muted">
                  {formatDateTime(h.at)} · {h.by}: &ldquo;{h.from}&rdquo; → &ldquo;{h.to}&rdquo;
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="metric text-[13px] capitalize">{value}</dd>
    </div>
  );
}
