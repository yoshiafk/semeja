import { useMember } from "@/hooks/useMember";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Loader2, Sparkles, LogIn } from "lucide-react";

export function NameEntry() {
  const { loadMember, loading } = useMember();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await loadMember(name.trim(), password.trim() || undefined);
    } catch (err: any) {
      if (err.message === 'PASSWORD_REQUIRED') {
        setShowPassword(true);
        setError("Akun ini butuh password nih.");
      } else {
        setError(err.message || "Gagal masuk, coba lagi ya");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center space-y-8">
        {/* Logo & Branding */}
        <div className="space-y-4 animate-page-in">
          <div className="mx-auto w-20 h-20">
            <picture>
              <source srcSet="/logo.webp" type="image/webp" />
              <img src="/logo.png" alt="Semeja" className="w-full h-full object-contain" />
            </picture>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center justify-center gap-2">
              Halo! <Sparkles className="h-5 w-5 text-accent" />
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Siapa nih yang mau gabung aktivitas bareng?
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            placeholder="Ketik nama kamu..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-12 text-center text-base bg-card border-border rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20"
            autoFocus={!showPassword}
            disabled={loading || showPassword}
            required
          />

          {showPassword && (
            <div className="space-y-2 animate-page-in">
              <Input
                type="password"
                placeholder="Masukkan password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 text-center text-base bg-card border-border rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20"
                autoFocus
                disabled={loading}
                required
              />
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  setShowPassword(false);
                  setPassword("");
                  setError("");
                }}
              >
                Bukan kamu? Ganti nama
              </button>
            </div>
          )}

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <Button
            type="submit"
            className="w-full h-12 text-[15px] font-semibold rounded-xl shadow-sm"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Tunggu sebentar...
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Gabung Sekarang
              </>
            )}
          </Button>
        </form>

        <p className="text-[11px] text-muted-foreground/60">
          Nama kamu akan diingat di perangkat ini 📱
        </p>
      </div>
    </div>
  );
}
