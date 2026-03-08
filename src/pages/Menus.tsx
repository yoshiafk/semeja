import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Link2, Plus, Edit2, Trash2, Search, Utensils, Carrot, IceCream, X } from "lucide-react";

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
    ingredient_id?: number; // Added to map back to ingredients table
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

  // Edit State
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
      alert("Error: " + err.message);
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
      alert("Resep berhasil diimport!");
    } catch (err: any) {
      alert("Gagal mengimport resep: " + (err.data?.error || err.message));
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
    } catch (err: any) {
      alert("Gagal menghapus: " + err.message);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecipe) return;

    try {
      setIsSavingEdit(true);
      // Map frontend ingredients to expected backend structure
      const payload = {
        name: editingRecipe.name,
        category: editingRecipe.category,
        ingredients: editingRecipe.ingredients.map(ing => ({
           ingredient_id: ing.ingredient_id || ing.id, // Fallback to id if it's already an active ingredient record
           quantity_per_person: parseFloat(ing.quantity_per_person.toString())
        }))
      };
      
      await api.put(`/recipes/${editingRecipe.id}`, payload);
      setEditingRecipe(null);
      fetchRecipes();
      alert("Resep berhasil diperbarui!");
    } catch (err: any) {
      alert("Gagal memperbarui resep: " + (err.data?.error || err.message));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const filteredRecipes = recipes.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
  const laukRecipes = filteredRecipes.filter(r => r.category === 'Lauk' || !r.category);
  const sayurRecipes = filteredRecipes.filter(r => r.category === 'Sayur');
  const dessertRecipes = filteredRecipes.filter(r => r.category === 'Dessert');

  const RecipeCard = ({ recipe }: { recipe: Recipe }) => (
    <Card className="hover:shadow-md transition-shadow border-stone-200">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-black text-lg text-stone-900 leading-tight mb-1">{recipe.name}</h3>
            {recipe.source_url && (
              <a href={recipe.source_url} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-500 hover:text-blue-700 flex items-center gap-1 uppercase tracking-wider">
                <Link2 className="h-3 w-3" /> Cookpad Source
              </a>
            )}
            {!recipe.source_url && <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Manual Entry</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-50 border-amber-200" 
                onClick={() => setEditingRecipe(recipe)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              disabled={isDeleting === recipe.id}
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200" 
              onClick={() => handleDelete(recipe.id)}
            >
              {isDeleting === recipe.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-stone-100">
          <p className="text-[10px] uppercase font-black tracking-widest text-stone-400 mb-2">
            {recipe.ingredients?.length || 0} Ingredients
          </p>
          <div className="flex flex-wrap gap-1">
            {recipe.ingredients?.slice(0, 5).map(ing => (
              <span key={ing.id} className="text-[10px] bg-stone-100/80 px-2 py-1 rounded-sm text-stone-600 font-medium">
                {ing.name} ({ing.quantity_per_person} {ing.unit})
              </span>
            ))}
            {(recipe.ingredients?.length || 0) > 5 && (
              <span className="text-[10px] bg-stone-100/80 px-2 py-1 rounded-sm text-stone-400 font-bold">
                +{recipe.ingredients.length - 5} more
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <PageContainer>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-stone-900 tracking-tight">Menu Makanan</h1>
          <p className="text-sm text-stone-500 font-medium mt-1">Kelola daftar menu dan resep, atau import langsung dari Cookpad.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input 
              placeholder="Cari menu..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full md:w-[250px] shadow-sm"
            />
          </div>
          <Button onClick={() => setIsCookpadOpen(true)} className="shadow-sm font-bold tracking-wide">
            <Link2 className="mr-2 h-4 w-4" /> Import Cookpad
          </Button>
          <Button variant="outline" className="shadow-sm font-bold tracking-wide">
            <Plus className="mr-2 h-4 w-4" /> Manual
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-[40vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="lauk" className="w-full">
          <TabsList className="bg-stone-100 p-1 h-14 mb-8">
            <TabsTrigger value="lauk" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm px-6">
              <Utensils className="h-4 w-4 mr-2" /> Lauk Utama ({laukRecipes.length})
            </TabsTrigger>
            <TabsTrigger value="sayur" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm px-6">
              <Carrot className="h-4 w-4 mr-2" /> Sayuran ({sayurRecipes.length})
            </TabsTrigger>
            <TabsTrigger value="dessert" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm px-6">
              <IceCream className="h-4 w-4 mr-2" /> Pencuci Mulut ({dessertRecipes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lauk" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {laukRecipes.map(r => <RecipeCard key={r.id} recipe={r} />)}
              {laukRecipes.length === 0 && <p className="text-stone-400 italic">Belum ada menu lauk.</p>}
            </div>
          </TabsContent>
          <TabsContent value="sayur" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {sayurRecipes.map(r => <RecipeCard key={r.id} recipe={r} />)}
              {sayurRecipes.length === 0 && <p className="text-stone-400 italic">Belum ada menu sayur.</p>}
            </div>
          </TabsContent>
          <TabsContent value="dessert" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {dessertRecipes.map(r => <RecipeCard key={r.id} recipe={r} />)}
              {dessertRecipes.length === 0 && <p className="text-stone-400 italic">Belum ada menu pencuci mulut.</p>}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Cookpad Import Dialog */}
      <Dialog open={isCookpadOpen} onOpenChange={setIsCookpadOpen}>
        <DialogContent className="w-[95vw] max-w-lg rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle>Import dari Cookpad</DialogTitle>
            <DialogDescription>
              Copy link resep dari Cookpad (contoh: https://cookpad.com/id/resep/...) lalu tentukan jenis hidangannya.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCookpadImport} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>URL Resep Cookpad</Label>
              <Input 
                required 
                type="url" 
                placeholder="https://cookpad.com/id/resep/..." 
                value={cookpadUrl} 
                onChange={e => setCookpadUrl(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Kategori Hidangan</Label>
              <Select value={cookpadCategory} onValueChange={setCookpadCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lauk">Lauk Utama</SelectItem>
                  <SelectItem value="Sayur">Sayuran</SelectItem>
                  <SelectItem value="Dessert">Pencuci Mulut / Dessert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={isImporting} className="w-full">
                {isImporting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sedang Mengimport...</>
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
        <DialogContent className="w-[95vw] max-w-2xl rounded-3xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Menu Menu</DialogTitle>
          </DialogHeader>
          {editingRecipe && (
            <form onSubmit={handleSaveEdit} className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nama Menu</Label>
                  <Input 
                    required 
                    value={editingRecipe.name} 
                    onChange={e => setEditingRecipe({ ...editingRecipe, name: e.target.value })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Select 
                    value={editingRecipe.category} 
                    onValueChange={(val: any) => setEditingRecipe({ ...editingRecipe, category: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Lauk">Lauk Utama</SelectItem>
                      <SelectItem value="Sayur">Sayuran</SelectItem>
                      <SelectItem value="Dessert">Pencuci Mulut / Dessert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                   <Label className="text-base font-bold">Daftar Bahan Makanan</Label>
                   <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="h-8 font-bold text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={() => setEditingRecipe({
                          ...editingRecipe, 
                          ingredients: [...(editingRecipe.ingredients || []), { id: Date.now() * -1, name: '', quantity_per_person: 1, unit: '' }]
                      })}
                   >
                     <Plus className="h-4 w-4 mr-1" /> Tambah Bahan
                   </Button>
                </div>
                
                <div className="space-y-3">
                  {(editingRecipe.ingredients || []).map((ing, idx) => {
                    const isNew = ing.id < 0; // Negative ID means it's a new row added by the user in this session
                    return (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100">
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
                                <SelectTrigger className="h-9 bg-white">
                                  <SelectValue placeholder="Pilih bahan baku..." />
                                </SelectTrigger>
                                <SelectContent>
                                   {availableIngredients.map(a => (
                                     <SelectItem key={a.id} value={a.id.toString()}>{a.name} ({a.unit})</SelectItem>
                                   ))}
                                </SelectContent>
                             </Select>
                          ) : (
                             <div className="font-bold text-stone-700 text-sm pl-2">{ing.name} <span className="text-stone-400 font-normal ml-1">({ing.unit})</span></div>
                          )}
                        </div>
                        <div className="w-[120px]">
                           <Input 
                             type="number" 
                             step="0.01" 
                             required
                             min="0"
                             value={ing.quantity_per_person}
                             onChange={(e) => {
                               const newIngs = [...editingRecipe.ingredients];
                               newIngs[idx].quantity_per_person = parseFloat(e.target.value) || 0;
                               setEditingRecipe({ ...editingRecipe, ingredients: newIngs });
                             }}
                             className="h-9 bg-white"
                           />
                        </div>
                        <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-stone-400 hover:text-red-500 hover:bg-red-50"
                            onClick={() => {
                               const newIngs = [...editingRecipe.ingredients];
                               newIngs.splice(idx, 1);
                               setEditingRecipe({ ...editingRecipe, ingredients: newIngs });
                            }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                  {(!editingRecipe.ingredients || editingRecipe.ingredients.length === 0) && (
                     <div className="text-center py-6 text-stone-400 text-sm font-medium italic">
                        Belum ada bahan makanan yang terdaftar.
                     </div>
                  )}
                </div>
              </div>

              <DialogFooter className="pt-6 mt-6 border-t border-stone-100">
                <Button type="button" variant="ghost" onClick={() => setEditingRecipe(null)}>Batal</Button>
                <Button type="submit" disabled={isSavingEdit} className="w-full sm:w-auto">
                  {isSavingEdit ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : "Simpan Perubahan"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
