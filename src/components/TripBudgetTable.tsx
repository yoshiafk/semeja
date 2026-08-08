import { useState, useMemo } from "react";
import { formatRupiah } from "@/lib/utils";
import type { TripBudgetRow } from "@/types/trip";
import { WhatsAppShareButton } from "./WhatsAppShareButton";
import { formatTripBudgetWhatsApp } from "@/lib/whatsapp";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface TripBudgetTableProps {
  tripTitle: string;
  participantCount: number;
  rows: TripBudgetRow[];
}

export function TripBudgetTable({ tripTitle, participantCount, rows }: TripBudgetTableProps) {
  const [includeAccommodation, setIncludeAccommodation] = useState(true);

  // Filter rows based on toggle (only filter non-total rows for the list)
  const displayRows = useMemo(() => {
    return rows.filter(r => {
      if (r.is_total_row) return false;
      if (!includeAccommodation && r.is_accommodation) return false;
      return true;
    });
  }, [rows, includeAccommodation]);

  // Find the right total row
  const totalRow = useMemo(() => {
    return rows.find(r => r.is_total_row && r.is_accommodation === includeAccommodation);
  }, [rows, includeAccommodation]);

  const perPersonTotal = totalRow && participantCount > 0 
    ? Math.round(totalRow.amount_rp / participantCount) 
    : 0;

  return (
    <div className="bg-card border rounded-2xl overflow-hidden shadow-sm mb-4 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-foreground text-lg">Perkiraan Budget</h3>
        <span className="text-sm text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
          {participantCount} Orang
        </span>
      </div>

      {/* Toggle */}
      <div className="flex items-center space-x-2 bg-muted/30 p-3 rounded-lg mb-4 border border-border/50">
        <Checkbox 
          id="include-accom" 
          checked={includeAccommodation}
          onCheckedChange={(checked) => setIncludeAccommodation(!!checked)}
        />
        <Label htmlFor="include-accom" className="text-sm cursor-pointer">
          Tampilkan penginapan
        </Label>
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden mb-5">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium">
            <tr>
              <th className="py-2.5 px-3">Kategori</th>
              <th className="py-2.5 px-3 hidden xs:table-cell">Detail</th>
              <th className="py-2.5 px-3 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {displayRows.map((row, i) => (
              <tr key={i} className={i % 2 === 1 ? "bg-muted/10" : "bg-transparent"}>
                <td className="py-2.5 px-3">
                  <span className="font-medium">{row.category}</span>
                  <div className="text-xs text-muted-foreground xs:hidden mt-0.5">{row.detail}</div>
                </td>
                <td className="py-2.5 px-3 hidden xs:table-cell text-muted-foreground">
                  {row.detail}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                  {row.amount_rp > 0 ? formatRupiah(row.amount_rp) : "—"}
                </td>
              </tr>
            ))}
            
            {/* Total Row */}
            {totalRow && (
              <tr className="bg-muted/50 font-bold">
                <td colSpan={2} className="py-3 px-3">
                  Total <span className="font-normal text-xs text-muted-foreground block xs:inline">({includeAccommodation ? "Termasuk" : "Tanpa"} akomodasi)</span>
                </td>
                <td className="py-3 px-3 text-right tabular-nums text-primary whitespace-nowrap">
                  {formatRupiah(totalRow.amount_rp)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Per Person Callout */}
      {totalRow && (
        <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 mb-4 text-center">
          <p className="text-sm text-muted-foreground mb-1">
            👤 Per Orang <span className="text-xs">({includeAccommodation ? "termasuk" : "tanpa"} akomodasi)</span>
          </p>
          <p className="text-2xl font-bold text-primary">
            {formatRupiah(perPersonTotal)}
          </p>
        </div>
      )}

      {/* Share Button */}
      <WhatsAppShareButton
        message={formatTripBudgetWhatsApp(tripTitle, participantCount, rows, includeAccommodation)}
        label="Bagikan estimasi via WhatsApp"
        className="w-full justify-center"
      />
    </div>
  );
}
