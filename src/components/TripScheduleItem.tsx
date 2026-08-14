import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, ExternalLink, Check, Clock, Pencil, Trash2, Loader2, Receipt, ReceiptText, Sparkles, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduleItem, ActivityType } from "@/types/trip";

// ── Icon map by activity type ────────────────────────────────────────────
import {
  Utensils, Landmark, Bus, Hotel, Music, ShoppingBag, Sun,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox as UiCheckbox } from "@/components/ui/checkbox";
import { ReceiptUpload } from "./ReceiptUpload";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const ACTIVITY_ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  food:        Utensils,
  attraction:  Landmark,
  transit:     Bus,
  hotel:       Hotel,
  event:       Music,
  shopping:    ShoppingBag,
  leisure:     Sun,
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  food:        "text-amber-500 bg-amber-50 ring-amber-50",
  attraction:  "text-blue-500 bg-blue-50 ring-blue-50",
  transit:     "text-gray-500 bg-gray-100 ring-gray-100",
  hotel:       "text-teal-500 bg-teal-50 ring-teal-50",
  event:       "text-violet-500 bg-violet-50 ring-violet-50",
  shopping:    "text-pink-500 bg-pink-50 ring-pink-50",
  leisure:     "text-orange-500 bg-orange-50 ring-orange-50",
};

interface TripScheduleItemProps {
  item: ScheduleItem;
  slug: string;
  isLast?: boolean;
  isAdmin?: boolean;
  onToggleDone?: (itemId: number, isDone: boolean) => Promise<void>;
  onDeleted?: (itemId: number) => void;
  onUpdated?: (itemId: number, data: Partial<ScheduleItem>) => void | Promise<void>;
  onAddBudget?: (data: { category: string, detail?: string, amount_rp?: number, is_accommodation?: boolean }) => Promise<void>;
}

