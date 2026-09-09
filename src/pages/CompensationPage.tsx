import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { ProgressBar, Select, TextInput } from '@/components/ui/Form';
import { StatTile } from '@/components/kpi/KpiCard';
import { ChartCard } from '@/components/charts/ChartCard';
import { areaCompareOption, funnelOption, groupedBarOption, horizontalBarOption } from '@/components/charts/presets';
import { Can } from '@/auth/PermissionGuard';
import { getDataset } from '@/data/dataset';
import { useAppStore } from '@/store/appStore';
import { useScope } from '@/hooks/useScope';
import { compensationOverTime, filterByGeo } from '@/services/analytics';
import { THEME } from '@/config/constants';
import { formatCurrency, formatDate } from '@/lib/format';
import { exportCsv } from '@/lib/export';
import { mean, pct, round, sum } from '@/lib/stats';
import type { Beneficiary, CompensationRecord, RRRecord } from '@/types';

export default function CompensationPage() {
  const scope = useScope();
  const dataset = getDataset();
  const recordAudit = useAppStore((s) => s.recordAudit);
  const role = useAppStore((s) => s.role);
  const user = useAppStore((s) => s.user);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | CompensationRecord['status']>('ALL');

  const records = useMemo(() => {
    const q = search.trim().toLowerCase();
    return filterByGeo(dataset.compensation, scope).filter(
      (c) =>
        (status === 'ALL' || c.status === status) &&
        (!q || `${c.beneficiaryId} ${c.parcelId} ${c.district} ${c.status}`.toLowerCase().includes(q)),
    );
  }, [dataset.compensation, scope, search, status]);

  const beneficiaries = useMemo(() => filterByGeo(dataset.beneficiaries, scope), [dataset.beneficiaries, scope]);
  const rrRecords = useMemo(() => {
    const ids = new Set(beneficiaries.map((b) => b.beneficiaryId));
    return dataset.rrRecords.filter((r) => ids.has(r.beneficiaryId));
  }, [dataset.rrRecords, beneficiaries]);

  const assessed = sum(records.map((r) => r.amountAssessed));
  const paid = sum(records.map((r) => r.amountPaid));

  const byDistrict = useMemo(() => {
    const map = new Map<string, { assessed: number; paid: number }>();
    records.forEach((r) => {
      const cur = map.get(r.district) ?? { assessed: 0, paid: 0 };
      cur.assessed += r.amountAssessed;
      cur.paid += r.amountPaid;
      map.set(r.district, cur);
    });
    return [...map.entries()]
      .map(([district, v]) => ({ district, progress: pct(v.paid, v.assessed), assessed: v.assessed, paid: v.paid }))
      .sort((a, b) => b.assessed - a.assessed)
      .slice(0, 14);
  }, [records]);

  const failureReasons = useMemo(() => {
    const map = new Map<string, number>();
    records.filter((r) => r.failureReason).forEach((r) => map.set(r.failureReason!, (map.get(r.failureReason!) ?? 0) + 1));
    return [...map.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => a.count - b.count);
  }, [records]);

  const verificationFunnel = useMemo(
    () => [
      { name: 'Identified beneficiaries', value: beneficiaries.length },
      { name: 'Bank details captured', value: beneficiaries.filter((b) => b.bankVerification !== 'pending').length },
      { name: 'Bank verification passed', value: beneficiaries.filter((b) => b.bankVerification === 'verified').length },
      { name: 'Payment approved', value: records.filter((r) => r.status !== 'Assessed').length },
      { name: 'Payment disbursed', value: records.filter((r) => r.amountPaid > 0).length },
      { name: 'Fully paid', value: records.filter((r) => r.status === 'Paid').length },
    ],
    [beneficiaries, records],
  );

  const rrByProject = useMemo(() => {
    const map = new Map<string, { total: number; completed: number }>();
    rrRecords.forEach((r) => {
      const project = dataset.projects.find((p) => p.id === r.projectId);
      if (!project) return;
      const cur = map.get(project.code) ?? { total: 0, completed: 0 };
      cur.total += 1;
      if (r.status === 'completed') cur.completed += 1;
      map.set(project.code, cur);
    });
    return [...map.entries()]
      .map(([code, v]) => ({ code, completion: pct(v.completed, v.total), total: v.total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 14);
  }, [rrRecords, dataset.projects]);

  const trend = useMemo(() => compensationOverTime(scope), [scope]);

  const compensationColumns: Column<CompensationRecord>[] = [
    { key: 'ben', header: 'Beneficiary', accessor: (r) => r.beneficiaryId, render: (r) => <span className="metric">{r.beneficiaryId}</span> },
    { key: 'parcel', header: 'Parcel', accessor: (r) => r.parcelId },
    { key: 'district', header: 'District', accessor: (r) => r.district },
    { key: 'assessed', header: 'Assessed', accessor: (r) => r.amountAssessed, align: 'right', render: (r) => formatCurrency(r.amountAssessed) },
    { key: 'paid', header: 'Paid', accessor: (r) => r.amountPaid, align: 'right', render: (r) => formatCurrency(r.amountPaid) },
    {
      key: 'progress',
      header: 'Progress',
      accessor: (r) => (r.amountAssessed ? r.amountPaid / r.amountAssessed : 0),
      width: '120px',
      render: (r) => <ProgressBar value={pct(r.amountPaid, r.amountAssessed)} tone="green" />,
    },
    { key: 'status', header: 'Status', accessor: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
    { key: 'assessedOn', header: 'Assessed on', accessor: (r) => r.assessedOn, render: (r) => formatDate(r.assessedOn) },
    { key: 'paidOn', header: 'Paid on', accessor: (r) => r.paidOn ?? '', render: (r) => formatDate(r.paidOn) },
    { key: 'delay', header: 'Delay (days)', accessor: (r) => r.disbursementDelayDays, align: 'right' },
    { key: 'reason', header: 'Failure reason', accessor: (r) => r.failureReason ?? '—' },
    {
      key: 'grievance',
      header: 'Grievance',
      sortable: false,
      render: (r) => (r.grievanceRaised ? <Badge tone="amber">Raised</Badge> : <Badge tone="neutral">None</Badge>),
    },
    {
      key: 'action',
      header: 'Action',
      sortable: false,
      render: (r) => (
        <Can permission="compensation.approve">
          <button
            className="btn-secondary px-1.5 py-0.5 text-2xs"
            onClick={(e) => {
              e.stopPropagation();
              recordAudit({
                actor: user?.name ?? 'Demo user',
                role,
                action: 'compensation.approved',
                entityType: 'CompensationRecord',
                entityId: r.beneficiaryId,
                oldValue: r.status,
                newValue: 'Approved',
                reason: 'Approved from the compensation workspace',
              });
            }}
          >
            Approve
          </button>
        </Can>
      ),
    },
  ];

  const beneficiaryColumns: Column<Beneficiary>[] = [
    { key: 'id', header: 'Beneficiary', accessor: (b) => b.beneficiaryId, render: (b) => <span className="metric">{b.beneficiaryId}</span> },
    { key: 'name', header: 'Name', accessor: (b) => b.name },
    { key: 'guardian', header: 'Guardian', accessor: (b) => b.guardianName },
    { key: 'family', header: 'Family size', accessor: (b) => b.familySize, align: 'right' },
    { key: 'category', header: 'Category', accessor: (b) => b.category },
    { key: 'parcel', header: 'Parcel', accessor: (b) => b.parcelId },
    { key: 'district', header: 'District', accessor: (b) => b.district },
    {
      key: 'bank',
      header: 'Bank account',
      accessor: (b) => b.bankAccountMasked,
      render: (b) => <span className="metric text-2xs">{b.bankAccountMasked}</span>,
    },
    { key: 'verify', header: 'Verification', accessor: (b) => b.bankVerification, render: (b) => <StatusBadge status={b.bankVerification} /> },
    { key: 'vuln', header: 'Vulnerable', sortable: false, render: (b) => (b.vulnerable ? <Badge tone="amber">Priority</Badge> : <Badge tone="neutral">Standard</Badge>) },
  ];

  const rrColumns: Column<RRRecord>[] = [
    { key: 'ben', header: 'Beneficiary', accessor: (r) => r.beneficiaryId },
    { key: 'elig', header: 'Eligibility', accessor: (r) => r.eligibility, render: (r) => <StatusBadge status={r.eligibility} /> },
    { key: 'ent', header: 'Entitlements', accessor: (r) => r.entitlements.join(', '), render: (r) => <span className="text-2xs">{r.entitlements.join(', ') || '—'}</span> },
    { key: 'site', header: 'Site allotted', accessor: (r) => (r.siteAllotted ? 'Yes' : 'No') },
    { key: 'code', header: 'Site code', accessor: (r) => r.siteCode ?? '—' },
    { key: 'disb', header: 'Benefits disbursed', accessor: (r) => r.benefitsDisbursedPercent, width: '140px', render: (r) => <ProgressBar value={r.benefitsDisbursedPercent} /> },
    { key: 'status', header: 'Status', accessor: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
    { key: 'updated', header: 'Updated', accessor: (r) => r.updatedAt, render: (r) => formatDate(r.updatedAt) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Compensation and Rehabilitation"
        description="Assessment, beneficiary verification, disbursement, failures, grievances and resettlement entitlements. Bank and identity values are always masked."
        trail={[{ label: 'Compensation & R&R' }]}
        actions={
          <button
            className="btn-secondary"
            onClick={() =>
              exportCsv(
                records.map((r) => ({
                  beneficiaryId: r.beneficiaryId,
                  parcelId: r.parcelId,
                  district: r.district,
                  state: r.state,
                  amountAssessed: r.amountAssessed,
                  amountPaid: r.amountPaid,
                  status: r.status,
                  assessedOn: r.assessedOn,
                  paidOn: r.paidOn,
                  disbursementDelayDays: r.disbursementDelayDays,
                  failureReason: r.failureReason,
                })),
                'compensation-records',
              )
            }
          >
            Export records
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Records" value={records.length.toLocaleString('en-IN')} />
        <StatTile label="Assessed" value={formatCurrency(assessed)} />
        <StatTile label="Disbursed" value={formatCurrency(paid)} tone="green" />
        <StatTile label="Outstanding" value={formatCurrency(assessed - paid)} tone="red" />
        <StatTile label="Payment failures" value={String(records.filter((r) => r.status === 'Failed').length)} tone="red" />
        <StatTile label="Mean disbursement delay" value={`${round(mean(records.map((r) => r.disbursementDelayDays)), 0)} days`} tone="amber" />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <ChartCard
          title="Assessed versus disbursed compensation"
          subtitle="₹ crore per month"
          height={280}
          isEmpty={!trend.length}
          option={areaCompareOption(
            trend.map((t) => t.period),
            { name: 'Assessed', data: trend.map((t) => t.assessed) },
            { name: 'Disbursed', data: trend.map((t) => t.disbursed) },
            '₹ crore',
          )}
          exportName="compensation-trend"
          exportRows={trend}
        />
        <ChartCard
          title="Payment progress by district"
          subtitle="Share of assessed amount disbursed"
          height={280}
          isEmpty={!byDistrict.length}
          option={groupedBarOption(
            byDistrict.map((d) => d.district),
            [{ name: 'Progress %', data: byDistrict.map((d) => d.progress), color: THEME.green }],
            '%',
          )}
          exportName="compensation-by-district"
          exportRows={byDistrict}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <ChartCard
          title="Beneficiary verification funnel"
          subtitle="From identification to full payment"
          height={280}
          option={funnelOption(verificationFunnel)}
          exportName="beneficiary-funnel"
          exportRows={verificationFunnel.map((f) => ({ stage: f.name, count: f.value }))}
        />
        <ChartCard
          title="Payment failures by reason"
          subtitle="Root causes of disbursement failure"
          height={280}
          isEmpty={!failureReasons.length}
          option={horizontalBarOption(
            failureReasons.map((f) => f.reason),
            failureReasons.map((f) => f.count),
            { valueName: 'records', color: THEME.red },
          )}
          exportName="payment-failures"
          exportRows={failureReasons}
        />
        <ChartCard
          title="R&R completion by project"
          subtitle="Share of eligible families with completed entitlements"
          height={280}
          isEmpty={!rrByProject.length}
          option={horizontalBarOption(
            rrByProject.map((r) => r.code),
            rrByProject.map((r) => r.completion),
            { valueName: '%', color: THEME.olive },
          )}
          exportName="rr-completion"
          exportRows={rrByProject}
        />
      </div>

      <Tabs
        items={[
          {
            id: 'compensation',
            label: 'Compensation records',
            badge: records.length,
            content: (
              <Card
                dense
                actions={
                  <div className="flex items-center gap-1.5">
                    <TextInput
                      className="w-52 py-1 text-2xs"
                      placeholder="Search beneficiary, parcel, district…"
                      value={search}
                      aria-label="Search compensation records"
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <Select
                      className="w-36 py-1 text-2xs"
                      aria-label="Filter payment status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as typeof status)}
                      options={[
                        { value: 'ALL', label: 'All statuses' },
                        { value: 'Assessed', label: 'Assessed' },
                        { value: 'Approved', label: 'Approved' },
                        { value: 'Partially Paid', label: 'Partially paid' },
                        { value: 'Paid', label: 'Paid' },
                        { value: 'Failed', label: 'Failed' },
                        { value: 'Withheld', label: 'Withheld' },
                      ]}
                    />
                  </div>
                }
              >
                <DataTable rows={records} columns={compensationColumns} rowKey={(r) => r.id} pageSize={14} />
              </Card>
            ),
          },
          {
            id: 'beneficiaries',
            label: 'Beneficiaries',
            badge: beneficiaries.length,
            content: (
              <Card dense footer="Bank account identifiers and identity numbers are masked for every role. Unmasking requires an explicit, logged authorisation in production.">
                <DataTable rows={beneficiaries} columns={beneficiaryColumns} rowKey={(b) => b.id} pageSize={14} />
              </Card>
            ),
          },
          {
            id: 'rr',
            label: 'Rehabilitation & resettlement',
            badge: rrRecords.length,
            content: (
              <Card dense>
                <DataTable rows={rrRecords} columns={rrColumns} rowKey={(r) => r.id} pageSize={14} />
              </Card>
            ),
          },
          {
            id: 'grievances',
            label: 'Grievances',
            badge: records.filter((r) => r.grievanceRaised).length,
            content: (
              <Card dense title="Compensation grievances">
                <DataTable
                  rows={records.filter((r) => r.grievanceRaised)}
                  columns={[
                    { key: 'ben', header: 'Beneficiary', accessor: (r) => r.beneficiaryId },
                    { key: 'parcel', header: 'Parcel', accessor: (r) => r.parcelId },
                    { key: 'district', header: 'District', accessor: (r) => r.district },
                    { key: 'status', header: 'Payment status', accessor: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
                    { key: 'reason', header: 'Failure reason', accessor: (r) => r.failureReason ?? 'Not recorded' },
                    { key: 'delay', header: 'Delay (days)', accessor: (r) => r.disbursementDelayDays, align: 'right' },
                  ]}
                  rowKey={(r) => r.id}
                  pageSize={12}
                  emptyTitle="No grievances raised in this scope"
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
