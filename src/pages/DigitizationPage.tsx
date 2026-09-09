import { useMemo, useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ConfidenceBadge, StatusBadge } from '@/components/ui/Badge';
import { Select, TextInput, ProgressBar } from '@/components/ui/Form';
import { StatTile } from '@/components/kpi/KpiCard';
import { ChartCard } from '@/components/charts/ChartCard';
import { funnelOption, horizontalBarOption, multiLineOption } from '@/components/charts/presets';
import { Can } from '@/auth/PermissionGuard';
import { getDataset } from '@/data/dataset';
import { useAppStore } from '@/store/appStore';
import { useScope } from '@/hooks/useScope';
import { documentPipelineSeries, filterByGeo, processingFunnel } from '@/services/analytics';
import { DOCUMENT_TYPES, LANGUAGES, PROCESSING_STAGE_LABEL, THEME } from '@/config/constants';
import { formatCompact, formatDate, iso } from '@/lib/format';
import { round } from '@/lib/stats';
import type { DocumentRecord, DocumentType, LanguageCode } from '@/types';

interface UploadItem {
  id: string;
  name: string;
  sizeKb: number;
  progress: number;
  stage: string;
  status: 'processing' | 'done' | 'failed';
  code: string;
}

const PIPELINE_STEPS = [
  'Document classification',
  'Page segmentation',
  'Image enhancement',
  'Script detection',
  'Printed-text OCR',
  'Handwriting recognition',
  'Layout analysis',
  'Table detection',
  'Key-value extraction',
  'Named-entity recognition',
  'Transliteration',
  'Standardisation',
  'Confidence scoring',
  'Business-rule validation',
  'Human review routing',
];

