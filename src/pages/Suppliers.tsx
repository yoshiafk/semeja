import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, MapPin, Search as SearchIcon, FileText, CalendarDays } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

interface Supplier {
  id: number;
  name: string;
  location: string;
  notes: string;
  total_purchases: number;
  last_purchase_date: string | null;
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState<Partial<Supplier>>({
    name: "",
    location: "",
    notes: ""
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const data = await api.get<Supplier[]>("/suppliers");
      setSuppliers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveSupplier = async () => {
    if (!currentSupplier.id) return;
    try {
      await api.put(`/suppliers/${currentSupplier.id}`, currentSupplier);
      setIsDialogOpen(false);
      fetchSuppliers();
    } catch (err) {
      alert("Gagal menyimpan: " + err);
    }
  };

  const filtered = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.location && s.location.toLowerCase().includes(search.toLowerCase()))
  );

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
            <h1 className="text-3xl font-black tracking-tight text-stone-900">Daftar Supplier</h1>
            <p className="text-stone-500 font-medium">Data vendor tempat Anda biasa berbelanja bahan.</p>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-stone-50 p-6 rounded-3xl border border-stone-100 shadow-sm">
          <div className="md:col-span-2 relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input
              placeholder="Cari nama toko atau lokasi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-12 bg-white border-stone-200 rounded-2xl focus:ring-primary focus:border-primary"
            />
          </div>
          <Card className="border-stone-200 bg-white grid place-items-center h-12 rounded-2xl">
             <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest leading-none">
              <span className="text-primary text-sm mr-1.5">{filtered.length}</span> Vendor Aktif
             </span>
          </Card>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <Search className="h-16 w-16 text-stone-200" />
            <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Supplier tidak ditemukan</p>
            <p className="text-stone-500 text-sm max-w-sm mt-2">
              Supplier akan otomatis ditambahkan ke sistem saat Anda mencatat pembelian bahan baru di halaman Ingredients.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(supplier => (
              <Card key={supplier.id} className="border-stone-200 hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5 rounded-2xl overflow-hidden bg-white cursor-pointer" onClick={() => {
                setCurrentSupplier(supplier);
                setIsDialogOpen(true);
              }}>
                <CardContent className="p-0">
                  <div className="p-6 space-y-4">
                    <div>
                      <h3 className="text-xl font-black text-stone-900 truncate">{supplier.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1.5 text-stone-500">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="text-sm font-medium line-clamp-1">{supplier.location || "Lokasi belum diisi"}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-stone-50">
                      <div className="flex flex-col bg-stone-50 p-3 rounded-xl">
                         <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest flex items-center gap-1 mb-1"><FileText className="h-3 w-3" /> Transaksi</span>
                         <span className="text-lg font-black text-stone-700">{supplier.total_purchases}</span>
                      </div>
                      <div className="flex flex-col bg-stone-50 p-3 rounded-xl">
                         <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest flex items-center gap-1 mb-1"><CalendarDays className="h-3 w-3" /> Terakhir</span>
                         <span className="text-sm font-bold text-stone-700 mt-1">
                           {supplier.last_purchase_date 
                             ? new Date(supplier.last_purchase_date).toLocaleDateString('id-ID', {day: 'numeric', month:'short', year:'2-digit'}) 
                             : "-"}
                         </span>
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
            <DialogTitle className="text-2xl font-black text-stone-900">Info Vendor</DialogTitle>
            <DialogDescription className="font-bold text-stone-400 uppercase text-[10px] tracking-widest">Update lokasi dan catatan toko</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Nama Toko/Supplier</label>
              <Input
                value={currentSupplier.name}
                disabled
                className="h-12 bg-stone-100 border-stone-200 rounded-2xl font-bold text-stone-500"
              />
              <p className="text-[10px] text-stone-400 font-medium">Nama supplier dibuat otomatis saat mencatat pembelian.</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Lokasi</label>
              <Input
                placeholder="Contoh: Jl. Sudirman No 12..."
                value={currentSupplier.location || ""}
                onChange={e => setCurrentSupplier({ ...currentSupplier, location: e.target.value })}
                className="h-12 bg-stone-50 border-stone-200 rounded-2xl font-bold"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Catatan</label>
              <Input
                placeholder="Jam buka, kontak Whatsapp..."
                value={currentSupplier.notes || ""}
                onChange={e => setCurrentSupplier({ ...currentSupplier, notes: e.target.value })}
                className="h-12 bg-stone-50 border-stone-200 rounded-2xl font-bold"
              />
            </div>
          </div>
          <DialogFooter className="mt-8 flex gap-3">
            <Button variant="ghost" className="flex-1 h-12 rounded-2xl font-bold text-stone-400 hover:bg-stone-50" onClick={() => setIsDialogOpen(false)}>
              Batal
            </Button>
            <Button className="flex-1 h-12 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-primary/20" onClick={saveSupplier}>
              Simpan Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
