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
  stock_quantity: number;
  min_stock_threshold: number;
  last_restocked: string | null;
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
    category: "Lainnya",
    stock_quantity: 0,
    min_stock_threshold: 0
  });

  // State for Purchase Dialog
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [purchaseData, setPurchaseData] = useState({
    ingredient_id: 0,
    supplier_name: "",
    quantity: 0,
    total_price: 0,
    purchased_at: new Date().toISOString().split('T')[0],
    notes: "",
    update_stock: true
  });
  const [suppliers, setSuppliers] = useState<{id: number, name: string}[]>([]);

  // State for Stock Adjustment Dialog
  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
  const [stockAdjustment, setStockAdjustment] = useState({
    ingredient_id: 0,
    adjustment: 0,
    type: "restock" as "restock" | "consume"
  });

  // State for expanding purchase history
  const [expandedIngredientId, setExpandedIngredientId] = useState<number | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchIngredients();
  }, []);

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      const [ingRes, supRes] = await Promise.all([
        api.get<Ingredient[]>("/ingredients"),
        api.get<{id: number, name: string}[]>("/suppliers")
      ]);
      setIngredients(ingRes);
      setSuppliers(supRes);
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

  const savePurchase = async () => {
    if (!purchaseData.ingredient_id || !purchaseData.supplier_name || purchaseData.quantity <= 0 || purchaseData.total_price <= 0) return;
    try {
      await api.post("/purchases", purchaseData);
      setIsPurchaseDialogOpen(false);
      fetchIngredients(); // Refresh to get updated stock
      if (expandedIngredientId === purchaseData.ingredient_id) {
        fetchHistory(purchaseData.ingredient_id);
      }
    } catch (err) {
      alert("Gagal mencatat pembelian: " + err);
    }
  };

  const saveStockAdjustment = async () => {
    if (!stockAdjustment.ingredient_id || stockAdjustment.adjustment <= 0) return;
    try {
      await api.put(`/ingredients/${stockAdjustment.ingredient_id}/stock`, {
        adjustment: stockAdjustment.adjustment,
        type: stockAdjustment.type
      });
      setIsStockDialogOpen(false);
      fetchIngredients();
    } catch (err) {
      alert("Gagal menyesuaikan stok: " + err);
    }
  };

  const fetchHistory = async (ingredientId: number) => {
    if (expandedIngredientId === ingredientId) {
      setExpandedIngredientId(null);
      return;
    }
    try {
      setLoadingHistory(true);
      setExpandedIngredientId(ingredientId);
      const [history] = await Promise.all([
        api.get<any[]>(`/purchases/ingredient/${ingredientId}`)
      ]);
      
      // We can attach the compare result to the first item for easy rendering, 
      // or just store it in a separate state if needed.
      // For simplicity, we just store history. 
      // Compare needs to be visually indicated if we want.
      setPurchaseHistory(history);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const getStockBadgeColor = (stock: number, threshold: number) => {
    if (stock <= 0) return "bg-rose-100 text-rose-700 border-rose-200";
    if (stock <= threshold) return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
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
                          <h3 className="text-lg font-black text-stone-900 group-hover:text-primary transition-colors line-clamp-1">{ing.name}</h3>
                       </div>
                       <ChefHat className="h-4 w-4 shrink-0 text-stone-100 group-hover:text-primary/20 transition-colors" />
                    </div>

                    <div className="space-y-4">
                       <div className="flex items-end justify-between">
                         <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest leading-none mb-1">Harga Estimasi</span>
                            <span className="text-xl font-black text-stone-700 tracking-tight">{formatRupiah(ing.price_per_unit)}<span className="text-sm text-stone-400 font-medium">/{ing.unit}</span></span>
                         </div>
                         <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest leading-none mb-1">Sisa Stok</span>
                            <Badge variant="outline" className={`font-black text-sm tracking-tight border ${getStockBadgeColor(ing.stock_quantity, ing.min_stock_threshold)}`}>
                              {ing.stock_quantity} {ing.unit}
                            </Badge>
                         </div>
                       </div>

                       <div className="flex items-center gap-2 pt-4 border-t border-stone-50">
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="flex-1 rounded-xl h-10 font-bold text-xs bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all"
                            onClick={() => {
                              setPurchaseData({
                                ingredient_id: ing.id,
                                supplier_name: "",
                                quantity: 0,
                                total_price: 0,
                                purchased_at: new Date().toISOString().split('T')[0],
                                notes: "",
                                update_stock: true
                              });
                              setIsPurchaseDialogOpen(true);
                            }}
                          >
                            + Beli
                          </Button>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="flex-1 rounded-xl h-10 font-bold text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all"
                            onClick={() => fetchHistory(ing.id)}
                          >
                            Riwayat
                          </Button>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="rounded-xl w-10 h-10 bg-amber-50 hover:bg-amber-100 text-amber-600 transition-all p-0"
                            onClick={() => {
                              setStockAdjustment({ ingredient_id: ing.id, adjustment: 0, type: "consume" });
                              setIsStockDialogOpen(true);
                            }}
                          >
                            <span className="font-black text-lg leading-none">-</span>
                          </Button>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="rounded-xl w-10 h-10 bg-stone-100 hover:bg-primary/10 hover:text-primary transition-all p-0"
                            onClick={() => {
                              setCurrentIng(ing);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
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

                    {/* Expandable History Section */}
                    {expandedIngredientId === ing.id && (
                      <div className="mt-4 pt-4 border-t border-stone-100 bg-stone-50 -mx-5 -mb-5 p-5">
                        <h4 className="text-[10px] font-black uppercase text-stone-500 tracking-widest mb-3 flex items-center justify-between">
                          Riwayat Pembelian
                          {loadingHistory && <Loader2 className="h-3 w-3 animate-spin" />}
                        </h4>
                        
                        {purchaseHistory.length === 0 && !loadingHistory ? (
                          <div className="text-xs text-stone-400 font-medium text-center py-4 bg-white rounded-xl border border-stone-100">Belum ada riwayat</div>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {purchaseHistory.map(ph => (
                              <div key={ph.id} className="bg-white p-3 rounded-xl border border-stone-100 flex flex-col gap-1 shadow-sm">
                                <div className="flex justify-between items-start">
                                  <span className="font-bold text-stone-700 text-sm">{ph.supplier_name}</span>
                                  <span className="text-[10px] font-bold text-stone-400">{new Date(ph.purchased_at).toLocaleDateString('id-ID')}</span>
                                </div>
                                <div className="flex justify-between items-end mt-1">
                                  <span className="text-xs font-medium text-stone-500">{ph.quantity} {ing.unit}</span>
                                  <div className="flex flex-col items-end">
                                    <span className="text-xs font-black text-emerald-600">{formatRupiah(ph.price_per_unit)}/{ing.unit}</span>
                                    <span className="text-[9px] font-bold text-stone-400 capitalize">Total: {formatRupiah(ph.total_price)}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
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

      {/* Purchase Dialog */}
      <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-8 border-none overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500" />
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black text-stone-900">Catat Pembelian</DialogTitle>
            <DialogDescription className="font-bold text-stone-400 uppercase text-[10px] tracking-widest">
              {ingredients.find(i => i.id === purchaseData.ingredient_id)?.name || "Bahan"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Tempat Beli (Supplier)</label>
              <Input
                placeholder="Contoh: Pasar Kebayoran, Indomaret..."
                value={purchaseData.supplier_name}
                onChange={e => setPurchaseData({ ...purchaseData, supplier_name: e.target.value })}
                list="suppliers-list"
                className="h-12 bg-stone-50 border-stone-200 rounded-2xl font-bold"
              />
              <datalist id="suppliers-list">
                {suppliers.map(s => <option key={s.id} value={s.name} />)}
              </datalist>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">
                  Kuantitas ({ingredients.find(i => i.id === purchaseData.ingredient_id)?.unit || "unit"})
                </label>
                <Input
                  type="number"
                  placeholder="0"
                  value={purchaseData.quantity || ""}
                  onChange={e => setPurchaseData({ ...purchaseData, quantity: parseFloat(e.target.value) || 0 })}
                  className="h-12 bg-stone-50 border-stone-200 rounded-2xl font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Tanggal</label>
                <Input
                  type="date"
                  value={purchaseData.purchased_at}
                  onChange={e => setPurchaseData({ ...purchaseData, purchased_at: e.target.value })}
                  className="h-12 bg-stone-50 border-stone-200 rounded-2xl font-bold text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Total Harga (IDR)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-sm">Rp</span>
                <Input
                  type="number"
                  placeholder="0"
                  value={purchaseData.total_price || ""}
                  onChange={e => setPurchaseData({ ...purchaseData, total_price: parseInt(e.target.value) || 0 })}
                  className="h-12 pl-12 bg-stone-50 border-stone-200 rounded-2xl font-black text-emerald-600 text-lg"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input 
                type="checkbox" 
                id="update-stock" 
                className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 h-5 w-5"
                checked={purchaseData.update_stock}
                onChange={e => setPurchaseData({...purchaseData, update_stock: e.target.checked})}
              />
              <label htmlFor="update-stock" className="text-sm font-bold text-stone-600 cursor-pointer">
                Tambahkan ke stok inventory
              </label>
            </div>
          </div>
          <DialogFooter className="mt-8 flex gap-3">
            <Button variant="ghost" className="flex-1 h-12 rounded-2xl font-bold text-stone-400 hover:bg-stone-50" onClick={() => setIsPurchaseDialogOpen(false)}>
              Batal
            </Button>
            <Button className="flex-1 h-12 rounded-2xl font-black uppercase text-xs tracking-widest bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20" onClick={savePurchase}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Adjustment Dialog */}
      <Dialog open={isStockDialogOpen} onOpenChange={setIsStockDialogOpen}>
         <DialogContent className="max-w-[320px] rounded-3xl p-6 border-none overflow-hidden text-center">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500" />
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-black text-stone-900 mx-auto">Kurangi Stok</DialogTitle>
            <DialogDescription className="font-bold text-stone-400 uppercase text-[10px] tracking-widest mx-auto">
              Pemakaian manual di luar menu
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
             <div className="relative mx-auto w-32">
                <Input
                  type="number"
                  placeholder="0"
                  autoFocus
                  value={stockAdjustment.adjustment || ""}
                  onChange={e => setStockAdjustment({ ...stockAdjustment, adjustment: Math.abs(parseFloat(e.target.value) || 0) })}
                  className="h-16 text-center bg-stone-50 border-stone-200 rounded-2xl font-black text-stone-700 text-3xl"
                />
             </div>
             <p className="font-bold text-stone-400 uppercase text-[10px] tracking-widest">
               {ingredients.find(i => i.id === stockAdjustment.ingredient_id)?.unit || "unit"} digunakan
             </p>
          </div>
          <DialogFooter className="mt-6 flex gap-2 sm:justify-center">
            <Button variant="ghost" className="flex-1 h-12 rounded-2xl font-bold text-stone-400 hover:bg-stone-50" onClick={() => setIsStockDialogOpen(false)}>
              Batal
            </Button>
            <Button className="flex-1 h-12 rounded-2xl font-black uppercase text-xs tracking-widest bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20" onClick={saveStockAdjustment}>
              Kurangi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
