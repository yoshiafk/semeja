import { useState, useEffect, useDeferredValue } from "react";
import { api } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Search, Filter, Carrot, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { IngredientCard } from "@/components/IngredientCard";
import { useMember } from "@/hooks/useMember";
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
  price_last_updated_at: string | null;
  canonical_name: string | null;
}

interface FlaggedItem {
  id: number;
  name: string;
  unit: string;
  old_price: number;
  new_price: number;
  change_pct: string;
  source: string;
}

interface NormalizationItem {
  id: number;
  current_name: string;
  suggested_canonical: string;
  similarity: number;
  scraped_price: number;
  current_price: number;
  source: string;
}

interface SyncResult {
  updated: number;
  auto_normalized: number;
  flagged: FlaggedItem[];
  normalized: NormalizationItem[];
  skipped: number;
  sources_used: string[];
  threshold_pct: number;
  total_ingredients: number;
}

const CATEGORIES = ["Segala", "Pokok", "Protein", "Sayuran", "Bumbu", "Buah", "Lainnya"];

export default function Ingredients() {
  const { isAdmin } = useMember();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
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
  const [deletingIds, setDeletingIds] = useState<number[]>([]);

  // --- Price Sync state ---
  const [isSyncingPrices, setIsSyncingPrices] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [isSyncResultOpen, setIsSyncResultOpen] = useState(false);
  const [dismissedNormIds, setDismissedNormIds] = useState<Set<number>>(new Set());
  const [isApplyingFlagged, setIsApplyingFlagged] = useState(false);
  const [isApplyingNorm, setIsApplyingNorm] = useState(false);

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
    if (deletingIds.includes(id)) return;
    if (!confirm("Hapus bahan ini?")) return;
    
    setDeletingIds(prev => [...prev, id]);
    try {
      await api.delete(`/ingredients/${id}`);
      // Optimistic update: remove from local state immediately
      setIngredients(prev => prev.filter(ing => ing.id !== id));
      toast.success("Bahan berhasil dihapus!");
    } catch (err) {
      toast.error("Gagal menghapus: " + err);
    } finally {
      setDeletingIds(prev => prev.filter(did => did !== id));
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

  const syncPrices = async () => {
    try {
      setIsSyncingPrices(true);
      setDismissedNormIds(new Set());
      const result = await api.post<SyncResult>("/ingredients/sync-prices", { threshold: 30 });
      setSyncResult(result);
      setIsSyncResultOpen(true);
      fetchIngredients(true);
      toast.success(`${result.updated} harga diperbarui!`);
    } catch (err) {
      toast.error("Sync gagal: " + err);
    } finally {
      setIsSyncingPrices(false);
    }
  };

  const applyFlagged = async (items: FlaggedItem[]) => {
    try {
      setIsApplyingFlagged(true);
      const result = await api.post<{ applied: number }>("/ingredients/set-prices", {
        items: items.map(f => ({ id: f.id, price: f.new_price })),
      });
      toast.success(`${result.applied} harga diterapkan!`);
      setIsSyncResultOpen(false);
      fetchIngredients(true);
    } catch (err) {
      toast.error("Gagal menerapkan harga: " + err);
    } finally {
      setIsApplyingFlagged(false);
    }
  };

  const applyNormalizations = async (items: NormalizationItem[]) => {
    const toApply = items.filter(n => !dismissedNormIds.has(n.id));
    if (!toApply.length) return;
    try {
      setIsApplyingNorm(true);
      const result = await api.post<{ applied: number }>("/ingredients/apply-normalizations", {
        items: toApply.map(n => ({
          id: n.id,
          canonical_name: n.suggested_canonical,
          price: n.scraped_price,
        })),
      });
      toast.success(`${result.applied} nama dikonfirmasi!`);
      setIsSyncResultOpen(false);
      fetchIngredients(true);
    } catch (err) {
      toast.error("Gagal konfirmasi nama: " + err);
    } finally {
      setIsApplyingNorm(false);
    }
  };

  const filtered = ingredients.filter(ing => {
    const matchesSearch = ing.name.toLowerCase().includes(deferredSearch.toLowerCase());
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
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                variant="outline"
                onClick={syncPrices}
                disabled={isSyncingPrices}
                className="h-9 px-4 rounded-xl text-xs font-semibold border-border text-muted-foreground hover:text-foreground"
              >
                {isSyncingPrices
                  ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Memperbarui...</>
                  : <><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Sync Harga</>}
              </Button>
            )}
            <Button onClick={() => {
              setCurrentIng({ name: "", unit: "kg", price_per_unit: 0, category: "Lainnya" });
              setIsDialogOpen(true);
            }} className="h-9 px-5 rounded-xl text-xs font-semibold">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Bahan
            </Button>
          </div>
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
              <IngredientCard 
                key={ing.id}
                ingredient={ing}
                isDeleting={deletingIds.includes(ing.id)}
                onEdit={(i) => { setCurrentIng(i); setIsDialogOpen(true); }}
                onDelete={deleteIngredient}
                onPurchase={(i) => {
                  setPurchaseData({
                    ingredient_id: i.id, supplier_name: "", quantity: 0,
                    total_price: 0, purchased_at: new Date().toISOString().split('T')[0],
                    notes: "", update_stock: true
                  });
                  setIsPurchaseDialogOpen(true);
                }}
                onHistory={fetchHistory}
                onConsume={(i) => {
                  setStockAdjustment({ ingredient_id: i.id, adjustment: 0, type: "consume" });
                  setIsStockDialogOpen(true);
                }}
                isExpanded={expandedIngredientId === ing.id}
                purchaseHistory={purchaseHistory}
                isLoadingHistory={loadingHistory}
              />
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

      {/* Sync Result Dialog */}
      <Dialog open={isSyncResultOpen} onOpenChange={setIsSyncResultOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-6 border-border">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-bold text-foreground">Hasil Sinkronisasi Harga</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {syncResult?.sources_used?.join(' · ')} · Hanya bahan dengan harga >7 hari atau kosong yang diproses
            </DialogDescription>
          </DialogHeader>

          {/* Summary badges */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-xl bg-emerald-50 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{syncResult?.updated ?? 0}</p>
              <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">Diperbarui</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{syncResult?.flagged?.length ?? 0}</p>
              <p className="text-[11px] text-amber-700 mt-0.5 font-medium">Harga Berubah</p>
            </div>
            <div className="rounded-xl bg-indigo-50 p-3 text-center">
              <p className="text-2xl font-bold text-indigo-600">{syncResult?.normalized?.length ?? 0}</p>
              <p className="text-[11px] text-indigo-700 mt-0.5 font-medium">Nama Baru</p>
            </div>
          </div>
          {(syncResult?.auto_normalized ?? 0) > 0 && (
            <div className="mb-3 flex items-center gap-1.5 text-xs text-teal-700 bg-teal-50 rounded-lg px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
              ✨ {syncResult!.auto_normalized} nama dikenali otomatis dan langsung diperbarui
            </div>
          )}

          {/* Section 2: Flagged prices */}
          {(syncResult?.flagged?.length ?? 0) > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-amber-700 mb-2">⚠ Harga berubah signifikan (perlu konfirmasi)</p>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {syncResult!.flagged.map(f => (
                  <div key={f.id} className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-xs font-medium text-foreground">{f.name}</p>
                      <p className="text-[10px] text-muted-foreground">{f.source}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs">
                        <span className="line-through text-muted-foreground">{formatRupiah(f.old_price)}</span>
                        {' → '}
                        <span className="font-bold text-amber-600">{formatRupiah(f.new_price)}</span>
                      </p>
                      <p className="text-[10px] text-amber-600">{f.change_pct}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                className="mt-2 w-full h-9 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => applyFlagged(syncResult!.flagged)}
                disabled={isApplyingFlagged}
              >
                {isApplyingFlagged && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Terapkan yang Ditandai ({syncResult!.flagged.length})
              </Button>
            </div>
          )}

          {/* Section 3: Normalization queue */}
          {(() => {
            const visibleNorm = syncResult?.normalized?.filter(n => !dismissedNormIds.has(n.id)) ?? [];
            if (visibleNorm.length === 0) return null;
            const similarityDots = (sim: number) => sim >= 0.65 ? '●●●' : sim >= 0.55 ? '●●' : '●';
            return (
              <div>
                <p className="text-xs font-semibold text-indigo-700 mb-0.5">🔍 Nama Belum Dikenali</p>
                <p className="text-[10px] text-muted-foreground mb-2">Konfirmasi agar sinkronisasi berikutnya otomatis. Nama tampilan tidak berubah.</p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {visibleNorm.map(n => (
                    <div key={n.id} className="bg-indigo-50 rounded-lg px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-foreground">"{n.current_name}"</span>
                          <span className="text-xs text-muted-foreground mx-1.5">→</span>
                          <span className="text-xs text-indigo-700 font-medium">{n.suggested_canonical}</span>
                          <span className="text-[10px] text-indigo-400 ml-1.5">{similarityDots(n.similarity)} {Math.round(n.similarity * 100)}%</span>
                        </div>
                        <button
                          className="text-muted-foreground/40 hover:text-muted-foreground text-xs leading-none mt-0.5 flex-shrink-0"
                          onClick={() => setDismissedNormIds(prev => { const s = new Set(prev); s.add(n.id); return s; })}
                        >✕</button>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatRupiah(n.current_price)} → {formatRupiah(n.scraped_price)} · {n.source}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="ghost"
                    className="flex-1 h-8 rounded-xl text-xs font-medium text-muted-foreground"
                    onClick={() => {
                      const allIds = syncResult!.normalized.map(n => n.id);
                      setDismissedNormIds(new Set(allIds));
                    }}
                  >Lewati Semua</Button>
                  <Button
                    className="flex-1 h-8 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => applyNormalizations(syncResult!.normalized)}
                    disabled={isApplyingNorm}
                  >
                    {isApplyingNorm && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                    Konfirmasi Semua ({visibleNorm.length})
                  </Button>
                </div>
              </div>
            );
          })()}

          <DialogFooter className="mt-4">
            <Button variant="ghost" className="w-full h-9 rounded-xl text-sm" onClick={() => setIsSyncResultOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