export default function DigitizationPage() {
  const navigate = useNavigate();
  const scope = useScope();
  const dataset = getDataset();
  const addUploaded = useAppStore((s) => s.addUploadedDocument);
  const uploaded = useAppStore((s) => s.workspace.uploadedDocuments);

  const [search, setSearch] = useState('');
  const [type, setType] = useState<DocumentType | 'ALL'>('ALL');
  const [language, setLanguage] = useState<LanguageCode | 'ALL'>('ALL');
  const [status, setStatus] = useState<'ALL' | DocumentRecord['status']>('ALL');
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const documents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...uploaded, ...filterByGeo(dataset.documents, scope)].filter(
      (d) =>
        (type === 'ALL' || d.documentType === type) &&
        (language === 'ALL' || d.language === language) &&
        (status === 'ALL' || d.status === status) &&
        (!q || `${d.code} ${d.fileName} ${d.village} ${d.district} ${d.parcelId ?? ''}`.toLowerCase().includes(q)),
    );
  }, [dataset.documents, uploaded, scope, search, type, language, status]);

  const funnel = useMemo(() => processingFunnel(scope), [scope]);
  const pipeline = useMemo(() => documentPipelineSeries(scope), [scope]);

  const languageMix = useMemo(() => {
    const rows = LANGUAGES.map((l) => ({
      label: `${l.label} (${l.script})`,
      count: documents.filter((d) => d.language === l.code).length,
    })).sort((a, b) => a.count - b.count);
    return rows;
  }, [documents]);

  const accuracy = useMemo(
    () => round(documents.reduce((s, d) => s + d.ocrConfidence, 0) / (documents.length || 1), 1),
    [documents],
  );

  const startUpload = (files: FileList | File[]) => {
    const list = Array.from(files);
    list.forEach((file, index) => {
      const code = `DOC-U${String(Date.now() + index).slice(-6)}`;
      const item: UploadItem = {
        id: code,
        name: file.name,
        sizeKb: Math.round(file.size / 1024),
        progress: 0,
        stage: PIPELINE_STEPS[0],
        status: 'processing',
        code,
      };
      setUploads((cur) => [item, ...cur]);

      let step = 0;
      const timer = window.setInterval(() => {
        step += 1;
        const progress = Math.min(100, Math.round((step / PIPELINE_STEPS.length) * 100));
        setUploads((cur) =>
          cur.map((u) =>
            u.id === code
              ? { ...u, progress, stage: PIPELINE_STEPS[Math.min(step, PIPELINE_STEPS.length - 1)] }
              : u,
          ),
        );
        if (step >= PIPELINE_STEPS.length) {
          window.clearInterval(timer);
          const parcel = dataset.parcels[Math.floor(Math.random() * dataset.parcels.length)];
          const doc: DocumentRecord = {
            id: code,
            code,
            fileName: file.name,
            documentType: 'Mutation Register',
            language: 'hi',
            script: 'Devanagari',
            isHandwritten: true,
            pages: 3,
            state: parcel.state,
            district: parcel.district,
            village: parcel.village,
            projectId: parcel.projectId,
            parcelId: parcel.parcelId,
            uploadedBy: 'Current session',
            uploadedAt: iso(new Date()),
            processingStage: 'validated',
            status: 'needs_review',
            ocrConfidence: 78.4,
            imageQuality: 82,
            validationIssues: 2,
            assignedReviewer: null,
            sizeKb: Math.round(file.size / 1024),
            createdAt: iso(new Date()),
            updatedAt: iso(new Date()),
            createdBy: 'session.upload',
            version: 1,
          };
          addUploaded(doc);
          setUploads((cur) =>
            cur.map((u) => (u.id === code ? { ...u, progress: 100, status: 'done', stage: 'Ready for review' } : u)),
          );
        }
      }, 220);
    });
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) startUpload(e.dataTransfer.files);
  };

  const columns: Column<DocumentRecord>[] = [
    { key: 'code', header: 'Document', accessor: (d) => d.code, render: (d) => <span className="metric font-semibold">{d.code}</span>, width: '110px' },
    {
      key: 'file',
      header: 'File',
      accessor: (d) => d.fileName,
      render: (d) => (
        <span className="block">
          <span className="block truncate text-[13px]">{d.fileName}</span>
          <span className="block text-2xs text-muted">{d.documentType}</span>
        </span>
      ),
      width: '240px',
    },
    { key: 'lang', header: 'Language', accessor: (d) => d.language, render: (d) => `${d.language.toUpperCase()} · ${d.script}` },
    { key: 'hand', header: 'Source', accessor: (d) => (d.isHandwritten ? 'Handwritten' : 'Printed') },
    { key: 'pages', header: 'Pages', accessor: (d) => d.pages, align: 'right' },
    { key: 'district', header: 'District', accessor: (d) => d.district },
    { key: 'stage', header: 'Pipeline stage', accessor: (d) => d.processingStage, render: (d) => <StatusBadge status={PROCESSING_STAGE_LABEL[d.processingStage]} /> },
    { key: 'conf', header: 'OCR confidence', accessor: (d) => d.ocrConfidence, align: 'center', render: (d) => <ConfidenceBadge value={d.ocrConfidence} /> },
    { key: 'quality', header: 'Image quality', accessor: (d) => d.imageQuality, width: '110px', render: (d) => <ProgressBar value={d.imageQuality} tone={d.imageQuality > 70 ? 'teal' : 'amber'} /> },
    { key: 'issues', header: 'Issues', accessor: (d) => d.validationIssues, align: 'right' },
    { key: 'status', header: 'Status', accessor: (d) => d.status, render: (d) => <StatusBadge status={d.status} /> },
    { key: 'uploaded', header: 'Uploaded', accessor: (d) => d.uploadedAt, render: (d) => formatDate(d.uploadedAt) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Document Digitization Studio"
        description="Multilingual intake, enhancement, OCR, layout analysis and key-value extraction for fragmented land records. Open any document to review the scan alongside the extracted fields."
        trail={[{ label: 'Digitization Studio' }]}
        actions={
          <Can permission="document.upload">
            <>
              <button className="btn-secondary" onClick={() => fileInput.current?.click()}>
                Upload documents
              </button>
              <button className="btn-primary" onClick={() => navigate('/digitization/DOC-000001')}>
                Open flagship document
              </button>
            </>
          </Can>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Documents in scope" value={formatCompact(documents.length)} />
        <StatTile label="Needs review" value={formatCompact(documents.filter((d) => d.status === 'needs_review').length)} tone="amber" />
        <StatTile label="Approved" value={formatCompact(documents.filter((d) => d.status === 'approved').length)} tone="green" />
        <StatTile label="Handwritten" value={formatCompact(documents.filter((d) => d.isHandwritten).length)} />
        <StatTile label="Mean OCR confidence" value={`${accuracy}%`} tone={accuracy > 85 ? 'green' : 'amber'} />
        <StatTile label="Languages present" value={String(new Set(documents.map((d) => d.language)).size)} />
      </div>

      <Can permission="document.upload">
        <Card title="Intake" subtitle="PDF and image upload, drag and drop, batch processing, mobile camera capture">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors ${
              dragging ? 'border-teal bg-teal/8' : 'border-line bg-paper/40'
            }`}
          >
            <p className="text-[14px] font-semibold">Drop scanned records here</p>
            <p className="mt-0.5 text-2xs text-muted">
              PDF, JPG, PNG or TIFF · multiple files supported · processing runs asynchronously
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button className="btn-primary" onClick={() => fileInput.current?.click()}>
                Choose files
              </button>
              <label className="btn-secondary cursor-pointer">
                Camera capture
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => e.target.files && startUpload(e.target.files)}
                />
              </label>
            </div>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept=".pdf,image/*"
              className="hidden"
              onChange={(e) => e.target.files && startUpload(e.target.files)}
            />
          </div>

          {uploads.length > 0 && (
            <ul className="mt-3 space-y-2">
              {uploads.map((u) => (
                <li key={u.id} className="rounded-md border border-line/70 bg-surface p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{u.name}</span>
                      <span className="metric block text-2xs text-muted">
                        {u.code} · {u.sizeKb.toLocaleString('en-IN')} KB · {u.stage}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <StatusBadge status={u.status} />
                      {u.status === 'done' && (
                        <button className="btn-secondary py-0.5 text-2xs" onClick={() => navigate(`/digitization/${u.code}`)}>
                          Open
                        </button>
                      )}
                      {u.status === 'failed' && (
                        <button className="btn-secondary py-0.5 text-2xs" onClick={() => startUpload([new File([], u.name)])}>
                          Retry
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <ProgressBar value={u.progress} tone={u.status === 'failed' ? 'red' : 'teal'} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 rounded-md border border-line/60 bg-paper/40 p-2.5">
            <p className="text-2xs font-bold uppercase tracking-wide text-muted">Processing pipeline</p>
            <ol className="mt-1 flex flex-wrap gap-1">
              {PIPELINE_STEPS.map((s, i) => (
                <li key={s} className="chip border-line bg-surface text-muted">
                  {i + 1}. {s}
                </li>
              ))}
            </ol>
          </div>
        </Card>
      </Can>

      <div className="grid gap-3 xl:grid-cols-3">
        <ChartCard
          title="Pipeline funnel"
          subtitle="Documents reaching each stage"
          height={260}
          isEmpty={funnel.every((f) => f.value === 0)}
          option={funnelOption(funnel.map((f) => ({ name: PROCESSING_STAGE_LABEL[f.stage], value: f.value })))}
          exportName="digitization-funnel"
          exportRows={funnel.map((f) => ({ stage: PROCESSING_STAGE_LABEL[f.stage], documents: f.value }))}
        />
        <ChartCard
          title="Language and script mix"
          subtitle="Documents by detected language"
          height={260}
          isEmpty={languageMix.every((l) => l.count === 0)}
          option={horizontalBarOption(
            languageMix.map((l) => l.label),
            languageMix.map((l) => l.count),
            { valueName: 'documents', color: THEME.olive },
          )}
          exportName="language-mix"
          exportRows={languageMix}
        />
        <ChartCard
          title="Throughput trend"
          subtitle="Uploaded versus processed"
          height={260}
          isEmpty={!pipeline.periods.length}
          option={multiLineOption(
            pipeline.periods,
            [
              { name: 'Uploaded', data: pipeline.uploaded, color: THEME.blue },
              { name: 'Processed', data: pipeline.processed, color: THEME.teal },
            ],
            { asMonths: true },
          )}
          exportName="digitization-throughput"
          exportRows={pipeline.periods.map((p, i) => ({
            period: p,
            uploaded: pipeline.uploaded[i],
            processed: pipeline.processed[i],
          }))}
        />
      </div>

      <Card
        dense
        title={`Document register (${documents.length.toLocaleString('en-IN')})`}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <TextInput
              className="w-52 py-1 text-2xs"
              placeholder="Search code, file, village, parcel…"
              value={search}
              aria-label="Search documents"
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              className="w-40 py-1 text-2xs"
              aria-label="Filter document type"
              value={type}
              onChange={(e) => setType(e.target.value as DocumentType | 'ALL')}
              options={[{ value: 'ALL', label: 'All types' }, ...DOCUMENT_TYPES.map((t) => ({ value: t, label: t }))]}
            />
            <Select
              className="w-32 py-1 text-2xs"
              aria-label="Filter language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode | 'ALL')}
              options={[{ value: 'ALL', label: 'All languages' }, ...LANGUAGES.map((l) => ({ value: l.code, label: l.label }))]}
            />
            <Select
              className="w-32 py-1 text-2xs"
              aria-label="Filter status"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              options={[
                { value: 'ALL', label: 'All statuses' },
                { value: 'processing', label: 'Processing' },
                { value: 'needs_review', label: 'Needs review' },
                { value: 'validated', label: 'Validated' },
                { value: 'approved', label: 'Approved' },
                { value: 'failed', label: 'Failed' },
              ]}
            />
          </div>
        }
      >
        <DataTable
          rows={documents}
          columns={columns}
          rowKey={(d) => d.id}
          pageSize={14}
          onRowClick={(d) => navigate(`/digitization/${d.code}`)}
        />
      </Card>
    </div>
  );
}
