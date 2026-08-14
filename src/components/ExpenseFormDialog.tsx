import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ledgerId: number;
  onSuccess: () => void;
}

export function ExpenseFormDialog({ open, onOpenChange, ledgerId, onSuccess }: ExpenseFormDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    paid_by: "",
    category: "other"
  });

  useEffect(() => {
    if (open) {
      api.get("/members").then((data: any) => setMembers(data)).catch(console.error);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount || !formData.paid_by) {
      toast.error("Mohon lengkapi data");
      return;
    }

    try {
      setIsSaving(true);
      await api.post("/expenses", {
        ledger_id: ledgerId,
        description: formData.description,
        amount: parseInt(formData.amount),
        paid_by: parseInt(formData.paid_by),
        category: formData.category,
        split_type: "equal" // Automatically equal split across all active ledger members
      });
      toast.success("Pengeluaran berhasil dicatat");
      onSuccess();
      onOpenChange(false);
      setFormData({ description: "", amount: "", paid_by: "", category: "other" });
    } catch (err) {
      console.error(err);
      toast.error("Gagal mencatat pengeluaran");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Catat Pengeluaran Baru</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          
          <div className="flex flex-col gap-2">
            <Label>Deskripsi</Label>
            <Input 
              placeholder="Contoh: Tiket Masuk Candi" 
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Jumlah (Rp)</Label>
            <Input 
              type="number"
              placeholder="0" 
              value={formData.amount}
              onChange={e => setFormData({ ...formData, amount: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Dibayar Oleh</Label>
            <Select 
              value={formData.paid_by}
              onValueChange={val => setFormData({ ...formData, paid_by: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih anggota yang membayar" />
              </SelectTrigger>
              <SelectContent>
                {members.map(m => (
                  <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full mt-4" disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
            Simpan Pengeluaran
          </Button>

        </form>
      </DialogContent>
    </Dialog>
  );
}
