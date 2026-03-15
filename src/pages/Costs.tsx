import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Receipt, TrendingUp, Users, ShoppingCart, Check, Plus, CalendarDays, Download, FileImage } from "lucide-react";
import { formatRupiah, cn, formatDate } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { toast } from "sonner";
import { exportShoppingListPDF } from "@/lib/pdf-export";
import { ReceiptUpload } from "@/components/ReceiptUpload";
import { ReceiptPreview } from "@/components/ReceiptPreview";
import { OCRReviewDialog } from "@/components/OCRReviewDialog";
import { DailyRecapCard } from "@/components/DailyRecapCard";
import { PaymentStatusRow } from "@/components/PaymentStatusRow";
import { WhatsAppPreviewDialog } from "@/components/WhatsAppPreviewDialog";
import { formatWeeklySettlement } from "@/lib/whatsapp";
import { useMember } from "@/hooks/useMember";
import type { PaymentRecord } from "@/lib/api";

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
    activity_total?: number;
  }>;
  total_shopping_cost: number;
  total_actual_cost: number;
  total_activity_cost?: number;
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
  purchases: Array<{
    id: number;
    ingredient_name: string;
    supplier_name: string;
    quantity: number;
    total_price: number;
    purchased_at: string;
    receipt_id: number | null;
  }>;
}

