import { useState, useEffect } from 'react';
import { ShoppingCart, Plus } from 'lucide-react';
import { api, type DailyBuyList } from '@/lib/api';
import { formatRupiah } from '@/lib/utils';
import { formatWhatsAppBuyList } from '@/lib/whatsapp';
import { WhatsAppShareButton } from './WhatsAppShareButton';

interface DailyBriefingCardProps {
  meals: any[];
  onStartLogging?: (mealId: number) => void;
}

export function DailyBriefingCard({ meals, onStartLogging }: DailyBriefingCardProps) {
  const [buyList, setBuyList] = useState<DailyBuyList | null>(null);
  const [loading, setLoading] = useState(false);

  // Find tomorrow's meal, or today's if tomorrow isn't available
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const tomorrowMeal = meals.find((m) => m.date === tomorrowStr);
  const todayMeal = meals.find((m) => m.date === today);
  const targetMeal = tomorrowMeal || todayMeal;

  useEffect(() => {
    if (!targetMeal) return;
    setLoading(true);
    api
      .get<DailyBuyList>(`/meals/${targetMeal.id}/buy-list`)
      .then((data) => setBuyList(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [targetMeal?.id]);

  if (!targetMeal) return null;

  const isTomorrow = targetMeal.date === tomorrowStr;
  const itemsToBuy = buyList?.items.filter((i) => !i.has_enough_stock) ?? [];

  return (
    <div className="rounded-2xl border border-border/50 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 bg-primary/5 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="size-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            {isTomorrow ? 'Belanja besok' : 'Belanja hari ini'}
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              {targetMeal.day_name} · {buyList?.participant_count ?? '…'} orang
            </span>
          </span>
        </div>
        {buyList && (
          <span className="text-xs font-semibold text-primary">
            ~{formatRupiah(buyList.total_estimated_cost)}
          </span>
        )}
      </div>

      {/* Buy list items */}
      {loading ? (
        <div className="p-4 text-center text-sm text-muted-foreground">Memuat…</div>
      ) : itemsToBuy.length === 0 && buyList ? (
        <div className="p-4 text-center text-sm text-muted-foreground">
          Semua stok cukup ✓
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {itemsToBuy.slice(0, 5).map((item) => (
            <div key={item.ingredient_id} className="px-4 py-2.5 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-foreground">{item.name}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {item.shortage_quantity} {item.unit}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-medium text-foreground">
                  {formatRupiah(item.cost_to_buy)}
                </span>
                {item.cheapest_supplier && (
                  <p className="text-[11px] text-muted-foreground">{item.cheapest_supplier}</p>
                )}
              </div>
            </div>
          ))}
          {itemsToBuy.length > 5 && (
            <div className="px-4 py-2 text-xs text-muted-foreground text-center">
              +{itemsToBuy.length - 5} bahan lainnya
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {buyList && (
        <div className="px-4 py-3 border-t border-border/30 flex gap-2">
          <WhatsAppShareButton
            message={formatWhatsAppBuyList(buyList)}
            label="Share ke WA"
            className="flex-1 justify-center"
          />
          <button
            onClick={() => onStartLogging?.(targetMeal.id)}
            className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Catat Belanja
          </button>
        </div>
      )}
    </div>
  );
}
