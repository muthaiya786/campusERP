import React from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Info,
  XCircle,
} from 'lucide-react';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-5 mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
}

export function KpiMetricCard({
  label,
  value,
  subtext,
  tone = 'neutral',
  onClick,
  actionLabel,
}: {
  label: string;
  value: string | number;
  subtext: string;
  tone?: 'neutral' | 'positive' | 'warning' | 'danger' | 'accent';
  onClick?: () => void;
  actionLabel?: string;
}) {
  const valueTone =
    tone === 'positive'
      ? 'text-emerald-700'
      : tone === 'warning'
      ? 'text-amber-700'
      : tone === 'danger'
      ? 'text-red-700'
      : tone === 'accent'
      ? 'text-blue-700'
      : 'text-slate-900';

  const Container = onClick ? 'button' : 'div';
  return (
    <Container
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full text-left bg-white border border-slate-200 rounded-lg p-5 transition-colors ${
        onClick ? 'hover:border-blue-300 hover:bg-slate-50/60 cursor-pointer group' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {onClick && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 opacity-80 group-hover:opacity-100 whitespace-nowrap shrink-0">
            {actionLabel || 'Inspect'}
            <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
      <div className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums font-display ${valueTone}`}>
        {value}
      </div>
      <div className="mt-1.5 text-xs text-slate-500 tabular-nums">{subtext}</div>
    </Container>
  );
}

export function StatusLabel({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const normalized = status.toUpperCase();
  let Icon = Info;
  let colorClass = 'text-slate-600';

  if (
    [
      'APPROVED',
      'PUBLISHED',
      'VERIFIED',
      'PAID',
      'ACTIVE',
      'OPERATIONAL',
      'COMPLETED',
      'GRADED',
      'PRESENT',
      'NOMINAL',
    ].includes(normalized)
  ) {
    Icon = CheckCircle2;
    colorClass = 'text-emerald-700';
  } else if (
    [
      'SUBMITTED',
      'UNDER_REVIEW',
      'PARTIAL',
      'PENDING',
      'PENDING_APPROVAL',
      'DRAFT',
      'WATCH',
      'MAINTENANCE_DUE',
      'ON_DUTY',
      'REVIEW_DUE',
      'IN_PROGRESS',
    ].includes(normalized)
  ) {
    Icon = Clock;
    colorClass = 'text-amber-700';
  } else if (
    [
      'REJECTED',
      'OVERDUE',
      'ABSENT',
      'HIGH_RISK',
      'OUT_OF_ORDER',
      'NEEDS_REVISION',
      'SUSPENDED',
      'DEACTIVATED',
      'LATE',
    ].includes(normalized)
  ) {
    Icon = normalized === 'HIGH_RISK' || normalized === 'OVERDUE' ? AlertTriangle : XCircle;
    colorClass = 'text-red-700';
  }

  const display = label || status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${colorClass}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{display}</span>
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function FeedbackBanner({
  type,
  message,
  onDismiss,
}: {
  type: 'success' | 'error' | 'info';
  message: string;
  onDismiss?: () => void;
}) {
  const styles =
    type === 'success'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
      : type === 'error'
      ? 'bg-red-50 border-red-200 text-red-900'
      : 'bg-blue-50 border-blue-200 text-blue-900';

  return (
    <div className={`flex items-center justify-between gap-4 border rounded-lg px-4 py-3 text-sm mb-5 ${styles}`}>
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-medium underline underline-offset-2 shrink-0 cursor-pointer"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

export function getInitials(name: string): string {
  const parts = name.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.)\s+/i, '').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
