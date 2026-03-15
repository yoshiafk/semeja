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

export function DailyRecapCard({ day, onRecord }: DailyRecapCardProps) {
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
    <div className="rounded-xl border border-border/50 overflow-hidden">
      {/* Day header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">
              {day.day_name.substring(0, 2)}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold">{day.day_name}</p>
            <p className="text-xs text-muted-foreground">
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
            'text-[11px] font-semibold px-2 py-1 rounded-full',
            statusColors[shopping_status]
          )}
        >
          {statusLabels[shopping_status]}
        </span>
      </div>

      {/* Cost comparison */}
      <div className="px-4 pb-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[11px] text-muted-foreground">Estimasi</p>
          <p className="text-sm font-semibold">{formatRupiah(estimatedCost)}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">Aktual</p>
          <p className={cn('text-sm font-semibold', actualCost > 0 ? 'text-foreground' : 'text-muted-foreground')}>
            {actualCost > 0 ? formatRupiah(actualCost) : '—'}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">/orang</p>
          <div className="flex items-center justify-center gap-1">
            <p className="text-sm font-semibold text-primary">{formatRupiah(costPerPerson)}</p>
            {day.uses_actual ? (
              <span className="text-[9px] bg-teal-100 text-teal-700 px-1 py-0.5 rounded font-medium">
                Aktual
              </span>
            ) : (
              <span className="text-[9px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded font-medium">
                Est
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Purchase log */}
      {(day.purchases ?? []).length > 0 && (
        <div className="border-t border-border/30 px-4 py-2 space-y-1">
          {day.purchases.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-xs">
              <span className="text-foreground">{p.ingredient_name}</span>
              <div className="text-right">
                <span className="font-medium">{formatRupiah(p.total_price)}</span>
                {p.supplier_name && (
                  <span className="text-muted-foreground ml-1">· {p.supplier_name}</span>
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
