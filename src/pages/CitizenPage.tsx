import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Labelled, ProgressBar, Select, TextInput } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs } from '@/components/ui/Tabs';
import { DemoBadge } from '@/components/ui/Disclaimers';
import { getDataset } from '@/data/dataset';
import { useAppStore } from '@/store/appStore';
import { LANGUAGES } from '@/config/constants';
import { formatArea, formatCurrency, formatDate, maskIdentifier } from '@/lib/format';
import { downloadBlob } from '@/lib/export';
import type { LanguageCode, Parcel } from '@/types';

type SearchKind = 'parcel' | 'survey' | 'khasra' | 'khata' | 'registration' | 'application';

interface Grievance {
  id: string;
  subject: string;
  category: string;
  status: 'submitted' | 'under_review' | 'resolved';
  submittedOn: string;
  parcelId: string;
}

export default function CitizenPage() {
  const dataset = getDataset();
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const recordAudit = useAppStore((s) => s.recordAudit);
  const role = useAppStore((s) => s.role);

  const [kind, setKind] = useState<SearchKind>('parcel');
  const [query, setQuery] = useState('BL-184');
  const [result, setResult] = useState<Parcel | null>(null);
  const [searched, setSearched] = useState(false);
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Record correction');
  const [voiceNote, setVoiceNote] = useState('');

  const compensation = useMemo(
    () => (result ? dataset.compensation.find((c) => c.parcelId === result.parcelId) : undefined),
    [result, dataset.compensation],
  );
  const mutation = useMemo(
    () => (result ? dataset.mutations.filter((m) => m.parcelId === result.parcelId).slice(-1)[0] : undefined),
    [result, dataset.mutations],
  );
  const project = useMemo(
    () => (result?.projectId ? dataset.projects.find((p) => p.id === result.projectId) : undefined),
    [result, dataset.projects],
  );

  const runSearch = () => {
    const q = query.trim().toLowerCase();
    setSearched(true);
    if (!q) {
      setResult(null);
      return;
    }
    const found = dataset.parcels.find((p) => {
      switch (kind) {
        case 'parcel':
          return p.parcelId.toLowerCase() === q;
        case 'survey':
          return p.surveyNumber.toLowerCase() === q;
        case 'khasra':
          return p.khasraNumber.toLowerCase() === q;
        case 'khata':
          return p.khataNumber.toLowerCase() === q;
        case 'registration':
          return dataset.registrations.some(
            (r) => r.registrationNumber.toLowerCase() === q && r.parcelId === p.parcelId,
          );
        default:
          return p.parcelId.toLowerCase().endsWith(q);
      }
    });
    setResult(found ?? null);
  };

  const submitGrievance = () => {
    if (!subject.trim() || !result) return;
    const g: Grievance = {
      id: `GRV-${String(grievances.length + 1).padStart(5, '0')}`,
      subject: subject.trim(),
      category,
      status: 'submitted',
      submittedOn: new Date().toISOString(),
      parcelId: result.parcelId,
    };
    setGrievances((cur) => [g, ...cur]);
    setSubject('');
    recordAudit({
      actor: 'Citizen (self-service)',
      role,
      action: 'grievance.submitted',
      entityType: 'Grievance',
      entityId: g.id,
      oldValue: null,
      newValue: g.subject,
      reason: `Citizen grievance for parcel ${g.parcelId}`,
    });
  };

  const downloadAcknowledgement = (g: Grievance) => {
    const text = [
      'BhoomiLens — Grievance acknowledgement',
      '=======================================',
      `Acknowledgement number : ${g.id}`,
      `Parcel                 : ${g.parcelId}`,
      `Category               : ${g.category}`,
      `Subject                : ${g.subject}`,
      `Submitted on           : ${formatDate(g.submittedOn)}`,
      `Current status         : ${g.status}`,
      '',
      'This acknowledgement is generated in a demonstration environment using synthetic data.',
      'It is not a certified government record.',
    ].join('\n');
    downloadBlob(new Blob([text], { type: 'text/plain' }), `${g.id}-acknowledgement.txt`);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Citizen Services"
        description="Search publicly available land information, track applications and compensation, submit correction requests and grievances. Owner identity and legal details are masked."
        trail={[{ label: 'Citizen Services' }]}
        actions={
          <Select
            className="w-40 py-1.5"
            aria-label="Preferred language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageCode)}
            options={LANGUAGES.map((l) => ({ value: l.code, label: `${l.native} · ${l.label}` }))}
          />
        }
      />

      <Card title="Search land information" subtitle="Use any identifier printed on your record">
        <div className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
          <Labelled label="Search by">
            <Select
              value={kind}
              aria-label="Search identifier type"
              onChange={(e) => setKind(e.target.value as SearchKind)}
              options={[
                { value: 'parcel', label: 'Parcel ID' },
                { value: 'survey', label: 'Survey number' },
                { value: 'khasra', label: 'Khasra number' },
                { value: 'khata', label: 'Khata number' },
                { value: 'registration', label: 'Registration number' },
                { value: 'application', label: 'Application number' },
              ]}
            />
          </Labelled>
          <Labelled label="Identifier">
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="BL-184"
            />
          </Labelled>
          <div className="flex items-end gap-1.5">
            <button className="btn-teal" onClick={runSearch}>
              Search
            </button>
            <button
              className="btn-secondary"
              title="Voice search records the spoken identifier; the demo accepts typed input instead."
              onClick={() => setVoiceNote('Voice input is captured on supported devices. Please type the identifier in this demonstration.')}
            >
              🎤 Voice
            </button>
          </div>
        </div>
        {voiceNote && <p className="mt-2 text-2xs text-muted">{voiceNote}</p>}
        <div className="mt-2">
          <DemoBadge />
        </div>
      </Card>

      {searched && !result && (
        <div className="surface-card">
          <EmptyState
            title="No public record found"
            description="Check the identifier and try again, or contact the tehsil office. Some records may not be published for public access."
          />
        </div>
      )}

      {result && (
        <>
          <Card title={`Public record · ${result.parcelId}`} subtitle="Sensitive owner and legal details are masked by policy">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] md:grid-cols-4">
              <Field label="Parcel ID" value={result.parcelId} />
              <Field label="Survey number" value={result.surveyNumber} />
              <Field label="Khasra number" value={result.khasraNumber} />
              <Field label="Khata number" value={result.khataNumber} />
              <Field label="Village" value={result.village} />
              <Field label="Tehsil" value={result.tehsil} />
              <Field label="District" value={result.district} />
              <Field label="State" value={result.state} />
              <Field label="Recorded area" value={formatArea(result.area)} />
              <Field label="Classification" value={result.landType} />
              <Field label="Owner (masked)" value={maskName(result.owner)} />
              <Field label="Ownership type" value={result.ownershipType} />
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="neutral">Acquisition status: {result.acquisitionStatus}</Badge>
              <Badge tone="neutral">Possession: {result.possessionStatus}</Badge>
              <Badge tone={result.legalStatus === 'Clear' ? 'green' : 'amber'}>
                Legal status: {result.legalStatus === 'Clear' ? 'No dispute recorded' : 'Matter recorded'}
              </Badge>
            </div>
          </Card>

          <Tabs
            items={[
              {
                id: 'status',
                label: 'Application status',
                content: (
                  <Card title="Application and mutation status">
                    <ol className="relative space-y-3 border-l border-line pl-5">
                      <Step done title="Application received" detail={`Record request registered for ${result.parcelId}`} />
                      <Step done title="Record retrieved" detail={`Record of rights located in ${result.tehsil} office`} />
                      <Step
                        done={!!mutation}
                        title="Mutation status"
                        detail={
                          mutation
                            ? `Mutation ${mutation.mutationNumber} dated ${formatDate(mutation.mutationDate)} is ${mutation.status}.`
                            : 'No mutation entry is recorded against this parcel.'
                        }
                      />
                      <Step
                        done={result.acquisitionStatus !== 'Not Notified'}
                        title="Acquisition status"
                        detail={
                          project
                            ? `Parcel is included in ${project.name} (${project.code}); current stage ${project.currentStage.replace(/_/g, ' ')}.`
                            : 'Parcel is not part of any notified acquisition.'
                        }
                      />
                      <Step
                        done={!!compensation && compensation.amountPaid > 0}
                        title="Compensation status"
                        detail={
                          compensation
                            ? `${compensation.status}: ${formatCurrency(compensation.amountPaid)} disbursed of ${formatCurrency(compensation.amountAssessed)} assessed.`
                            : 'No compensation record exists for this parcel.'
                        }
                      />
                    </ol>
                    {compensation && (
                      <div className="mt-3">
                        <p className="mb-0.5 text-2xs font-semibold uppercase text-muted">Disbursement progress</p>
                        <ProgressBar
                          value={compensation.amountAssessed ? (compensation.amountPaid / compensation.amountAssessed) * 100 : 0}
                          tone="green"
                        />
                      </div>
                    )}
                  </Card>
                ),
              },
              {
                id: 'correction',
                label: 'Correction request',
                content: (
                  <Card title="Submit a correction request or grievance">
                    <div className="grid gap-2 md:grid-cols-2">
                      <Labelled label="Category">
                        <Select
                          value={category}
                          aria-label="Grievance category"
                          onChange={(e) => setCategory(e.target.value)}
                          options={[
                            { value: 'Record correction', label: 'Record correction' },
                            { value: 'Owner name spelling', label: 'Owner name spelling' },
                            { value: 'Area discrepancy', label: 'Area discrepancy' },
                            { value: 'Compensation delay', label: 'Compensation delay' },
                            { value: 'Possession objection', label: 'Possession objection' },
                            { value: 'R&R entitlement', label: 'R&R entitlement' },
                          ]}
                        />
                      </Labelled>
                      <Labelled label="Subject">
                        <TextInput value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Describe the issue" />
                      </Labelled>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <label className="btn-secondary cursor-pointer">
                        Upload supporting document
                        <input type="file" className="hidden" onChange={() => setVoiceNote('Document attached to the request in this session.')} />
                      </label>
                      <button className="btn-primary" disabled={!subject.trim()} onClick={submitGrievance}>
                        Submit request
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() =>
                          downloadBlob(
                            new Blob(
                              [
                                `Certified record request for ${result.parcelId}\nSubmitted ${formatDate(new Date().toISOString())}\nDemonstration environment using synthetic data.`,
                              ],
                              { type: 'text/plain' },
                            ),
                            `certified-record-request-${result.parcelId}.txt`,
                          )
                        }
                      >
                        Request certified record
                      </button>
                    </div>
                  </Card>
                ),
              },
              {
                id: 'grievances',
                label: 'Track grievances',
                badge: grievances.length,
                content: (
                  <Card title="Your grievances">
                    {grievances.length === 0 ? (
                      <EmptyState title="No grievances submitted in this session" description="Submit a correction request to see it tracked here." />
                    ) : (
                      <ul className="space-y-2">
                        {grievances.map((g) => (
                          <li key={g.id} className="rounded-md border border-line/70 bg-paper/50 p-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[13px] font-semibold">
                                <span className="metric">{g.id}</span> · {g.subject}
                              </span>
                              <StatusBadge status={g.status} />
                            </div>
                            <p className="text-2xs text-muted">
                              {g.category} · parcel {g.parcelId} · submitted {formatDate(g.submittedOn)}
                            </p>
                            <button className="btn-secondary mt-1.5 py-0.5 text-2xs" onClick={() => downloadAcknowledgement(g)}>
                              Download acknowledgement
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  );
}

function Step({ done, title, detail }: { done?: boolean; title: string; detail: string }) {
  return (
    <li className="relative">
      <span
        className={`absolute -left-[23px] top-1.5 h-2.5 w-2.5 rounded-full ${done ? 'bg-signal-green' : 'bg-line'}`}
      />
      <p className="text-[13px] font-medium">{title}</p>
      <p className="text-2xs text-muted">{detail}</p>
    </li>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="metric text-[13px]">{value}</dd>
    </div>
  );
}

/** Public views show only the first name and initials of the surname. */
function maskName(name: string): string {
  const parts = name.split(' ');
  if (parts.length === 1) return `${parts[0].slice(0, 2)}${'*'.repeat(Math.max(2, parts[0].length - 2))}`;
  return `${parts[0]} ${parts
    .slice(1)
    .map((p) => `${p.charAt(0)}.`)
    .join(' ')}`;
}
