import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, ScanEye, ShoppingCart, RotateCcw,
  ChevronDown, ChevronUp, TrendingUp, PackageCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface IngredientSummary {
  ingredient_id: number;
  name: string;
  category: string;
  unit: string;
  price_per_unit: number;
  stock_quantity: number;
  total_qty: number;
  total_cost: number;
  shortage: number;
  cost_to_buy: number;
  has_override: boolean;
  override_reason: string | null;
  has_enough_stock: boolean;
}

interface PreviewData {
  ingredient_summary: IngredientSummary[];
  total_estimated_cost: number;
  total_cost_to_buy: number;
}

interface ActivePlan {
  id: number;
  week_start: string;
  week_end: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function groupByCategory(items: IngredientSummary[]) {
  return items.reduce<Record<string, IngredientSummary[]>>((acc, item) => {
    const cat = item.category || "Lainnya";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});
}

// ── Component ──────────────────────────────────────────────────────────────

export default function MealPreviewPage() {
  const [plan, setPlan]           = useState<ActivePlan | null>(null);
  const [data, setData]           = useState<PreviewData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [isSaving, setIsSaving]   = useState(false);

  // Local overrides: ingredient_id → qty string (what's in the input right now)
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async (planId: number) => {
    try {
      setLoading(true);
      const preview = await api.get<PreviewData>(`/meal-preview/${planId}`);
      setData(preview);

      // Seed overrides from existing saved values
      const initial: Record<number, string> = {};
      preview.ingredient_summary.forEach(ing => {
        if (ing.has_override) {
          // will be populated from the override_qty if we expose it — for now seed as total_qty / ...
          // We rely on the user reviewing and changing; pre-fill with total_qty displayed
        }
        initial[ing.ingredient_id] = "";
      });
      setOverrides(initial);

      // Expand all categories by default
      const cats = groupByCategory(preview.ingredient_summary);
      const defaultExpanded: Record<string, boolean> = {};
      Object.keys(cats).forEach(c => { defaultExpanded[c] = true; });
      setExpandedCats(defaultExpanded);
    } catch (err) {
      toast.error("Gagal memuat preview");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const plans = await api.get<ActivePlan[]>("/meal-plans/active");
        if (plans.length === 0) { setLoading(false); return; }
        setPlan(plans[0]);
        await fetchData(plans[0].id);
      } catch {
        setLoading(false);
      }
    };
    init();
  }, [fetchData]);

  const handleOverrideChange = (ingredientId: number, value: string) => {
    setOverrides(prev => ({ ...prev, [ingredientId]: value }));
  };

  const handleReset = (ingredientId: number) => {
    setOverrides(prev => ({ ...prev, [ingredientId]: "" }));
  };

  const handleSave = async () => {
    if (!plan) return;

    // Collect only entries where admin actually typed something
    const payload = Object.entries(overrides)
      .filter(([, v]) => v !== "" && !isNaN(parseFloat(v)) && parseFloat(v) >= 0)
      .map(([id, v]) => ({
        ingredient_id: parseInt(id),
        override_qty_per_person: parseFloat(v),
      }));

    if (payload.length === 0) {
      toast.error("Belum ada perubahan qty yang dimasukkan");
      return;
    }

    try {
      setIsSaving(true);
      await api.post(`/meal-preview/${plan.id}/overrides`, { overrides: payload });
      toast.success(`${payload.length} override berhasil disimpan! Shopping list diperbarui.`);
      await fetchData(plan.id);
    } catch (err) {
      toast.error("Gagal menyimpan: " + err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteOverride = async (ingredientId: number) => {
    if (!plan) return;
    try {
      await api.delete(`/meal-preview/${plan.id}/overrides/${ingredientId}`);
      toast.success("Override dihapus, kembali ke qty resep.");
      await fetchData(plan.id);
    } catch {
      toast.error("Gagal menghapus override");
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageContainer>
        <div className="flex justify-center items-center h-40">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  if (!plan || !data) {
    return (
      <PageContainer>
        <div className="text-center py-20 text-muted-foreground">
          <ScanEye className="size-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Tidak ada meal plan aktif.</p>
        </div>
      </PageContainer>
    );
  }

  const grouped = groupByCategory(data.ingredient_summary);
  const dirtyCount = Object.values(overrides).filter(v => v !== "").length;

  return (
    <PageContainer>
      {/* Page header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Review belanja minggu ini</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sesuaikan qty per orang sebelum belanja. Perubahan hanya berlaku untuk minggu ini
            — resep dasar tidak berubah.
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving || dirtyCount === 0} size="sm" className="flex-shrink-0">
          {isSaving
            ? <Loader2 className="size-4 mr-1.5 animate-spin" />
            : <ShoppingCart className="size-4 mr-1.5" />}
          Simpan {dirtyCount > 0 ? `(${dirtyCount})` : ""}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-muted/50 rounded-xl p-4">
          <p className="text-[11px] uppercase font-semibold tracking-wider text-muted-foreground mb-1">
            Total estimasi
          </p>
          <p className="text-lg font-semibold text-foreground">
            {formatCurrency(data.total_estimated_cost)}
          </p>
        </div>
        <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
          <p className="text-[11px] uppercase font-semibold tracking-wider text-primary/70 mb-1">
            Perlu dibeli
          </p>
          <p className="text-lg font-semibold text-primary">
            {formatCurrency(data.total_cost_to_buy)}
          </p>
        </div>
      </div>

      {/* Ingredient table by category */}
      <div className="flex flex-col gap-3">
        {Object.entries(grouped).map(([category, items]) => {
          const isExpanded = expandedCats[category] !== false;
          const overrideCount = items.filter(i => i.has_override).length;

          return (
            <div key={category} className="bg-white border border-border/50 rounded-2xl overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => setExpandedCats(prev => ({ ...prev, [category]: !isExpanded }))}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{category}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {items.length} bahan
                  </span>
                  {overrideCount > 0 && (
                    <span className="text-xs text-warning bg-warning/10 px-2 py-0.5 rounded-full font-medium">
                      {overrideCount} diubah
                    </span>
                  )}
                </div>
                {isExpanded
                  ? <ChevronUp className="size-4 text-muted-foreground" />
                  : <ChevronDown className="size-4 text-muted-foreground" />}
              </button>

              {/* Ingredient rows */}
              {isExpanded && (
                <div className="divide-y divide-border/30">
                  {/* Column labels */}
                  <div className="grid grid-cols-[1fr_80px_80px_90px_40px] gap-2 px-4 py-2 bg-muted/20">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">Bahan</span>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide text-right">Perlu</span>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide text-right">Stok</span>
                    <span className="text-[10px] uppercase font-semibold text-warning tracking-wide text-center">Override qty/org</span>
                    <span />
                  </div>

                  {items.map(ing => {
                    const localVal = overrides[ing.ingredient_id] ?? "";
                    const isDirty  = localVal !== "";
                    const hasOverride = ing.has_override;

                    return (
                      <div
                        key={ing.ingredient_id}
                        className={cn(
                          "grid grid-cols-[1fr_80px_80px_90px_40px] gap-2 items-center px-4 py-2.5",
                          hasOverride && "bg-warning/10",
                          ing.has_enough_stock && "opacity-60"
                        )}
                      >
                        {/* Name + badges */}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{ing.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {ing.has_enough_stock && (
                              <span className="flex items-center gap-0.5 text-[10px] text-success font-medium">
                                <PackageCheck className="size-3" />
                                Cukup stok
                              </span>
                            )}
                            {hasOverride && (
                              <span className="flex items-center gap-0.5 text-[10px] text-warning font-medium">
                                <TrendingUp className="size-3" />
                                Override aktif
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Need */}
                        <p className="text-sm text-right text-foreground tabular-nums">
                          {ing.shortage.toFixed(2)}<span className="text-muted-foreground text-[11px] ml-0.5">{ing.unit}</span>
                        </p>

                        {/* Stock */}
                        <p className="text-sm text-right tabular-nums text-muted-foreground">
                          {ing.stock_quantity.toFixed(2)}<span className="text-[11px] ml-0.5">{ing.unit}</span>
                        </p>

                        {/* Override input */}
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={localVal}
                          onChange={e => handleOverrideChange(ing.ingredient_id, e.target.value)}
                          placeholder={hasOverride ? "disimpan" : "qty/org"}
                          className={cn(
                            "h-7 text-xs text-right px-2",
                            isDirty && "border-warning/30 bg-warning/10 ring-warning/20",
                            hasOverride && !isDirty && "border-warning/30"
                          )}
                        />

                        {/* Reset button */}
                        <button
                          onClick={() =>
                            hasOverride
                              ? handleDeleteOverride(ing.ingredient_id)
                              : handleReset(ing.ingredient_id)
                          }
                          disabled={!isDirty && !hasOverride}
                          className={cn(
                            "flex items-center justify-center size-7 rounded-lg transition-colors",
                            (isDirty || hasOverride)
                              ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              : "text-transparent pointer-events-none"
                          )}
                          title={hasOverride ? "Hapus override" : "Reset"}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sticky save bar on mobile */}
      {dirtyCount > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-40 lg:hidden">
          <Button onClick={handleSave} disabled={isSaving} className="w-full shadow-xl">
            {isSaving
              ? <Loader2 className="size-4 mr-1.5 animate-spin" />
              : <ShoppingCart className="size-4 mr-1.5" />}
            Simpan {dirtyCount} perubahan
          </Button>
        </div>
      )}
    </PageContainer>
  );
}
