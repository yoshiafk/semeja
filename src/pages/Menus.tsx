import { useState, useEffect, useDeferredValue } from "react";
import { api } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Utensils, Carrot, IceCream, X, Search } from "lucide-react";
import { toast } from "sonner";
import { RecipeCard } from "@/components/RecipeCard";

interface Recipe {
  id: number;
  name: string;
  description: string;
  category: 'Lauk' | 'Sayur' | 'Dessert';
  source_url: string;
  servings: number;
  is_normalized: boolean;
  ingredients: Array<{
    id: number;
    name: string;
    quantity_per_person: number;
    unit: string;
    ingredient_id?: number;
  }>;
}

interface Ingredient {
  id: number;
  name: string;
  unit: string;
  category: string;
}

export default function Menus() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const [isCookpadOpen, setIsCookpadOpen] = useState(false);
  const [cookpadUrl, setCookpadUrl] = useState("");
  const [cookpadCategory, setCookpadCategory] = useState<string>("Lauk");
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [availableIngredients, setAvailableIngredients] = useState<Ingredient[]>([]);
  const [isRescraping, setIsRescraping] = useState<number | null>(null);
  const [isRescrapingAll, setIsRescrapingAll] = useState(false);
  const [normalizeDialogRecipe, setNormalizeDialogRecipe] = useState<Recipe | null>(null);
  const [normalizeServings, setNormalizeServings] = useState<number>(1);

  useEffect(() => {
    fetchRecipes();
    fetchIngredients();
  }, []);

  const fetchIngredients = async () => {
    try {
      const data = await api.get<Ingredient[]>("/ingredients");
      setAvailableIngredients(data);
    } catch (err: any) {
      console.error("Failed to load ingredients: " + err.message);
    }
  };

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const data = await api.get<Recipe[]>("/recipes");
      setRecipes(data);
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCookpadImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookpadUrl) return;
    
    try {
      setIsImporting(true);
      await api.post("/scraper/cookpad", { url: cookpadUrl, category: cookpadCategory });
      setIsCookpadOpen(false);
      setCookpadUrl("");
      fetchRecipes();
      toast.success("Resep berhasil diimport!");
    } catch (err: any) {
      toast.error("Gagal mengimport resep: " + (err.data?.error || err.message));
    } finally {
      setIsImporting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Hapus resep ini? Semua jadwal yang menggunakan menu ini mungkin terpengaruh.")) return;
    try {
      setIsDeleting(id);
      await api.delete(`/recipes/${id}`);
      fetchRecipes();
      toast.success("Resep berhasil dihapus!");
    } catch (err: any) {
      toast.error("Gagal menghapus: " + err.message);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleRescrape = async (recipe: Recipe) => {
    if (!recipe.source_url) {
      toast.error("Resep ini tidak memiliki URL sumber untuk di-scrape ulang");
      return;
    }
    try {
      setIsRescraping(recipe.id);
      const result = await api.put<{ message: string; updated_meals: number }>(`/scraper/rescrape/${recipe.id}`);
      fetchRecipes();
      toast.success(`${result.message}. ${result.updated_meals} jadwal makan diperbarui.`);
    } catch (err: any) {
      toast.error("Gagal re-scrape: " + (err.data?.error || err.message));
    } finally {
      setIsRescraping(null);
    }
  };

  const handleRescrapeAll = async () => {
    const unNormalized = recipes.filter(r => r.source_url && !r.is_normalized);
    if (unNormalized.length === 0) {
      toast.info("Semua resep sudah dinormalisasi");
      return;
    }
    if (!confirm(`Re-scrape ${unNormalized.length} resep yang belum dinormalisasi? Proses ini mungkin memakan waktu.`)) return;
    
    try {
      setIsRescrapingAll(true);
      const result = await api.post<{ message: string; success: Array<{name: string}>; failed: Array<{name: string; error: string}> }>('/scraper/rescrape-all');
      fetchRecipes();
      
      if (result.failed.length > 0) {
        toast.warning(`${result.success.length} berhasil, ${result.failed.length} gagal. Cek console untuk detail.`);
        console.log('Failed recipes:', result.failed);
      } else {
        toast.success(`${result.success.length} resep berhasil di-scrape ulang dan dinormalisasi!`);
      }
    } catch (err: any) {
      toast.error("Gagal re-scrape: " + err.message);
    } finally {
      setIsRescrapingAll(false);
    }
  };

  const handleManualNormalize = async () => {
    if (!normalizeDialogRecipe || normalizeServings < 1) return;
    
    try {
      setIsSavingEdit(true);
      await api.put(`/scraper/normalize/${normalizeDialogRecipe.id}`, { servings: normalizeServings });
      setNormalizeDialogRecipe(null);
      fetchRecipes();
      toast.success(`Resep dinormalisasi dengan membagi semua jumlah bahan dengan ${normalizeServings}`);
    } catch (err: any) {
      toast.error("Gagal normalisasi: " + (err.data?.error || err.message));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecipe) return;

    try {
      setIsSavingEdit(true);
      const isNew = editingRecipe.id === 0;
      
      const payload = {
        name: editingRecipe.name,
        description: editingRecipe.description,
        category: editingRecipe.category,
        ingredients: (editingRecipe.ingredients || []).map(ing => ({
           ingredient_id: ing.ingredient_id || (ing.id > 0 ? ing.id : null),
           quantity_per_person: parseFloat(ing.quantity_per_person.toString())
        })).filter(ing => ing.ingredient_id && ing.quantity_per_person > 0)
      };
      
      if (isNew) {
        await api.post("/recipes", payload);
      } else {
        await api.put(`/recipes/${editingRecipe.id}`, payload);
      }
      
      setEditingRecipe(null);
      fetchRecipes();
      toast.success(isNew ? "Resep berhasil ditambahkan!" : "Resep berhasil diperbarui!");
    } catch (err: any) {
      toast.error("Gagal menyimpan resep: " + (err.data?.error || err.message));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const filteredRecipes = recipes.filter(r => r.name.toLowerCase().includes(deferredSearch.toLowerCase()));
  const laukRecipes = filteredRecipes.filter(r => r.category === 'Lauk' || !r.category);
  const sayurRecipes = filteredRecipes.filter(r => r.category === 'Sayur');
  const dessertRecipes = filteredRecipes.filter(r => r.category === 'Dessert');

  return (
    <PageContainer>
      <div className="flex flex-col gap-5 md:flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Daftar Menu</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Kelola resep masakan dan import dari Cookpad.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button 
               variant="outline" 
               className="h-9 px-4 rounded-xl text-xs font-semibold gap-2 border-border/50 text-muted-foreground hover:text-primary"
               onClick={() => setIsCookpadOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Import Cookpad
            </Button>
            <Button 
               variant="outline" 
               className="h-9 px-4 rounded-xl text-xs font-semibold gap-2 border-border/50 text-muted-foreground hover:text-primary"
               onClick={handleRescrapeAll}
               disabled={isRescrapingAll}
            >
              {isRescrapingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} 
              Re-scrape Semua
            </Button>
            <Button onClick={() => setEditingRecipe({ id: 0, name: "", description: "", category: "Lauk", source_url: "", servings: 1, is_normalized: false, ingredients: [] })} className="h-9 px-5 rounded-xl text-xs font-semibold">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Menu
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
            <Input
              placeholder="Cari menu masakan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-secondary/80 border-border rounded-xl text-sm"
            />
        </div>

        {loading ? (
          <div className="flex h-[40vh] items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="lauk" className="w-full">
            <TabsList className="bg-muted p-1 h-9 rounded-lg mb-5">
              <TabsTrigger value="lauk" className="rounded-md text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 gap-1.5">
                <Utensils className="h-3.5 w-3.5" /> Lauk ({laukRecipes.length})
              </TabsTrigger>
              <TabsTrigger value="sayur" className="rounded-md text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 gap-1.5">
                <Carrot className="h-3.5 w-3.5" /> Sayur ({sayurRecipes.length})
              </TabsTrigger>
              <TabsTrigger value="dessert" className="rounded-md text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 gap-1.5">
                <IceCream className="h-3.5 w-3.5" /> Dessert ({dessertRecipes.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lauk" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {laukRecipes.map(r => (
                  <RecipeCard 
                    key={r.id} 
                    recipe={r} 
                    isRescraping={isRescraping === r.id}
                    isDeleting={isDeleting === r.id}
                    onRescrape={handleRescrape}
                    onNormalize={(rec) => {
                      setNormalizeDialogRecipe(rec);
                      setNormalizeServings(1);
                    }}
                    onEdit={setEditingRecipe}
                    onDelete={handleDelete}
                  />
                ))}
                {laukRecipes.length === 0 && <p className="text-muted-foreground/70 text-sm">Belum ada menu lauk.</p>}
              </div>
            </TabsContent>
            <TabsContent value="sayur" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {sayurRecipes.map(r => (
                  <RecipeCard 
                    key={r.id} 
                    recipe={r} 
                    isRescraping={isRescraping === r.id}
                    isDeleting={isDeleting === r.id}
                    onRescrape={handleRescrape}
                    onNormalize={(rec) => {
                      setNormalizeDialogRecipe(rec);
                      setNormalizeServings(1);
                    }}
                    onEdit={setEditingRecipe}
                    onDelete={handleDelete}
                  />
                ))}
                {sayurRecipes.length === 0 && <p className="text-muted-foreground/70 text-sm">Belum ada menu sayur.</p>}
              </div>
            </TabsContent>
            <TabsContent value="dessert" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {dessertRecipes.map(r => (
                  <RecipeCard 
                    key={r.id} 
                    recipe={r} 
                    isRescraping={isRescraping === r.id}
                    isDeleting={isDeleting === r.id}
                    onRescrape={handleRescrape}
                    onNormalize={(rec) => {
                      setNormalizeDialogRecipe(rec);
                      setNormalizeServings(1);
                    }}
                    onEdit={setEditingRecipe}
                    onDelete={handleDelete}
                  />
                ))}
                {dessertRecipes.length === 0 && <p className="text-muted-foreground/70 text-sm">Belum ada menu dessert.</p>}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Cookpad Import Dialog */}
      <Dialog open={isCookpadOpen} onOpenChange={setIsCookpadOpen}>
        <DialogContent className="w-[95vw] max-w-lg rounded-2xl p-6 border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Import dari Cookpad</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Copy link resep dari Cookpad lalu tentukan jenis hidangannya.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCookpadImport} className="flex flex-col gap-4 pt-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">URL Resep</Label>
              <Input 
                required 
                type="url" 
                placeholder="https://cookpad.com/id/resep/..." 
                value={cookpadUrl} 
                onChange={e => setCookpadUrl(e.target.value)} 
                className="h-10 rounded-xl bg-secondary/80 border-border text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Kategori</Label>
              <Select value={cookpadCategory} onValueChange={setCookpadCategory}>
                <SelectTrigger className="h-10 rounded-xl bg-secondary/80 border-border text-sm">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border">
                  <SelectItem value="Lauk" className="text-sm">Lauk Utama</SelectItem>
                  <SelectItem value="Sayur" className="text-sm">Sayuran</SelectItem>
                  <SelectItem value="Dessert" className="text-sm">Pencuci Mulut / Dessert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-2">
              <Button type="submit" disabled={isImporting} className="w-full h-10 rounded-xl text-sm font-semibold">
                {isImporting ? (
                  <><Loader2 className="mr-1.5 size-4 animate-spin" /> Mengimport...</>
                ) : (
                  "Import Resep"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Recipe Dialog */}
      <Dialog open={!!editingRecipe} onOpenChange={(open) => !open && setEditingRecipe(null)}>
        <DialogContent className="w-[95vw] max-w-2xl rounded-2xl p-6 border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{editingRecipe?.id === 0 ? "Tambah Menu Baru" : "Edit Menu"}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {editingRecipe?.id === 0 ? "Masukkan detail menu dan bahan-bahan." : "Perbarui informasi menu atau daftar bahan."}
            </DialogDescription>
          </DialogHeader>
          {editingRecipe && (
            <form onSubmit={handleSaveRecipe} className="flex flex-col gap-5 pt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Nama Menu</Label>
                  <Input 
                    required 
                    value={editingRecipe.name} 
                    onChange={e => setEditingRecipe({ ...editingRecipe, name: e.target.value })} 
                    className="h-10 rounded-xl bg-secondary/80 border-border text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Kategori</Label>
                  <Select 
                    value={editingRecipe.category} 
                    onValueChange={(val: any) => setEditingRecipe({ ...editingRecipe, category: val })}
                  >
                    <SelectTrigger className="h-10 rounded-xl bg-secondary/80 border-border text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border">
                      <SelectItem value="Lauk" className="text-sm">Lauk Utama</SelectItem>
                      <SelectItem value="Sayur" className="text-sm">Sayuran</SelectItem>
                      <SelectItem value="Dessert" className="text-sm">Pencuci Mulut / Dessert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Deskripsi</Label>
                <Input 
                  placeholder="Keterangan singkat..." 
                  value={editingRecipe.description} 
                  onChange={e => setEditingRecipe({ ...editingRecipe, description: e.target.value })} 
                  className="h-10 rounded-xl bg-secondary/80 border-border text-sm"
                />
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-semibold">Daftar Bahan Makanan</Label>
                  <Button 
                    type="button" variant="outline" size="sm" 
                    className="h-8 rounded-lg text-xs font-medium text-primary border-primary/30 hover:bg-primary/10"
                    onClick={() => setEditingRecipe({
                      ...editingRecipe, 
                      ingredients: [...(editingRecipe.ingredients || []), { id: Date.now() * -1, name: '', quantity_per_person: 1, unit: '' }]
                    })}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Tambah Bahan
                  </Button>
                </div>
                
                <div className="flex flex-col gap-2">
                  {(editingRecipe.ingredients || []).map((ing, idx) => {
                    const isNewIng = ing.id < 0;
                    return (
                      <div key={idx} className="flex items-center gap-2 p-3 bg-secondary/80 rounded-xl border border-border/50">
                        <div className="flex-1">
                          {isNewIng ? (
                            <Select 
                              value={ing.ingredient_id?.toString() || ""}
                              onValueChange={(val) => {
                                const selected = availableIngredients.find(a => a.id.toString() === val);
                                if (selected) {
                                  const newIngs = [...editingRecipe.ingredients];
                                  newIngs[idx] = { ...newIngs[idx], ingredient_id: selected.id, name: selected.name, unit: selected.unit };
                                  setEditingRecipe({ ...editingRecipe, ingredients: newIngs });
                                }
                              }}
                            >
                              <SelectTrigger className="h-9 bg-white rounded-lg text-sm">
                                <SelectValue placeholder="Pilih bahan..." />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-border">
                                {availableIngredients.map(a => (
                                  <SelectItem key={a.id} value={a.id.toString()} className="text-sm">{a.name} ({a.unit})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="text-sm text-foreground/90 pl-2">{ing.name} <span className="text-muted-foreground/70 text-xs">({ing.unit})</span></div>
                          )}
                        </div>
                        <div className="w-[100px]">
                          <Input 
                            type="number" step="0.01" required min="0"
                            value={ing.quantity_per_person}
                            onChange={(e) => {
                              const newIngs = [...editingRecipe.ingredients];
                              newIngs[idx].quantity_per_person = parseFloat(e.target.value) || 0;
                              setEditingRecipe({ ...editingRecipe, ingredients: newIngs });
                            }}
                            className="h-9 bg-white rounded-lg text-sm"
                          />
                        </div>
                        <Button 
                          type="button" variant="ghost" size="icon" 
                          className="size-8 rounded-lg text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            const newIngs = [...editingRecipe.ingredients];
                            newIngs.splice(idx, 1);
                            setEditingRecipe({ ...editingRecipe, ingredients: newIngs });
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                  {(!editingRecipe.ingredients || editingRecipe.ingredients.length === 0) && (
                    <div className="text-center py-6 text-muted-foreground/70 text-sm">
                      Belum ada bahan yang terdaftar.
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="pt-4 border-t border-border/50">
                <Button type="button" variant="ghost" className="text-sm text-muted-foreground" onClick={() => setEditingRecipe(null)}>Batal</Button>
                <Button type="submit" disabled={isSavingEdit} className="h-10 rounded-xl text-sm font-semibold w-full sm:w-auto">
                  {isSavingEdit ? (
                    <><Loader2 className="mr-1.5 size-4 animate-spin" /> Menyimpan...</>
                  ) : editingRecipe.id === 0 ? (
                    "Tambah Menu"
                  ) : (
                    "Simpan Perubahan"
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Manual Normalize Dialog */}
      <Dialog open={!!normalizeDialogRecipe} onOpenChange={(open) => !open && setNormalizeDialogRecipe(null)}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl p-6 border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Normalisasi Resep</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Masukkan jumlah porsi asli resep ini. Semua jumlah bahan akan dibagi dengan angka ini untuk mendapatkan jumlah per 1 porsi.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-3">
            <div className="p-3 bg-warning/10 rounded-xl border border-warning/30">
              <p className="text-sm font-medium text-warning">{normalizeDialogRecipe?.name}</p>
              <p className="text-xs text-warning/80 mt-1">
                {normalizeDialogRecipe?.ingredients?.length || 0} bahan akan dinormalisasi
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Jumlah Porsi Asli</Label>
              <Input 
                type="number" 
                min="1" 
                step="1"
                value={normalizeServings} 
                onChange={e => setNormalizeServings(parseInt(e.target.value) || 1)} 
                className="h-10 rounded-xl bg-secondary/80 border-border text-sm"
                placeholder="Contoh: 4 (jika resep untuk 4 orang)"
              />
              <p className="text-[11px] text-muted-foreground/70">
                Contoh: Jika resep ini awalnya untuk 4 porsi, masukkan 4. Jumlah bahan akan dibagi 4.
              </p>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" className="text-sm text-muted-foreground" onClick={() => setNormalizeDialogRecipe(null)}>Batal</Button>
              <Button 
                onClick={handleManualNormalize} 
                disabled={isSavingEdit || normalizeServings < 1} 
                className="h-10 rounded-xl text-sm font-semibold"
              >
                {isSavingEdit ? (
                  <><Loader2 className="mr-1.5 size-4 animate-spin" /> Menyimpan...</>
                ) : (
                  "Normalisasi"
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
