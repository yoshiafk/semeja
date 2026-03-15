import { cn } from '@/lib/utils';

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  draft:    { label: 'Draft',       className: 'bg-gray-100 text-gray-600' },
  proposed: { label: 'Diusulkan',  className: 'bg-amber-100 text-amber-700' },
  active:   { label: 'Aktif',       className: 'bg-green-100 text-green-700' },
  shopping: { label: 'Belanja',     className: 'bg-blue-100 text-blue-700' },
  closed:   { label: 'Selesai',     className: 'bg-purple-100 text-purple-700' },
  archived: { label: 'Diarsipkan',  className: 'bg-gray-100 text-gray-400' },
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
