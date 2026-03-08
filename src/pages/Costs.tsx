import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
  
  // Purchase Modal State
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<{ id?: number; name: string; qty: number; unit: string } | null>(null);
  const [formData, setFormData] = useState({ supplier_name: "", quantity: "", total_price: "", notes: "" });
  const [isSaving, setIsSaving] = useState(false);

  // 1. Initial Load: Fetch all plans
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
          setLoading(false); // No plans exist
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  // 2. Secondary Load: Fetch summary when activePlanId changes
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
      
      // Refresh to get the new actual costs
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
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-8 pb-12">
        {/* Week Selector */}
        {plans.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h1 className="text-3xl font-black tracking-tight text-stone-900">Perhitungan Cost</h1>
            <Select 
              value={activePlanId?.toString()} 
              onValueChange={(val) => setActivePlanId(parseInt(val))}
            >
              <SelectTrigger className="w-full sm:w-[280px] h-11 bg-white border-stone-200 rounded-xl font-bold shadow-sm">
                <CalendarDays className="h-4 w-4 mr-2 text-primary" />
                <SelectValue placeholder="Pilih Pekan" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-stone-200 shadow-xl">
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()} className="font-medium rounded-lg">
                    Pekan: {format(new Date(p.week_start), "d MMM", { locale: id })} -{" "}
                    {format(new Date(p.week_end), "d MMM yyyy", { locale: id })}
                    {p.status === 'active' && <span className="ml-2 text-[10px] text-emerald-600 font-black uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-full">Aktif</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!data ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4 bg-stone-50 rounded-3xl border border-dashed border-stone-200">
            <Receipt className="h-16 w-16 text-stone-300" />
            <div>
              <h2 className="text-xl font-bold text-stone-700">Belum ada perhitungan cost</h2>
              <p className="text-stone-500">Pilih pekan lain atau hubungi admin untuk membuat jadwal baru.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Hero Section / Summary Box */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              {loading && (
                <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-[2px] rounded-3xl flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              <div className="md:col-span-2 bg-primary/5 p-8 rounded-3xl border border-primary/10 flex flex-col justify-center">
                <div className="flex justify-between items-start mb-3">
                   <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-xs">
                     <TrendingUp className="h-4 w-4" /> BIAYA BELANJA PEKAN INI
                   </div>
                   <Badge variant="outline" className="bg-white text-stone-500 border-stone-200">
                     Konsumsi Kotor: {formatRupiah(data.week_total)}
                   </Badge>
                </div>
            
            {data.total_actual_cost > 0 ? (
              <div>
                <div className="flex items-end gap-3 mb-1">
                  <div className="text-5xl font-black text-primary tracking-tight">
                    {formatRupiah(data.total_actual_cost)}
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border-emerald-200 uppercase font-black tracking-widest text-[9px] mb-2 shadow-sm">
                    Biaya Aktual
                  </Badge>
                </div>
                <div className="text-sm font-bold text-stone-400 line-through">
                  Estimasi awal: {formatRupiah(data.total_shopping_cost)}
                </div>
              </div>
            ) : (
              <div className="text-5xl font-black text-primary tracking-tight">
                {formatRupiah(data.total_shopping_cost)}
              </div>
            )}
            
            <p className="text-sm text-stone-500 mt-4 font-medium max-w-lg leading-relaxed">
              Estimasi biaya ini <b>sudah dikurangi dengan bahan yang ada di stok dapur</b>.
              Menghitung {data.daily_breakdown.length} hari ke depan untuk {data.member_totals.length} warga.
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
            <Card className="border-stone-200 bg-stone-50/50">
              <CardContent className="p-6 flex flex-col justify-center items-center text-center">
                <Users className="h-6 w-6 text-primary/40 mb-2" />
                <div className="text-2xl font-black text-stone-900">{data.member_totals.length}</div>
                <div className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Warga Ikut</div>
              </CardContent>
            </Card>
            <Card className="border-stone-200 bg-stone-50/50">
              <CardContent className="p-6 flex flex-col justify-center items-center text-center">
                <ShoppingCart className="h-6 w-6 text-primary/40 mb-2" />
                <div className="text-2xl font-black text-stone-900">{data.shopping_list.length}</div>
                <div className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Jenis Bahan</div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Tabs defaultValue="split" className="w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h2 className="text-2xl font-black text-stone-900">Rincian Perhitungan</h2>
            <TabsList className="grid w-full md:w-auto grid-cols-2 bg-stone-100 p-1 h-12">
              <TabsTrigger value="split" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">Tagihan Warga</TabsTrigger>
              <TabsTrigger value="shopping" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">Daftar Belanja</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="split" className="mt-0 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Member Totals List */}
              <div className="space-y-4">
                <h3 className="font-black text-sm text-stone-400 uppercase tracking-widest flex items-center gap-2">
                  <Users className="h-4 w-4" /> Distribusi Biaya
                </h3>
                <div className="grid gap-3">
                  {data.member_totals.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground italic">Belum ada warga yang bergabung</div>
                  ) : (
                    data.member_totals
                      .sort((a,b) => b.total - a.total)
                      .map(member => (
                        <Card key={member.member_id} className="border-transparent bg-white shadow-sm hover:shadow-md transition-shadow">
                          <CardContent className="p-5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-black text-lg">
                                {member.days_joined}
                              </div>
                              <div>
                                <p className="font-black text-stone-900 text-lg">{member.name}</p>
                                <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest leading-none">
                                  {member.days_joined} hari bergabung
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              {member.actual_total && member.actual_total > 0 ? (
                                <>
                                  <div className="text-2xl font-black text-rose-600 tracking-tight">
                                    {formatRupiah(member.actual_total)}
                                  </div>
                                  <div className="text-[10px] text-stone-400 font-bold line-through">
                                    Est: {formatRupiah(member.total)}
                                  </div>
                                </>
                              ) : (
                                <div className="text-2xl font-black text-rose-600 tracking-tight">
                                  {formatRupiah(member.total)}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))
                  )}
                </div>
              </div>

              {/* Daily Breakdown */}
              <div className="space-y-4">
                <h3 className="font-black text-sm text-stone-400 uppercase tracking-widest flex items-center gap-2">
                  <Receipt className="h-4 w-4" /> Rincian Harian
                </h3>
                <Card className="border-stone-200 overflow-hidden shadow-sm">
                  <div className="p-2">
                    {data.daily_breakdown.map(day => (
                      <div key={day.meal_id} className="flex items-center justify-between p-4 rounded-xl hover:bg-stone-50 transition-colors border-b border-stone-100 last:border-0">
                        <div className="flex flex-col">
                          <span className="font-black text-stone-900">{day.day_name}</span>
                          <span className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">
                            {day.participant_count} orang ikut
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-stone-800 text-lg">{formatRupiah(day.total_cost)}</div>
                          <div className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full inline-block">
                            @{formatRupiah(day.cost_per_person)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="shopping" className="mt-0">
            <div className="space-y-3">
              {data.shopping_list.map((ing, idx) => (
                <div 
                  key={idx} 
                  className={`rounded-2xl border p-4 transition-all ${
                    ing.has_enough_stock 
                      ? 'bg-stone-50/50 border-stone-100 opacity-60' 
                      : 'bg-white border-stone-100 shadow-sm hover:shadow-md'
                  }`}
                >
                  {/* Row 1: Name + Status Badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-black text-base text-stone-900 leading-tight ${ing.has_enough_stock ? 'line-through decoration-stone-300' : ''}`}>
                        {ing.name}
                      </h4>
                      {ing.has_enough_stock ? (
                        <span className="text-[9px] font-black tracking-widest uppercase text-emerald-600 mt-0.5 inline-block">
                          ✓ Terpenuhi dari Stok
                        </span>
                      ) : ing.cheapest_supplier ? (
                        <span className="text-[9px] font-bold tracking-widest uppercase text-blue-500 mt-0.5 inline-block">
                          📍 Termurah di {ing.cheapest_supplier}
                        </span>
                      ) : null}
                    </div>
                    {ing.has_enough_stock && (
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 font-black text-[9px] uppercase tracking-widest shadow-none hover:bg-emerald-50 shrink-0 rounded-full px-2.5">
                        Stok OK
                      </Badge>
                    )}
                  </div>

                  {/* Row 2: Quantity Details */}
                  <div className="flex items-center gap-4 text-sm mb-3">
                    <div className="flex-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-stone-400 block mb-0.5">Dibutuhkan</span>
                      <span className="font-bold text-stone-600">
                        {ing.total_quantity % 1 === 0 ? ing.total_quantity : Number(ing.total_quantity).toFixed(2)}
                        <span className="text-[10px] uppercase text-stone-400 ml-1">{ing.unit}</span>
                      </span>
                    </div>
                    {!ing.has_enough_stock && (
                      <div className="flex-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-stone-400 block mb-0.5">Beli Kekurangan</span>
                        <span className="font-black text-rose-600">
                          {ing.shortage_quantity % 1 === 0 ? ing.shortage_quantity : Number(ing.shortage_quantity).toFixed(2)}
                          <span className="text-[10px] uppercase text-stone-400 ml-1">{ing.unit}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Row 3: Cost + Action Button */}
                  <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-stone-400 block mb-0.5">Estimasi Biaya</span>
                      <span className={`text-xl font-black tracking-tight ${ing.has_enough_stock ? 'text-stone-300' : 'text-emerald-600'}`}>
                        {formatRupiah(ing.cost_to_buy)}
                      </span>
                    </div>
                    {!ing.has_enough_stock && ing.ingredient_id && (
                      <Button 
                        variant="default" size="sm" 
                        className="h-9 px-4 rounded-full shadow-sm font-black text-[10px] uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700"
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

      <Dialog open={isPurchaseOpen} onOpenChange={setIsPurchaseOpen}>
        <DialogContent className="w-[95vw] max-w-lg rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle>Catat Pembelian: {selectedIngredient?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={recordPurchase} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Beli di (Nama Toko/Suplier)</label>
              <Input required value={formData.supplier_name} onChange={e => setFormData({ ...formData, supplier_name: e.target.value })} placeholder="Cth: Pasar Palmerah / Indomaret" />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <label className="text-sm font-medium">Kuantitas ({selectedIngredient?.unit})</label>
                 <Input type="number" step="0.01" required value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} />
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-medium">Total Harga Akhir (Rp)</label>
                 <Input type="number" required value={formData.total_price} onChange={e => setFormData({ ...formData, total_price: e.target.value })} />
               </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-blue-50/50 rounded-lg border border-blue-100 mt-2">
              <Check className="h-4 w-4 text-blue-500" />
              <p className="text-xs font-semibold text-blue-800">Biaya ini akan langsung ditagihkan ke warga secara otomatis.</p>
            </div>
            <Button type="submit" disabled={isSaving} className="w-full h-11">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Tagihan Aktual
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
