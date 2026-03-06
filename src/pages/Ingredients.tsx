import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Search, Filter, Pencil, Trash2, Carrot, ChefHat } from "lucide-react";
import { formatRupiah } from "@/lib/utils";

interface Ingredient {
  id: number;
  name: string;
  unit: string;
  price_per_unit: number;
  category: string;
}

const CATEGORIES = ["Segala", "Pokok", "Protein", "Sayuran", "Bumbu", "Buah", "Lainnya"];

export default function Ingredients() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Segala");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentIng, setCurrentIng] = useState<Partial<Ingredient>>({
    name: "",
    unit: "kg",
    price_per_unit: 0,
    category: "Lainnya"
  });

  useEffect(() => {
    fetchIngredients();
  }, []);

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      const data = await api.get<Ingredient[]>("/ingredients");
      setIngredients(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveIngredient = async () => {
    if (!currentIng.name || !currentIng.unit || (currentIng.price_per_unit ?? 0) < 0) return;
    try {
      if (currentIng.id) {
        await api.put(`/ingredients/${currentIng.id}`, currentIng);
      } else {
        await api.post("/ingredients", currentIng);
      }
      setIsDialogOpen(false);
      fetchIngredients();
    } catch (err) {
      alert("Gagal menyimpan: " + err);
    }
  };

  const deleteIngredient = async (id: number) => {
    if (!confirm("Hapus bahan ini?")) return;
    try {
      await api.delete(`/ingredients/${id}`);
      fetchIngredients();
    } catch (err) {
      alert("Gagal menghapus: " + err);
    }
  };

  const filtered = ingredients.filter(ing => {
    const matchesSearch = ing.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = category === "Segala" || ing.category === category;
    return matchesSearch && matchesCat;
  });

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
            <h1 className="text-3xl font-black tracking-tight text-stone-900">Inventory Bahan</h1>
            <p className="text-stone-500 font-medium">Atur daftar bahan makanan dan update harga pasar terbaru.</p>
          </div>
          <Button onClick={() => {
            setCurrentIng({ name: "", unit: "kg", price_per_unit: 0, category: "Lainnya" });
            setIsDialogOpen(true);
          }} className="h-12 px-8 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-primary/20">
            <Plus className="mr-2 h-4 w-4 stroke-[3px]" /> Tambah Bahan
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-stone-50 p-6 rounded-3xl border border-stone-100 shadow-sm">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input
              placeholder="Cari nama bahan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-12 bg-white border-stone-200 rounded-2xl focus:ring-primary focus:border-primary"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 z-10" />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="pl-11 h-12 bg-white border-stone-200 rounded-2xl font-bold text-stone-700">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-stone-200">
                {CATEGORIES.map(c => (
                  <SelectItem key={c} value={c} className="font-medium">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Card className="border-stone-200 bg-white grid place-items-center h-12 rounded-2xl">
             <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest leading-none">
              <span className="text-primary text-sm mr-1.5">{filtered.length}</span> Item
             </span>
          </Card>
        </div>

        {/* Grid List */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <Carrot className="h-16 w-16 text-stone-200" />
            <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Bahan tidak ditemukan</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(ing => (
              <Card key={ing.id} className="border-stone-200 hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5 group rounded-2xl overflow-hidden bg-white">
                <CardContent className="p-0">
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                       <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 w-fit bg-stone-50 text-stone-500 border-stone-200 uppercase font-black tracking-widest">
                            {ing.category}
                          </Badge>
                          <h3 className="text-lg font-black text-stone-900 group-hover:text-primary transition-colors">{ing.name}</h3>
                       </div>
                       <ChefHat className="h-4 w-4 text-stone-100 group-hover:text-primary/20 transition-colors" />
                    </div>

                    <div className="space-y-4">
                       <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest leading-none mb-1">Harga per {ing.unit}</span>
                          <span className="text-xl font-black text-emerald-600 tracking-tight">{formatRupiah(ing.price_per_unit)}</span>
                       </div>

                       <div className="flex items-center gap-2 pt-4 border-t border-stone-50">
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="flex-1 rounded-xl h-10 font-bold text-xs bg-stone-100 hover:bg-primary/10 hover:text-primary transition-all gap-2"
                            onClick={() => {
                              setCurrentIng(ing);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="rounded-xl w-10 h-10 bg-stone-100 hover:bg-rose-50 hover:text-rose-600 transition-all p-0"
                            onClick={() => deleteIngredient(ing.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                       </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-8 border-none overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-primary" />
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black text-stone-900">{currentIng.id ? "Edit Bahan" : "Tambah Bahan"}</DialogTitle>
            <DialogDescription className="font-bold text-stone-400 uppercase text-[10px] tracking-widest">Update informasi harga dan unit bahan makanan</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Nama Bahan</label>
              <Input
                placeholder="Contoh: Ayam Broiler"
                value={currentIng.name}
                onChange={e => setCurrentIng({ ...currentIng, name: e.target.value })}
                className="h-12 bg-stone-50 border-stone-200 rounded-2xl font-bold"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Satuan (Unit)</label>
                <Input
                  placeholder="kg, pcs, ikat..."
                  value={currentIng.unit}
                  onChange={e => setCurrentIng({ ...currentIng, unit: e.target.value })}
                  className="h-12 bg-stone-50 border-stone-200 rounded-2xl font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Kategori</label>
                <Select 
                  value={currentIng.category} 
                  onValueChange={v => setCurrentIng({ ...currentIng, category: v })}
                >
                  <SelectTrigger className="h-12 bg-stone-50 border-stone-200 rounded-2xl font-bold">
                    <SelectValue placeholder="Kategori" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-stone-200">
                    {CATEGORIES.slice(1).map(c => (
                      <SelectItem key={c} value={c} className="font-medium">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Harga per Unit (IDR)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-black text-sm">Rp</span>
                <Input
                  type="number"
                  placeholder="0"
                  value={currentIng.price_per_unit}
                  onChange={e => setCurrentIng({ ...currentIng, price_per_unit: parseInt(e.target.value) || 0 })}
                  className="h-12 pl-12 bg-stone-50 border-stone-200 rounded-2xl font-black text-emerald-600 text-lg"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-8 flex gap-3">
            <Button variant="ghost" className="flex-1 h-12 rounded-2xl font-bold text-stone-400 hover:bg-stone-50" onClick={() => setIsDialogOpen(false)}>
              Batal
            </Button>
            <Button className="flex-1 h-12 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-primary/20" onClick={saveIngredient}>
              Simpan Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
