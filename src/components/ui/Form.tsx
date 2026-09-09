import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Labelled({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
      {hint && <span className="text-2xs text-muted">{hint}</span>}
    </label>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string; label: string }>;
}

export function Select({ options, className, ...rest }: SelectProps) {
  return (
    <select className={cn('field', className)} {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('field', className)} {...rest} />;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}</span>
        <span className="metric text-[13px] font-semibold text-ink">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        className="w-full accent-teal"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function ProgressBar({
  value,
  tone = 'teal',
  showLabel = true,
  height = 6,
}: {
  value: number;
  tone?: 'teal' | 'green' | 'amber' | 'red' | 'blue';
  showLabel?: boolean;
  height?: number;
}) {
  const colors: Record<string, string> = {
    teal: 'bg-teal',
    green: 'bg-signal-green',
    amber: 'bg-signal-amber',
    red: 'bg-signal-red',
    blue: 'bg-signal-blue',
  };
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 overflow-hidden rounded-full bg-line/40" style={{ height }}>
        <div
          className={cn('h-full rounded-full transition-all', colors[tone])}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          role="progressbar"
          aria-valuenow={Math.round(value)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {showLabel && <span className="metric w-10 text-right text-2xs text-muted">{Math.round(value)}%</span>}
    </div>
  );
}
