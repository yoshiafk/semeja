import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { Loader2, Plus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExpenseFormDialog } from "@/components/ExpenseFormDialog";

export function LedgerDashboard({ ledgerId }: { ledgerId: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // New settlement form state
  // const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  // const [settlementForm, setSettlementForm] = useState({ payer_id: "", payee_id: "", amount: "" });
  // const [isSaving, setIsSaving] = useState(false);
  
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);

  useEffect(() => {
    if (!ledgerId) return;
    const fetchLedger = async () => {
      try {
        setLoading(true);
        const summary = await api.get(`/ledgers/${ledgerId}/summary`);
        setData(summary);
      } catch (err) {
        console.error("Error fetching ledger", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLedger();
  }, [ledgerId]);

  const handleRefresh = () => {
    setLoading(true);
    api.get(`/ledgers/${ledgerId}/summary`).then(setData).catch(console.error).finally(() => setLoading(false));
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  }

  if (!data) return <div>Failed to load ledger.</div>;

  return (
    <div className="space-y-6 mt-6">
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-semibold text-lg mb-4">Ringkasan Saldo (Balances)</h3>
        <div className="space-y-3">
          {data.balances.map((b: any) => (
            <div key={b.member_id} className="flex justify-between items-center border-b pb-2 last:border-0">
              <span className="font-medium">{b.name}</span>
              <span className={b.balance > 0 ? "text-green-600 font-semibold" : b.balance < 0 ? "text-red-600 font-semibold" : "text-gray-500"}>
                {b.balance > 0 ? `+ ${formatRupiah(b.balance)}` : b.balance < 0 ? `- ${formatRupiah(Math.abs(b.balance))}` : "Lunas"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-lg">Semua Pengeluaran</h3>
          <Button size="sm" onClick={() => setIsExpenseOpen(true)} className="rounded-xl h-8">
            <Plus className="size-4 mr-1" /> Catat
          </Button>
        </div>
        <div className="space-y-3">
          {data.expenses.map((e: any) => (
            <div key={e.id} className="flex justify-between border-b pb-2 last:border-0">
              <div>
                <p className="font-medium">{e.description}</p>
                <p className="text-xs text-gray-500">Dibayar oleh {e.paid_by_name || '?'}</p>
              </div>
              <span className="font-semibold">{formatRupiah(e.amount)}</span>
            </div>
          ))}
          {data.expenses.length === 0 && (
            <div className="flex flex-col items-center justify-center p-6 text-center bg-secondary/50 rounded-2xl border border-dashed border-border gap-3 mt-4">
              <div className="size-10 bg-white rounded-xl shadow-sm border border-border/50 flex items-center justify-center">
                <Receipt className="size-5 text-muted-foreground/70" />
              </div>
              <p className="text-sm text-muted-foreground/70 font-medium">Belum ada pengeluaran dicatat.</p>
            </div>
          )}
        </div>
      </div>

      <ExpenseFormDialog 
        open={isExpenseOpen} 
        onOpenChange={setIsExpenseOpen} 
        ledgerId={ledgerId} 
        onSuccess={handleRefresh} 
      />
    </div>
  );
}
