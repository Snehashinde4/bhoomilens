import { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { PermissionGuard } from '@/auth/PermissionGuard';
import { useAppStore } from '@/store/appStore';
import { ChartSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const OverviewPage = lazy(() => import('@/pages/OverviewPage'));
const AcquisitionPage = lazy(() => import('@/pages/AcquisitionPage'));
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('@/pages/ProjectDetailPage'));
const RiskPage = lazy(() => import('@/pages/RiskPage'));
const ScenarioPage = lazy(() => import('@/pages/ScenarioPage'));
const DigitizationPage = lazy(() => import('@/pages/DigitizationPage'));
const DocumentStudioPage = lazy(() => import('@/pages/DocumentStudioPage'));
const ValidationPage = lazy(() => import('@/pages/ValidationPage'));
const TwinsPage = lazy(() => import('@/pages/TwinsPage'));
const TwinDetailPage = lazy(() => import('@/pages/TwinDetailPage'));
const OwnershipGraphPage = lazy(() => import('@/pages/OwnershipGraphPage'));
const TimeMachinePage = lazy(() => import('@/pages/TimeMachinePage'));
const FraudPage = lazy(() => import('@/pages/FraudPage'));
const GisPage = lazy(() => import('@/pages/GisPage'));
const WatershedPage = lazy(() => import('@/pages/WatershedPage'));
const ResearchPage = lazy(() => import('@/pages/ResearchPage'));
const CompensationPage = lazy(() => import('@/pages/CompensationPage'));
const ReviewPage = lazy(() => import('@/pages/ReviewPage'));
const CitizenPage = lazy(() => import('@/pages/CitizenPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const IntegrationsPage = lazy(() => import('@/pages/IntegrationsPage'));
const GovernancePage = lazy(() => import('@/pages/GovernancePage'));
const AuditPage = lazy(() => import('@/pages/AuditPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

function PageFallback() {
  return (
    <div className="surface-card p-4">
      <ChartSkeleton height={320} />
    </div>
  );
}

export default function App() {
  const ready = useAppStore((s) => s.ready);
  const user = useAppStore((s) => s.user);
  const initialize = useAppStore((s) => s.initialize);
  const location = useLocation();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-paper">
        <div className="text-center">
          <p className="font-display text-2xl font-semibold text-ink">BhoomiLens</p>
          <p className="mt-1 text-[13px] text-muted">Generating the synthetic national dataset…</p>
        </div>
      </div>
    );
  }

  if (!user && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<Guard p="overview.view"><OverviewPage /></Guard>} />
          <Route path="/acquisition" element={<Guard p="project.view"><AcquisitionPage /></Guard>} />
          <Route path="/projects" element={<Guard p="project.view"><ProjectsPage /></Guard>} />
          <Route path="/projects/:code" element={<Guard p="project.view"><ProjectDetailPage /></Guard>} />
          <Route path="/risk" element={<Guard p="risk.view"><RiskPage /></Guard>} />
          <Route path="/scenario" element={<Guard p="risk.simulate"><ScenarioPage /></Guard>} />
          <Route path="/digitization" element={<Guard p="document.view"><DigitizationPage /></Guard>} />
          <Route path="/digitization/:code" element={<Guard p="document.view"><DocumentStudioPage /></Guard>} />
          <Route path="/validation" element={<Guard p="validation.view"><ValidationPage /></Guard>} />
          <Route path="/twins" element={<Guard p="parcel.view"><TwinsPage /></Guard>} />
          <Route path="/twins/:parcelId" element={<Guard p="parcel.view"><TwinDetailPage /></Guard>} />
          <Route path="/ownership-graph" element={<Guard p="graph.view"><OwnershipGraphPage /></Guard>} />
          <Route path="/time-machine" element={<Guard p="parcel.view"><TimeMachinePage /></Guard>} />
          <Route path="/fraud" element={<Guard p="fraud.view"><FraudPage /></Guard>} />
          <Route path="/gis" element={<Guard p="gis.view"><GisPage /></Guard>} />
          <Route path="/watershed" element={<Guard p="watershed.view"><WatershedPage /></Guard>} />
          <Route path="/research" element={<Guard p="research.view"><ResearchPage /></Guard>} />
          <Route path="/compensation" element={<Guard p="compensation.view"><CompensationPage /></Guard>} />
          <Route path="/review" element={<Guard p="review.view"><ReviewPage /></Guard>} />
          <Route path="/citizen" element={<CitizenPage />} />
          <Route path="/reports" element={<Guard p="reports.view"><ReportsPage /></Guard>} />
          <Route path="/integrations" element={<Guard p="integrations.view"><IntegrationsPage /></Guard>} />
          <Route path="/governance" element={<Guard p="governance.view"><GovernancePage /></Guard>} />
          <Route path="/audit" element={<Guard p="audit.view"><AuditPage /></Guard>} />
          <Route path="/settings" element={<Guard p="settings.manage"><SettingsPage /></Guard>} />
          <Route
            path="*"
            element={
              <div className="surface-card">
                <EmptyState
                  title="Page not found"
                  description="The requested route does not exist. Use the left navigation to return to a module."
                />
              </div>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  );
}

function Guard({ p, children }: { p: Parameters<typeof PermissionGuard>[0]['permission']; children: ReactNode }) {
  return <PermissionGuard permission={p}>{children}</PermissionGuard>;
}
