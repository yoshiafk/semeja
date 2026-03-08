import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Receipt, TrendingUp, Users, ShoppingCart } from "lucide-react";
import { formatRupiah } from "@/lib/utils";

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
  }>;
  total_shopping_cost: number;
  shopping_list: Array<{
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const activePlan = await api.get<any>("/meal-plans/active");
      if (activePlan) {
        const summary = await api.get<CostSummary>(`/summary/${activePlan.id}`);
        setData(summary);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  if (!data) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
          <Receipt className="h-16 w-16 text-muted-foreground/20" />
          <div>
            <h2 className="text-xl font-bold">Belum ada perhitungan cost</h2>
            <p className="text-muted-foreground">Admin belum membuat jadwal makan.</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-8 pb-12">
        {/* Hero Section / Summary Box */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-primary/5 p-8 rounded-3xl border border-primary/10 flex flex-col justify-center">
            <div className="flex justify-between items-start mb-3">
               <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-xs">
                 <TrendingUp className="h-4 w-4" /> BIAYA BELANJA PEKAN INI
               </div>
               <Badge variant="outline" className="bg-white text-stone-500 border-stone-200">
                 Konsumsi Kotor: {formatRupiah(data.week_total)}
               </Badge>
            </div>
            <div className="text-5xl font-black text-primary tracking-tight">
              {formatRupiah(data.total_shopping_cost)}
            </div>
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
                            <div className="text-2xl font-black text-rose-600 tracking-tight">
                              {formatRupiah(member.total)}
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
            <Card className="border-stone-200 shadow-xl shadow-stone-200/50 overflow-hidden rounded-2xl">
              <Table>
                <TableHeader className="bg-stone-50 border-b border-stone-100">
                  <TableRow>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest h-14">Bahan Makanan</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px] tracking-widest h-14">Dibutuhkan</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px] tracking-widest h-14">Beli Kekurangan</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px] tracking-widest h-14">Estimasi Biaya</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.shopping_list.map((ing, idx) => (
                    <TableRow key={idx} className={`transition-colors border-stone-100 ${ing.has_enough_stock ? 'opacity-50 bg-stone-50/50 hover:bg-stone-50' : 'hover:bg-primary/[0.02]'}`}>
                      <TableCell className="font-bold text-stone-700 py-4 flex flex-col gap-1">
                        <span className={ing.has_enough_stock ? 'line-through decoration-stone-300' : ''}>{ing.name}</span>
                        {ing.has_enough_stock ? (
                          <span className="text-[9px] font-black tracking-widest uppercase text-emerald-600">Terpenuhi dari Stok</span>
                        ) : ing.cheapest_supplier ? (
                          <span className="text-[9px] font-bold tracking-widest uppercase text-blue-500">📍 Termurah di {ing.cheapest_supplier}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right font-bold text-stone-500 py-4">
                        <span className="mr-1">
                          {ing.total_quantity % 1 === 0 ? ing.total_quantity : ing.total_quantity.toFixed(2)}
                        </span>
                        <span className="text-[10px] uppercase">{ing.unit}</span>
                      </TableCell>
                      <TableCell className="text-right font-black text-stone-900 py-4">
                         {!ing.has_enough_stock ? (
                           <>
                              <span className="text-rose-600 mr-1">
                                {ing.shortage_quantity % 1 === 0 ? ing.shortage_quantity : ing.shortage_quantity.toFixed(2)}
                              </span>
                              <span className="text-[10px] uppercase text-stone-400">{ing.unit}</span>
                           </>
                         ) : '-'}
                      </TableCell>
                      <TableCell className={`text-right font-black text-lg py-4 ${ing.has_enough_stock ? 'text-stone-300' : 'text-emerald-600'}`}>
                        {formatRupiah(ing.cost_to_buy)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
            <div className="mt-6 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-4">
              <div className="text-blue-500 text-xl font-black mt-1">i</div>
              <p className="text-xs text-blue-800 font-medium leading-relaxed">
                Biaya di atas dihitung dengan mempertimbangkan jumlah stok saat ini. Kebutuhan yang sudah terpenuhi oleh stok gudang disorot warna <span className="text-emerald-600 font-bold uppercase tracking-wider text-[10px]">HIJAU</span> dan tidak ikut dihitung ke beban biaya belanja.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
