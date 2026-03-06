import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Calendar, ChefHat, LayoutGrid } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Recipe {
  id: number;
  name: string;
}

interface Meal {
  id: number;
  date: string;
  day_name: string;
  lunch_menu: string;
  lunch_recipe_id: number | null;
  dinner_menu: string;
  dinner_recipe_id: number | null;
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
    try {
      const today = new Date();
      const nextMonday = new Date(today);
      nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));
      
      const week_start = nextMonday.toISOString().split('T')[0];
      await api.post("/meal-plans", { week_start });
      fetchData();
    } catch (err) {
      alert("Gagal membuat plan: " + err);
    }
  };

  const updateMeal = async (mealId: number, field: string, value: any) => {
    if (!activePlan) return;
    try {
      const meal = activePlan.meals.find(m => m.id === mealId);
      if (!meal) return;

      const updateData = { ...meal, [field]: value };
      await api.put(`/meals/${mealId}`, updateData);
      
      setActivePlan({
        ...activePlan,
        meals: activePlan.meals.map(m => m.id === mealId ? { ...m, [field]: value } : m)
      });
    } catch (err) {
      console.error(err);
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
                <SelectTrigger className="h-12 w-[240px] bg-stone-50 border-stone-100 rounded-2xl font-bold">
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
             <Button onClick={createNewPlan} className="h-12 px-6 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-primary/20">
                <Plus className="mr-2 h-4 w-4 stroke-[3px]" /> Buat Pekan Baru
             </Button>
          </div>
        </div>

        {activePlan ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {activePlan.meals.map((meal) => (
              <Card key={meal.id} className="border-stone-200 hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5 rounded-3xl overflow-hidden group">
                <CardHeader className="bg-stone-50/50 pb-4 group-hover:bg-primary/5 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                       <CardTitle className="text-xl font-black text-stone-900">{meal.day_name}</CardTitle>
                       <CardDescription className="font-bold text-primary/60">{new Date(meal.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</CardDescription>
                    </div>
                    <Calendar className="h-5 w-5 text-stone-200 group-hover:text-primary transition-colors" />
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-8">
                  {/* Lunch Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-stone-400 tracking-widest leading-none">
                      <Badge variant="outline" className="h-4 bg-orange-50 text-orange-600 border-orange-100 text-[8px] font-black uppercase tracking-tighter">Siang</Badge>
                      <span>Menu Makan Siang</span>
                    </div>
                    <div className="space-y-3">
                      <Select 
                        value={meal.lunch_recipe_id?.toString() || "manual"} 
                        onValueChange={(v) => {
                          const rid = v === "manual" ? null : parseInt(v);
                          updateMeal(meal.id, "lunch_recipe_id", rid);
                          if (rid) {
                            const r = recipes.find(rec => rec.id === rid);
                            if (r) updateMeal(meal.id, "lunch_menu", r.name);
                          }
                        }}
                      >
                        <SelectTrigger className="h-10 bg-stone-50/50 border-stone-200 rounded-xl font-bold text-xs">
                          <ChefHat className="mr-2 h-3 w-3 text-stone-400" />
                          <SelectValue placeholder="Pilih Resep..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="manual" className="font-medium italic">Input Manual</SelectItem>
                          {recipes.map(r => <SelectItem key={r.id} value={r.id.toString()} className="font-medium">{r.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="relative group/input">
                        <textarea
                          placeholder="Atau ketik menu khusus..."
                          className="w-full text-sm font-bold bg-white border border-stone-200 rounded-xl p-3 h-20 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none shadow-sm"
                          value={meal.lunch_menu}
                          onChange={(e) => updateMeal(meal.id, "lunch_menu", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Dinner Section */}
                  <div className="space-y-4 pt-4 border-t border-stone-50">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-stone-400 tracking-widest leading-none">
                      <Badge variant="outline" className="h-4 bg-indigo-50 text-indigo-600 border-indigo-100 text-[8px] font-black uppercase tracking-tighter">Malam</Badge>
                      <span>Menu Makan Malam</span>
                    </div>
                    <div className="space-y-3">
                      <Select 
                        value={meal.dinner_recipe_id?.toString() || "manual"} 
                        onValueChange={(v) => {
                          const rid = v === "manual" ? null : parseInt(v);
                          updateMeal(meal.id, "dinner_recipe_id", rid);
                          if (rid) {
                            const r = recipes.find(rec => rec.id === rid);
                            if (r) updateMeal(meal.id, "dinner_menu", r.name);
                          }
                        }}
                      >
                        <SelectTrigger className="h-10 bg-stone-50/50 border-stone-200 rounded-xl font-bold text-xs">
                          <ChefHat className="mr-2 h-3 w-3 text-stone-400" />
                          <SelectValue placeholder="Pilih Resep..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl font-medium">
                          <SelectItem value="manual" className="font-medium italic">Input Manual</SelectItem>
                          {recipes.map(r => <SelectItem key={r.id} value={r.id.toString()} className="font-medium">{r.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <textarea
                        placeholder="Atau ketik menu khusus..."
                        className="w-full text-sm font-bold bg-white border border-stone-200 rounded-xl p-3 h-20 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none shadow-sm"
                        value={meal.dinner_menu}
                        onChange={(e) => updateMeal(meal.id, "dinner_menu", e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <LayoutGrid className="h-16 w-16 text-stone-200" />
            <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Belum ada perencanaan pekan ini</p>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
