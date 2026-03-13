import React from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { formatRupiah, cn } from "@/lib/utils";

interface Ingredient {
  id: number;
  name: string;
  unit: string;
  price_per_unit: number;
  category: string;
  stock_quantity: number;
  min_stock_threshold: number;
  last_restocked: string | null;
}

interface IngredientCardProps {
  ingredient: Ingredient;
  isDeleting: boolean;
  onEdit: (ingredient: Ingredient) => void;
  onDelete: (id: number) => void;
  onPurchase: (ingredient: Ingredient) => void;
  onHistory: (id: number) => void;
  onConsume: (ingredient: Ingredient) => void;
  isExpanded: boolean;
  purchaseHistory: any[];
  isLoadingHistory: boolean;
}

export const IngredientCard = React.memo(({
  ingredient,
  isDeleting,
  onEdit,
  onDelete,
  onPurchase,
  onHistory,
  onConsume,
  isExpanded,
  purchaseHistory,
  isLoadingHistory
}: IngredientCardProps) => {
  return (
    <div className={cn(
      "rounded-2xl border border-border/50 bg-white hover:border-border transition-all group overflow-hidden",
      isDeleting && "opacity-40 grayscale-[0.5] pointer-events-none scale-[0.98]"
    )}>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-secondary text-muted-foreground font-medium">
            {ingredient.category}
          </span>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button 
              variant="ghost" size="icon" 
              className="h-7 w-7 rounded-lg text-muted-foreground/70 hover:text-primary hover:bg-secondary"
              onClick={() => onEdit(ingredient)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" size="icon" 
              disabled={isDeleting}
              className="h-7 w-7 rounded-lg text-muted-foreground/70 hover:text-red-500 hover:bg-red-50 disabled:opacity-50"
              onClick={() => onDelete(ingredient.id)}
            >
              {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        {/* Name */}
        <h3 className="text-base font-semibold text-foreground leading-tight line-clamp-2">
          {ingredient.name}
        </h3>

        {/* Stats */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground/70 font-medium">Harga</p>
            <p className="text-sm font-semibold text-foreground">
              {formatRupiah(ingredient.price_per_unit)}<span className="text-xs text-muted-foreground/70 font-normal ml-0.5">/{ingredient.unit}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground/70 font-medium">Stok</p>
            <span className={`text-sm font-semibold ${
              ingredient.stock_quantity <= 0 ? "text-rose-600" :
              ingredient.stock_quantity <= ingredient.min_stock_threshold ? "text-amber-600" :
              "text-emerald-600"
            }`}>
              {Number(ingredient.stock_quantity || 0).toFixed(3).replace(/\.?0+$/, '')} {ingredient.unit}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-1">
          <Button 
            variant="secondary" size="sm" 
            className="flex-1 rounded-xl h-8 font-medium text-xs bg-emerald-50 text-emerald-600 hover:bg-emerald-100 shadow-none"
            onClick={() => onPurchase(ingredient)}
          >
            + Beli
          </Button>
          <Button 
            variant="secondary" size="sm" 
            className="flex-1 rounded-xl h-8 font-medium text-xs bg-secondary text-muted-foreground hover:bg-muted shadow-none"
            onClick={() => onHistory(ingredient.id)}
          >
            Riwayat
          </Button>
          <Button 
            variant="secondary" size="icon" 
            className="rounded-xl w-8 h-8 bg-amber-50 text-amber-600 hover:bg-amber-100 shadow-none"
            onClick={() => onConsume(ingredient)}
          >
            <span className="font-bold text-base leading-none">−</span>
          </Button>
        </div>

        {/* Expandable History */}
        {isExpanded && (
          <div className="pt-3 border-t border-border/50">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground">Riwayat Pembelian</p>
              {isLoadingHistory && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/70" />}
            </div>
            
            {purchaseHistory.length === 0 && !isLoadingHistory ? (
              <div className="text-xs text-muted-foreground/70 text-center py-4 bg-secondary rounded-xl">Belum ada riwayat</div>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                {purchaseHistory.map(ph => (
                  <div key={ph.id} className="bg-secondary p-3 rounded-xl flex flex-col gap-1">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-foreground/90 text-xs">{ph.supplier_name || 'Tanpa Supplier'}</span>
                      <span className="text-[10px] text-muted-foreground/70">
                        {new Date(ph.purchased_at).toLocaleDateString('id-ID')}
                      </span>
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="text-xs text-muted-foreground">{ph.quantity} {ingredient.unit}</span>
                      <div className="text-right">
                        <span className="text-xs font-semibold text-emerald-600">{formatRupiah(ph.price_per_unit)}/{ingredient.unit}</span>
                        <span className="block text-[10px] text-muted-foreground/70">Total {formatRupiah(ph.total_price)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

IngredientCard.displayName = "IngredientCard";
