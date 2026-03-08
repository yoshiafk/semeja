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
import { formatDate } from "@/lib/utils";
import { Search, DownloadCloud, Utensils } from "lucide-react";

interface Recipe {
  id: number;
  name: string;
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

  // State for creating a new plan
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newPlanStartDate, setNewPlanStartDate] = useState(() => {
    const today = new Date();
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));
    return nextMonday.toISOString().split('T')[0];
  });

  // State for external recipe search
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState<string | null>(null);

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
      await api.post("/meal-plans", { week_start: newPlanStartDate });
      setIsCreateDialogOpen(false);
      fetchData();
    } catch (err) {
      alert("Gagal membuat plan: " + err);
    }
  };

  const updateMeal = async (mealId: number, field: string, value: any) => {
    if (!activePlan) return;
    const saveKey = `${mealId}-${field}`;
    
    try {
      setIsSaving(prev => ({ ...prev, [saveKey]: true }));
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
    } finally {
      setIsSaving(prev => ({ ...prev, [saveKey]: false }));
    }
  };

  const searchRecipes = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      setIsSearching(true);
      const data = await api.get<any>(`/recipe-search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(data.results || []);
    } catch (err: any) {
      alert("Gagal mencari resep: " + (err.error || err.message));
    } finally {
      setIsSearching(false);
    }
  };

  const importRecipe = async (externalId: string) => {
    try {
      setIsImporting(externalId);
      await api.post("/recipe-search/import", { externalId });
      
      // Refresh local recipes list so it appears in the dropdowns immediately
      const recipesData = await api.get<Recipe[]>("/recipes");
      setRecipes(recipesData);
      
      alert("Resep berhasil diimpor! Silakan pilih dari dropdown menu.");
      setIsSearchDialogOpen(false);
    } catch (err: any) {
      alert("Gagal impor resep: " + (err.error || err.message));
    } finally {
      setIsImporting(null);
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
             <Button onClick={() => setIsSearchDialogOpen(true)} variant="outline" className="h-12 px-6 rounded-2xl font-black uppercase text-xs tracking-widest text-stone-600 border-stone-200 hover:bg-stone-50">
                <Search className="mr-2 h-4 w-4 stroke-[3px]" /> Cari Resep Online
             </Button>
             <Button onClick={() => setIsCreateDialogOpen(true)} className="h-12 px-6 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-primary/20">
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
                  {/* Main Course Section (Lauk) */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-stone-400 tracking-widest leading-none">
                      <Badge variant="outline" className="h-4 bg-orange-50 text-orange-600 border-orange-100 text-[8px] font-black uppercase tracking-tighter">Lauk</Badge>
                      <span>Menu Utama</span>
                    </div>
                    <div className="space-y-3">
                      <Select 
                        disabled={isSaving[`${meal.id}-main_course_recipe_id`]}
                        value={meal.main_course_recipe_id?.toString() || "manual"} 
                        onValueChange={(v) => {
                          const rid = v === "manual" ? null : parseInt(v);
                          updateMeal(meal.id, "main_course_recipe_id", rid);
                          if (rid) {
                            const r = recipes.find(rec => rec.id === rid);
                            if (r) updateMeal(meal.id, "main_course_menu", r.name);
                          }
                        }}
                      >
                        <SelectTrigger className="h-10 bg-stone-50/50 border-stone-200 rounded-xl font-bold text-xs">
                          {isSaving[`${meal.id}-main_course_recipe_id`] ? <Loader2 className="mr-2 h-3 w-3 animate-spin text-stone-400" /> : <ChefHat className="mr-2 h-3 w-3 text-stone-400" />}
                          <SelectValue placeholder="Pilih Resep..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="manual" className="font-medium italic">Input Manual</SelectItem>
                          {recipes.map(r => <SelectItem key={r.id} value={r.id.toString()} className="font-medium">{r.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="relative group/input">
                        <textarea
                          placeholder="Atau ketik menu lauk..."
                          className="w-full text-sm font-bold bg-white border border-stone-200 rounded-xl p-3 h-20 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none shadow-sm"
                          value={meal.main_course_menu}
                          disabled={isSaving[`${meal.id}-main_course_menu`]}
                          onChange={(e) => updateMeal(meal.id, "main_course_menu", e.target.value)}
                        />
                         {isSaving[`${meal.id}-main_course_menu`] && (
                            <div className="absolute top-3 right-3">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            </div>
                         )}
                      </div>
                    </div>
                  </div>

                  {/* Second Course Section (Sayur) */}
                  <div className="space-y-4 pt-4 border-t border-stone-50">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-stone-400 tracking-widest leading-none">
                      <Badge variant="outline" className="h-4 bg-emerald-50 text-emerald-600 border-emerald-100 text-[8px] font-black uppercase tracking-tighter">Sayur</Badge>
                      <span>Menu Sayuran</span>
                    </div>
                    <div className="space-y-3">
                      <Select 
                        disabled={isSaving[`${meal.id}-second_course_recipe_id`]}
                        value={meal.second_course_recipe_id?.toString() || "manual"} 
                        onValueChange={(v) => {
                          const rid = v === "manual" ? null : parseInt(v);
                          updateMeal(meal.id, "second_course_recipe_id", rid);
                          if (rid) {
                            const r = recipes.find(rec => rec.id === rid);
                            if (r) updateMeal(meal.id, "second_course_menu", r.name);
                          }
                        }}
                      >
                        <SelectTrigger className="h-10 bg-stone-50/50 border-stone-200 rounded-xl font-bold text-xs">
                          {isSaving[`${meal.id}-second_course_recipe_id`] ? <Loader2 className="mr-2 h-3 w-3 animate-spin text-stone-400" /> : <ChefHat className="mr-2 h-3 w-3 text-stone-400" />}
                          <SelectValue placeholder="Pilih Resep..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl font-medium">
                          <SelectItem value="manual" className="font-medium italic">Input Manual</SelectItem>
                          {recipes.map(r => <SelectItem key={r.id} value={r.id.toString()} className="font-medium">{r.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="relative group/input">
                        <textarea
                          placeholder="Atau ketik menu sayuran..."
                          className="w-full text-sm font-bold bg-white border border-stone-200 rounded-xl p-3 h-20 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none shadow-sm"
                          value={meal.second_course_menu}
                          disabled={isSaving[`${meal.id}-second_course_menu`]}
                          onChange={(e) => updateMeal(meal.id, "second_course_menu", e.target.value)}
                        />
                         {isSaving[`${meal.id}-second_course_menu`] && (
                            <div className="absolute top-3 right-3">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            </div>
                         )}
                      </div>
                    </div>
                  </div>

                  {/* Dessert Section (Pencuci Mulut) */}
                  <div className="space-y-4 pt-4 border-t border-stone-50">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-stone-400 tracking-widest leading-none">
                      <Badge variant="outline" className="h-4 bg-indigo-50 text-indigo-600 border-indigo-100 text-[8px] font-black uppercase tracking-tighter">Pencuci Mulut</Badge>
                      <span>Menu Penutup / Snack</span>
                    </div>
                    <div className="space-y-3">
                      <Select 
                        disabled={isSaving[`${meal.id}-dessert_recipe_id`]}
                        value={meal.dessert_recipe_id?.toString() || "manual"} 
                        onValueChange={(v) => {
                          const rid = v === "manual" ? null : parseInt(v);
                          updateMeal(meal.id, "dessert_recipe_id", rid);
                          if (rid) {
                            const r = recipes.find(rec => rec.id === rid);
                            if (r) updateMeal(meal.id, "dessert_menu", r.name);
                          }
                        }}
                      >
                        <SelectTrigger className="h-10 bg-stone-50/50 border-stone-200 rounded-xl font-bold text-xs">
                          {isSaving[`${meal.id}-dessert_recipe_id`] ? <Loader2 className="mr-2 h-3 w-3 animate-spin text-stone-400" /> : <ChefHat className="mr-2 h-3 w-3 text-stone-400" />}
                          <SelectValue placeholder="Pilih Resep..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl font-medium">
                          <SelectItem value="manual" className="font-medium italic">Input Manual</SelectItem>
                          {recipes.map(r => <SelectItem key={r.id} value={r.id.toString()} className="font-medium">{r.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="relative group/input">
                        <textarea
                          placeholder="Atau ketik menu pencuci mulut..."
                          className="w-full text-sm font-bold bg-white border border-stone-200 rounded-xl p-3 h-20 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none shadow-sm"
                          value={meal.dessert_menu}
                          disabled={isSaving[`${meal.id}-dessert_menu`]}
                          onChange={(e) => updateMeal(meal.id, "dessert_menu", e.target.value)}
                        />
                         {isSaving[`${meal.id}-dessert_menu`] && (
                            <div className="absolute top-3 right-3">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            </div>
                         )}
                      </div>
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
      
      {/* Create Plan Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-8 border-none overflow-hidden">
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
            <Button className="flex-1 h-12 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-primary/20" onClick={createNewPlan}>
              Buat Jadwal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search external recipe dialog */}
      <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
        <DialogContent className="max-w-2xl rounded-3xl p-8 border-none overflow-hidden max-h-[90vh] flex flex-col">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-500" />
          <DialogHeader className="mb-2 shrink-0">
            <DialogTitle className="text-2xl font-black text-stone-900">Cari Resep Online</DialogTitle>
            <DialogDescription className="font-bold text-stone-400 uppercase text-[10px] tracking-widest">
              Cari & impor resep masakan nusantara beserta takaran bahannya
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 pt-4 min-h-0 relative">
            <form onSubmit={searchRecipes} className="sticky top-0 z-10 bg-white/80 backdrop-blur-md pb-4 pt-1">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
                <Input
                  autoFocus
                  placeholder="Ketik nama masakan (misal: Sate Lilit...)"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-14 pl-12 bg-stone-50 border-stone-200 rounded-2xl font-bold text-lg"
                />
                <Button 
                  type="submit" 
                  disabled={isSearching || !searchQuery.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 h-10 px-4 rounded-xl text-xs font-black uppercase tracking-widest"
                >
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cari'}
                </Button>
              </div>
            </form>

            <div className="space-y-4 pb-4">
              {searchResults.length === 0 && !isSearching && searchQuery.trim() && (
                <div className="text-center py-12 text-stone-400 font-bold uppercase tracking-widest text-xs">
                  Resep tidak ditemukan
                </div>
              )}
              
              {searchResults.length === 0 && !isSearching && !searchQuery && (
                <div className="flex flex-col items-center justify-center py-16 text-stone-300">
                   <Utensils className="h-16 w-16 mb-4" />
                   <p className="font-bold uppercase tracking-widest text-xs text-center">Gunakan menu pencarian di atas untuk<br/>menemukan inspirasi masakan</p>
                </div>
              )}

              {searchResults.map((recipe) => (
                <div key={recipe.key} className="flex gap-4 p-4 rounded-2xl border border-stone-100 bg-white hover:border-blue-200 group transition-colors shadow-sm">
                  {recipe.thumb && (
                    <img src={recipe.thumb} alt={recipe.title} className="w-24 h-24 object-cover rounded-xl shrink-0 bg-stone-100" />
                  )}
                  <div className="flex flex-col flex-1 justify-center gap-2">
                     <h3 className="font-black text-stone-800 leading-tight text-lg line-clamp-2 mix-blend-multiply">{recipe.title}</h3>
                     <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 h-auto bg-stone-50 text-stone-500 border-stone-200 uppercase font-bold tracking-widest">
                          {recipe.serving || "Takaran porsi tidak diketahui"} 
                        </Badge>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 h-auto bg-stone-50 text-stone-500 border-stone-200 uppercase font-bold tracking-widest">
                          {recipe.times || "?"}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 h-auto bg-stone-50 text-stone-500 border-stone-200 uppercase font-bold tracking-widest">
                          {recipe.difficulty || "?"}
                        </Badge>
                     </div>
                  </div>
                  <div className="flex items-center">
                    <Button 
                      onClick={() => importRecipe(recipe.key)} 
                      disabled={isImporting === recipe.key}
                      variant="outline"
                      className="h-12 px-5 rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 font-black uppercase text-[10px] tracking-widest"
                    >
                      {isImporting === recipe.key ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <DownloadCloud className="h-4 w-4 mr-1.5" />
                          Impor
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
