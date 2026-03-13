import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileImage, ExternalLink, Receipt, Calendar, User, MapPin } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface ReceiptPreviewProps {
  receiptId?: number | null;
  digitalData?: {
    title: string;
    amount: number;
    date: string;
    member?: string;
    notes?: string;
    location?: string;
  };
  trigger?: React.ReactNode;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({ receiptId, digitalData, trigger }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-[11px] rounded-lg">
            <Receipt className="h-3.5 w-3.5" />
            {receiptId ? "Lihat Struk" : "Digital Preview"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden rounded-2xl border-none">
        <DialogHeader className="p-4 bg-secondary/30 border-b border-border/50">
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            {receiptId ? "Struk Pembelian" : "Preview Digital"}
          </DialogTitle>
        </DialogHeader>

        <div className="p-0 max-h-[70vh] overflow-y-auto">
          {receiptId ? (
            <div className="relative group">
              <img 
                src={`/api/attachments/${receiptId}`} 
                alt="Receipt" 
                className="w-full h-auto object-contain bg-muted/30"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://placehold.co/400x600?text=PDF+or+Unviewable+File';
                }}
              />
              <div className="absolute top-4 right-4 flex gap-2">
                <Button 
                  asChild 
                  size="icon" 
                  variant="secondary" 
                  className="h-8 w-8 rounded-full shadow-lg bg-white/90 backdrop-blur-sm"
                >
                  <a href={`/api/attachments/${receiptId}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          ) : digitalData ? (
            <div className="p-6 space-y-6 bg-white">
              {/* Digital receipt design */}
              <div className="text-center space-y-1">
                <div className="h-12 w-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-2">
                  <Receipt className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-lg text-foreground tracking-tight">{digitalData.title}</h3>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Bukti Digital Semeja</p>
              </div>

              <div className="border-t border-b border-dashed border-border py-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Tanggal</span>
                  </div>
                  <span className="font-medium">{formatDate(digitalData.date)}</span>
                </div>
                
                {digitalData.location && (
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>Lokasi</span>
                    </div>
                    <span className="font-medium">{digitalData.location}</span>
                  </div>
                )}

                {digitalData.member && (
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      <span>Oleh</span>
                    </div>
                    <span className="font-medium">{digitalData.member}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1 pt-2">
                <div className="flex justify-between items-end">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Biaya</span>
                  <span className="text-2xl font-black text-primary">
                    Rp {digitalData.amount.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {digitalData.notes && (
                <div className="bg-secondary/30 p-3 rounded-xl">
                  <p className="text-[11px] text-muted-foreground leading-relaxed italic">
                    "{digitalData.notes}"
                  </p>
                </div>
              )}

              <div className="pt-4 flex flex-col items-center gap-2">
                <div className="w-16 h-1 bg-muted rounded-full opacity-30" />
                <p className="text-[9px] text-muted-foreground/50 font-mono">ID: DIGITAL-{Math.random().toString(36).substring(7).toUpperCase()}</p>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center space-y-3">
              <FileImage className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">Tidak ada struk atau data preview.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
