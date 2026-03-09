import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Receipt, TrendingUp, Users, ShoppingCart, Check, Plus, CalendarDays } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { toast } from "sonner";

interface CostSummary {
  week_total: number;
  daily_breakdown: Array<{
    meal_id: number;
    date: string;
    day_name: string;
    main_course_menu: string;
    second_course_menu: string;
    dessert_menu: string;
    participant_count: number;
    total_cost: number;
    cost_per_person: number;
  }>;
  member_totals: Array<{
    member_id: number;
    name: string;
    days_joined: number;
    total: number;
    actual_total?: number;
  }>;
  total_shopping_cost: number;
  total_actual_cost: number;
  shopping_list: Array<{
    ingredient_id?: number;
    name: string;
    unit: string;
    total_quantity: number;
    shortage_quantity: number;
    has_enough_stock: boolean;
    cost_to_buy: number;
    price_per_unit: number;
    cheapest_supplier: string | null;
  }>;
}

export default function Costs() {
  const [data, setData] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<{ id?: number; name: string; qty: number; unit: string } | null>(null);
  const [formData, setFormData] = useState({ supplier_name: "", quantity: "", total_price: "", notes: "" });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const allPlans = await api.get<any[]>("/meal-plans");
        setPlans(allPlans);
        if (allPlans.length > 0) {
          const active = allPlans.find(p => p.status === 'active') || allPlans[0];
          setActivePlanId(active.id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  useEffect(() => {
    if (!activePlanId) return;
    
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const summary = await api.get<CostSummary>(`/summary/${activePlanId}`);
        setData(summary);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [activePlanId]);

  const recordPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredient?.id || !activePlanId) return;
    
    try {
      setIsSaving(true);
      await api.post("/purchases", {
        ingredient_id: selectedIngredient.id,
        supplier_name: formData.supplier_name,
        quantity: parseFloat(formData.quantity),
        total_price: parseInt(formData.total_price),
        update_stock: true,
        meal_plan_id: activePlanId
      });
      setIsPurchaseOpen(false);
      setFormData({ supplier_name: "", quantity: "", total_price: "", notes: "" });
      toast.success("Pembelian berhasil dicatat dan ditagihkan!");
      
      setLoading(true);
      const summary = await api.get<CostSummary>(`/summary/${activePlanId}`);
      setData(summary);
      setLoading(false);
    } catch (err: any) {
      toast.error("Gagal mencatat: " + (err.error || err.message));
      setIsSaving(false);
    }
  };

  if (loading && !data) {
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
        {/* Header + Week Selector */}
        {plans.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Perhitungan Cost</h1>
            <Select 
              value={activePlanId?.toString()} 
              onValueChange={(val) => setActivePlanId(parseInt(val))}
            >
              <SelectTrigger className="w-full sm:w-[260px] h-10 bg-secondary/80 border-border rounded-xl text-sm font-medium">
                <CalendarDays className="h-3.5 w-3.5 mr-2 text-primary" />
                <SelectValue placeholder="Pilih Pekan" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border">
                <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground/70 mb-0.5">Pekan Aktif</div>
                {plans.filter(p => p.status === 'active').map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()} className="text-sm rounded-lg">
                    {format(new Date(p.week_start), "d MMM", { locale: id })} – {format(new Date(p.week_end), "d MMM yyyy", { locale: id })}
                    <span className="ml-2 text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-md">Aktif</span>
                  </SelectItem>
                ))}
                
                {plans.some(p => p.status === 'archived') && (
                  <>
                    <div className="px-2 py-1.5 mt-1.5 border-t border-border/50 text-[11px] font-semibold text-muted-foreground/70 mb-0.5">Riwayat</div>
                    {plans.filter(p => p.status === 'archived').map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()} className="text-sm rounded-lg text-muted-foreground">
                        {format(new Date(p.week_start), "d MMM", { locale: id })} – {format(new Date(p.week_end), "d MMM yyyy", { locale: id })}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {!data ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-3 bg-secondary rounded-2xl border border-dashed border-border">
            <Receipt className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <h2 className="text-base font-semibold text-foreground/90">Belum ada perhitungan cost</h2>
              <p className="text-sm text-muted-foreground mt-1">Pilih pekan lain atau hubungi admin untuk membuat jadwal baru.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Summary Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
              {loading && (
                <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-[2px] rounded-2xl flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
              <div className="md:col-span-2 bg-primary/5 p-5 md:p-6 rounded-2xl border border-primary/10 flex flex-col justify-center">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                  <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                    <TrendingUp className="h-3.5 w-3.5" /> Biaya Belanja Pekan Ini
                  </div>
                  <span className="text-xs text-muted-foreground bg-white px-2.5 py-1 rounded-lg border border-border/50 w-fit">
                    Konsumsi Kotor: {formatRupiah(data.week_total)}
                  </span>
                </div>
            
                {data.total_actual_cost > 0 ? (
                  <div>
                    <div className="flex items-end gap-2 mb-1">
                      <div className="text-3xl md:text-4xl font-bold text-primary tracking-tight">
                        {formatRupiah(data.total_actual_cost)}
                      </div>
                      <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md mb-1">
                        Aktual
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground/70 line-through">
                      Estimasi: {formatRupiah(data.total_shopping_cost)}
                    </div>
                  </div>
                ) : (
                  <div className="text-3xl md:text-4xl font-bold text-primary tracking-tight">
                    {formatRupiah(data.total_shopping_cost)}
                  </div>
                )}
            
                <p className="text-xs text-muted-foreground mt-3 leading-relaxed max-w-lg">
                  Estimasi <b>sudah dikurangi stok dapur</b>. Menghitung {data.daily_breakdown.length} hari untuk {data.member_totals.length} warga.
                </p>
              </div>
          
              <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
                <div className="rounded-2xl border border-border/50 bg-white p-4 flex flex-col items-center justify-center text-center">
                  <Users className="h-5 w-5 text-primary/40 mb-1.5" />
                  <div className="text-xl font-bold text-foreground">{data.member_totals.length}</div>
                  <div className="text-[11px] text-muted-foreground/70 font-medium">Warga Ikut</div>
                </div>
                <div className="rounded-2xl border border-border/50 bg-white p-4 flex flex-col items-center justify-center text-center">
                  <ShoppingCart className="h-5 w-5 text-primary/40 mb-1.5" />
                  <div className="text-xl font-bold text-foreground">{data.shopping_list.length}</div>
                  <div className="text-[11px] text-muted-foreground/70 font-medium">Jenis Bahan</div>
                </div>
              </div>
            </div>

            {/* Detail Tabs */}
            <Tabs defaultValue="split" className="w-full">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
                <h2 className="text-lg font-bold text-foreground">Rincian Perhitungan</h2>
                <TabsList className="grid w-full md:w-auto grid-cols-2 bg-muted p-1 h-9 rounded-lg">
                  <TabsTrigger value="split" className="rounded-md text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">Tagihan Warga</TabsTrigger>
                  <TabsTrigger value="shopping" className="rounded-md text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">Daftar Belanja</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="split" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Member Totals */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground/70 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> Distribusi Biaya
                    </h3>
                    <div className="space-y-2">
                      {data.member_totals.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground/70 text-sm">Belum ada warga yang bergabung</div>
                      ) : (
                        data.member_totals
                          .sort((a,b) => b.total - a.total)
                          .map(member => (
                            <div key={member.member_id} className="rounded-xl border border-border/50 bg-white p-4 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-bold text-sm">
                                  {member.days_joined}
                                </div>
                                <div>
                                  <p className="font-semibold text-foreground text-sm">{member.name}</p>
                                  <p className="text-[11px] text-muted-foreground/70">{member.days_joined} hari bergabung</p>
                                </div>
                              </div>
                              <div className="text-right">
                                {member.actual_total && member.actual_total > 0 ? (
                                  <>
                                    <div className="text-base font-bold text-rose-600">{formatRupiah(member.actual_total)}</div>
                                    <div className="text-[11px] text-muted-foreground/70 line-through">Est: {formatRupiah(member.total)}</div>
                                  </>
                                ) : (
                                  <div className="text-base font-bold text-rose-600">{formatRupiah(member.total)}</div>
                                )}
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>

                  {/* Daily Breakdown */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground/70 flex items-center gap-1.5">
                      <Receipt className="h-3.5 w-3.5" /> Rincian Harian
                    </h3>
                    <div className="rounded-xl border border-border/50 overflow-hidden bg-white">
                      {data.daily_breakdown.map(day => (
                        <div key={day.meal_id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors border-b border-border/30 last:border-0">
                          <div>
                            <span className="font-medium text-foreground text-sm">{day.day_name}</span>
                            <span className="block text-[11px] text-muted-foreground/70">{day.participant_count} orang</span>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-foreground text-sm">{formatRupiah(day.total_cost)}</div>
                            <span className="text-[11px] text-primary font-medium">@{formatRupiah(day.cost_per_person)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="shopping" className="mt-0">
                <div className="space-y-2">
                  {data.shopping_list.map((ing, idx) => (
                    <div 
                      key={idx} 
                      className={`rounded-xl border p-4 transition-all ${
                        ing.has_enough_stock 
                          ? 'bg-secondary/50 border-border/50 opacity-50' 
                          : 'bg-white border-border/50 hover:border-border'
                      }`}
                    >
                      {/* Name + Status */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-medium text-sm text-foreground leading-tight ${ing.has_enough_stock ? 'line-through decoration-muted-foreground/50' : ''}`}>
                            {ing.name}
                          </h4>
                          {ing.has_enough_stock ? (
                            <span className="text-[11px] text-emerald-600 font-medium mt-0.5 inline-block">✓ Terpenuhi dari stok</span>
                          ) : ing.cheapest_supplier ? (
                            <span className="text-[11px] text-info font-medium mt-0.5 inline-block">📍 Termurah di {ing.cheapest_supplier}</span>
                          ) : null}
                        </div>
                        {ing.has_enough_stock && (
                          <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md shrink-0">
                            Stok OK
                          </span>
                        )}
                      </div>

                      {/* Quantities */}
                      <div className="flex items-center gap-4 text-sm mb-2">
                        <div className="flex-1">
                          <span className="text-[11px] text-muted-foreground/70 block mb-0.5">Dibutuhkan</span>
                          <span className="font-medium text-muted-foreground text-sm">
                            {ing.total_quantity % 1 === 0 ? ing.total_quantity : Number(ing.total_quantity).toFixed(2)}
                            <span className="text-[11px] text-muted-foreground/70 ml-1">{ing.unit}</span>
                          </span>
                        </div>
                        {!ing.has_enough_stock && (
                          <div className="flex-1">
                            <span className="text-[11px] text-muted-foreground/70 block mb-0.5">Beli Kekurangan</span>
                            <span className="font-semibold text-rose-600 text-sm">
                              {ing.shortage_quantity % 1 === 0 ? ing.shortage_quantity : Number(ing.shortage_quantity).toFixed(2)}
                              <span className="text-[11px] text-muted-foreground/70 ml-1">{ing.unit}</span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Cost + Action */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/30">
                        <div>
                          <span className="text-[11px] text-muted-foreground/70 block mb-0.5">Estimasi Biaya</span>
                          <span className={`text-base font-bold tracking-tight ${ing.has_enough_stock ? 'text-muted-foreground/50' : 'text-emerald-600'}`}>
                            {formatRupiah(ing.cost_to_buy)}
                          </span>
                        </div>
                        {!ing.has_enough_stock && ing.ingredient_id && (
                          <Button 
                            variant="default" size="sm" 
                            className="h-8 px-3 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => {
                              setSelectedIngredient({ id: ing.ingredient_id, name: ing.name, qty: ing.shortage_quantity, unit: ing.unit });
                              setFormData({ ...formData, quantity: ing.shortage_quantity.toString(), total_price: ing.cost_to_buy.toString() });
                              setIsPurchaseOpen(true);
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" /> Catat
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {/* Purchase Dialog */}
      <Dialog open={isPurchaseOpen} onOpenChange={setIsPurchaseOpen}>
        <DialogContent className="w-[95vw] max-w-lg rounded-2xl p-6 border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Catat Pembelian: {selectedIngredient?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={recordPurchase} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Beli di (Nama Toko/Suplier)</label>
              <Input required value={formData.supplier_name} onChange={e => setFormData({ ...formData, supplier_name: e.target.value })} placeholder="Cth: Pasar Palmerah / Indomaret" className="h-10 rounded-xl bg-secondary/80 border-border text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Kuantitas ({selectedIngredient?.unit})</label>
                <Input type="number" step="0.01" required value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} className="h-10 rounded-xl bg-secondary/80 border-border text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Total Harga (Rp)</label>
                <Input type="number" required value={formData.total_price} onChange={e => setFormData({ ...formData, total_price: e.target.value })} className="h-10 rounded-xl bg-secondary/80 border-border text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-info/10 rounded-xl border border-info/20">
              <Check className="h-3.5 w-3.5 text-info" />
              <p className="text-xs text-info">Biaya ini akan langsung ditagihkan ke warga secara otomatis.</p>
            </div>
            <Button type="submit" disabled={isSaving} className="w-full h-10 rounded-xl text-sm font-semibold">
              {isSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Simpan Tagihan Aktual
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
