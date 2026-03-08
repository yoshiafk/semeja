import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Calendar, ChefHat, LayoutGrid } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDate, cn, formatDayName, formatShortDate } from "@/lib/utils";
import { toast } from "sonner";

interface Recipe {
  id: number;
  name: string;
  category: 'Lauk' | 'Sayur' | 'Dessert';
}

interface Meal {
  id: number;
  date: string;
  day_name: string;
  main_course_menu: string;
  main_course_recipe_id: number | null;
  second_course_menu: string;
  second_course_recipe_id: number | null;
  dessert_menu: string;
  dessert_recipe_id: number | null;
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

  // State for creating a new plan
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
      
      const active = plansData.find(p => p.status === 'active') || plansData[0];
      if (active) setActivePlan(active);
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

  if (loading) {
    return (
      <PageContainer>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-stone-100 pb-8">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight text-stone-900">Atur Jadwal Makan</h1>
            <p className="text-stone-500 font-medium">Klik menu untuk memperbarui atau pilih resep untuk kalkulasi otomatis.</p>
          </div>
           <div className="flex items-center gap-3">
             <Select value={activePlan?.id.toString()} onValueChange={(v) => setActivePlan(plans.find(p => p.id.toString() === v) || null)}>
                <SelectTrigger className="h-10 w-[200px] bg-stone-50 border-stone-100 rounded-full font-bold shadow-none text-xs">
                  <SelectValue placeholder="Pilih Pekan" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-stone-200">
                  {plans.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()} className="font-medium">
                      {formatDate(p.week_start)}
                    </SelectItem>
                  ))}
                </SelectContent>
             </Select>
             <Button onClick={() => setIsCreateDialogOpen(true)} className="h-10 px-6 rounded-full font-black uppercase text-[10px] tracking-widest shadow-none bg-emerald-600 hover:bg-emerald-700">
                <Plus className="mr-2 h-3.5 w-3.5 stroke-[3px]" /> Buat Pekan Baru
             </Button>
          </div>
        </div>

        {activePlan ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {activePlan.meals.map((meal) => {
               const dayName = formatDayName(meal.date);
               const formattedDateStr = formatShortDate(meal.date);

               return (
                <Card key={meal.id} className="border-stone-100 shadow-sm hover:shadow-md transition-shadow rounded-3xl overflow-hidden group bg-white">
                  <CardHeader className="pb-2 pt-6 px-6">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-0.5">
                         <CardTitle className="text-[22px] font-black tracking-tight text-stone-900">{dayName}</CardTitle>
                         <CardDescription className="text-sm font-bold text-emerald-500">{formattedDateStr}</CardDescription>
                      </div>
                      <Calendar className="h-5 w-5 text-stone-200" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-8">
                    {/* Main Course Section (Lauk) */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest leading-none">
                        <Badge variant="secondary" className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-black uppercase tracking-widest shadow-none hover:bg-orange-50 cursor-default">
                           Lauk
                        </Badge>
                        <span className="font-black text-stone-400">Menu Utama</span>
                      </div>
                      <div>
                        <Select 
                          disabled={isSaving[`${meal.id}-main_course_recipe_id`]}
                          value={meal.main_course_recipe_id?.toString() || "placeholder"} 
                          onValueChange={(v) => {
                            const rid = v === "placeholder" ? null : parseInt(v);
                            if (rid) {
                              const r = recipes.find(rec => rec.id === rid);
                              updateMeal(meal.id, { 
                                  main_course_recipe_id: rid, 
                                  ...(r ? { main_course_menu: r.name } : {}) 
                              });
                            } else {
                              updateMeal(meal.id, { main_course_recipe_id: null, main_course_menu: "" });
                            }
                          }}
                        >
                          <SelectTrigger className="h-11 w-full sm:w-[85%] bg-white border-stone-200 rounded-full font-bold text-sm shadow-sm hover:bg-stone-50 transition-colors">
                            <div className="flex items-center truncate">
                               {isSaving[`${meal.id}-main_course_recipe_id`] ? <Loader2 className="mr-2.5 h-4 w-4 animate-spin text-stone-400 shrink-0" /> : <ChefHat className="mr-2.5 h-4 w-4 text-stone-400 shrink-0" />}
                               <SelectValue placeholder="Pilih Menu..." />
                            </div>
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-stone-100 p-1">
                            <SelectItem value="placeholder" className="font-medium italic text-stone-400">Pilih Menu...</SelectItem>
                            {recipes.filter(r => r.category === 'Lauk' || !r.category).map(r => <SelectItem key={r.id} value={r.id.toString()} className="font-black text-stone-700 py-2.5">{r.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
  
                    {/* Second Course Section (Sayur) */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest leading-none">
                        <Badge variant="secondary" className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-black uppercase tracking-widest shadow-none hover:bg-emerald-50 cursor-default">
                           Sayur
                        </Badge>
                        <span className="font-black text-stone-400">Menu Sayuran</span>
                      </div>
                      <div>
                        <Select 
                          disabled={isSaving[`${meal.id}-second_course_recipe_id`]}
                          value={meal.second_course_recipe_id?.toString() || "placeholder"} 
                          onValueChange={(v) => {
                            const rid = v === "placeholder" ? null : parseInt(v);
                            if (rid) {
                              const r = recipes.find(rec => rec.id === rid);
                              updateMeal(meal.id, { 
                                  second_course_recipe_id: rid, 
                                  ...(r ? { second_course_menu: r.name } : {}) 
                              });
                            } else {
                              updateMeal(meal.id, { second_course_recipe_id: null, second_course_menu: "" });
                            }
                          }}
                        >
                          <SelectTrigger className="h-11 w-full sm:w-[85%] bg-white border-stone-200 rounded-full font-bold text-sm shadow-sm hover:bg-stone-50 transition-colors">
                            <div className="flex items-center truncate">
                               {isSaving[`${meal.id}-second_course_recipe_id`] ? <Loader2 className="mr-2.5 h-4 w-4 animate-spin text-stone-400 shrink-0" /> : <ChefHat className="mr-2.5 h-4 w-4 text-stone-400 shrink-0" />}
                               <SelectValue placeholder="Pilih Menu..." />
                            </div>
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-stone-100 p-1 font-medium">
                            <SelectItem value="placeholder" className="font-medium italic text-stone-400">Pilih Menu...</SelectItem>
                            {recipes.filter(r => r.category === 'Sayur').map(r => <SelectItem key={r.id} value={r.id.toString()} className="font-black text-stone-700 py-2.5">{r.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
  
                    {/* Dessert Section (Pencuci Mulut) */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest leading-none">
                        <Badge variant="secondary" className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500 font-black uppercase tracking-widest shadow-none hover:bg-indigo-50 cursor-default">
                           Pencuci Mulut
                        </Badge>
                        <span className="font-black text-stone-400">Menu Penutup / Snack</span>
                      </div>
                      <div>
                        <Select 
                          disabled={isSaving[`${meal.id}-dessert_recipe_id`]}
                          value={meal.dessert_recipe_id?.toString() || "placeholder"} 
                          onValueChange={(v) => {
                            const rid = v === "placeholder" ? null : parseInt(v);
                            if (rid) {
                              const r = recipes.find(rec => rec.id === rid);
                              updateMeal(meal.id, { 
                                  dessert_recipe_id: rid, 
                                  ...(r ? { dessert_menu: r.name } : {}) 
                              });
                            } else {
                              updateMeal(meal.id, { dessert_recipe_id: null, dessert_menu: "" });
                            }
                          }}
                        >
                          <SelectTrigger className="h-11 w-full sm:w-[85%] bg-white border-stone-200 rounded-full font-bold text-sm shadow-sm hover:bg-stone-50 transition-colors">
                            <div className="flex items-center truncate">
                               {isSaving[`${meal.id}-dessert_recipe_id`] ? <Loader2 className="mr-2.5 h-4 w-4 animate-spin text-stone-400 shrink-0" /> : <ChefHat className="mr-2.5 h-4 w-4 text-stone-400 shrink-0" />}
                               <SelectValue placeholder="Pilih Menu..." />
                            </div>
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-stone-100 p-1 font-medium">
                            <SelectItem value="placeholder" className="font-medium italic text-stone-400">Pilih Menu...</SelectItem>
                            {recipes.filter(r => r.category === 'Dessert').map(r => <SelectItem key={r.id} value={r.id.toString()} className="font-black text-stone-700 py-2.5">{r.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Rice Toggle Section */}
                    <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
                       <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest leading-none mb-1">Kebutuhan Pokok</span>
                          <span className="text-sm font-bold text-stone-900">Sajikan Nasi Putih?</span>
                       </div>
                        <Button
                         size="sm"
                         variant={meal.requires_rice ? "default" : "outline"}
                         className={cn(
                           "h-9 px-4 rounded-xl font-bold transition-all",
                           meal.requires_rice 
                             ? "bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200 text-white" 
                             : "hover:bg-primary/5 hover:text-primary border-stone-200 text-stone-500"
                         )}
                         disabled={isSaving[`${meal.id}-requires_rice`]}
                         onClick={() => updateMeal(meal.id, { requires_rice: !meal.requires_rice })}
                       >
                         {isSaving[`${meal.id}-requires_rice`] ? (
                           <Loader2 className="h-4 w-4 animate-spin text-stone-400 shrink-0" />
                         ) : (
                           <span className="flex items-center gap-1.5">
                             {meal.requires_rice ? "Ya, Sajikan" : "Tidak"}
                           </span>
                         )}
                       </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <LayoutGrid className="h-16 w-16 text-stone-200" />
            <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Belum ada perencanaan pekan ini</p>
          </div>
        )}
      </div>
      
      {/* Create Plan Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md rounded-3xl p-6 sm:p-8 border-none overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-primary" />
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black text-stone-900">Buat Pekan Baru</DialogTitle>
            <DialogDescription className="font-bold text-stone-400 uppercase text-[10px] tracking-widest">
              Pilih tanggal mulai untuk jadwal 7 hari ke depan
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Tanggal Mulai</label>
              <Input
                type="date"
                value={newPlanStartDate}
                onChange={e => setNewPlanStartDate(e.target.value)}
                className="h-12 bg-stone-50 border-stone-200 rounded-2xl font-bold"
              />
            </div>
          </div>
          <DialogFooter className="mt-8 flex gap-3">
            <Button variant="ghost" className="flex-1 h-12 rounded-2xl font-bold text-stone-400 hover:bg-stone-50" onClick={() => setIsCreateDialogOpen(false)}>
              Batal
            </Button>
            <Button disabled={isCreatingPlan} className="flex-1 h-12 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-primary/20" onClick={createNewPlan}>
              {isCreatingPlan ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Merekap...</> : "Buat Jadwal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </PageContainer>
  );
}
