import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Lock } from "lucide-react";

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
        setError(data.error || "Kunci salah");
      }
    } catch (err) {
      setError("Gagal menghubungi server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-stone-50 px-6">
      <div className="w-full max-w-sm text-center space-y-8 animate-page-in">
        {/* Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
          <Lock className="h-7 w-7" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Semeja</h1>
          <p className="text-sm text-stone-500 leading-relaxed">
            Aplikasi ini privat untuk penghuni coliving. Masukkan kunci rumah untuk masuk.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            placeholder="Kunci Rumah..."
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="h-13 text-lg text-center tracking-[0.2em] bg-white border-stone-200 rounded-xl focus:border-stone-400 focus:ring-1 focus:ring-stone-200"
            autoFocus
            disabled={loading}
          />
          {error && <p className="text-sm font-medium text-rose-500">{error}</p>}
          <Button
            type="submit"
            className="w-full h-12 text-[15px] font-semibold bg-stone-900 hover:bg-stone-800 rounded-xl"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mengecek...
              </>
            ) : (
              "Buka Pintu"
            )}
          </Button>
        </form>

        <p className="text-[11px] text-stone-400">
          Lupa kunci? Tanya teman atau admin coliving kamu.
        </p>
      </div>
    </div>
  );
}
