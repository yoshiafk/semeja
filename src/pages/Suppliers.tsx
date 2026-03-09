import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, MapPin, Search as SearchIcon, FileText, CalendarDays } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

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
      toast.success("Data supplier berhasil diperbarui!");
    } catch (err) {
      toast.error("Gagal menyimpan: " + err);
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
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-5 md:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-stone-900">Daftar Supplier</h1>
          <p className="text-sm text-stone-500 mt-0.5">Data vendor tempat Anda biasa berbelanja bahan.</p>
        </div>

        {/* Search */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input
              placeholder="Cari nama toko atau lokasi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-stone-50/80 border-stone-200 rounded-xl text-sm"
            />
          </div>
          <div className="hidden sm:flex items-center px-4 h-10 rounded-xl bg-stone-50/80 border border-stone-200 text-xs text-stone-500 font-medium whitespace-nowrap">
            <span className="text-stone-900 font-semibold mr-1">{filtered.length}</span> vendor
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <Search className="h-12 w-12 text-stone-200" />
            <p className="text-stone-400 font-medium text-sm">Supplier tidak ditemukan</p>
            <p className="text-stone-500 text-xs max-w-xs">
              Supplier akan otomatis ditambahkan saat Anda mencatat pembelian bahan baru di halaman Ingredients.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(supplier => (
              <div 
                key={supplier.id} 
                className="rounded-2xl border border-stone-100 bg-white hover:border-stone-200 transition-all cursor-pointer p-4 space-y-3"
                onClick={() => {
                  setCurrentSupplier(supplier);
                  setIsDialogOpen(true);
                }}
              >
                <div>
                  <h3 className="text-base font-semibold text-stone-900 truncate">{supplier.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1 text-stone-500">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="text-xs line-clamp-1">{supplier.location || "Lokasi belum diisi"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-50">
                  <div className="flex flex-col bg-stone-50/80 p-2.5 rounded-xl">
                    <span className="text-[11px] text-stone-400 flex items-center gap-1 mb-0.5">
                      <FileText className="h-3 w-3" /> Transaksi
                    </span>
                    <span className="text-sm font-semibold text-stone-700">{supplier.total_purchases}</span>
                  </div>
                  <div className="flex flex-col bg-stone-50/80 p-2.5 rounded-xl">
                    <span className="text-[11px] text-stone-400 flex items-center gap-1 mb-0.5">
                      <CalendarDays className="h-3 w-3" /> Terakhir
                    </span>
                    <span className="text-xs font-medium text-stone-700 mt-0.5">
                      {supplier.last_purchase_date 
                        ? new Date(supplier.last_purchase_date).toLocaleDateString('id-ID', {day: 'numeric', month:'short', year:'2-digit'}) 
                        : "–"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6 border-stone-200">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-bold text-stone-900">Info Vendor</DialogTitle>
            <DialogDescription className="text-sm text-stone-500">Update lokasi dan catatan toko</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-600">Nama Toko/Supplier</label>
              <Input
                value={currentSupplier.name}
                disabled
                className="h-10 bg-stone-100 border-stone-200 rounded-xl text-sm text-stone-500"
              />
              <p className="text-[11px] text-stone-400">Nama supplier dibuat otomatis saat mencatat pembelian.</p>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-600">Lokasi</label>
              <Input
                placeholder="Contoh: Jl. Sudirman No 12..."
                value={currentSupplier.location || ""}
                onChange={e => setCurrentSupplier({ ...currentSupplier, location: e.target.value })}
                className="h-10 bg-stone-50/80 border-stone-200 rounded-xl text-sm"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-600">Catatan</label>
              <Input
                placeholder="Jam buka, kontak Whatsapp..."
                value={currentSupplier.notes || ""}
                onChange={e => setCurrentSupplier({ ...currentSupplier, notes: e.target.value })}
                className="h-10 bg-stone-50/80 border-stone-200 rounded-xl text-sm"
              />
            </div>
          </div>
          <DialogFooter className="mt-6 flex gap-2">
            <Button variant="ghost" className="flex-1 h-10 rounded-xl text-sm font-medium text-stone-500" onClick={() => setIsDialogOpen(false)}>
              Batal
            </Button>
            <Button className="flex-1 h-10 rounded-xl text-sm font-semibold" onClick={saveSupplier}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
