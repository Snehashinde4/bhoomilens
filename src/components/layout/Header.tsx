import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDataset } from '@/data/dataset';
import { useAppStore, visibleNotifications } from '@/store/appStore';
import { ROLE_LIST, ROLES } from '@/auth/roles';
import { LANGUAGES, DATE_RANGE_PRESETS } from '@/config/constants';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { DemoBadge } from '@/components/ui/Disclaimers';
import { Drawer } from '@/components/ui/Modal';
import type { LanguageCode, RoleId } from '@/types';

interface SearchHit {
  label: string;
  sub: string;
  route: string;
  kind: string;
}

export function Header({ onOpenCopilot }: { onOpenCopilot: () => void }) {
  const navigate = useNavigate();
  const role = useAppStore((s) => s.role);
  const user = useAppStore((s) => s.user);
  const filters = useAppStore((s) => s.filters);
  const language = useAppStore((s) => s.language);
  const setFilters = useAppStore((s) => s.setFilters);
  const switchRole = useAppStore((s) => s.switchRole);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const markRead = useAppStore((s) => s.markNotificationRead);
  const readIds = useAppStore((s) => s.workspace.readNotifications);

  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const dataset = getDataset();
  const states = useMemo(
    () => ['ALL', ...dataset.states.map((s) => s.name)],
    [dataset.states],
  );
  const districts = useMemo(() => {
    const pool =
      filters.state === 'ALL'
        ? dataset.districts
        : dataset.districts.filter((d) => d.state === filters.state);
    return ['ALL', ...pool.map((d) => d.name)];
  }, [dataset.districts, filters.state]);

  const notifications = visibleNotifications(dataset.notifications, role, readIds);
  const unread = notifications.filter((n) => !n.read).length;

  const hits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: SearchHit[] = [];
    dataset.projects
      .filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
      .slice(0, 5)
      .forEach((p) =>
        out.push({ label: p.name, sub: `${p.code} · ${p.district}, ${p.state}`, route: `/projects/${p.code}`, kind: 'Project' }),
      );
    dataset.parcels
      .filter(
        (p) =>
          p.parcelId.toLowerCase().includes(q) ||
          p.surveyNumber.toLowerCase().includes(q) ||
          p.khasraNumber.toLowerCase().includes(q) ||
          p.owner.toLowerCase().includes(q),
      )
      .slice(0, 5)
      .forEach((p) =>
        out.push({ label: `${p.parcelId} · ${p.owner}`, sub: `Survey ${p.surveyNumber} · ${p.village}`, route: `/twins/${p.parcelId}`, kind: 'Parcel' }),
      );
    dataset.documents
      .filter((d) => d.code.toLowerCase().includes(q) || d.fileName.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((d) =>
        out.push({ label: d.code, sub: `${d.documentType} · ${d.district}`, route: `/digitization/${d.code}`, kind: 'Document' }),
      );
    return out;
  }, [query, dataset]);

  return (
    <header className="z-30 flex flex-col gap-2 border-b border-line bg-surface px-4 py-2 no-print">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h1 className="font-display text-[17px] font-semibold leading-none">BhoomiLens</h1>
            <span className="hidden truncate text-2xs text-muted sm:inline">
              National Land Governance Intelligence Platform
            </span>
          </div>
        </div>

        <div className="relative w-full max-w-md sm:w-auto sm:flex-1">
          <input
            className="field pr-8"
            placeholder="Search projects, parcels, survey numbers, documents…"
            value={query}
            aria-label="Global search"
            onChange={(e) => {
              setQuery(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            onBlur={() => window.setTimeout(() => setShowResults(false), 180)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && hits[0]) navigate(hits[0].route);
            }}
          />
          <span className="pointer-events-none absolute right-2.5 top-1.5 text-muted">⌕</span>
          {showResults && hits.length > 0 && (
            <ul className="absolute left-0 right-0 top-9 z-50 max-h-80 overflow-y-auto rounded-md border border-line bg-surface shadow-raised">
              {hits.map((hit) => (
                <li key={`${hit.kind}-${hit.route}`}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-teal/8"
                    onMouseDown={() => navigate(hit.route)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{hit.label}</span>
                      <span className="block truncate text-2xs text-muted">{hit.sub}</span>
                    </span>
                    <span className="chip border-line bg-paper text-muted">{hit.kind}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <select
            className="field w-[86px] py-1"
            aria-label="Interface language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageCode)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.native}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn-teal"
            onClick={onOpenCopilot}
            title="Open LandGPT, the BhoomiLens governance copilot"
          >
            ✦ LandGPT
          </button>

          <button
            type="button"
            className="relative btn-secondary px-2"
            onClick={() => setNotifOpen(true)}
            aria-label={`Notifications (${unread} unread)`}
          >
            ✉
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-signal-red px-1 text-[9px] font-bold text-white">
                {unread}
              </span>
            )}
          </button>

          <div className="flex items-center gap-1.5 rounded-md border border-line bg-paper px-2 py-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-paper">
              {user?.avatarInitials ?? 'BL'}
            </span>
            <span className="hidden leading-tight md:block">
              <span className="block text-[11px] font-semibold">{user?.name ?? 'Demo user'}</span>
              <span className="block text-[10px] text-muted">{ROLES[role].label}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <FilterSelect
          label="Workspace"
          value={filters.workspace}
          options={['national', 'state', 'district', 'project', 'citizen']}
          onChange={(v) => setFilters({ workspace: v as typeof filters.workspace })}
        />
        <FilterSelect
          label="State"
          value={filters.state}
          options={states}
          onChange={(v) => setFilters({ state: v, district: 'ALL' })}
        />
        <FilterSelect
          label="District"
          value={filters.district}
          options={districts}
          onChange={(v) => setFilters({ district: v })}
        />
        <label className="flex items-center gap-1 rounded-md border border-line bg-paper px-2 py-1 text-2xs">
          <span className="font-semibold uppercase tracking-wide text-muted">Period</span>
          <select
            className="bg-transparent text-[12px] font-medium focus:outline-none"
            value={filters.dateRange.label}
            aria-label="Date range"
            onChange={(e) => {
              const preset = DATE_RANGE_PRESETS.find((p) => p.label === e.target.value);
              if (!preset) return;
              const to = new Date('2026-09-09');
              const from = new Date(to);
              from.setMonth(from.getMonth() - preset.months);
              setFilters({
                dateRange: {
                  from: from.toISOString().slice(0, 10),
                  to: to.toISOString().slice(0, 10),
                  label: preset.label,
                },
              });
            }}
          >
            {DATE_RANGE_PRESETS.map((p) => (
              <option key={p.label}>{p.label}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1 rounded-md border border-teal/50 bg-teal/10 px-2 py-1 text-2xs">
          <span className="font-semibold uppercase tracking-wide text-teal">Demo role</span>
          <select
            className="bg-transparent text-[12px] font-medium text-ink focus:outline-none"
            value={role}
            aria-label="Switch demo role"
            onChange={(e) => {
              const next = e.target.value as RoleId;
              switchRole(next);
              navigate(ROLES[next].landingRoute);
            }}
          >
            {ROLE_LIST.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <DemoBadge className="ml-auto" />
      </div>

      <Drawer open={notifOpen} onClose={() => setNotifOpen(false)} title="Notifications">
        {notifications.length === 0 ? (
          <p className="text-[13px] text-muted">No notifications for this role.</p>
        ) : (
          <ul className="space-y-2">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={cn(
                  'rounded-md border p-3',
                  n.severity === 'critical'
                    ? 'border-signal-red/40 bg-signal-red/5'
                    : n.severity === 'warning'
                      ? 'border-signal-amber/50 bg-signal-amber/8'
                      : 'border-line bg-paper/60',
                  n.read && 'opacity-60',
                )}
              >
                <p className="text-[13px] font-semibold">{n.title}</p>
                <p className="mt-0.5 text-2xs text-muted">{n.body}</p>
                <p className="mt-1 text-[10px] text-muted">{formatDateTime(n.createdAt)}</p>
                <div className="mt-1.5 flex gap-2">
                  {n.route && (
                    <button
                      type="button"
                      className="btn-secondary py-1 text-2xs"
                      onClick={() => {
                        markRead(n.id);
                        setNotifOpen(false);
                        navigate(n.route!);
                      }}
                    >
                      Open
                    </button>
                  )}
                  {!n.read && (
                    <button type="button" className="btn-ghost py-1 text-2xs" onClick={() => markRead(n.id)}>
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Drawer>
    </header>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-1 rounded-md border border-line bg-paper px-2 py-1 text-2xs">
      <span className="font-semibold uppercase tracking-wide text-muted">{label}</span>
      <select
        className="max-w-[150px] bg-transparent text-[12px] font-medium focus:outline-none"
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === 'ALL' ? 'All' : o.charAt(0).toUpperCase() + o.slice(1)}
          </option>
        ))}
      </select>
    </label>
  );
}
