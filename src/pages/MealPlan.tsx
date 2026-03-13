import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Archive, Trash2, LayoutGrid } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDate, formatDayName, formatShortDate } from "@/lib/utils";
import { toast } from "sonner";
import { MealCard } from "@/components/MealCard";

interface Recipe {
  id: number;
  name: string;
  category: 'Lauk' | 'Sayur' | 'Dessert';
}

interface MealMenuItem {
  id: number;
  recipe_id: number | null;
  custom_name: string;
  category: 'main' | 'second' | 'dessert';
  sort_order: number;
}

interface Meal {
  id: number;
  date: string;
  day_name: string;
  items: MealMenuItem[];
  requires_rice: boolean;
}

interface MealPlan {
  id: number;
  week_start: string;
  week_end: string;
  status: string;
  meals: Meal[];
}

export default function MealPlanPage() {
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<MealPlan | null>(null);
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newPlanStartDate, setNewPlanStartDate] = useState(() => {
    const today = new Date();
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));
    return nextMonday.toISOString().split('T')[0];
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [plansData, recipesData] = await Promise.all([
        api.get<MealPlan[]>("/meal-plans"),
        api.get<Recipe[]>("/recipes")
      ]);
      setPlans(plansData);
      setRecipes(recipesData);
      
      const active = plansData.find(p => p.status === 'active') || plansData[0] || null;
      setActivePlan(active);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createNewPlan = async () => {
    if (!newPlanStartDate) return;
    try {
      setIsCreatingPlan(true);
      await api.post("/meal-plans", { week_start: newPlanStartDate });
      setIsCreateDialogOpen(false);
      fetchData();
      toast.success("Jadwal pekan baru berhasil dibuat!");
    } catch (err) {
      toast.error("Gagal membuat plan: " + err);
    } finally {
      setIsCreatingPlan(false);
    }
  };

  const updateMeal = async (mealId: number, updates: Partial<Meal>) => {
    if (!activePlan) return;
    
    setIsSaving(prev => {
      const next = { ...prev };
      Object.keys(updates).forEach(k => next[`${mealId}-${k}`] = true);
      return next;
    });
    
    try {
      const meal = activePlan.meals.find(m => m.id === mealId);
      if (!meal) return;

      const updateData = { ...meal, ...updates };
      await api.put(`/meals/${mealId}`, updateData);
      
      setActivePlan(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          meals: prev.meals.map(m => m.id === mealId ? { ...m, ...updates } : m)
        };
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(prev => {
        const next = { ...prev };
        Object.keys(updates).forEach(k => next[`${mealId}-${k}`] = false);
        return next;
      });
    }
  };

  const archivePlan = async () => {
    if (!activePlan) return;
    try {
      setIsUpdatingStatus(true);
      await api.put(`/meal-plans/${activePlan.id}`, { status: 'archived' });
      toast.success("Pekan berhasil diarsipkan!");
      fetchData();
    } catch (err) {
      toast.error("Gagal mengarsipkan: " + err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const deletePlan = async () => {
    if (!activePlan) return;
    try {
      setIsUpdatingStatus(true);
      await api.delete(`/meal-plans/${activePlan.id}`);
      toast.success("Pekan berhasil dihapus!");
      setIsDeleteDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error("Gagal menghapus: " + err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-border/50">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Atur Rencana Makan</h1>
            <p className="text-sm text-muted-foreground/70 mt-0.5">Pilih resep untuk kalkulasi otomatis bahan & biaya.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={activePlan?.id.toString()} onValueChange={(v) => setActivePlan(plans.find(p => p.id.toString() === v) || null)}>
              <SelectTrigger className="h-9 w-[180px] bg-secondary border-border/50 rounded-lg font-medium text-xs shadow-none">
                <SelectValue placeholder="Pilih Pekan" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/50">
                {plans.map(p => (
                  <SelectItem key={p.id} value={p.id.toString()} className="text-sm">
                    {formatDate(p.week_start)} {p.status === 'archived' ? '(Arsip)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
             
            {activePlan && activePlan.status === 'active' && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={archivePlan}
                disabled={isUpdatingStatus}
                className="h-9 px-3 rounded-lg text-xs font-medium border-border/50 text-muted-foreground/70 hover:text-amber-600 hover:bg-amber-50 gap-1.5"
              >
                {isUpdatingStatus ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
                Arsipkan
              </Button>
            )}

            {activePlan && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="h-9 w-9 rounded-lg text-muted-foreground/50 hover:text-rose-500 hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}

            <Button onClick={() => setIsCreateDialogOpen(true)} className="h-9 px-4 rounded-lg text-xs font-semibold shadow-none bg-primary hover:bg-primary/90 gap-1.5 ml-auto">
              <Plus className="h-3.5 w-3.5 stroke-[2.5px]" /> Rencana Baru
            </Button>
          </div>
        </div>

        {activePlan ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activePlan.meals.map((meal) => (
              <MealCard 
                key={meal.id}
                meal={meal}
                dayName={formatDayName(meal.date)}
                formattedDateStr={formatShortDate(meal.date)}
                recipes={recipes}
                isSaving={isSaving}
                onUpdateMeal={updateMeal}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
              <LayoutGrid className="h-6 w-6 text-muted-foreground/70" />
            </div>
            <p className="text-sm text-muted-foreground/70 font-medium">Belum ada perencanaan untuk pekan ini</p>
          </div>
        )}
      </div>
      
      {/* Dialogs... */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl p-6 border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Buat Rencana Baru</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground/70">
              Pilih tanggal mulai untuk jadwal 7 hari ke depan
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tanggal Mulai</label>
              <Input
                type="date"
                value={newPlanStartDate}
                onChange={e => setNewPlanStartDate(e.target.value)}
                className="h-11 bg-secondary border-border rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2 pt-2">
            <Button variant="ghost" className="flex-1 h-11 rounded-xl text-muted-foreground/70" onClick={() => setIsCreateDialogOpen(false)}>
              Batal
            </Button>
            <Button disabled={isCreatingPlan} className="flex-1 h-11 rounded-xl font-semibold shadow-none" onClick={createNewPlan}>
              {isCreatingPlan ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Membuat...</> : "Buat Jadwal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl p-6 border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Hapus Rencana Makan?</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground/70">
              Tindakan ini tidak dapat dibatalkan
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Seluruh data menu dan partisipasi pada pekan ini akan dihapus secara permanen.
          </p>
          <DialogFooter className="flex gap-2 pt-2">
            <Button variant="ghost" className="flex-1 h-11 rounded-xl text-muted-foreground/70" onClick={() => setIsDeleteDialogOpen(false)}>
              Batal
            </Button>
            <Button 
              disabled={isUpdatingStatus} 
              className="flex-1 h-11 rounded-xl font-semibold bg-rose-600 hover:bg-rose-700 shadow-none" 
              onClick={deletePlan}
            >
              {isUpdatingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Ya, Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
