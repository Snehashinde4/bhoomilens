import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { LandGptPanel } from '@/components/copilot/LandGptPanel';

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-paper">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenCopilot={() => setCopilotOpen(true)} />
        <main className="flex-1 overflow-y-auto scroll-thin px-4 py-3">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <LandGptPanel open={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </div>
  );
}
