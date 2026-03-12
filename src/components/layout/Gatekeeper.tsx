import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Home, KeyRound } from "lucide-react";

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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center space-y-8">
        {/* Logo with Key Badge */}
        <div className="relative mx-auto w-24 h-24 animate-page-in animate-float">
          <picture>
            <source srcSet="/logo.webp" type="image/webp" />
            <img src="/logo.png" alt="Semeja" className="w-full h-full object-contain" />
          </picture>
          <div className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-lg animate-page-in stagger-2">
            <KeyRound className="h-4 w-4 text-primary-foreground" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2 animate-page-in stagger-1">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Selamat Datang!</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Semeja khusus untuk penghuni coliving. Masukkan kunci rumah untuk masuk.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3 animate-page-in stagger-2">
          <Input
            type="password"
            placeholder="Masukkan kunci rumah..."
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="h-13 text-lg text-center tracking-[0.15em] bg-card border-border rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20"
            autoFocus
            disabled={loading}
          />
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <Button
            type="submit"
            className="w-full h-12 text-[15px] font-semibold rounded-xl"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mengecek...
              </>
            ) : (
              <>
                <Home className="mr-2 h-4 w-4" />
                Masuk Rumah
              </>
            )}
          </Button>
        </form>

        <p className="text-[11px] text-muted-foreground/60 animate-page-in stagger-3">
          Lupa kunci? Tanya teman atau admin coliving kamu ya.
        </p>
      </div>
    </div>
  );
}
