import { useMember } from "@/hooks/useMember";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Loader2, Sparkles, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

export function NameEntry() {
  const { loadMember, pendingPasswordName } = useMember();
  const [name, setName] = useState(pendingPasswordName || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(!!pendingPasswordName);
  const [error, setError] = useState(pendingPasswordName ? "Akun ini butuh password nih." : "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const nameRegex = /^[a-zA-Z0-9\s.\-]{2,50}$/;
    if (!nameRegex.test(name.trim())) {
      setError("Nama hanya boleh berisi huruf, angka, spasi, titik, atau tanda hubung (min. 2 karakter)");
      return;
    }

    try {
      setIsSubmitting(true);
      await loadMember(name.trim(), password.trim() || undefined);
    } catch (err: any) {
      if (err.message === 'PASSWORD_REQUIRED') {
        setShowPassword(true);
        setError("Akun ini butuh password nih.");
      } else {
        setError(err.message || "Gagal masuk, coba lagi ya");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background px-6 overflow-hidden">
      {/* Background decorative */}
      <div className="absolute -top-32 -right-32 size-96 rounded-full bg-primary/5 pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 size-72 rounded-full bg-accent/5 pointer-events-none" />

      <div className="relative w-full max-w-sm text-center flex flex-col gap-8">
        {/* Logo & Branding */}
        <div className="flex flex-col items-center gap-3 animate-page-in">
          <div className="size-20 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shadow-lg shadow-primary/10 animate-float">
            <picture>
              <source srcSet="/logo.webp" type="image/webp" />
              <img src="/logo.png" alt="Semeja" className="size-12 object-contain" />
            </picture>
          </div>
          <div className="animate-page-in stagger-1">
            <h1 className="text-[28px] font-extrabold tracking-tight text-foreground flex items-center justify-center gap-2">
              Halo! <Sparkles className="size-5 text-accent animate-gentle-pulse" />
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1 font-medium leading-relaxed">
              Siapa nih yang mau gabung aktivitas bareng?
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-xl shadow-black/5 flex flex-col gap-4 animate-page-in stagger-2">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              placeholder="Ketik nama kamu..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cn(
                "h-12 text-center text-base rounded-xl",
                error && !showPassword && "border-destructive focus-visible:ring-destructive/30"
              )}
              autoFocus={!showPassword}
              disabled={isSubmitting || showPassword}
              required
            />

            {showPassword && (
              <div className="flex flex-col gap-2 animate-page-in">
                <Input
                  type="password"
                  placeholder="Masukkan password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 text-center text-base rounded-xl"
                  autoFocus
                  disabled={isSubmitting}
                  required
                />
                <button
                  type="button"
                  className="text-[12px] text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                  onClick={() => {
                    setShowPassword(false);
                    setPassword("");
                    setError("");
                  }}
                >
                  Bukan {name}? Ganti nama
                </button>
              </div>
            )}

            {error && (
              <p className="text-[12px] font-semibold text-destructive animate-page-in">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-[14px] font-bold rounded-xl shadow-sm"
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                  Tunggu sebentar...
                </>
              ) : (
                <>
                  <LogIn data-icon="inline-start" />
                  Gabung Sekarang
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="text-[11px] text-muted-foreground/50 animate-page-in stagger-3">
          Nama kamu akan diingat di perangkat ini
        </p>
      </div>
    </div>
  );
}
