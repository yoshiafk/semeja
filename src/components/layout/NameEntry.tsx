import { useMember } from "@/hooks/useMember";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState } from "react";
import { Loader2 } from "lucide-react";

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
      console.log('Caught login error:', err.message);
      
      if (err.message === 'PASSWORD_REQUIRED') {
        setShowPassword(true);
        setError("Akun ini memerlukan password.");
      } else {
        setError(err.message || "Gagal masuk");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background px-6">
      <Card className="w-full max-w-sm border-none shadow-none text-center">
        <CardHeader className="space-y-6">
          <div className="mx-auto">
            <img src="/logo.png" alt="Semeja Logo" className="h-24 w-24 object-contain" />
          </div>
          <div>
            <CardTitle className="text-3xl font-black tracking-tighter text-stone-900">Semeja</CardTitle>
            <CardDescription className="text-base font-medium text-stone-500">
              Masuk dengan nama kamu untuk bergabung dengan meja makan coliving hari ini.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <Input
                placeholder="Ketik nama kamu..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 text-lg text-center"
                autoFocus={!showPassword}
                disabled={loading || showPassword}
                required
              />
              
              {showPassword && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <Input
                    type="password"
                    placeholder="Password Admin..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 text-lg text-center"
                    autoFocus
                    disabled={loading}
                    required
                  />
                  <Button 
                    type="button" 
                    variant="link" 
                    className="text-xs text-stone-400"
                    onClick={() => {
                      setShowPassword(false);
                      setPassword("");
                      setError("");
                    }}
                  >
                    Bukan akun saya? Ganti nama
                  </Button>
                </div>
              )}

              {error && <p className="text-sm font-bold text-rose-500">{error}</p>}
            </div>
            <Button type="submit" className="w-full h-12 text-lg font-semibold" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sabar ya...
                </>
              ) : (
                "Masuk"
              )}
            </Button>
          </form>
          <p className="mt-6 text-xs text-muted-foreground italic">
            *Nama kamu akan diingat di perangkat ini.
          </p>
          <p className="mt-8 text-[10px] text-stone-300 font-mono">
            Build: 2026-03-06.23:30
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
