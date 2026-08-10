import { useState, useMemo } from "react";
import { formatRupiah } from "@/lib/utils";
import type { TripBudgetRow } from "@/types/trip";
import { WhatsAppShareButton } from "./WhatsAppShareButton";
import { formatTripBudgetWhatsApp } from "@/lib/whatsapp";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Pencil, Check, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TripBudgetTableProps {
  tripTitle: string;
  participantCount: number;
  rows: TripBudgetRow[];
  isAdmin?: boolean;
  onUpdateActual?: (rowId: number, actualAmount: number) => Promise<void>;
  onAddBudget?: (data: { category: string, detail?: string, amount_rp?: number, is_accommodation?: boolean }) => Promise<void>;
}

export function TripBudgetTable({ tripTitle, participantCount, rows, isAdmin, onUpdateActual, onAddBudget }: TripBudgetTableProps) {
  const [includeAccommodation, setIncludeAccommodation] = useState(true);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addCategory, setAddCategory] = useState("");
  const [addDetail, setAddDetail] = useState("");
  const [addEstimasi, setAddEstimasi] = useState("");
  const [addIsAccom, setAddIsAccom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayRows = useMemo(() => {
    return rows.filter(r => {
      if (r.is_total_row) return false;
      if (!includeAccommodation && r.is_accommodation) return false;
      return true;
    });
  }, [rows, includeAccommodation]);

  const totalRow = useMemo(() => {
    return rows.find(r => r.is_total_row && r.is_accommodation === includeAccommodation);
  }, [rows, includeAccommodation]);

  const perPersonTotal = totalRow && participantCount > 0
    ? Math.round(totalRow.amount_rp / participantCount)
    : 0;

  const handleSave = (row: TripBudgetRow) => {
    const val = parseInt(editValue, 10);
    if (!isNaN(val) && val !== row.actual_amount_rp && onUpdateActual) {
      onUpdateActual(row.id, val);
    }
    setEditingRow(null);
  };

  return (
    <div className="bg-card border rounded-2xl overflow-hidden shadow-sm mb-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h3 className="font-bold text-foreground text-base">Perkiraan Budget</h3>
        <span className="text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full font-medium">
          {participantCount} orang
        </span>
      </div>

      {/* ── Accommodation toggle ── */}
      <div className="flex items-center gap-2.5 mx-4 mb-3 bg-muted/40 px-3 py-2.5 rounded-xl border border-border/50">
        <Checkbox
          id="include-accom"
          checked={includeAccommodation}
          onCheckedChange={(checked) => setIncludeAccommodation(!!checked)}
        />
        <Label htmlFor="include-accom" className="text-sm cursor-pointer font-medium">
          Tampilkan penginapan
        </Label>
      </div>

      {/* ── Budget rows (list, no table) ── */}
      <div className="divide-y divide-border/60">
        {displayRows.map((row, i) => {
          const isEditing = editingRow === row.id && isAdmin;
          const hasActual = row.actual_amount_rp > 0;

          return (
            <div
              key={i}
              className={cn(
                "flex items-start justify-between gap-3 px-4 py-3",
                i % 2 === 1 && "bg-muted/20"
              )}
            >
              {/* Left: category + detail */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-snug">{row.category}</p>
                {row.detail && (
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{row.detail}</p>
                )}
              </div>

              {/* Right: amounts stacked */}
              <div className="shrink-0 text-right flex flex-col items-end gap-1">
                {/* Estimasi */}
                <span className="text-sm font-medium tabular-nums text-foreground/80">
                  {row.amount_rp > 0 ? formatRupiah(row.amount_rp) : "—"}
                </span>

                {/* Aktual — inline input or tap-to-edit */}
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      className="w-28 text-right bg-background border border-primary rounded-lg px-2 py-1 text-xs text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => handleSave(row)}
                      onKeyDown={e => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setEditingRow(null);
                      }}
                      autoFocus
                    />
                    <button
                      onMouseDown={e => { e.preventDefault(); handleSave(row); }}
                      className="p-1 rounded-md bg-primary/10 text-primary"
                    >
                      <Check className="size-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (!isAdmin) return;
                      setEditingRow(row.id);
                      setEditValue(hasActual ? String(row.actual_amount_rp) : "");
                    }}
                    className={cn(
                      "flex items-center gap-1 text-xs rounded-md px-1.5 py-0.5 transition-colors",
                      hasActual
                        ? "text-primary font-semibold tabular-nums"
                        : isAdmin
                        ? "text-muted-foreground hover:text-primary hover:bg-primary/8 font-medium"
                        : "text-muted-foreground"
                    )}
                  >
                    {hasActual ? formatRupiah(row.actual_amount_rp) : isAdmin ? (
                      <>
                        <Pencil className="size-2.5" /> Isi aktual
                      </>
                    ) : "—"}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* ── Add New Budget Button (Admin only) ── */}
        {isAdmin && (
          <div className="px-4 py-3 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              className="w-full border-dashed rounded-xl h-10 text-muted-foreground hover:text-primary hover:bg-primary/5 hover:border-primary/30"
              onClick={() => {
                setAddCategory("");
                setAddDetail("");
                setAddEstimasi("");
                setAddIsAccom(false);
                setIsAddOpen(true);
              }}
            >
              <Plus className="size-4 mr-1.5" />
              Tambah Kategori
            </Button>
          </div>
        )}

        {/* ── Total row ── */}
        {totalRow && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/40 border-t border-border">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Total</p>
              <p className="text-xs text-muted-foreground">
                {includeAccommodation ? "Termasuk" : "Tanpa"} akomodasi
              </p>
            </div>
            <div className="shrink-0 text-right flex flex-col items-end gap-0.5">
              <span className="text-sm font-bold tabular-nums">{formatRupiah(totalRow.amount_rp)}</span>
              {totalRow.actual_amount_rp > 0 && (
                <span className="text-xs font-semibold text-primary tabular-nums">
                  {formatRupiah(totalRow.actual_amount_rp)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Per-person cards ── */}
      {totalRow && (
        <div className="grid grid-cols-2 gap-3 p-4">
          <div className="bg-muted/30 border border-border/50 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1 font-medium">👤 Estimasi/Orang</p>
            <p className="text-base font-bold tabular-nums">{formatRupiah(perPersonTotal)}</p>
          </div>
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 text-center">
            <p className="text-xs text-primary/70 mb-1 font-medium">👤 Aktual/Orang</p>
            <p className="text-base font-bold text-primary tabular-nums">
              {totalRow.actual_amount_rp > 0 && participantCount > 0
                ? formatRupiah(Math.round(totalRow.actual_amount_rp / participantCount))
                : "—"}
            </p>
          </div>
        </div>
      )}

      {/* ── WhatsApp share ── */}
      <div className="px-4 pb-4">
        <WhatsAppShareButton
          message={formatTripBudgetWhatsApp(tripTitle, participantCount, rows, includeAccommodation)}
          label="Bagikan estimasi via WhatsApp"
          className="w-full justify-center"
        />
      </div>

      {/* ── Add Budget Dialog ── */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md w-[95%] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle>Tambah Budget</DialogTitle>
            <DialogDescription className="text-xs">
              Masukkan rencana pengeluaran baru (tiket kereta, wisata, dll).
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-3">
            <div className="grid gap-1.5">
              <Label htmlFor="category" className="text-xs font-semibold">Kategori *</Label>
              <input
                id="category"
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Cth: Tiket Kereta Jakarta-Smg"
                value={addCategory}
                onChange={e => setAddCategory(e.target.value)}
                autoFocus
              />
            </div>
            
            <div className="grid gap-1.5">
              <Label htmlFor="detail" className="text-xs font-semibold">Detail Keterangan</Label>
              <input
                id="detail"
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Cth: Rp 200rb/orang x 3"
                value={addDetail}
                onChange={e => setAddDetail(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="estimasi" className="text-xs font-semibold">Estimasi Total Biaya (Rp)</Label>
              <input
                id="estimasi"
                type="number"
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Cth: 600000"
                value={addEstimasi}
                onChange={e => setAddEstimasi(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 mt-2 p-3 bg-muted/40 rounded-xl border border-border/50">
              <Checkbox 
                id="is-accom-add" 
                checked={addIsAccom}
                onCheckedChange={(checked) => setAddIsAccom(!!checked)}
              />
              <Label htmlFor="is-accom-add" className="text-sm font-medium cursor-pointer">
                Ini adalah biaya penginapan
              </Label>
            </div>
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl w-full sm:w-auto" disabled={isSubmitting}>
              Batal
            </Button>
            <Button 
              className="rounded-xl w-full sm:w-auto" 
              disabled={!addCategory.trim() || isSubmitting}
              onClick={async () => {
                if (onAddBudget && addCategory.trim()) {
                  setIsSubmitting(true);
                  await onAddBudget({
                    category: addCategory.trim(),
                    detail: addDetail.trim(),
                    amount_rp: addEstimasi ? parseInt(addEstimasi, 10) : 0,
                    is_accommodation: addIsAccom
                  });
                  setIsSubmitting(false);
                  setIsAddOpen(false);
                }
              }}
            >
              {isSubmitting ? "Menyimpan..." : "Simpan Budget"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
