import { useEffect, useState } from "react";
import { useMember } from "@/hooks/useMember";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getMemberSummary } from "@/lib/api";
import type { MemberSummary } from "@/lib/api";
import { 
  User, 
  Calendar, 
  Wallet, 
  TrendingUp, 
  LogOut, 
  ChevronRight,
  Loader2,
  Receipt,
  CalendarDays
} from "lucide-react";

export default function Profile() {
  const { member, logout, isSuperadmin, isAdmin } = useMember();
  const [summary, setSummary] = useState<MemberSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (member?.id) {
      getMemberSummary(member.id)
        .then(setSummary)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [member?.id]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="animate-page-in space-y-6">
        {/* Profile Header */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <span className="text-xl font-bold text-primary">
              {member?.name?.substring(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">{member?.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {isSuperadmin ? (
                <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                  Superadmin
                </Badge>
              ) : isAdmin ? (
                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10">
                  Admin
                </Badge>
              ) : (
                <Badge variant="secondary">Warga</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Current Week Summary */}
        {summary?.currentWeek ? (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Ringkasan Minggu Ini
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {summary.currentWeek.weekLabel}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  label="Total Tagihan"
                  value={formatCurrency(summary.currentWeek.actualCost || summary.currentWeek.estimatedCost)}
                  subValue={summary.currentWeek.actualCost ? "Aktual" : "Estimasi"}
                  icon={Wallet}
                />
                <StatCard
                  label="Hari Ikut"
                  value={`${summary.currentWeek.daysJoined}`}
                  subValue="hari"
                  icon={CalendarDays}
                />
                <StatCard
                  label="Rata-rata/Hari"
                  value={formatCurrency(
                    summary.currentWeek.daysJoined > 0
                      ? Math.round((summary.currentWeek.actualCost || summary.currentWeek.estimatedCost) / summary.currentWeek.daysJoined)
                      : 0
                  )}
                  subValue="per hari"
                  icon={TrendingUp}
                />
              </div>

              {/* Daily Breakdown */}
              {summary.currentWeek.dailyBreakdown.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <Receipt className="w-4 h-4" />
                      Rincian Harian
                    </h3>
                    <div className="space-y-2">
                      {summary.currentWeek.dailyBreakdown.map((day, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-xl bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-bold text-primary">
                                {day.dayName.substring(0, 2)}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {day.dayName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(day.date).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                })}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-foreground">
                            {formatCurrency(day.costPerPerson)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <Calendar className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Belum ada jadwal makan minggu ini
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Gabung nanti kalau sudah ada jadwal ya!
              </p>
            </CardContent>
          </Card>
        )}

        {/* History Summary */}
        {(summary?.history?.totalWeeks ?? 0) > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Riwayat Partisipasi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  label="Total Minggu"
                  value={`${summary?.history.totalWeeks}`}
                  subValue="minggu ikut"
                  icon={Calendar}
                  variant="muted"
                />
                <StatCard
                  label="Total Biaya"
                  value={formatCurrency(summary?.history.totalCost || 0)}
                  subValue="keseluruhan"
                  icon={Wallet}
                  variant="muted"
                />
                <StatCard
                  label="Rata-rata"
                  value={formatCurrency(summary?.history.averageWeekly || 0)}
                  subValue="per minggu"
                  icon={TrendingUp}
                  variant="muted"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Account Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Akun
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-between h-12 px-4 rounded-xl hover:bg-destructive/5 hover:text-destructive"
              onClick={logout}
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-4 h-4" />
                <span>Keluar</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Button>
          </CardContent>
        </Card>

        {/* Version Info */}
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground/50">
            Semeja v2.0 • Coliving Super App
          </p>
        </div>
      </div>
    </PageContainer>
  );
}

function StatCard({
  value,
  subValue,
  icon: Icon,
  variant = "default",
}: {
  label?: string;
  value: string;
  subValue: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "muted";
}) {
  return (
    <div
      className={`p-3 rounded-xl ${
        variant === "muted" ? "bg-muted/50" : "bg-primary/5"
      }`}
    >
      <Icon
        className={`w-4 h-4 mb-2 ${
          variant === "muted" ? "text-muted-foreground" : "text-primary"
        }`}
      />
      <p className="text-base font-bold text-foreground truncate">{value}</p>
      <p className="text-[10px] text-muted-foreground truncate">{subValue}</p>
    </div>
  );
}
