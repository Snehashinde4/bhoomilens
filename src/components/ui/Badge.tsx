import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { ConflictSeverity, RiskLevel } from '@/types';

type Tone = 'neutral' | 'teal' | 'green' | 'amber' | 'red' | 'blue' | 'olive' | 'ink';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'border-line bg-paper text-muted',
  teal: 'border-teal/40 bg-teal/10 text-teal',
  green: 'border-signal-green/40 bg-signal-green/10 text-signal-green',
  amber: 'border-signal-amber/50 bg-signal-amber/15 text-[#9a6b12]',
  red: 'border-signal-red/40 bg-signal-red/10 text-signal-red',
  blue: 'border-signal-blue/40 bg-signal-blue/10 text-signal-blue',
  olive: 'border-olive/40 bg-olive/10 text-olive',
  ink: 'border-ink/30 bg-ink/10 text-ink',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return <span className={cn('chip', TONE_CLASS[tone], className)}>{children}</span>;
}

const RISK_TONE: Record<RiskLevel, Tone> = {
  low: 'green',
  medium: 'amber',
  high: 'red',
  critical: 'red',
};

export function RiskBadge({ level, score }: { level: RiskLevel; score?: number }) {
  return (
    <Badge tone={RISK_TONE[level]} className={level === 'critical' ? 'ring-1 ring-signal-red/50' : undefined}>
      <span className="uppercase">{level}</span>
      {score !== undefined && <span className="metric">{score}</span>}
    </Badge>
  );
}

const SEVERITY_TONE: Record<ConflictSeverity, Tone> = {
  blocking: 'red',
  review: 'amber',
  informational: 'blue',
  validated: 'green',
};

export function SeverityBadge({ severity }: { severity: ConflictSeverity }) {
  const label: Record<ConflictSeverity, string> = {
    blocking: 'Blocking',
    review: 'Review',
    informational: 'Info',
    validated: 'Validated',
  };
  return <Badge tone={SEVERITY_TONE[severity]}>{label[severity]}</Badge>;
}

const STATUS_TONE: Record<string, Tone> = {
  approved: 'green',
  validated: 'green',
  completed: 'green',
  resolved: 'green',
  connected: 'green',
  verified: 'green',
  paid: 'green',
  processing: 'blue',
  syncing: 'blue',
  in_progress: 'blue',
  assigned: 'blue',
  needs_review: 'amber',
  pending: 'amber',
  degraded: 'amber',
  under_investigation: 'amber',
  'partially paid': 'amber',
  new: 'amber',
  unassigned: 'neutral',
  failed: 'red',
  rejected: 'red',
  error: 'red',
  escalated: 'red',
  offline: 'neutral',
  false_positive: 'neutral',
};

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  return (
    <Badge tone={STATUS_TONE[key] ?? 'neutral'}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

export function ConfidenceBadge({ value }: { value: number }) {
  const tone: Tone = value >= 88 ? 'green' : value >= 70 ? 'amber' : 'red';
  return (
    <Badge tone={tone}>
      <span className="metric">{value.toFixed(1)}%</span>
    </Badge>
  );
}
