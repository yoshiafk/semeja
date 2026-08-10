import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Home, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

interface GatekeeperProps {
  onSuccess: (key: string) => void;
}

export function Gatekeeper({ onSuccess }: GatekeeperProps) {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch('/api/auth/gatekeeper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() }),
      });

      if (response.ok) {
        onSuccess(key.trim());
      } else {
        const data = await response.json();
        setError(data.error || "Kunci salah, coba lagi ya!");
      }
    } catch (err) {
      setError("Waduh, gagal connect ke server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background px-6 overflow-hidden">
      {/* Background decorative circles */}
      <div className="absolute -top-32 -right-32 size-96 rounded-full bg-primary/5 pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 size-72 rounded-full bg-accent/5 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[500px] rounded-full bg-primary/3 pointer-events-none" />

      <div className="relative w-full max-w-sm text-center flex flex-col gap-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 animate-page-in">
          <div className="relative">
            <div className="size-24 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shadow-lg shadow-primary/10 animate-float">
              <picture>
                <source srcSet="/logo.webp" type="image/webp" />
                <img src="/logo.png" alt="Semeja" className="size-14 object-contain" />
              </picture>
            </div>
            <div className="absolute -bottom-2 -right-2 size-9 rounded-xl bg-primary shadow-md shadow-primary/30 flex items-center justify-center animate-page-in stagger-1">
              <KeyRound className="size-4 text-primary-foreground" />
            </div>
          </div>
          <div>
            <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">Semeja</h1>
            <p className="text-[13px] text-muted-foreground font-medium mt-0.5">Super app untuk coliving</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-xl shadow-black/5 flex flex-col gap-4 animate-page-in stagger-2">
          <div>
            <h2 className="text-[17px] font-bold text-foreground">Selamat Datang!</h2>
            <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
              Semeja khusus untuk penghuni coliving. Masukkan kunci rumah untuk masuk.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              type="password"
              placeholder="Masukkan kunci rumah..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className={cn(
                "h-12 text-base text-center tracking-[0.2em] rounded-xl",
                error && "border-destructive focus-visible:ring-destructive/30"
              )}
              autoFocus
              disabled={loading}
            />
            {error && (
              <p className="text-[12px] font-semibold text-destructive animate-page-in">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full h-12 text-[14px] font-bold rounded-xl shadow-sm"
              disabled={loading || !key.trim()}
            >
              {loading ? (
                <>
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                  Mengecek...
                </>
              ) : (
                <>
                  <Home data-icon="inline-start" />
                  Masuk Rumah
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="text-[11px] text-muted-foreground/50 animate-page-in stagger-3">
          Lupa kunci? Tanya teman atau admin coliving kamu ya.
        </p>
      </div>
    </div>
  );
}
