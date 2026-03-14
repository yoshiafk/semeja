import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatRupiah } from "@/lib/utils";
import { Receipt, ListCheck, ArrowRight, Store } from "lucide-react";

interface OCRItem {
  name: string;
  quantity: number;
  unit: string | null;
  totalPrice: number;
  unitPrice: number | null;
}

interface OCRData {
  supplierName: string;
  date: string | null;
  totalAmount: number;
  items: OCRItem[];
}

interface OCRReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: OCRData | null;
  receiptId: number | null;
  onImport: (selectedItems: OCRItem[], supplierName: string) => void;
}

export const OCRReviewDialog: React.FC<OCRReviewDialogProps> = ({
  open,
  onOpenChange,
  data,
  receiptId,
  onImport
}) => {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  if (!data) return null;

  const toggleItem = (index: number) => {
    setSelectedIndices(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleImport = () => {
    const selected = data.items.filter((_, idx) => selectedIndices.includes(idx));
    onImport(selected, data.supplierName);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-6 border-b bg-secondary/20">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <ListCheck className="h-5 w-5 text-primary" />
              Review Hasil Scan Struk
            </DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Pilih items yang ingin Anda masukkan ke dalam catatan pembelian.
          </p>
        </DialogHeader>

        <div className="flex-1 flex flex-col md:row overflow-hidden">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
            {/* Left: Receipt Preview */}
            <div className="bg-muted/30 p-4 flex flex-col items-center justify-start overflow-hidden border-r">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-1.5 self-start">
                <Receipt className="h-3.5 w-3.5" /> Foto Struk
              </h3>
              <div className="w-full h-full relative rounded-xl overflow-hidden border shadow-sm bg-white">
                {receiptId ? (
                  <img 
                    src={`/api/attachments/${receiptId}`} 
                    alt="Receipt" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground/50 italic text-sm">
                    Struk tidak tersedia
                  </div>
                )}
              </div>
            </div>

            {/* Right: Extracted Items */}
            <div className="flex flex-col bg-white overflow-hidden">
              <div className="p-4 border-b bg-primary/5">
                <div className="flex items-center gap-2 mb-1">
                  <Store className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold text-foreground">
                    {data.supplierName || 'Merchant Tidak Terdeteksi'}
                  </span>
                </div>
                <div className="flex items-end justify-between">
                  <span className="text-xs text-muted-foreground">Total di Struk:</span>
                  <span className="text-lg font-black text-primary">{formatRupiah(data.totalAmount)}</span>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-2">
                  {data.items.map((item, idx) => (
                    <div 
                      key={idx}
                      className={cn(
                        "flex items-start gap-4 p-3 rounded-xl border transition-all cursor-pointer",
                        selectedIndices.includes(idx) 
                          ? "bg-primary/5 border-primary/30 ring-1 ring-primary/10" 
                          : "bg-white border-border hover:border-border-hover"
                      )}
                      onClick={() => toggleItem(idx)}
                    >
                      <Checkbox 
                        checked={selectedIndices.includes(idx)} 
                        onCheckedChange={() => toggleItem(idx)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-tight truncate">
                          {item.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                            {item.quantity} {item.unit || 'pcs'}
                          </span>
                          {item.unitPrice && (
                            <span className="text-[11px] text-muted-foreground">
                              @{formatRupiah(item.unitPrice)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-primary">{formatRupiah(item.totalPrice)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              <div className="p-4 bg-secondary/20 border-t">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="text-muted-foreground">Dipilih ({selectedIndices.length} item):</span>
                  <span className="text-lg text-primary">
                    {formatRupiah(
                      data.items
                        .filter((_, idx) => selectedIndices.includes(idx))
                        .reduce((sum, item) => sum + item.totalPrice, 0)
                    )}
                  </span>
                </div>
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
            disabled={selectedIndices.length === 0}
            className="rounded-xl h-11 px-8 gap-2 font-bold shadow-lg shadow-primary/20"
          >
            Import ke Form
            <ArrowRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Simple utility to conditionally join classNames
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
