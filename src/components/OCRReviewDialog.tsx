import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "./ui/checkbox";
import { ScrollArea } from "./ui/scroll-area";
import { Input } from "@/components/ui/input";
import { formatRupiah, cn } from "@/lib/utils";
import { Receipt, ListCheck, ArrowRight, Store, Search, Info, Loader2, Users, Plus } from "lucide-react";

interface OCRItem {
  name: string;
  quantity: number;
  unit: string | null;
  totalPrice: number;
  unitPrice: number | null;
  matchedIngredientId?: number;
}

interface OCRData {
  supplierName: string;
  date: string | null;
  totalAmount: number;
  items: OCRItem[];
}

interface Ingredient {
  id: number;
  name: string;
  unit: string;
}

interface Member {
  id: number;
  name: string;
}

interface OCRReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: OCRData | null;
  receiptId: number | null;
  ingredients: Ingredient[];
  members: Member[];
  onImport: (selectedItems: (OCRItem & { isNewIngredient?: boolean })[], supplierName: string, memberId?: number) => void;
  loading?: boolean;
}

export const OCRReviewDialog: React.FC<OCRReviewDialogProps> = ({
  open,
  onOpenChange,
  data,
  receiptId,
  ingredients,
  members,
  onImport,
  loading = false
}) => {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [matches, setMatches] = useState<{ [key: number]: number | 'NEW' }>({});
  const [selectedMemberId, setSelectedMemberId] = useState<number | undefined>(undefined);

  // Auto-match items when data changes
  useEffect(() => {
    if (!data || ingredients.length === 0) return;

    const newMatches: { [key: number]: number | 'NEW' } = {};
    const newSelected: number[] = [];

    data.items.forEach((item, idx) => {
      // Simple name matching
      const match = ingredients.find(ing => 
        ing.name.toLowerCase().includes(item.name.toLowerCase()) || 
        item.name.toLowerCase().includes(ing.name.toLowerCase())
      );
      
      if (match) {
        newMatches[idx] = match.id;
        newSelected.push(idx);
      } else {
        // Default to NEW if no match found for items that have price
        if (item.totalPrice > 0) {
          newMatches[idx] = 'NEW';
          newSelected.push(idx);
        }
      }
    });

    setMatches(newMatches);
    setSelectedIndices(newSelected);
  }, [data, ingredients]);

  // Create a datalist for ingredients
  const datalistId = useMemo(() => `ingredients-list-${Math.random().toString(36).substr(2, 9)}`, []);

  if (!data && !loading) return null;

  const toggleItem = (index: number) => {
    setSelectedIndices(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleMatchChange = (index: number, ingredientName: string) => {
    if (ingredientName === "ADD_NEW") {
      setMatches(prev => ({ ...prev, [index]: 'NEW' }));
      if (!selectedIndices.includes(index)) {
        setSelectedIndices(prev => [...prev, index]);
      }
      return;
    }

    const ingredient = ingredients.find(ing => ing.name === ingredientName);
    if (ingredient) {
      setMatches(prev => ({ ...prev, [index]: ingredient.id }));
      if (!selectedIndices.includes(index)) {
        setSelectedIndices(prev => [...prev, index]);
      }
    } else {
      setMatches(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  const handleImport = () => {
    if (!data) return;
    const selected = data.items
      .filter((_, idx) => selectedIndices.includes(idx))
      .map((item, idx) => {
        return {
          ...item,
          matchedIngredientId: matches[idx] === 'NEW' ? undefined : (matches[idx] as number),
          isNewIngredient: matches[idx] === 'NEW'
        };
      });

    onImport(selected, data.supplierName, selectedMemberId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-none w-[98vw] h-[98vh] flex flex-col p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
        <DialogHeader className="p-6 border-b bg-secondary/20">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <ListCheck className="h-5 w-5 text-primary" />
              Review & Cocokkan Hasil Scan
            </DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Centang items yang valid dan cocokkan dengan bahan di database untuk memproses otomatis.
          </p>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
            {/* Left: Receipt Preview */}
            <div className="bg-muted/30 p-4 flex flex-col items-center justify-start overflow-hidden border-r">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-1.5 self-start">
                <Receipt className="h-3.5 w-3.5" /> Foto Struk
              </h3>
              <div className="w-full h-full relative rounded-xl overflow-hidden border shadow-sm bg-white">
                {receiptId ? (
                  <>
                    <img 
                      src={`/api/attachments/${receiptId}`} 
                      alt="Receipt" 
                      className="w-full h-full object-contain"
                    />
                    {loading && (
                      <div className="absolute inset-0 bg-black/5 overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-primary shadow-[0_0_15px_rgba(var(--primary),0.8)] animate-scan-line" />
                        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-primary/10 opacity-30 animate-pulse" />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground/50 italic text-sm">
                    {loading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
                        <p>Mengambil gambar...</p>
                      </div>
                    ) : "Struk tidak tersedia"}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Extracted Items */}
            <div className="flex flex-col bg-white overflow-hidden">
              <div className="p-4 border-b bg-primary/5">
                <div className="flex items-center gap-2 mb-1">
                  <Store className="h-5 w-5 text-primary" />
                  <span className="text-base font-bold text-foreground">
                    {data?.supplierName || 'Merchant Tidak Terdeteksi'}
                  </span>
                </div>
                <div className="flex items-end justify-between mb-4">
                  <span className="text-sm text-muted-foreground">Total di Struk:</span>
                  <span className="text-2xl font-black text-primary">{formatRupiah(data?.totalAmount || 0)}</span>
                </div>

                <div className="space-y-1.5 pt-3 border-t">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                    <Users className="h-3 w-3" /> Siapa yang bayar?
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {members.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMemberId(m.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                          selectedMemberId === m.id
                            ? "bg-primary text-white border-primary shadow-md shadow-primary/20 scale-105"
                            : "bg-white text-muted-foreground border-border hover:border-primary/30"
                        )}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  <datalist id={datalistId}>
                    <option value="ADD_NEW">Tambah sebagai bahan baru...</option>
                    {ingredients.map(ing => (
                      <option key={ing.id} value={ing.name} />
                    ))}
                  </datalist>

                  {loading ? (
                    // Skeleton Loaders
                    Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex flex-col gap-3 p-3 rounded-xl border border-border bg-white animate-pulse">
                        <div className="flex items-start gap-3">
                          <div className="h-5 w-5 rounded bg-muted mt-1" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 w-3/4 bg-muted rounded" />
                            <div className="h-3 w-1/2 bg-muted rounded" />
                          </div>
                          <div className="h-5 w-20 bg-muted rounded" />
                        </div>
                        <div className="pl-7 h-10 bg-muted/50 rounded-lg" />
                      </div>
                    ))
                  ) : (
                    data?.items.map((item, idx) => {
                      const matchedIngId = matches[idx];
                      const matchedIng = ingredients.find(ing => ing.id === matchedIngId);
                      
                      return (
                        <div 
                          key={idx}
                          className={cn(
                            "flex flex-col gap-3 p-3 rounded-xl border transition-all",
                            selectedIndices.includes(idx) 
                              ? "bg-primary/5 border-primary/30 ring-1 ring-primary/10" 
                              : "bg-white border-border hover:border-border-hover"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox 
                              checked={selectedIndices.includes(idx)} 
                              onCheckedChange={() => toggleItem(idx)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-base font-bold text-foreground leading-tight truncate">
                                {item.name}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-md font-medium">
                                  {item.quantity} {item.unit || 'pcs'}
                                </span>
                                {item.unitPrice && (
                                  <span className="text-xs text-muted-foreground">
                                    @{formatRupiah(item.unitPrice)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-black text-primary">{formatRupiah(item.totalPrice)}</p>
                            </div>
                          </div>

                          {/* Matching Search */}
                          <div className="pl-7 space-y-1.5">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
                              <Input
                                placeholder="Cari bahan yang cocok..."
                                defaultValue={matchedIngId === 'NEW' ? "Tambah sebagai bahan baru..." : (matchedIng?.name || "")}
                                onBlur={(e) => handleMatchChange(idx, e.target.value)}
                                list={datalistId}
                                className={cn(
                                  "h-10 pl-8 text-sm rounded-lg bg-white",
                                  !matchedIngId && "border-amber-200 bg-amber-50/30",
                                  matchedIngId === 'NEW' && "border-green-200 bg-green-50/30 text-green-700 font-medium"
                                )}
                              />
                            </div>
                            {!matchedIngId && (
                              <p className="text-[10px] text-amber-600 flex items-center gap-1 font-medium pl-1">
                                <Info className="h-2.5 w-2.5" />
                                Wajib dipilih untuk proses otomatis
                              </p>
                            )}
                            {matchedIngId === 'NEW' && (
                              <p className="text-[10px] text-green-600 flex items-center gap-1 font-medium pl-1">
                                <Plus className="h-2.5 w-2.5" />
                                Akan ditambahkan otomatis ke database
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
              
              <div className="p-4 bg-secondary/20 border-t">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-1 text-sm text-primary font-medium">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gemini sedang membaca struk Anda...
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span className="text-muted-foreground">Dipilih ({selectedIndices.length} item):</span>
                    <span className="text-lg text-primary">
                      {formatRupiah(
                        data?.items
                          .filter((_, idx) => selectedIndices.includes(idx))
                          .reduce((sum, item) => sum + item.totalPrice, 0) || 0
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 border-t gap-3 sm:gap-0 bg-white">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="rounded-xl h-11"
          >
            Batal
          </Button>
          <Button 
            onClick={handleImport}
            disabled={loading || selectedIndices.length === 0}
            className="rounded-xl h-11 px-8 gap-2 font-bold shadow-lg shadow-primary/20"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menganalisa...
              </>
            ) : (
              <>
                Simpan & Proses Items
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
