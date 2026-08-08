import { useState } from "react";
import { useMember } from "@/hooks/useMember";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldCheck, KeyRound } from "lucide-react";

interface PasswordSetupProps {
  onComplete: () => void;
}

export function PasswordSetup({ onComplete }: PasswordSetupProps) {
  const { member } = useMember();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 4) {
      setError("Password minimal 4 karakter");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Password tidak sama");
      return;
    }

    try {
      setSaving(true);
      await api.put(`/members/${member?.id}/password`, { newPassword });
      onComplete();
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center flex flex-col gap-8">
        {/* Icon */}
        <div className="relative mx-auto size-20 animate-page-in animate-float">
          <div className="w-full h-full rounded-2xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="size-10 text-primary" />
          </div>
          <div className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-xl bg-amber-500 shadow-lg animate-page-in stagger-2">
            <KeyRound className="size-4 text-white" />
          </div>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-2 animate-page-in stagger-1">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Atur Password</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Halo <span className="font-semibold text-foreground">{member?.name}</span>! 
            Akunmu sekarang menjadi <span className="font-semibold text-primary">Admin</span>. 
            Buat password untuk mengamankan akses admin kamu.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 animate-page-in stagger-2">
          <Input
            type="password"
            placeholder="Password baru (min. 4 karakter)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="h-12 text-center text-base bg-card border-border rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20"
            autoFocus
            disabled={saving}
            required
          />
          <Input
            type="password"
            placeholder="Ulangi password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="h-12 text-center text-base bg-card border-border rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20"
            disabled={saving}
            required
          />

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <Button
            type="submit"
            className="w-full h-12 text-[15px] font-semibold rounded-xl shadow-sm"
            disabled={saving || !newPassword || !confirmPassword}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 size-4" />
                Simpan Password
              </>
            )}
          </Button>
        </form>

        <p className="text-[11px] text-muted-foreground/60 animate-page-in stagger-3">
          Password ini akan diminta setiap kali kamu login
        </p>
      </div>
    </div>
  );
}
