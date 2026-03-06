import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
      <Card className="w-full max-w-sm border-none shadow-2xl text-center p-4">
        <CardHeader className="space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Lock className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-black tracking-tighter text-stone-900">Semeja</CardTitle>
            <CardDescription className="text-base font-medium text-stone-500">
              Aplikasi ini privat untuk penghuni coliving. Masukkan kunci rumah untuk masuk.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Kunci Rumah..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="h-14 text-xl text-center tracking-widest"
                autoFocus
                disabled={loading}
              />
              {error && <p className="text-sm font-bold text-rose-500">{error}</p>}
            </div>
            <Button type="submit" className="w-full h-14 text-xl font-black bg-stone-900 hover:bg-stone-800" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Mengecek...
                </>
              ) : (
                "Buka Pintu"
              )}
            </Button>
          </form>
          <p className="mt-8 text-xs text-stone-400 font-medium">
            *Lupa kunci? Tanya teman atau admin coliving kamu.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
