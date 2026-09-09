import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Select, TextInput } from '@/components/ui/Form';
import { StatTile } from '@/components/kpi/KpiCard';
import { ChartCard } from '@/components/charts/ChartCard';
import { donutOption, horizontalBarOption } from '@/components/charts/presets';
import { getDataset } from '@/data/dataset';
import { useAppStore } from '@/store/appStore';
import { askLandGpt, COPILOT_DISCLAIMER } from '@/copilot/engine';
import { CHART_PALETTE, THEME } from '@/config/constants';
import { formatDate } from '@/lib/format';
import { exportCsv } from '@/lib/export';
import type { ResearchDocument } from '@/types';

const EXAMPLE_QUERY =
  'Show evidence on how compensation-verification delays affect highway acquisition timelines in Rajasthan';

export default function ResearchPage() {
  const dataset = getDataset();
  const role = useAppStore((s) => s.role);
  const pushQuery = useAppStore((s) => s.pushCopilotQuery);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'ALL' | ResearchDocument['category']>('ALL');
  const [tag, setTag] = useState('ALL');
  const [question, setQuestion] = useState(EXAMPLE_QUERY);
  const [answer, setAnswer] = useState<ReturnType<typeof askLandGpt> | null>(null);

  const allTags = useMemo(
    () => [...new Set(dataset.research.flatMap((r) => r.tags))].sort(),
    [dataset.research],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dataset.research.filter(
      (r) =>
        (category === 'ALL' || r.category === category) &&
        (tag === 'ALL' || r.tags.includes(tag)) &&
        (!q || `${r.title} ${r.abstract} ${r.tags.join(' ')} ${r.sourceRef}`.toLowerCase().includes(q)),
    );
  }, [dataset.research, search, category, tag]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    dataset.research.forEach((r) => map.set(r.category, (map.get(r.category) ?? 0) + 1));
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [dataset.research]);

  const topTags = useMemo(() => {
    const map = new Map<string, number>();
    dataset.research.forEach((r) => r.tags.forEach((t) => map.set(t, (map.get(t) ?? 0) + 1)));
    return [...map.entries()]
      .map(([tagName, count]) => ({ tag: tagName, count }))
      .sort((a, b) => a.count - b.count)
      .slice(-12);
  }, [dataset.research]);

  const askAssistant = () => {
    pushQuery(question);
    setAnswer(askLandGpt(question, role));
  };

  const relatedEvidence = useMemo(() => {
    const q = question.toLowerCase();
    const districts = dataset.districtMetrics
      .filter((d) => q.includes(d.state.toLowerCase()) || q.includes(d.district.toLowerCase()))
      .slice(0, 6);
    const projects = dataset.projects
      .filter(
        (p) =>
          (q.includes('highway') ? p.projectType === 'highway' : true) &&
          (q.includes(p.state.toLowerCase()) || districts.some((d) => d.district === p.district)),
      )
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 6);
    const papers = dataset.research
      .filter((r) => r.tags.some((t) => q.includes(t.split(' ')[0])))
      .slice(0, 5);
    return { districts, projects, papers };
  }, [question, dataset]);

  const columns: Column<ResearchDocument>[] = [
    { key: 'title', header: 'Title', accessor: (r) => r.title, width: '320px' },
    { key: 'category', header: 'Category', accessor: (r) => r.category },
    { key: 'authors', header: 'Authors', accessor: (r) => r.authors.join(', ') },
    { key: 'published', header: 'Published', accessor: (r) => r.publishedOn, render: (r) => formatDate(r.publishedOn) },
    { key: 'states', header: 'States', accessor: (r) => r.states.join(', '), render: (r) => <span className="text-2xs">{r.states.join(', ')}</span> },
    { key: 'tags', header: 'Tags', sortable: false, render: (r) => <span className="flex flex-wrap gap-0.5">{r.tags.slice(0, 3).map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}</span> },
    { key: 'citations', header: 'Citations', accessor: (r) => r.citations, align: 'right' },
    { key: 'access', header: 'Access', accessor: (r) => r.accessLevel, render: (r) => <Badge tone={r.accessLevel === 'public' ? 'green' : 'amber'}>{r.accessLevel}</Badge> },
    { key: 'ref', header: 'Source reference', accessor: (r) => r.sourceRef, render: (r) => <span className="metric text-2xs">{r.sourceRef}</span> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Research and Policy Hub"
        description="A searchable evidence base plus a grounded research assistant. The assistant answers only from records held in this environment and never invents documents, policies or citations."
        trail={[{ label: 'Research Hub' }]}
        actions={
          <button className="btn-secondary" onClick={() => exportCsv(rows.map((r) => ({ ...r, authors: r.authors.join('; '), tags: r.tags.join('; '), states: r.states.join('; ') })), 'research-library')}>
            Export library
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Library entries" value={String(dataset.research.length)} />
        <StatTile label="Research papers" value={String(dataset.research.filter((r) => r.category === 'Research Paper').length)} />
        <StatTile label="Policy documents" value={String(dataset.research.filter((r) => r.category === 'Policy Document').length)} />
        <StatTile label="Datasets" value={String(dataset.research.filter((r) => r.category === 'Dataset').length)} />
        <StatTile label="Active pilots" value={String(dataset.research.filter((r) => r.category === 'Pilot').length)} />
        <StatTile label="Restricted items" value={String(dataset.research.filter((r) => r.accessLevel === 'restricted').length)} tone="amber" />
      </div>

      <Card title="AI research assistant" subtitle="Grounded retrieval over projects, districts and the policy library">
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextInput
            value={question}
            aria-label="Research question"
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && askAssistant()}
          />
          <button className="btn-teal shrink-0" onClick={askAssistant}>
            Ask assistant
          </button>
        </div>

        {answer && (
          <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-2 rounded-md border border-line/70 bg-paper/50 p-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[14px] font-semibold">{answer.headline}</h3>
                <Badge tone={answer.confidence >= 80 ? 'green' : 'amber'}>{answer.confidence}% confidence</Badge>
              </div>
              {answer.facts.length > 0 && (
                <div>
                  <p className="text-2xs font-bold uppercase tracking-wide text-muted">Extracted findings</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {answer.facts.map((f, i) => (
                      <li key={i} className="text-[12.5px]">• {f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {answer.predictions.length > 0 && (
                <div className="rounded border border-signal-amber/40 bg-signal-amber/8 p-2">
                  <p className="text-2xs font-bold uppercase tracking-wide text-[#8a5f10]">Model estimates</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {answer.predictions.map((p, i) => (
                      <li key={i} className="text-[12.5px]">• {p}</li>
                    ))}
                  </ul>
                </div>
              )}
              {answer.calculation && (
                <p className="text-2xs text-muted">
                  <b>Source traceability:</b> {answer.calculation}
                </p>
              )}
              <p className="text-[11px] italic text-muted">{COPILOT_DISCLAIMER}</p>
            </div>

            <div className="space-y-2">
              <div className="rounded-md border border-line/70 bg-surface p-2.5">
                <p className="text-2xs font-bold uppercase tracking-wide text-muted">Related districts</p>
                {relatedEvidence.districts.length ? (
                  <ul className="mt-0.5 space-y-0.5 text-2xs">
                    {relatedEvidence.districts.map((d) => (
                      <li key={d.id}>
                        • {d.district} ({d.state}): compensation progress {d.compensationProgress}%, delay probability {d.delayProbability}%
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-2xs text-muted">No district matched the question text.</p>
                )}
              </div>
              <div className="rounded-md border border-line/70 bg-surface p-2.5">
                <p className="text-2xs font-bold uppercase tracking-wide text-muted">Similar projects</p>
                {relatedEvidence.projects.length ? (
                  <ul className="mt-0.5 space-y-0.5 text-2xs">
                    {relatedEvidence.projects.map((p) => (
                      <li key={p.id}>
                        • {p.code} · {p.name} — risk {p.riskScore}, driver {p.primaryDelayDriver}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-2xs text-muted">No project matched the question text.</p>
                )}
              </div>
              <div className="rounded-md border border-line/70 bg-surface p-2.5">
                <p className="text-2xs font-bold uppercase tracking-wide text-muted">Dataset and library references</p>
                <ul className="mt-0.5 space-y-0.5 text-2xs">
                  {relatedEvidence.papers.length ? (
                    relatedEvidence.papers.map((p) => (
                      <li key={p.id}>• {p.sourceRef} — {p.title}</li>
                    ))
                  ) : (
                    <li>• No library entry matched; only operational records were used.</li>
                  )}
                </ul>
              </div>
              <div className="rounded-md border border-teal/40 bg-teal/8 p-2.5">
                <p className="text-2xs font-bold uppercase tracking-wide text-teal">Policy considerations</p>
                <ul className="mt-0.5 space-y-0.5 text-2xs">
                  <li>• Sequencing beneficiary verification before award reduces disbursement delay exposure.</li>
                  <li>• Capacity augmentation shows the largest modelled effect where compensation gaps dominate.</li>
                  <li>• Findings are observational within this synthetic environment and require validation on live data.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-3 xl:grid-cols-2">
        <ChartCard
          title="Library composition"
          subtitle="Entries by category"
          height={260}
          option={donutOption(byCategory, { colors: CHART_PALETTE, centerValue: String(dataset.research.length), centerLabel: 'entries' })}
          exportName="research-categories"
          exportRows={byCategory.map((b) => ({ category: b.name, entries: b.value }))}
        />
        <ChartCard
          title="Most frequent research themes"
          subtitle="Tag frequency across the library"
          height={260}
          option={horizontalBarOption(
            topTags.map((t) => t.tag),
            topTags.map((t) => t.count),
            { valueName: 'entries', color: THEME.blue },
          )}
          exportName="research-tags"
          exportRows={topTags}
        />
      </div>

      <Card
        dense
        title={`Knowledge library (${rows.length})`}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <TextInput
              className="w-56 py-1 text-2xs"
              placeholder="Search titles, abstracts, tags…"
              value={search}
              aria-label="Search research library"
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              className="w-44 py-1 text-2xs"
              aria-label="Filter category"
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              options={[
                { value: 'ALL', label: 'All categories' },
                ...byCategory.map((c) => ({ value: c.name, label: c.name })),
              ]}
            />
            <Select
              className="w-40 py-1 text-2xs"
              aria-label="Filter tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              options={[{ value: 'ALL', label: 'All tags' }, ...allTags.map((t) => ({ value: t, label: t }))]}
            />
          </div>
        }
        footer="Entries are synthetic records created for the prototype knowledge base and must not be cited as official publications."
      >
        <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} pageSize={12} />
      </Card>
    </div>
  );
}
