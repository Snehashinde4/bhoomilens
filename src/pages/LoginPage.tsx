import { useNavigate } from 'react-router-dom';
import { ROLE_LIST, ROLES } from '@/auth/roles';
import { useAppStore } from '@/store/appStore';
import { appConfig } from '@/config/appConfig';
import { getDataset } from '@/data/dataset';
import { formatCompact } from '@/lib/format';
import { DemoBadge } from '@/components/ui/Disclaimers';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAppStore((s) => s.login);
  const dataset = getDataset();

  const signIn = (roleId: (typeof ROLE_LIST)[number]['id']) => {
    login(roleId);
    navigate(ROLES[roleId].landingRoute);
  };

  return (
    <div className="min-h-screen cadastral-grid">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 gap-6 px-5 py-8 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <section>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-ink text-lg font-bold text-paper">
              BL
            </div>
            <div>
              <h1 className="font-display text-3xl font-semibold leading-none">BhoomiLens</h1>
              <p className="text-[13px] text-muted">National Land Governance Intelligence Platform</p>
            </div>
          </div>

          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink/85">
            An AI-powered land intelligence, validation, acquisition monitoring, GIS and decision
            support platform for transparent, evidence-driven land governance.
          </p>

          <ul className="mt-5 grid max-w-xl grid-cols-2 gap-2 text-[13px]">
            {[
              'Intelligent land-record digitization',
              'Acquisition lifecycle monitoring',
              'Explainable delay prediction',
              'Ownership and conflict graph',
              'Potential anomaly detection',
              'Cadastral GIS and watershed intelligence',
              'Human-assisted verification',
              'Audit-grade governance trail',
            ].map((f) => (
              <li key={f} className="flex items-start gap-1.5 text-muted">
                <span className="text-teal">▸</span>
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-6 grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Projects" value={formatCompact(dataset.projects.length)} />
            <Stat label="Parcels" value={formatCompact(dataset.parcels.length)} />
            <Stat label="Documents" value={formatCompact(dataset.documents.length)} />
            <Stat label="Districts" value={formatCompact(dataset.districts.length)} />
          </div>

          <div className="mt-5">
            <DemoBadge />
          </div>
        </section>

        <section className="surface-card p-4">
          <h2 className="text-[16px] font-semibold">Sign in to the demonstration</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            Prototype authentication. Choose a role to enter the platform with that role&apos;s
            permissions, dashboards and data scope. The role can be switched at any time from the
            header.
          </p>

          <div className="mt-3 max-h-[52vh] space-y-1.5 overflow-y-auto scroll-thin pr-1">
            {ROLE_LIST.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => signIn(role.id)}
                className="flex w-full items-start justify-between gap-3 rounded-md border border-line bg-paper/50 px-3 py-2 text-left transition-colors hover:border-teal hover:bg-teal/8"
              >
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold">{role.label}</span>
                  <span className="block text-2xs text-muted">{role.description}</span>
                </span>
                <span className="chip shrink-0 border-line bg-surface text-muted">{role.scope}</span>
              </button>
            ))}
          </div>

          <p className="mt-3 border-t border-line/60 pt-2 text-2xs text-muted">
            Production deployments use OAuth 2.0 / OpenID Connect with departmental identity
            providers, session binding and MFA. {appConfig.demoBadge}
          </p>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card px-3 py-2">
      <p className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="metric text-lg font-semibold">{value}</p>
    </div>
  );
}