export function TripScheduleItem({ item, slug, isLast = false, isAdmin, onToggleDone, onDeleted, onUpdated, onAddBudget }: TripScheduleItemProps) {
  const [expandedNotes, setExpandedNotes] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBillOpen, setIsBillOpen] = useState(false);
  const [billTotal, setBillTotal] = useState(item.bill_total_rp?.toString() || "");
  const [receiptId, setReceiptId] = useState<number | null>(item.receipt_id || null);
  const [isSavingBill, setIsSavingBill] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [addToBudget, setAddToBudget] = useState(true);
  const Icon = ACTIVITY_ICONS[item.activity_type] ?? MapPin;
  const colorClass = ACTIVITY_COLORS[item.activity_type] ?? "text-gray-500 bg-gray-100 ring-gray-100";

  const handleMapsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(item.maps_url, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Hapus agenda "${item.name}"?`)) return;
    setIsDeleting(true);
    try {
      const { deleteTripScheduleItem } = await import("@/lib/api");
      await deleteTripScheduleItem(slug, item.id);
      if (onDeleted) onDeleted(item.id);
    } catch (err) {
      console.error("Failed to delete schedule item:", err);
      setIsDeleting(false);
      const { toast } = await import("sonner");
      toast.error("Gagal menghapus jadwal");
    }
  };

  const handleSaveBill = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsSavingBill(true);
    try {
      const parsedBill = billTotal ? parseInt(billTotal.replace(/[^0-9]/g, ''), 10) : undefined;
      const data = { bill_total_rp: parsedBill, receipt_id: receiptId };
      if (onUpdated) {
        await onUpdated(item.id, data);
      }
      
      if (addToBudget && parsedBill && onAddBudget) {
        await onAddBudget({
          category: item.activity_type,
          detail: item.name,
          amount_rp: parsedBill,
          is_accommodation: item.activity_type === 'hotel'
        });
      }
      
      setIsBillOpen(false);
    } catch (err) {
      console.error("Failed to save bill:", err);
      const { toast } = await import("sonner");
      toast.error("Gagal menyimpan pengeluaran");
    } finally {
      setIsSavingBill(false);
    }
  };

  const handleScanSuccess = async (scanData: any, uploadedReceiptId: number) => {
    setIsScanning(false);
    if (scanData && scanData.totalAmount) {
      setBillTotal(scanData.totalAmount.toString());
      setReceiptId(uploadedReceiptId);
      
      const { toast } = await import("sonner");
      toast.success("AI berhasil membaca nominal dari struk!");
    }
  };

  return (
    <div className="flex gap-4 relative group">
      {/* Time rail & Timeline line (Left Column) */}
      <div className="w-12 flex-shrink-0 flex flex-col items-end pt-3 relative">
        <span className="text-sm font-bold text-foreground leading-none">
          {item.time_start}
        </span>
        {item.time_end && (
          <span className="text-[10px] font-medium text-muted-foreground mt-1">
            {item.time_end}
          </span>
        )}
      </div>

      {/* Timeline line and Icon */}
      <div className="relative flex flex-col items-center flex-shrink-0">
        <div className={cn("z-10 mt-2 size-8 rounded-full flex items-center justify-center ring-4 ring-background", colorClass)}>
          <Icon className="size-4" />
        </div>
        {!isLast && (
          <div className="absolute top-10 w-[2px] bg-border bottom-[-2rem]" />
        )}
      </div>

      {/* Card Content (Right Column) */}
      <div className="flex-1 py-1 pb-4 min-w-0">
        <div className={cn(
          "bg-card border border-border/60 shadow-sm rounded-2xl p-4 transition-all hover:shadow-md hover:border-border",
          item.is_done && "opacity-60 bg-muted/50"
        )}>
          
          {/* Header: Title & Admin Checkbox/Dropdown */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <h4 className={cn(
              "font-bold text-base leading-snug text-foreground",
              item.is_done && "line-through text-muted-foreground"
            )}>
              {item.name}
            </h4>
            
            {isAdmin && (
                <div className="flex items-center gap-1 -mt-1 -mr-1">
                  {/* Dropdown Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg">
                      <DropdownMenuItem onClick={() => setIsBillOpen(true)} className="gap-2 cursor-pointer p-3">
                        <Receipt className="size-4 text-primary" /> <span className="font-medium text-primary">Catat Pengeluaran</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild className="p-0">
                        <Link to={`/trips/${slug}/schedule/${item.id}/edit`} className="w-full flex items-center gap-2 cursor-pointer p-3">
                          <Pencil className="size-4 text-muted-foreground" /> <span>Edit Agenda</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleDelete} className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer p-3">
                        {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} 
                        <span>Hapus</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onToggleDone) onToggleDone(item.id, !item.is_done);
                    }}
                    className={cn(
                      "flex-shrink-0 size-8 rounded-full border-2 flex items-center justify-center transition-all duration-200 active:scale-90 ml-1",
                      item.is_done 
                        ? "bg-primary border-primary text-primary-foreground" 
                        : "border-border hover:border-primary/50 bg-background text-transparent hover:text-primary/20"
                    )}
                    aria-label={item.is_done ? "Tandai belum selesai" : "Tandai selesai"}
                  >
                    <Check className={cn("size-4", item.is_done ? "text-primary-foreground" : "text-transparent")} strokeWidth={3} />
                  </button>
               </div>
            )}
          </div>

          {/* Details (Location, Time) */}
          <div className="flex flex-col gap-2">
            {(item.location || item.area || item.opening_hours || item.maps_url) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1 text-xs text-muted-foreground">
                {(item.location || item.area || item.maps_url) && (
                  <div className="flex items-center gap-1 min-w-0">
                    <MapPin className="size-3.5 flex-shrink-0 text-muted-foreground/70" />
                    {(item.location || item.area) && (
                      <span className="truncate max-w-[160px] sm:max-w-[200px]">
                        {item.location || item.area}
                        {item.location && item.area && ` · ${item.area}`}
                      </span>
                    )}
                    {item.maps_url && (
                      <button
                        onClick={handleMapsClick}
                        className={cn(
                          "text-blue-500 hover:text-blue-600 active:scale-95 transition-transform flex items-center gap-1",
                          (item.location || item.area) ? "ml-1" : "ml-0"
                        )}
                        aria-label={`Buka ${item.name} di Maps`}
                      >
                        {(!item.location && !item.area) && <span className="font-medium">Lihat di Maps</span>}
                        <ExternalLink className="size-3.5" />
                      </button>
                    )}
                  </div>
                )}
                {item.opening_hours && (
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <Clock className="size-3.5 flex-shrink-0 text-muted-foreground/70" />
                    <span>{item.opening_hours}</span>
                  </div>
                )}
              </div>
            )}

            {/* Badges row */}
            {(item.is_highlight || item.is_cash_only || item.requires_booking || item.is_optional) && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {item.is_highlight && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-yellow-100 text-yellow-700">
                    ⭐ HIGHLIGHT
                  </span>
                )}
                {item.is_cash_only && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-red-100 text-red-700">
                    💵 CASH ONLY
                  </span>
                )}
                {item.requires_booking && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-orange-100 text-orange-700">
                    📌 BOOK DULU
                  </span>
                )}
                {item.is_optional && (
                  <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-muted text-muted-foreground">
                    Opsional
                  </span>
                )}
              </div>
            )}
            
            {/* Bill Info */}
            {(item.bill_total_rp !== undefined && item.bill_total_rp !== null) && (
              <div className="mt-1 flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-semibold border border-emerald-100">
                  <ReceiptText className="size-3.5" />
                  <span>Rp {item.bill_total_rp.toLocaleString("id-ID")}</span>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {item.notes && (
             <div className="mt-3">
               <p className={cn(
                 "text-sm text-muted-foreground leading-relaxed italic",
                 !expandedNotes && "line-clamp-2"
               )}>
                 {item.notes}
               </p>
               {item.notes.length > 80 && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setExpandedNotes(!expandedNotes); }}
                    className="text-[11px] text-primary font-medium mt-1 hover:underline active:scale-95"
                  >
                    {expandedNotes ? "Tutup" : "Lihat selengkapnya"}
                  </button>
                )}
             </div>
          )}
        </div>
      </div>

      {/* Bill Dialog */}
      {isAdmin && (
        <Dialog open={isBillOpen} onOpenChange={setIsBillOpen}>
          <DialogContent onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Catat Pengeluaran: {item.name}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="space-y-2">
                <Label>Total Tagihan (Rp)</Label>
                <Input 
                  type="text" 
                  inputMode="numeric"
                  placeholder="Contoh: 150000"
                  value={billTotal}
                  onChange={(e) => setBillTotal(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Struk / Bon</Label>
                <ReceiptUpload 
                  initialId={receiptId}
                  onUploadSuccess={setReceiptId}
                  onClear={() => setReceiptId(null)}
                  autoScan={true}
                  isScanning={isScanning}
                  onScanStart={() => setIsScanning(true)}
                  onScanSuccess={handleScanSuccess}
                />
              </div>
              
              {onAddBudget && (
                <div className="flex items-center space-x-2 pt-1 pb-2">
                  <UiCheckbox 
                    id="addToBudget" 
                    checked={addToBudget} 
                    onCheckedChange={(checked) => setAddToBudget(checked as boolean)} 
                  />
                  <Label htmlFor="addToBudget" className="text-xs text-muted-foreground font-normal leading-tight">
                    Otomatis tambahkan pengeluaran ini ke tab Budget trip
                  </Label>
                </div>
              )}
              
              <Button onClick={handleSaveBill} disabled={isSavingBill || isScanning} className="w-full mt-2">
                {isSavingBill ? <Loader2 className="size-4 animate-spin mr-2" /> : <Sparkles className="size-4 mr-2" />}
                Simpan Tagihan
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
