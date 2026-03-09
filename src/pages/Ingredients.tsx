import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Search, Filter, Pencil, Trash2, Carrot } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { toast } from "sonner";

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

  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
  const [stockAdjustment, setStockAdjustment] = useState({
    ingredient_id: 0,
    adjustment: 0,
    type: "restock" as "restock" | "consume"
  });

  const [expandedIngredientId, setExpandedIngredientId] = useState<number | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  useEffect(() => {
    fetchIngredients();
  }, []);

  const fetchIngredients = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [ingRes, supRes] = await Promise.all([
        api.get<Ingredient[]>("/ingredients"),
        api.get<{id: number, name: string}[]>("/suppliers")
      ]);
      setIngredients(ingRes);
      setSuppliers(supRes);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const saveIngredient = async () => {
    if (!currentIng.name || !currentIng.unit || (currentIng.price_per_unit ?? 0) < 0) return;
    try {
      setIsSaving(true);
      if (currentIng.id) {
        await api.put(`/ingredients/${currentIng.id}`, currentIng);
        toast.success("Bahan berhasil diperbarui!");
      } else {
        await api.post("/ingredients", currentIng);
        toast.success("Bahan baru berhasil ditambahkan!");
      }
      setIsDialogOpen(false);
      fetchIngredients(true);
    } catch (err) {
      toast.error("Gagal menyimpan: " + err);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteIngredient = async (id: number) => {
    if (!confirm("Hapus bahan ini?")) return;
    try {
      setIsDeleting(id);
      await api.delete(`/ingredients/${id}`);
      fetchIngredients(true);
      toast.success("Bahan berhasil dihapus!");
    } catch (err) {
      toast.error("Gagal menghapus: " + err);
    } finally {
      setIsDeleting(null);
    }
  };

  const savePurchase = async () => {
    if (!purchaseData.ingredient_id || !purchaseData.supplier_name || purchaseData.quantity <= 0 || purchaseData.total_price <= 0) return;
    try {
      setIsSaving(true);
      await api.post("/purchases", purchaseData);
      setIsPurchaseDialogOpen(false);
      fetchIngredients(true);
      toast.success("Pembelian berhasil dicatat!");
      if (expandedIngredientId === purchaseData.ingredient_id) {
        fetchHistory(purchaseData.ingredient_id);
      }
    } catch (err) {
      toast.error("Gagal mencatat pembelian: " + err);
    } finally {
      setIsSaving(false);
    }
  };

  const saveStockAdjustment = async () => {
    if (!stockAdjustment.ingredient_id || stockAdjustment.adjustment <= 0) return;
    try {
      setIsSaving(true);
      await api.put(`/ingredients/${stockAdjustment.ingredient_id}/stock`, {
        adjustment: stockAdjustment.adjustment,
        type: stockAdjustment.type
      });
      setIsStockDialogOpen(false);
      fetchIngredients(true);
      toast.success("Stok berhasil disesuaikan!");
    } catch (err) {
      toast.error("Gagal menyesuaikan stok: " + err);
    } finally {
      setIsSaving(false);
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
      setPurchaseHistory(history);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
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
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-5 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Inventory Bahan</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Atur daftar bahan makanan dan harga pasar terbaru.</p>
          </div>
          <Button onClick={() => {
            setCurrentIng({ name: "", unit: "kg", price_per_unit: 0, category: "Lainnya" });
            setIsDialogOpen(true);
          }} className="h-9 px-5 rounded-xl text-xs font-semibold">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Bahan
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
            <Input
              placeholder="Cari nama bahan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-secondary/80 border-border rounded-xl text-sm"
            />
          </div>
          <div className="relative w-full sm:w-44">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70 z-10" />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="pl-9 h-10 bg-secondary/80 border-border rounded-xl text-sm font-medium">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border">
                {CATEGORIES.map(c => (
                  <SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="hidden sm:flex items-center px-4 h-10 rounded-xl bg-secondary/80 border border-border text-xs text-muted-foreground font-medium whitespace-nowrap">
            <span className="text-foreground font-semibold mr-1">{filtered.length}</span> item
          </div>
        </div>

        {/* Grid List */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <Carrot className="h-12 w-12 text-border" />
            <p className="text-muted-foreground/70 font-medium text-sm">Bahan tidak ditemukan</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(ing => (
              <div key={ing.id} className="rounded-2xl border border-border/50 bg-white hover:border-border transition-all group overflow-hidden">
                <div className="p-4 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-secondary text-muted-foreground font-medium">
                      {ing.category}
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" size="icon" 
                        className="h-7 w-7 rounded-lg text-muted-foreground/70 hover:text-primary hover:bg-secondary"
                        onClick={() => { setCurrentIng(ing); setIsDialogOpen(true); }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="ghost" size="icon" 
                        disabled={isDeleting === ing.id}
                        className="h-7 w-7 rounded-lg text-muted-foreground/70 hover:text-red-500 hover:bg-red-50 disabled:opacity-50"
                        onClick={() => deleteIngredient(ing.id)}
                      >
                        {isDeleting === ing.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>

                  {/* Name */}
                  <h3 className="text-base font-semibold text-foreground leading-tight line-clamp-2">
                    {ing.name}
                  </h3>

                  {/* Stats */}
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[11px] text-muted-foreground/70 font-medium">Harga</p>
                      <p className="text-sm font-semibold text-foreground">
                        {formatRupiah(ing.price_per_unit)}<span className="text-xs text-muted-foreground/70 font-normal ml-0.5">/{ing.unit}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-muted-foreground/70 font-medium">Stok</p>
                      <span className={`text-sm font-semibold ${
                        ing.stock_quantity <= 0 ? "text-rose-600" :
                        ing.stock_quantity <= ing.min_stock_threshold ? "text-amber-600" :
                        "text-emerald-600"
                      }`}>
                        {Number(ing.stock_quantity || 0).toFixed(3).replace(/\.?0+$/, '')} {ing.unit}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <Button 
                      variant="secondary" size="sm" 
                      className="flex-1 rounded-xl h-8 font-medium text-xs bg-emerald-50 text-emerald-600 hover:bg-emerald-100 shadow-none"
                      onClick={() => {
                        setPurchaseData({
                          ingredient_id: ing.id, supplier_name: "", quantity: 0,
                          total_price: 0, purchased_at: new Date().toISOString().split('T')[0],
                          notes: "", update_stock: true
                        });
                        setIsPurchaseDialogOpen(true);
                      }}
                    >
                      + Beli
                    </Button>
                    <Button 
                      variant="secondary" size="sm" 
                      className="flex-1 rounded-xl h-8 font-medium text-xs bg-secondary text-muted-foreground hover:bg-muted shadow-none"
                      onClick={() => fetchHistory(ing.id)}
                    >
                      Riwayat
                    </Button>
                    <Button 
                      variant="secondary" size="icon" 
                      className="rounded-xl w-8 h-8 bg-amber-50 text-amber-600 hover:bg-amber-100 shadow-none"
                      onClick={() => {
                        setStockAdjustment({ ingredient_id: ing.id, adjustment: 0, type: "consume" });
                        setIsStockDialogOpen(true);
                      }}
                    >
                      <span className="font-bold text-base leading-none">−</span>
                    </Button>
                  </div>

                  {/* Expandable History */}
                  {expandedIngredientId === ing.id && (
                    <div className="pt-3 border-t border-border/50">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-muted-foreground">Riwayat Pembelian</p>
                        {loadingHistory && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/70" />}
                      </div>
                      
                      {purchaseHistory.length === 0 && !loadingHistory ? (
                        <div className="text-xs text-muted-foreground/70 text-center py-4 bg-secondary rounded-xl">Belum ada riwayat</div>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                          {purchaseHistory.map(ph => (
                            <div key={ph.id} className="bg-secondary p-3 rounded-xl flex flex-col gap-1">
                              <div className="flex justify-between items-start">
                                <span className="font-medium text-foreground/90 text-xs">{ph.supplier_name || 'Tanpa Supplier'}</span>
                                <span className="text-[10px] text-muted-foreground/70">
                                  {new Date(ph.purchased_at).toLocaleDateString('id-ID')}
                                </span>
                              </div>
                              <div className="flex justify-between items-end">
                                <span className="text-xs text-muted-foreground">{ph.quantity} {ing.unit}</span>
                                <div className="text-right">
                                  <span className="text-xs font-semibold text-emerald-600">{formatRupiah(ph.price_per_unit)}/{ing.unit}</span>
                                  <span className="block text-[10px] text-muted-foreground/70">Total {formatRupiah(ph.total_price)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Ingredient Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6 border-border">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-bold text-foreground">{currentIng.id ? "Edit Bahan" : "Tambah Bahan"}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">Update informasi harga dan unit bahan makanan</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nama Bahan</label>
              <Input
                placeholder="Contoh: Ayam Broiler"
                value={currentIng.name}
                onChange={e => setCurrentIng({ ...currentIng, name: e.target.value })}
                className="h-10 bg-secondary/80 border-border rounded-xl text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Satuan</label>
                <Input
                  placeholder="kg, pcs, ikat..."
                  value={currentIng.unit}
                  onChange={e => setCurrentIng({ ...currentIng, unit: e.target.value })}
                  className="h-10 bg-secondary/80 border-border rounded-xl text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Kategori</label>
                <Select 
                  value={currentIng.category} 
                  onValueChange={v => setCurrentIng({ ...currentIng, category: v })}
                >
                  <SelectTrigger className="h-10 bg-secondary/80 border-border rounded-xl text-sm">
                    <SelectValue placeholder="Kategori" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border">
                    {CATEGORIES.slice(1).map(c => (
                      <SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Harga per Unit (IDR)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">Rp</span>
                <Input
                  type="number"
                  placeholder="0"
                  value={currentIng.price_per_unit}
                  onChange={e => setCurrentIng({ ...currentIng, price_per_unit: parseInt(e.target.value) || 0 })}
                  className="h-10 pl-10 bg-secondary/80 border-border rounded-xl text-sm font-semibold text-emerald-600"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6 flex gap-2">
            <Button variant="ghost" className="flex-1 h-10 rounded-xl text-sm font-medium text-muted-foreground" onClick={() => setIsDialogOpen(false)}>
              Batal
            </Button>
            <Button className="flex-1 h-10 rounded-xl text-sm font-semibold" onClick={saveIngredient} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase Dialog */}
      <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6 border-border">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-bold text-foreground">Catat Pembelian</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {ingredients.find(i => i.id === purchaseData.ingredient_id)?.name || "Bahan"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tempat Beli</label>
              <Input
                placeholder="Contoh: Pasar Kebayoran, Indomaret..."
                value={purchaseData.supplier_name}
                onChange={e => setPurchaseData({ ...purchaseData, supplier_name: e.target.value })}
                list="suppliers-list"
                className="h-10 bg-secondary/80 border-border rounded-xl text-sm"
              />
              <datalist id="suppliers-list">
                {suppliers.map(s => <option key={s.id} value={s.name} />)}
              </datalist>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Kuantitas ({ingredients.find(i => i.id === purchaseData.ingredient_id)?.unit || "unit"})
                </label>
                <Input
                  type="number"
                  placeholder="0"
                  value={purchaseData.quantity || ""}
                  onChange={e => setPurchaseData({ ...purchaseData, quantity: parseFloat(e.target.value) || 0 })}
                  className="h-10 bg-secondary/80 border-border rounded-xl text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tanggal</label>
                <Input
                  type="date"
                  value={purchaseData.purchased_at}
                  onChange={e => setPurchaseData({ ...purchaseData, purchased_at: e.target.value })}
                  className="h-10 bg-secondary/80 border-border rounded-xl text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Total Harga (IDR)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">Rp</span>
                <Input
                  type="number"
                  placeholder="0"
                  value={purchaseData.total_price || ""}
                  onChange={e => setPurchaseData({ ...purchaseData, total_price: parseInt(e.target.value) || 0 })}
                  className="h-10 pl-10 bg-secondary/80 border-border rounded-xl text-sm font-semibold text-emerald-600"
                />
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input 
                type="checkbox" 
                id="update-stock" 
                className="rounded border-border text-primary focus:ring-primary/20 h-4 w-4"
                checked={purchaseData.update_stock}
                onChange={e => setPurchaseData({...purchaseData, update_stock: e.target.checked})}
              />
              <span className="text-sm text-muted-foreground">Tambahkan ke stok inventory</span>
            </label>
          </div>
          <DialogFooter className="mt-6 flex gap-2">
            <Button variant="ghost" className="flex-1 h-10 rounded-xl text-sm font-medium text-muted-foreground" onClick={() => setIsPurchaseDialogOpen(false)}>
              Batal
            </Button>
            <Button className="flex-1 h-10 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700" onClick={savePurchase} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Adjustment Dialog */}
      <Dialog open={isStockDialogOpen} onOpenChange={setIsStockDialogOpen}>
        <DialogContent className="max-w-[300px] rounded-2xl p-6 border-border text-center">
          <DialogHeader className="mb-3">
            <DialogTitle className="text-lg font-bold text-foreground mx-auto">Kurangi Stok</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mx-auto">
              Pemakaian manual di luar menu
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative mx-auto w-28">
              <Input
                type="number"
                placeholder="0"
                autoFocus
                value={stockAdjustment.adjustment || ""}
                onChange={e => setStockAdjustment({ ...stockAdjustment, adjustment: Math.abs(parseFloat(e.target.value) || 0) })}
                className="h-14 text-center bg-secondary/80 border-border rounded-xl font-bold text-foreground/90 text-2xl"
              />
            </div>
            <p className="text-xs text-muted-foreground/70 font-medium">
              {ingredients.find(i => i.id === stockAdjustment.ingredient_id)?.unit || "unit"} digunakan
            </p>
          </div>
          <DialogFooter className="mt-5 flex gap-2 sm:justify-center">
            <Button variant="ghost" className="flex-1 h-10 rounded-xl text-sm font-medium text-muted-foreground" onClick={() => setIsStockDialogOpen(false)}>
              Batal
            </Button>
            <Button className="flex-1 h-10 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white" onClick={saveStockAdjustment} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Kurangi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
