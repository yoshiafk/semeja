import { cn } from '@/lib/utils';

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  draft:    { label: 'Draft',       className: 'bg-muted text-muted-foreground' },
  proposed: { label: 'Diusulkan',   className: 'bg-warning/10 text-warning-foreground' },
  active:   { label: 'Aktif',       className: 'bg-success/10 text-success' },
  shopping: { label: 'Belanja',     className: 'bg-info/10 text-info' },
  closed:   { label: 'Selesai',     className: 'bg-chart-3/10 text-chart-3' },
  archived: { label: 'Diarsipkan',  className: 'bg-muted/50 text-muted-foreground/70' },
};

interface PlanStatusBadgeProps {
  status: string;
  className?: string;
}

export function PlanStatusBadge({ status, className }: PlanStatusBadgeProps) {
  const config = STATUS_STYLE[status] ?? STATUS_STYLE.active;
  return (
    <span
      className={cn(
        'text-[11px] font-semibold px-2.5 py-1 rounded-full',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