export default function Costs() {
  const { member, isAdmin } = useMember();
  const [data, setData] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isWASettlementOpen, setIsWASettlementOpen] = useState(false);
  const [waSettlementMsg, setWaSettlementMsg] = useState('');

  
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<{ id?: number; name: string; qty: number; unit: string } | null>(null);
  const [formData, setFormData] = useState({ supplier_name: "", quantity: "", total_price: "", notes: "", receipt_id: null as number | null });
  const [isSaving, setIsSaving] = useState(false);

  // OCR States
  const [ocrData, setOcrData] = useState<any>(null);
  const [isOCRReviewOpen, setIsOCRReviewOpen] = useState(false);
  const [scannedReceiptId, setScannedReceiptId] = useState<number | null>(null);
  const [isOCRUploadOpen, setIsOCRUploadOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [allIngredients, setAllIngredients] = useState<any[]>([]);
  // Tracks which specific meal (day) purchases are being tagged to
  const [selectedMealId, setSelectedMealId] = useState<number | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const [allPlans, ings] = await Promise.all([
          api.get<any[]>("/meal-plans"),
          api.get<any[]>("/ingredients")
        ]);
        setPlans(allPlans);
        setAllIngredients(ings);
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
        const [summary, paymentData] = await Promise.all([
          api.get<CostSummary>(`/summary/${activePlanId}`),
          api.get<PaymentRecord[]>(`/payments/${activePlanId}`).catch(() => []),
        ]);
        setData(summary);
        setPayments(paymentData);
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
        meal_plan_id: activePlanId,
        meal_id: selectedMealId,   // tag to specific day if set
        receipt_id: formData.receipt_id
      });
      setIsPurchaseOpen(false);
      setFormData({ supplier_name: "", quantity: "", total_price: "", notes: "", receipt_id: null });
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

  const handleScanSuccess = (data: any, receiptId: number) => {
    setOcrData(data);
    setScannedReceiptId(receiptId);
    setIsScanning(false);
    setIsOCRUploadOpen(false);
    setIsOCRReviewOpen(true);
  };

  const handleOCRImport = async (selectedItems: any[], supplierName: string) => {
    if (selectedItems.length === 0) return;

    // Check if it's a multi-item import (from bulk scan or shopping list)
    // or a single item import (from the purchase dialog)
    if (selectedItems.length > 1 || selectedItems[0].matchedIngredientId) {
      setIsSaving(true);
      let successCount = 0;
      
      for (const item of selectedItems) {
        if (!item.matchedIngredientId || !activePlanId) continue;
        
        try {
          await api.post("/purchases", {
            ingredient_id: item.matchedIngredientId,
            supplier_name: supplierName || "OCR Import",
            quantity: item.quantity,
            total_price: item.totalPrice,
            update_stock: true,
            meal_plan_id: activePlanId,
            meal_id: selectedMealId,   // tag to specific day if set
            receipt_id: scannedReceiptId
          });
          successCount++;
        } catch (err) {
          console.error(`Failed to import item ${item.name}:`, err);
        }
      }
      
      setIsSaving(false);
      toast.success(`${successCount} item berhasil dicatat!`);
      
      // Refresh data
      setLoading(true);
      const summary = await api.get<CostSummary>(`/summary/${activePlanId}`);
      setData(summary);
      setLoading(false);
      return;
    }

    // Original single-item logic (legacy, but keeping for compatibility if matchedIngredientId is missing)
    const totalFromSelected = selectedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalQty = selectedItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

    setFormData(prev => ({
      ...prev,
      supplier_name: supplierName || prev.supplier_name,
      total_price: totalFromSelected.toString(),
      quantity: totalQty.toString(),
      receipt_id: scannedReceiptId
    }));
    
    toast.success(`${selectedItems.length} item dari struk berhasil di-import!`);
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
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Perhitungan Biaya</h1>
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
              <h2 className="text-base font-semibold text-foreground/90">Belum ada perhitungan biaya</h2>
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
                
                {data.total_activity_cost !== undefined && data.total_activity_cost > 0 && (
                  <div className="mt-4 pt-3 border-t border-primary/10">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground font-medium">Biaya Aktifitas (Total)</span>
                      <span className="font-bold text-primary">{formatRupiah(data.total_activity_cost)}</span>
                    </div>
                  </div>
                )}
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
                <TabsList className="grid w-full md:w-auto grid-cols-3 bg-muted p-1 h-9 rounded-lg">
                  <TabsTrigger value="split" className="rounded-md text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">Tagihan</TabsTrigger>
                  <TabsTrigger value="daily" className="rounded-md text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">Harian</TabsTrigger>
                  <TabsTrigger value="shopping" className="rounded-md text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">Daftar Belanja</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="split" className="mt-0 space-y-6">
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
                          <div key={member.member_id} className="rounded-xl border border-border/50 bg-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-bold text-sm">
                                {member.days_joined}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground text-sm">{member.name}</p>
                                <p className="text-[11px] text-muted-foreground/70">{member.days_joined} hari bergabung</p>
                              </div>
                            </div>
                            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
                              <div className="text-left md:text-right">
                                <div className="text-[10px] text-muted-foreground font-semibold uppercase mb-1 hidden md:block">Belanja</div>
                                {(member as any).actual_total && (member as any).actual_total > 0 ? (
                                  <>
                                    <div className="text-sm font-bold text-rose-600">{formatRupiah((member as any).actual_total)}</div>
                                    <div className="text-[10px] text-muted-foreground/70 line-through">Est: {formatRupiah(member.total)}</div>
                                  </>
                                ) : (
                                  <div className="text-sm font-bold text-rose-600">{formatRupiah(member.total)}</div>
                                )}
                              </div>

                              {((member as any).activity_total || 0) > 0 && (
                                <div className="text-left md:text-right">
                                  <div className="text-[10px] text-muted-foreground font-semibold uppercase mb-1 hidden md:block">Aktifitas</div>
                                  <div className="text-sm font-bold text-blue-600">+{formatRupiah((member as any).activity_total || 0)}</div>
                                </div>
                              )}

                              <div className="text-left md:text-right pt-2 border-t border-border/50 md:border-0 md:pt-0">
                                <div className="text-[10px] text-muted-foreground font-semibold uppercase mb-1 hidden md:block">Grand Total</div>
                                <div className="text-base font-black text-primary">
                                  {formatRupiah(((member as any).actual_total && (member as any).actual_total > 0 ? (member as any).actual_total : member.total) + ((member as any).activity_total || 0))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Settlement section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-muted-foreground/70 flex items-center gap-1.5">
                      <Receipt className="h-3.5 w-3.5" /> Status Pembayaran
                    </h3>
                    {isAdmin && data.member_totals.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 gap-1.5 text-xs font-medium rounded-lg border-green-300 text-green-700 hover:bg-green-50"
                        onClick={() => {
                          const currentPlan = plans.find(p => p.id === activePlanId);
                          const wl = currentPlan
                            ? `${format(new Date(currentPlan.week_start), 'd MMM', { locale: id })} – ${format(new Date(currentPlan.week_end), 'd MMM yyyy', { locale: id })}`
                            : 'Minggu ini';
                          setWaSettlementMsg(formatWeeklySettlement({
                            weekLabel: wl,
                            totalActualCost: data.total_actual_cost,
                            members: data.member_totals.map(m => ({ name: m.name, days_joined: m.days_joined, total: (m as any).actual_total ?? m.total })),
                            adminName: member?.name,
                          }));
                          setIsWASettlementOpen(true);
                        }}
                      >
                        Share Tagihan WA
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {data.member_totals
                      .sort((a, b) => b.total - a.total)
                      .map(memberData => (
                        <PaymentStatusRow
                          key={memberData.member_id}
                          member={memberData}
                          payment={payments.find(p => p.member_id === memberData.member_id)}
                          isAdmin={isAdmin || false}
                          onToggle={async (m, isPaid) => {
                            if (isPaid) {
                              await api.delete(`/payments/${activePlanId}/${m.member_id}`);
                              setPayments(prev => prev.filter(p => p.member_id !== m.member_id));
                            } else {
                              const result = await api.post<PaymentRecord>('/payments', {
                                meal_plan_id: activePlanId,
                                member_id: m.member_id,
                                amount: (m as any).actual_total ?? m.total,
                              });
                              setPayments(prev => [...prev.filter(p => p.member_id !== m.member_id), result]);
                            }
                          }}
                        />
                      ))
                    }
                  </div>
                </div>
              </TabsContent>


              {/* NEW: Daily tab – per-day actuals */}
              <TabsContent value="daily" className="mt-0 space-y-3">
                {data.daily_breakdown.map(day => (
                  <DailyRecapCard
                    key={day.meal_id}
                    day={day as any}
                    onRecord={(mealId) => {
                      setSelectedMealId(mealId);
                      setIsOCRUploadOpen(true);
                    }}
                  />
                ))}
              </TabsContent>

              <TabsContent value="shopping" className="mt-0">
                {/* Export Button Header */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-muted-foreground">
                    {data.shopping_list.filter(i => !i.has_enough_stock).length} bahan perlu dibeli
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 gap-1.5 text-xs font-medium rounded-lg border-primary/30 text-primary hover:bg-primary/5"
                      onClick={() => setIsOCRUploadOpen(true)}
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      Upload Struk
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 gap-1.5 text-xs font-medium rounded-lg border-primary/30 text-primary hover:bg-primary/5"
                    onClick={() => {
                      const activePlan = plans.find(p => p.id === activePlanId);
                      if (!activePlan) return;
                      
                      const toastId = toast.loading('Memulai export PDF...', {
                        description: 'Mohon tunggu sebentar'
                      });
                      
                      // Use setTimeout to allow UI to update before heavy PDF generation
                      setTimeout(() => {
                        try {
                          const weekRange = `${format(new Date(activePlan.week_start), "d MMM", { locale: id })} - ${format(new Date(activePlan.week_end), "d MMM yyyy", { locale: id })}`;
                          
                          exportShoppingListPDF(
                            {
                              weekRange,
                              dailyBreakdown: data.daily_breakdown,
                              shoppingList: data.shopping_list
                            },
                            (progress, message) => {
                              toast.loading(message, {
                                id: toastId,
                                description: `${progress}% selesai`
                              });
                            }
                          );
                          
                          toast.success('PDF berhasil diunduh!', {
                            id: toastId,
                            description: 'Silakan cek folder Downloads Anda'
                          });
                        } catch (error) {
                          console.error('PDF export error:', error);
                          toast.error('Gagal membuat PDF', {
                            id: toastId,
                            description: 'Terjadi kesalahan saat membuat dokumen'
                          });
                        }
                      }, 100);
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export PDF
                  </Button>
                </div>
              </div>
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

                {/* Purchase History Section */}
                {data.purchases && data.purchases.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-border/50 space-y-4">
                    <h3 className="text-xs font-semibold text-muted-foreground/70 flex items-center gap-1.5 uppercase tracking-wider">
                      <TrendingUp className="h-3.5 w-3.5" /> Riwayat Belanja Pekan Ini
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {data.purchases.map((p) => (
                        <div key={p.id} className="bg-white border border-border/50 rounded-xl p-3 flex items-center justify-between group hover:shadow-sm transition-shadow">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 bg-secondary/80 rounded-lg flex items-center justify-center text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary transition-colors">
                              <Receipt className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">{p.ingredient_name}</p>
                              <p className="text-[10px] text-muted-foreground/70 truncate flex items-center gap-1">
                                <span>{p.supplier_name}</span>
                                <span>•</span>
                                <span>{formatDate(p.purchased_at)}</span>
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <div>
                              <p className="text-sm font-black text-primary">{formatRupiah(p.total_price)}</p>
                              <p className="text-[10px] text-muted-foreground/70">{p.quantity} unit</p>
                            </div>
                            <ReceiptPreview 
                              receiptId={p.receipt_id}
                              digitalData={{
                                title: p.ingredient_name,
                                amount: p.total_price,
                                date: p.purchased_at,
                                location: p.supplier_name,
                                notes: `Pembelian ${p.quantity} unit ${p.ingredient_name}`
                              }}
                              trigger={
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className={cn(
                                    "h-8 w-8 rounded-lg",
                                    p.receipt_id ? "text-emerald-600 bg-emerald-50" : "text-muted-foreground/40 bg-secondary/50"
                                  )}
                                >
                                  <FileImage className="h-4 w-4" />
                                </Button>
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

            <ReceiptUpload 
              label="Lampirkan Struk Belanja (Opsional)"
              autoScan={true}
              isScanning={isScanning}
              onScanStart={() => setIsScanning(true)}
              onScanSuccess={handleScanSuccess}
              onUploadSuccess={(id) => setFormData(prev => ({ ...prev, receipt_id: id }))}
              onClear={() => setFormData(prev => ({ ...prev, receipt_id: null }))}
              initialId={formData.receipt_id}
            />

            <Button type="submit" disabled={isSaving} className="w-full h-10 rounded-xl text-sm font-semibold">
              {isSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Simpan Tagihan Aktual
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <OCRReviewDialog 
        open={isOCRReviewOpen || isScanning}
        loading={isScanning}
        onOpenChange={(open) => {
          setIsOCRReviewOpen(open);
          if (!open) setIsScanning(false);
        }}
        data={ocrData}
        receiptId={scannedReceiptId}
        ingredients={allIngredients.map(ing => ({ id: ing.id, name: ing.name, unit: ing.unit }))}
        onImport={handleOCRImport}
      />

      {/* OCR Upload Dialog */}
      <Dialog
        open={isOCRUploadOpen}
        onOpenChange={(open) => {
          setIsOCRUploadOpen(open);
          if (!open) setSelectedMealId(null); // clear day context on close
        }}
      >
        <DialogContent className="max-w-md rounded-2xl p-6 border-border">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-bold text-foreground">
              {selectedMealId
                ? `Catat Belanja — ${data?.daily_breakdown.find(d => d.meal_id === selectedMealId)?.day_name ?? 'Hari Ini'}`
                : 'Scan Struk Belanja'}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {selectedMealId
                ? 'Scan struk dan cocokkan item untuk mencatat belanja hari ini.'
                : 'Cocokkan item di struk dengan daftar belanja pekan ini.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <ReceiptUpload 
              label="Klik atau Drop Struk di sini"
              autoScan={true}
              isScanning={isScanning}
              onScanStart={() => {
                setIsScanning(true);
              }}
              onScanSuccess={handleScanSuccess}
              onUploadSuccess={() => {}}
              onClear={() => {}}
            />
          </div>
          <DialogFooter className="mt-6 flex gap-2">
            <Button variant="ghost" className="flex-1 h-10 rounded-xl text-sm font-medium text-muted-foreground" onClick={() => setIsOCRUploadOpen(false)}>
              Batal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WhatsAppPreviewDialog
        open={isWASettlementOpen}
        onClose={() => setIsWASettlementOpen(false)}
        message={waSettlementMsg}
        title="Share Tagihan Mingguan"
      />
    </PageContainer>
  );
}
