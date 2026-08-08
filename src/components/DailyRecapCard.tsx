import { cn } from '@/lib/utils';
import { formatRupiah } from '@/lib/utils';
import { formatDailyRecap } from '@/lib/whatsapp';
import { WhatsAppShareButton } from './WhatsAppShareButton';
import { type DailyBreakdown } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ScanLine, ShoppingCart } from 'lucide-react';

interface DailyRecapCardProps {
  day: DailyBreakdown;
  /** When provided, shows a "Catat Belanja" button pre-tagged to this meal */
  onRecord?: (mealId: number) => void;
  onEdit?: (purchase: any) => void;
  onDelete?: (id: number) => void;
  isAdmin?: boolean;
}

const statusColors = {
  pending: 'text-muted-foreground bg-muted',
  partial: 'text-amber-700 bg-amber-50',
  done: 'text-teal-700 bg-teal-50',
};

const statusLabels = {
  pending: 'Belum belanja',
  partial: 'Sebagian',
  done: 'Selesai',
};

export function DailyRecapCard({ day, onRecord, onEdit, onDelete, isAdmin }: DailyRecapCardProps) {
  const shopping_status = day.shopping_status ?? 'pending';
  const costPerPerson = day.cost_per_person ?? 0;
  const actualCost = day.actual_cost ?? 0;
  const estimatedCost = day.estimated_cost ?? day.total_cost ?? 0;

  const waMessage = formatDailyRecap({
    day_name: day.day_name,
    date: day.date,
    participant_count: day.participant_count,
    purchases: day.purchases ?? [],
    actual_cost: actualCost,
    estimated_cost: estimatedCost,
  });

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden bg-white">
      {/* Day header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <span className="text-xs font-bold">
              {day.day_name.substring(0, 2)}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold">{day.day_name}</p>
            <p className="text-[11px] text-muted-foreground">
              {new Date(day.date).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
              })}
              {' · '}
              {day.participant_count} orang
            </p>
          </div>
        </div>
        <span
          className={cn(
            'text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-tight',
            statusColors[shopping_status]
          )}
        >
          {statusLabels[shopping_status]}
        </span>
      </div>

      {/* Cost comparison */}
      <div className="px-4 pb-3 grid grid-cols-3 gap-2 text-center border-b border-border/20">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Estimasi</p>
          <p className="text-sm font-bold">{formatRupiah(estimatedCost)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Aktual</p>
          <p className={cn('text-sm font-bold', actualCost > 0 ? 'text-primary' : 'text-muted-foreground/40')}>
            {actualCost > 0 ? formatRupiah(actualCost) : 'Rp 0'}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">/orang</p>
          <div className="flex items-center justify-center gap-1">
            <p className="text-sm font-bold text-emerald-600">{formatRupiah(costPerPerson)}</p>
            {day.uses_actual && (
              <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded font-bold uppercase">
                Aktual
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Purchase log */}
      {(day.purchases ?? []).length > 0 && (
        <div className="px-4 py-3 flex flex-col gap-2.5">
          {day.purchases.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 group">
              <span className="text-xs text-foreground/80 font-medium truncate">{p.ingredient_name}</span>
              <div className="flex items-center gap-2 ml-auto shrink-0">
                <div className="text-right">
                  <span className="text-xs font-bold text-foreground">{formatRupiah(p.total_price)}</span>
                  {p.supplier_name && (
                    <span className="text-[10px] text-muted-foreground/60 uppercase font-medium ml-1.5 shrink-0">· {p.supplier_name}</span>
                  )}
                </div>
                
                {isAdmin && (onEdit || onDelete) && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5"
                        onClick={() => onEdit(p)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                        onClick={() => onDelete(p.id)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action footer */}
      <div className="border-t border-border/30 px-3 py-2 flex items-center gap-2">
        {/* OCR record button — visible when onRecord is provided */}
        {onRecord && day.meal_id && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 px-3 text-xs font-medium rounded-lg gap-1.5 flex-1',
              shopping_status === 'done'
                ? 'text-teal-700 hover:bg-teal-50'
                : 'text-primary hover:bg-primary/5'
            )}
            onClick={() => onRecord(day.meal_id!)}
          >
            <ScanLine className="h-3.5 w-3.5" />
            {shopping_status === 'done' ? 'Tambah / Koreksi' : 'Catat Belanja'}
          </Button>
        )}

        {/* Share recap — only when there are actuals */}
        {actualCost > 0 && (
          <WhatsAppShareButton
            message={waMessage}
            label="Share rekap"
            className={cn('h-8 px-3 text-xs', onRecord && day.meal_id ? '' : 'flex-1 justify-center')}
          />
        )}

        {/* Placeholder when no record handler and no actuals */}
        {!onRecord && actualCost === 0 && (
          <div className="flex-1 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/50 py-1">
            <ShoppingCart className="h-3.5 w-3.5" />
            Belum ada catatan belanja
          </div>
        )}
      </div>
    </div>
  );
}
