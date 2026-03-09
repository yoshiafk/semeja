import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Link2, Plus, Edit2, Trash2, Search, Utensils, Carrot, IceCream, X } from "lucide-react";
import { toast } from "sonner";

interface Recipe {
  id: number;
  name: string;
  description: string;
  category: 'Lauk' | 'Sayur' | 'Dessert';
  source_url: string;
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

  const [isCookpadOpen, setIsCookpadOpen] = useState(false);
  const [cookpadUrl, setCookpadUrl] = useState("");
  const [cookpadCategory, setCookpadCategory] = useState<string>("Lauk");
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [availableIngredients, setAvailableIngredients] = useState<Ingredient[]>([]);

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

  const filteredRecipes = recipes.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
  const laukRecipes = filteredRecipes.filter(r => r.category === 'Lauk' || !r.category);
  const sayurRecipes = filteredRecipes.filter(r => r.category === 'Sayur');
  const dessertRecipes = filteredRecipes.filter(r => r.category === 'Dessert');

  const RecipeCard = ({ recipe }: { recipe: Recipe }) => (
    <div className="rounded-2xl border border-stone-100 bg-white hover:border-stone-200 transition-all p-4 group">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-stone-900 leading-tight mb-1 line-clamp-2">{recipe.name}</h3>
          {recipe.source_url ? (
            <a href={recipe.source_url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-500 hover:text-blue-700 flex items-center gap-1">
              <Link2 className="h-3 w-3" /> Cookpad
            </a>
          ) : (
            <p className="text-[11px] text-stone-400">Manual Entry</p>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button 
            variant="ghost" size="icon" 
            className="h-7 w-7 rounded-lg text-stone-400 hover:text-amber-600 hover:bg-amber-50" 
            onClick={() => setEditingRecipe(recipe)}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button 
            variant="ghost" size="icon" 
            disabled={isDeleting === recipe.id}
            className="h-7 w-7 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50" 
            onClick={() => handleDelete(recipe.id)}
          >
            {isDeleting === recipe.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </Button>
        </div>
      </div>
      
      <div className="pt-3 border-t border-stone-50">
        <p className="text-[11px] text-stone-400 mb-1.5">{recipe.ingredients?.length || 0} bahan</p>
        <div className="flex flex-wrap gap-1">
          {recipe.ingredients?.slice(0, 5).map(ing => (
            <span key={ing.id} className="text-[10px] bg-stone-50 px-1.5 py-0.5 rounded-md text-stone-500">
              {ing.name} ({ing.quantity_per_person} {ing.unit})
            </span>
          ))}
          {(recipe.ingredients?.length || 0) > 5 && (
            <span className="text-[10px] bg-stone-50 px-1.5 py-0.5 rounded-md text-stone-400">
              +{recipe.ingredients.length - 5} lagi
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <PageContainer>
      <div className="space-y-5 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-stone-900 tracking-tight">Menu Makanan</h1>
            <p className="text-sm text-stone-500 mt-0.5">Kelola daftar menu dan resep, atau import dari Cookpad.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <Input 
                placeholder="Cari menu..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 w-full md:w-[200px] rounded-xl bg-stone-50/80 border-stone-200 text-sm"
              />
            </div>
            <Button onClick={() => setIsCookpadOpen(true)} className="h-9 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700">
              <Link2 className="mr-1.5 h-3.5 w-3.5" /> Cookpad
            </Button>
            <Button 
              onClick={() => setEditingRecipe({ id: 0, name: "", description: "", category: "Lauk", source_url: "", ingredients: [] })} 
              variant="default" 
              className="h-9 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 border-none"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Manual
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex h-[40vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="lauk" className="w-full">
            <TabsList className="bg-stone-100 p-1 h-9 rounded-lg mb-5">
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
                {laukRecipes.map(r => <RecipeCard key={r.id} recipe={r} />)}
                {laukRecipes.length === 0 && <p className="text-stone-400 text-sm">Belum ada menu lauk.</p>}
              </div>
            </TabsContent>
            <TabsContent value="sayur" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {sayurRecipes.map(r => <RecipeCard key={r.id} recipe={r} />)}
                {sayurRecipes.length === 0 && <p className="text-stone-400 text-sm">Belum ada menu sayur.</p>}
              </div>
            </TabsContent>
            <TabsContent value="dessert" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {dessertRecipes.map(r => <RecipeCard key={r.id} recipe={r} />)}
                {dessertRecipes.length === 0 && <p className="text-stone-400 text-sm">Belum ada menu dessert.</p>}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Cookpad Import Dialog */}
      <Dialog open={isCookpadOpen} onOpenChange={setIsCookpadOpen}>
        <DialogContent className="w-[95vw] max-w-lg rounded-2xl p-6 border-stone-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Import dari Cookpad</DialogTitle>
            <DialogDescription className="text-sm text-stone-500">
              Copy link resep dari Cookpad lalu tentukan jenis hidangannya.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCookpadImport} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-stone-600">URL Resep</Label>
              <Input 
                required 
                type="url" 
                placeholder="https://cookpad.com/id/resep/..." 
                value={cookpadUrl} 
                onChange={e => setCookpadUrl(e.target.value)} 
                className="h-10 rounded-xl bg-stone-50/80 border-stone-200 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-stone-600">Kategori</Label>
              <Select value={cookpadCategory} onValueChange={setCookpadCategory}>
                <SelectTrigger className="h-10 rounded-xl bg-stone-50/80 border-stone-200 text-sm">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-stone-200">
                  <SelectItem value="Lauk" className="text-sm">Lauk Utama</SelectItem>
                  <SelectItem value="Sayur" className="text-sm">Sayuran</SelectItem>
                  <SelectItem value="Dessert" className="text-sm">Pencuci Mulut / Dessert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-2">
              <Button type="submit" disabled={isImporting} className="w-full h-10 rounded-xl text-sm font-semibold">
                {isImporting ? (
                  <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Mengimport...</>
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
        <DialogContent className="w-[95vw] max-w-2xl rounded-2xl p-6 border-stone-200 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{editingRecipe?.id === 0 ? "Tambah Menu Baru" : "Edit Menu"}</DialogTitle>
            <DialogDescription className="text-sm text-stone-500">
              {editingRecipe?.id === 0 ? "Masukkan detail menu dan bahan-bahan." : "Perbarui informasi menu atau daftar bahan."}
            </DialogDescription>
          </DialogHeader>
          {editingRecipe && (
            <form onSubmit={handleSaveRecipe} className="space-y-5 pt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Nama Menu</Label>
                  <Input 
                    required 
                    value={editingRecipe.name} 
                    onChange={e => setEditingRecipe({ ...editingRecipe, name: e.target.value })} 
                    className="h-10 rounded-xl bg-stone-50/80 border-stone-200 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Kategori</Label>
                  <Select 
                    value={editingRecipe.category} 
                    onValueChange={(val: any) => setEditingRecipe({ ...editingRecipe, category: val })}
                  >
                    <SelectTrigger className="h-10 rounded-xl bg-stone-50/80 border-stone-200 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-stone-200">
                      <SelectItem value="Lauk" className="text-sm">Lauk Utama</SelectItem>
                      <SelectItem value="Sayur" className="text-sm">Sayuran</SelectItem>
                      <SelectItem value="Dessert" className="text-sm">Pencuci Mulut / Dessert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-stone-600">Deskripsi</Label>
                <Input 
                  placeholder="Keterangan singkat..." 
                  value={editingRecipe.description} 
                  onChange={e => setEditingRecipe({ ...editingRecipe, description: e.target.value })} 
                  className="h-10 rounded-xl bg-stone-50/80 border-stone-200 text-sm"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-semibold">Daftar Bahan Makanan</Label>
                  <Button 
                    type="button" variant="outline" size="sm" 
                    className="h-8 rounded-lg text-xs font-medium text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => setEditingRecipe({
                      ...editingRecipe, 
                      ingredients: [...(editingRecipe.ingredients || []), { id: Date.now() * -1, name: '', quantity_per_person: 1, unit: '' }]
                    })}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Tambah Bahan
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {(editingRecipe.ingredients || []).map((ing, idx) => {
                    const isNew = ing.id < 0;
                    return (
                      <div key={idx} className="flex items-center gap-2 p-3 bg-stone-50/80 rounded-xl border border-stone-100">
                        <div className="flex-1">
                          {isNew ? (
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
                              <SelectContent className="rounded-xl border-stone-200">
                                {availableIngredients.map(a => (
                                  <SelectItem key={a.id} value={a.id.toString()} className="text-sm">{a.name} ({a.unit})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="text-sm text-stone-700 pl-2">{ing.name} <span className="text-stone-400 text-xs">({ing.unit})</span></div>
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
                          className="h-8 w-8 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50"
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
                    <div className="text-center py-6 text-stone-400 text-sm">
                      Belum ada bahan yang terdaftar.
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="pt-4 border-t border-stone-100">
                <Button type="button" variant="ghost" className="text-sm text-stone-500" onClick={() => setEditingRecipe(null)}>Batal</Button>
                <Button type="submit" disabled={isSavingEdit} className="h-10 rounded-xl text-sm font-semibold w-full sm:w-auto">
                  {isSavingEdit ? (
                    <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Menyimpan...</>
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
    </PageContainer>
  );
}
