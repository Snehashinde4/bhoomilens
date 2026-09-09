import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Labelled, Select, TextInput } from '@/components/ui/Form';
import { StatTile } from '@/components/kpi/KpiCard';
import { DemoBadge } from '@/components/ui/Disclaimers';
import { appConfig, SCALE_PROFILES, type DataScale } from '@/config/appConfig';
import { getDataset } from '@/data/dataset';
import { useAppStore } from '@/store/appStore';
import {
  applyMapping,
  commitImport,
  IMPORT_TARGETS,
  normaliseRows,
  validateRows,
  type ImportResult,
  type ImportTarget,
} from '@/data/importer';
import { exportJson, parseCsv, parseJsonFile } from '@/lib/export';
import { formatCompact, formatDateTime } from '@/lib/format';

export default function SettingsPage() {
  const dataset = getDataset();
  const scale = useAppStore((s) => s.scale);
  const setScale = useAppStore((s) => s.setScale);
  const regenerate = useAppStore((s) => s.regenerate);
  const recordAudit = useAppStore((s) => s.recordAudit);
  const role = useAppStore((s) => s.role);
  const user = useAppStore((s) => s.user);

  const [targetKey, setTargetKey] = useState<string>(IMPORT_TARGETS[0].key as string);
  const [rawRows, setRawRows] = useState<Array<Record<string, unknown>>>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [seed, setSeed] = useState(String(appConfig.seed));
  const [busy, setBusy] = useState(false);

  const target = useMemo(
    () => IMPORT_TARGETS.find((t) => (t.key as string) === targetKey) ?? IMPORT_TARGETS[0],
    [targetKey],
  );

  const sourceColumns = useMemo(() => Object.keys(rawRows[0] ?? {}), [rawRows]);

  const counts = [
    { label: 'Projects', value: dataset.projects.length },
    { label: 'Parcels', value: dataset.parcels.length },
    { label: 'Documents', value: dataset.documents.length },
    { label: 'Extracted fields', value: dataset.extractedFields.length },
    { label: 'Validations', value: dataset.validations.length },
    { label: 'Beneficiaries', value: dataset.beneficiaries.length },
    { label: 'Review tasks', value: dataset.reviewQueue.length },
    { label: 'Anomaly alerts', value: dataset.fraudAlerts.length },
    { label: 'Watersheds', value: dataset.watersheds.length },
    { label: 'Districts', value: dataset.districts.length },
    { label: 'Legal cases', value: dataset.legalCases.length },
    { label: 'Audit events', value: dataset.auditLogs.length },
  ];

  const loadFile = async (file: File) => {
    setBusy(true);
    try {
      const rows = file.name.toLowerCase().endsWith('.csv')
        ? await parseCsv<Record<string, unknown>>(file)
        : normaliseRows(await parseJsonFile(file));
      setRawRows(rows);
      setMapping({});
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const validate = () => {
    const mapped = applyMapping(rawRows, mapping);
    setResult(validateRows(target, mapped));
  };

  const commit = () => {
    if (!result || result.accepted === 0) return;
    const mapped = applyMapping(rawRows, mapping);
    commitImport(target, mapped);
    setResult({ ...result, applied: true });
    recordAudit({
      actor: user?.name ?? 'Demo user',
      role,
      action: 'data.imported',
      entityType: 'Dataset',
      entityId: target.key as string,
      oldValue: null,
      newValue: `${result.accepted} rows`,
      reason: `Mock-data import into ${target.label}`,
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings and Demo Data"
        description="Control the synthetic data engine, import your own mock data and inspect the current dataset. The UI reads exclusively from the centralised data layer, so imported data flows into every chart, table and map without code changes."
        trail={[{ label: 'Settings' }]}
        actions={<DemoBadge />}
      />

      <div className="grid gap-3 xl:grid-cols-[1fr_1.3fr]">
        <Card title="Synthetic data engine" subtitle={`Generated ${formatDateTime(dataset.generatedAt)} · seed ${dataset.seed}`}>
          <div className="space-y-3">
            <Labelled label="Dataset scale" hint="Larger scales generate more records and use more memory.">
              <Select
                value={scale}
                aria-label="Dataset scale"
                onChange={(e) => setScale(e.target.value as DataScale)}
                options={Object.values(SCALE_PROFILES).map((p) => ({
                  value: p.key,
                  label: `${p.label} — ${p.projects.toLocaleString('en-IN')} projects, ${p.parcels.toLocaleString('en-IN')} parcels`,
                }))}
              />
            </Labelled>
            <p className="text-2xs text-muted">{SCALE_PROFILES[scale].description}</p>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Labelled label="Generation seed" hint="The same seed always reproduces the same dataset.">
                <TextInput value={seed} onChange={(e) => setSeed(e.target.value)} inputMode="numeric" />
              </Labelled>
              <div className="flex items-end gap-1.5">
                <button
                  className="btn-teal"
                  onClick={() => {
                    regenerate(Number(seed) || appConfig.seed);
                    recordAudit({
                      actor: user?.name ?? 'Demo user',
                      role,
                      action: 'data.regenerated',
                      entityType: 'Dataset',
                      entityId: 'synthetic',
                      oldValue: String(dataset.seed),
                      newValue: seed,
                      reason: 'Dataset regenerated from the settings module',
                    });
                  }}
                >
                  Regenerate
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setSeed(String(appConfig.seed));
                    regenerate(appConfig.seed);
                  }}
                >
                  Reset demo data
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {counts.map((c) => (
                <StatTile key={c.label} label={c.label} value={formatCompact(c.value)} />
              ))}
            </div>

            <div className="rounded border border-line/60 bg-paper/40 p-2">
              <p className="text-2xs font-bold uppercase text-muted">Data source</p>
              <p className="text-[13px]">
                {appConfig.dataSource === 'api'
                  ? `REST backend at ${appConfig.apiBaseUrl} with automatic fallback to the in-browser engine.`
                  : 'In-browser synthetic engine (no backend required).'}
              </p>
            </div>

            <button
              className="btn-secondary w-full"
              onClick={() =>
                exportJson(
                  {
                    generatedAt: dataset.generatedAt,
                    seed: dataset.seed,
                    scale: dataset.scale,
                    projects: dataset.projects.slice(0, 200),
                    districtMetrics: dataset.districtMetrics,
                    monthlyMetrics: dataset.monthlyMetrics,
                  },
                  'bhoomilens-dataset-sample',
                )
              }
            >
              Download dataset sample (JSON)
            </button>
          </div>
        </Card>

        <Card
          title="Mock-data import"
          subtitle="JSON, CSV, Excel-exported CSV and GeoJSON are accepted. Imported rows replace the selected collection."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <Labelled label="Target collection">
              <Select
                value={targetKey}
                aria-label="Import target"
                onChange={(e) => {
                  setTargetKey(e.target.value);
                  setResult(null);
                }}
                options={IMPORT_TARGETS.map((t) => ({ value: t.key as string, label: `${t.label} (${t.file})` }))}
              />
            </Labelled>
            <Labelled label="Source file">
              <input
                type="file"
                accept=".json,.geojson,.csv"
                className="field py-1"
                onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
              />
            </Labelled>
          </div>

          <p className="mt-1 text-2xs text-muted">{target.description}</p>
          <p className="mt-1 text-2xs text-muted">
            Required columns: {target.requiredColumns.map((c) => <code key={c} className="mr-1">{c}</code>)}
          </p>

          {busy && <p className="mt-2 text-[13px] text-muted">Reading file…</p>}

          {rawRows.length > 0 && (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone="teal">{rawRows.length.toLocaleString('en-IN')} rows read</Badge>
                <Badge tone="neutral">{sourceColumns.length} columns detected</Badge>
                <button className="btn-secondary py-1 text-2xs" onClick={validate}>
                  Validate
                </button>
                <button
                  className="btn-primary py-1 text-2xs"
                  disabled={!result || result.accepted === 0 || result.applied}
                  onClick={commit}
                >
                  Apply to application
                </button>
              </div>

              <div className="mt-3">
                <p className="mb-1 text-2xs font-bold uppercase tracking-wide text-muted">
                  Column mapping (optional)
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {sourceColumns.slice(0, 14).map((col) => (
                    <label key={col} className="flex items-center gap-1.5 text-2xs">
                      <span className="w-32 truncate font-medium">{col}</span>
                      <span aria-hidden>→</span>
                      <select
                        className="field flex-1 py-0.5 text-2xs"
                        aria-label={`Map column ${col}`}
                        value={mapping[col] ?? ''}
                        onChange={(e) => setMapping((m) => ({ ...m, [col]: e.target.value }))}
                      >
                        <option value="">(keep as {col})</option>
                        {target.requiredColumns.map((rc) => (
                          <option key={rc} value={rc}>
                            {rc}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-3">
                <p className="mb-1 text-2xs font-bold uppercase tracking-wide text-muted">Preview</p>
                <div className="max-h-52 overflow-auto scroll-thin rounded border border-line/60">
                  <DataTable
                    rows={applyMapping(rawRows, mapping).slice(0, 20)}
                    columns={sourceColumns.slice(0, 8).map((c) => ({
                      key: c,
                      header: c,
                      accessor: (r: Record<string, unknown>) => String(r[c] ?? ''),
                    }))}
                    rowKey={(r) => JSON.stringify(r)}
                    pageSize={20}
                    stickyHeader={false}
                  />
                </div>
              </div>
            </>
          )}

          {result && (
            <div
              className={`mt-3 rounded-md border p-2.5 ${
                result.rejected === 0 ? 'border-signal-green/40 bg-signal-green/8' : 'border-signal-amber/50 bg-signal-amber/8'
              }`}
            >
              <p className="text-[13px] font-semibold">
                {result.accepted.toLocaleString('en-IN')} row(s) valid · {result.rejected.toLocaleString('en-IN')} rejected
                {result.applied && ' · applied to the application'}
              </p>
              {result.issues.length > 0 && (
                <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto scroll-thin">
                  {result.issues.map((i, idx) => (
                    <li key={idx} className="text-2xs text-muted">
                      Row {i.row} · <code>{i.path}</code>: {i.message}
                    </li>
                  ))}
                </ul>
              )}
              {result.applied && (
                <p className="mt-1 text-2xs text-muted">
                  Navigate to any module to see the imported data flowing through the KPIs, charts,
                  tables and maps.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      <Card title="Mock-data file contracts" subtitle="Drop these files into a data pack to replace the seed data">
        <DataTable
          rows={IMPORT_TARGETS}
          columns={[
            { key: 'file', header: 'File', accessor: (t: ImportTarget) => t.file, render: (t: ImportTarget) => <span className="metric">{t.file}</span> },
            { key: 'label', header: 'Collection', accessor: (t: ImportTarget) => t.label },
            { key: 'desc', header: 'Purpose', accessor: (t: ImportTarget) => t.description },
            {
              key: 'cols',
              header: 'Required columns',
              sortable: false,
              render: (t: ImportTarget) => (
                <span className="flex flex-wrap gap-0.5">
                  {t.requiredColumns.map((c) => (
                    <Badge key={c} tone="neutral">
                      {c}
                    </Badge>
                  ))}
                </span>
              ),
            },
          ]}
          rowKey={(t) => t.key as string}
          pageSize={14}
        />
      </Card>
    </div>
  );
}
