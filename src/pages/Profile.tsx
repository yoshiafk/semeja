import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMember } from "@/hooks/useMember";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { getMemberSummary, api } from "@/lib/api";
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
  CalendarDays,
  KeyRound,
  AlertTriangle,
  ClipboardList,
  Utensils,
  Carrot,
  Store,
  Sparkles,
  Gift,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { member, logout, isSuperadmin, isAdmin, needsPasswordSetup } = useMember();
  const [summary, setSummary] = useState<MemberSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

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
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="animate-page-in flex flex-col gap-6">
        {/* Profile Header */}
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
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
                  <Calendar className="size-4 text-primary" />
                  Ringkasan Minggu Ini
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {summary.currentWeek.weekLabel}
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  label="Total Tagihan"
                  value={formatCurrency(
                    (summary.currentWeek.actualCost || summary.currentWeek.estimatedCost) +
                    (summary.currentWeek.activityCost || 0) +
                    (summary.currentWeek.giftCost || 0)
                  )}
                  subValue="Estimasi total tagihan"
                  icon={Wallet}
                />
                <StatCard
                  label="Hari Ikut"
                  value={`${summary.currentWeek.daysJoined}`}
                  subValue="Hari"
                  icon={CalendarDays}
                />
                <StatCard
                  label="Rata-rata/Hari"
                  value={formatCurrency(
                    summary.currentWeek.daysJoined > 0
                      ? Math.round((summary.currentWeek.actualCost || summary.currentWeek.estimatedCost) / summary.currentWeek.daysJoined)
                      : 0
                  )}
                  subValue="Rata-rata/Hari"
                  icon={TrendingUp}
                />
              </div>

              {/* Breakdown by Type */}
              {summary.currentWeek.breakdown && (
                <div className="bg-muted/30 rounded-2xl p-4 border border-border/10">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <TrendingUp className="size-3" /> Rincian Jenis Biaya
                  </h3>
                  <div className="grid grid-cols-1 gap-2.5">
                    <BreakdownRow
                      label="Patungan Makan"
                      amount={summary.currentWeek.breakdown.meals}
                      icon={Utensils}
                      color="text-amber-600 bg-amber-50"
                    />
                    {summary.currentWeek.breakdown.activities > 0 && (
                      <BreakdownRow
                        label="Aktifitas Bersama"
                        amount={summary.currentWeek.breakdown.activities}
                        icon={Sparkles}
                        color="text-primary bg-primary/5"
                      />
                    )}
                    {summary.currentWeek.breakdown.gifts > 0 && (
                      <BreakdownRow
                        label="Gifts"
                        amount={summary.currentWeek.breakdown.gifts}
                        icon={Gift}
                        color="text-pink-600 bg-pink-50"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Daily Breakdown */}
              {summary.currentWeek.dailyBreakdown.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <Receipt className="size-4" />
                      Rincian Harian
                    </h3>
                    <div className="flex flex-col gap-2">
                      {summary.currentWeek.dailyBreakdown.map((day, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-xl bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
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
        ) : summary?.lastArchivedWeek ? (
          <Card className="border-primary/10 bg-primary/[0.02]">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-primary" />
                  Rekap Minggu Terakhir
                </CardTitle>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px]">
                  ✓ SELESAI
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/50">
                <div className="flex flex-col gap-0.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Periode</p>
                  <p className="text-sm font-semibold">{summary.lastArchivedWeek.weekLabel}</p>
                </div>
                <div className="text-right flex flex-col gap-0.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Tagihan</p>
                  <p className="text-sm font-bold text-primary">{formatCurrency(summary.lastArchivedWeek.totalCost)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-background border border-border/50 flex items-center gap-3">
                  <CalendarDays className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Hari Ikut</p>
                    <p className="text-xs font-semibold">{summary.lastArchivedWeek.daysJoined} Hari</p>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-background border border-border/50 flex items-center gap-3">
                  <TrendingUp className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Rata-rata</p>
                    <p className="text-xs font-semibold">
                      {formatCurrency(summary.lastArchivedWeek.daysJoined > 0 
                        ? Math.round(summary.lastArchivedWeek.totalCost / summary.lastArchivedWeek.daysJoined) 
                        : 0)}
                    </p>
                  </div>
                </div>
              </div>
              
              <p className="text-[10px] text-center text-muted-foreground italic">
                *Tagihan ini sudah masuk ke riwayat dan siap untuk diselesaikan.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="size-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
                <Calendar className="size-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">Tidak Ada Jadwal Aktif</h3>
              <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">
                Belum ada jadwal makan baru untuk minggu ini.
              </p>
              <p className="text-xs text-muted-foreground/60 mt-4 px-6 py-2 bg-muted/50 rounded-full inline-block">
                Pantau terus grup untuk info jadwal ya!
              </p>
            </CardContent>
          </Card>
        )}

        {/* History Summary */}
        {(summary?.history?.totalWeeks ?? 0) > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" />
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

        {/* Admin Management Section */}
        {isAdmin && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                Manajemen Semeja
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <AdminLink
                href="/meals/plan"
                icon={ClipboardList}
                label="Atur Jadwal"
                description="Kelola jadwal makan mingguan"
              />
              <AdminLink
                href="/meals/menus"
                icon={Utensils}
                label="Daftar Resep"
                description="Kelola database resep & menu"
              />
              <AdminLink
                href="/finance/ingredients"
                icon={Carrot}
                label="Stok Bahan"
                description="Pantau ketersediaan bahan"
              />
              <AdminLink
                href="/finance/suppliers"
                icon={Store}
                label="Supplier"
                description="Kelola daftar pemasok bahan"
              />
            </CardContent>
          </Card>
        )}

        {/* Account Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <User className="size-4 text-primary" />
              Akun
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {/* Password Setup/Change for Admin */}
            {isAdmin && (
              <div className="flex flex-col gap-3">
                {needsPasswordSetup && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <AlertTriangle className="size-4 text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-700">Kamu belum punya password. Atur password untuk keamanan akun admin.</p>
                  </div>
                )}
                <div className="p-4 rounded-xl bg-muted/50 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <KeyRound className="size-4 text-primary" />
                    <span className="text-sm font-medium">{needsPasswordSetup ? 'Atur Password' : 'Ubah Password'}</span>
                  </div>
                  {!needsPasswordSetup && (
                    <Input
                      type="password"
                      placeholder="Password lama"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="h-10 text-sm bg-background rounded-lg"
                    />
                  )}
                  <Input
                    type="password"
                    placeholder="Password baru"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-10 text-sm bg-background rounded-lg"
                  />
                  <Input
                    type="password"
                    placeholder="Konfirmasi password baru"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-10 text-sm bg-background rounded-lg"
                  />
                  <Button
                    className="w-full h-10 rounded-lg text-sm"
                    disabled={savingPassword || !newPassword || newPassword !== confirmPassword}
                    onClick={async () => {
                      if (newPassword.length < 4) {
                        toast.error('Password minimal 4 karakter');
                        return;
                      }
                      try {
                        setSavingPassword(true);
                        await api.put(`/members/${member?.id}/password`, {
                          currentPassword: needsPasswordSetup ? undefined : currentPassword,
                          newPassword
                        });
                        toast.success('Password berhasil disimpan!');
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                      } catch (err: any) {
                        toast.error(err.message || 'Gagal menyimpan password');
                      } finally {
                        setSavingPassword(false);
                      }
                    }}
                  >
                    {savingPassword ? (
                      <Loader2 className="size-4 animate-spin mr-2" />
                    ) : (
                      <KeyRound className="size-4 mr-2" />
                    )}
                    Simpan Password
                  </Button>
                </div>
                <Separator />
              </div>
            )}
            <Button
              variant="ghost"
              className="w-full justify-between h-12 px-4 rounded-xl hover:bg-destructive/5 hover:text-destructive"
              onClick={logout}
            >
              <div className="flex items-center gap-3">
                <LogOut className="size-4" />
                <span>Keluar</span>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
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
      className={`p-3 rounded-xl ${variant === "muted" ? "bg-muted/50" : "bg-primary/5"
        }`}
    >
      <Icon
        className={`size-4 mb-2 ${variant === "muted" ? "text-muted-foreground" : "text-primary"
          }`}
      />
      <p className="text-base font-bold text-foreground truncate">{value}</p>
      <p className="text-[10px] text-muted-foreground truncate">{subValue}</p>
    </div>
  );
}

StatCard.displayName = "StatCard";

function BreakdownRow({
  label,
  amount,
  icon: Icon,
  color
}: {
  label: string;
  amount: number;
  icon: any;
  color: string;
}) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="size-4" />
        </div>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <span className="text-sm font-bold text-foreground">
        {formatCurrency(amount)}
      </span>
    </div>
  );
}

function AdminLink({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
}) {
  return (
    <Link
      to={href}
      className="flex flex-col gap-2 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors touch-active border border-transparent hover:border-primary/20"
    >
      <div className="flex items-center justify-between">
        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="size-4 text-primary" />
        </div>
        <ChevronRight className="size-4 text-muted-foreground/50" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground line-clamp-1">{description}</p>
      </div>
    </Link>
  );
}
