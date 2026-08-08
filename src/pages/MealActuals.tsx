import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, AlertCircle, ChevronRight, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface PendingMeal {
  id: number;
  date: string;
  day_name: string;
  participant_count: number;
  ingredient_count: number;
  calibrated_count: number;
  calibration_status: "uncalibrated" | "partial" | "done";
}

interface MealIngredient {
  meal_ingredient_id: number;
  ingredient_id: number;
  name: string;
  category: string;
  unit: string;
  estimated_qty: number;
  actual_qty: number | null;
  is_calibrated: boolean;
}

interface ActivePlan {
  id: number;
  week_start: string;
  week_end: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function MealActualsPage() {
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [pendingMeals, setPendingMeals] = useState<PendingMeal[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<PendingMeal | null>(null);
  const [ingredients, setIngredients] = useState<MealIngredient[]>([]);
  const [actuals, setActuals] = useState<Record<number, string>>({}); // ingredient_id → qty string
  const [loading, setLoading] = useState(true);
  const [loadingIngredients, setLoadingIngredients] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load active plan + pending meals
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const plans = await api.get<ActivePlan[]>("/meal-plans/active");
        if (plans.length === 0) { setLoading(false); return; }
        const activePlan = plans[0];
        setPlan(activePlan);

        const pending = await api.get<PendingMeal[]>(
          `/meal-actuals/pending/${activePlan.id}`
        );
        setPendingMeals(pending);
      } catch (err) {
        console.error(err);
        toast.error("Gagal memuat data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Load ingredients when a meal is selected
  useEffect(() => {
    if (!selectedMeal) return;
    const fetchIngredients = async () => {
      try {
        setLoadingIngredients(true);
        const data = await api.get<MealIngredient[]>(
          `/meal-actuals/${selectedMeal.id}`
        );
        setIngredients(data);
        // Pre-fill form: use actual_qty if already calibrated, else estimated
        const initial: Record<number, string> = {};
        data.forEach(ing => {
          initial[ing.ingredient_id] = ing.actual_qty != null
            ? String(ing.actual_qty)
            : String(ing.estimated_qty ?? "");
        });
        setActuals(initial);
      } catch (err) {
        console.error(err);
        toast.error("Gagal memuat bahan");
      } finally {
        setLoadingIngredients(false);
      }
    };
    fetchIngredients();
  }, [selectedMeal]);

  const handleSave = async () => {
    if (!selectedMeal) return;
    const payload = ingredients
      .map(ing => ({
        ingredient_id: ing.ingredient_id,
        actual_qty_per_person: parseFloat(actuals[ing.ingredient_id] || "0"),
      }))
      .filter(e => !isNaN(e.actual_qty_per_person) && e.actual_qty_per_person > 0);

    if (payload.length === 0) {
      toast.error("Masukkan setidaknya satu qty yang valid");
      return;
    }

    try {
      setIsSaving(true);
      await api.post("/meal-actuals", {
        meal_id: selectedMeal.id,
        actuals: payload,
      });
      toast.success("Data aktual berhasil disimpan! Resep akan diperbarui otomatis.");

      // Refresh pending list
      if (plan) {
        const updated = await api.get<PendingMeal[]>(`/meal-actuals/pending/${plan.id}`);
        setPendingMeals(updated);
        // Update selected meal's status in state
        const refreshed = updated.find(m => m.id === selectedMeal.id);
        if (refreshed) setSelectedMeal(refreshed);
      }
    } catch (err) {
      toast.error("Gagal menyimpan: " + err);
    } finally {
      setIsSaving(false);
    }
  };

  const statusBadge = (status: PendingMeal["calibration_status"]) => {
    if (status === "done")
      return (
        <span className="flex items-center gap-1 text-xs font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">
          <CheckCircle2 className="size-3" />
          Selesai
        </span>
      );
    if (status === "partial")
      return (
        <span className="flex items-center gap-1 text-xs font-semibold text-warning-foreground bg-warning/10 px-2 py-0.5 rounded-full">
          <AlertCircle className="size-3" />
          Sebagian
        </span>
      );
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
        <AlertCircle className="size-3" />
        Belum
      </span>
    );
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

  if (!plan) {
    return (
      <PageContainer>
        <div className="text-center py-20 text-muted-foreground">
          <FlaskConical className="size-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Tidak ada meal plan aktif.</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Kalibrasi bahan</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Catat qty aktual yang dipakai setiap hari. Sistem akan otomatis memperbarui
          resep agar estimasi belanja minggu depan lebih akurat.
        </p>
      </div>

      <div className="grid md:grid-cols-[280px_1fr] gap-4">
        {/* Left: list of past meals */}
        <div className="flex flex-col gap-2">
          {pendingMeals.length === 0 && (
            <p className="text-sm text-muted-foreground px-1">
              Belum ada hari yang perlu dikalibrasi.
            </p>
          )}
          {pendingMeals.map(meal => (
            <button
              key={meal.id}
              onClick={() => setSelectedMeal(meal)}
              className={cn(
                "w-full text-left rounded-xl border px-4 py-3 flex items-center justify-between transition-all",
                selectedMeal?.id === meal.id
                  ? "border-primary/30 bg-primary/5 shadow-sm"
                  : "border-border/50 bg-white hover:border-border"
              )}
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {meal.day_name}, {formatDate(meal.date)}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {statusBadge(meal.calibration_status)}
                  <span className="text-xs text-muted-foreground">
                    {meal.calibrated_count}/{meal.ingredient_count} bahan
                  </span>
                </div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        {/* Right: ingredient calibration form */}
        <div>
          {!selectedMeal && (
            <div className="flex flex-col items-center justify-center h-48 rounded-2xl border border-dashed border-border/50 text-muted-foreground">
              <FlaskConical className="size-6 mb-2 opacity-40" />
              <p className="text-sm">Pilih hari dari daftar untuk mulai kalibrasi</p>
            </div>
          )}

          {selectedMeal && (
            <div className="bg-white rounded-2xl border border-border/50 overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-border/30 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">
                    {selectedMeal.day_name}, {formatDate(selectedMeal.date)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedMeal.participant_count} peserta · isi qty aktual per orang
                  </p>
                </div>
                {statusBadge(selectedMeal.calibration_status)}
              </div>

              {/* Body */}
              {loadingIngredients ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {ingredients.length === 0 && (
                    <p className="text-sm text-muted-foreground px-5 py-4">
                      Tidak ada bahan yang dicatat untuk hari ini.
                    </p>
                  )}
                  {ingredients.map(ing => {
                    const actualVal = actuals[ing.ingredient_id] ?? "";
                    const hasChanged =
                      actualVal !== "" &&
                      parseFloat(actualVal) !== ing.estimated_qty;
                    return (
                      <div
                        key={ing.ingredient_id}
                        className="flex items-center gap-3 px-5 py-3"
                      >
                        {/* Ingredient info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {ing.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Estimasi: {ing.estimated_qty} {ing.unit} / orang
                          </p>
                        </div>

                        {/* Actual qty input */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={actualVal}
                            onChange={e =>
                              setActuals(prev => ({
                                ...prev,
                                [ing.ingredient_id]: e.target.value,
                              }))
                            }
                            className={cn(
                              "w-24 text-right h-8 text-sm",
                              hasChanged && "border-warning/30 bg-warning/10 focus:ring-warning/20"
                            )}
                            placeholder="0"
                          />
                          <span className="text-xs text-muted-foreground w-12">
                            {ing.unit}
                          </span>
                          {ing.is_calibrated && (
                            <CheckCircle2 className="size-4 text-success flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer */}
              <div className="px-5 py-4 border-t border-border/30 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Perubahan akan memperbarui rata-rata resep secara otomatis.
                </p>
                <Button
                  onClick={handleSave}
                  disabled={isSaving || loadingIngredients}
                  size="sm"
                >
                  {isSaving && <Loader2 className="size-4 mr-1.5 animate-spin" />}
                  Simpan kalibrasi
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
