import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMember } from "@/hooks/useMember";
import { PageContainer } from "@/components/layout/PageContainer";
import { ModuleCard } from "@/components/ui/module-card";
import {
  UtensilsCrossed, Activity, Users, Sparkles, ClipboardList,
  Carrot, Salad, Map, ArrowRight, CalendarDays, Wallet,
} from "lucide-react";
import { getTodayParticipation, getTrips } from "@/lib/api";
import type { TripSummary } from "@/types/trip";
import { TripCountdownBanner } from "@/components/TripCountdownBanner";

export default function HomeHub() {
  const { member, isAdmin } = useMember();
  const [todayCount, setTodayCount] = useState(0);
  const [latestTrip, setLatestTrip] = useState<TripSummary | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    getTodayParticipation().then(({ count }) => setTodayCount(count));
    getTrips().then(trips => {
      if (trips?.length > 0) {
        const upcoming = trips.find(t => t.status !== "done") || trips[0];
        setLatestTrip(upcoming);
      }
    }).catch(console.error);

    const timer = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 5)  return { text: "Selamat malam",  emoji: "🌙" };
    if (hour < 11) return { text: "Selamat pagi",   emoji: "☀️" };
    if (hour < 15) return { text: "Selamat siang",  emoji: "🌤️" };
    if (hour < 18) return { text: "Selamat sore",   emoji: "🌅" };
    return               { text: "Selamat malam",   emoji: "🌙" };
  };

  const greeting = getGreeting();
  const firstName = member?.name?.split(" ")[0] ?? "";
  const dateStr = currentTime.toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <PageContainer>
      <div className="animate-page-in flex flex-col gap-6">

        {/* ── Greeting Hero ─────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground">
          {/* Decorative background circles */}
          <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -right-2 -bottom-10 size-24 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute right-12 top-2 size-12 rounded-full bg-white/5 pointer-events-none" />

          <div className="relative">
            <div className="flex items-center gap-1.5 mb-1">
              <CalendarDays className="size-3.5 opacity-70" />
              <span className="text-[11px] font-medium opacity-70 capitalize">{dateStr}</span>
            </div>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">
              {greeting.emoji} {greeting.text}, {firstName}!
            </h1>
            <p className="text-[13px] opacity-75 mt-1 font-medium">
              Apa yang mau kamu lakukan hari ini?
            </p>

            {/* Today's participation counter */}
            {todayCount > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 bg-white/15 rounded-full px-3 py-1.5">
                <Users className="size-3.5" />
                <span className="text-[12px] font-semibold">
                  {todayCount} orang makan bareng hari ini
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Briefing Harian ─────────────────────────────────── */}
        <div>
          <SectionLabel icon={Sparkles} label="Briefing Harian" />
          <div className="flex flex-col gap-3 mt-3">
            {latestTrip ? (
              <Link to={`/trips/${latestTrip.slug}`} className="block transition-transform active:scale-[0.98]">
                <TripCountdownBanner startDate={latestTrip.start_date} endDate={latestTrip.end_date} status={latestTrip.status} />
              </Link>
            ) : (
              <Link to="/trips" className="flex items-center gap-4 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/15 transition-colors">
                <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                  <Map className="size-6" />
                </div>
                <div>
                  <h3 className="font-bold text-indigo-700 dark:text-indigo-400 text-sm">Rencana Perjalanan</h3>
                  <p className="text-xs text-indigo-600/80 dark:text-indigo-400/80 font-medium mt-0.5">
                    Belum ada perjalanan aktif. Rencanakan sekarang!
                  </p>
                </div>
                <ArrowRight className="size-4 text-indigo-500 ml-auto opacity-50" />
              </Link>
            )}
            
            {todayCount > 0 ? (
              <Link to="/meals" className="flex items-center gap-4 p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/15 transition-colors">
                <div className="p-3 bg-orange-500/20 rounded-xl text-orange-600 dark:text-orange-400">
                  <UtensilsCrossed className="size-6" />
                </div>
                <div>
                  <h3 className="font-bold text-orange-700 dark:text-orange-400 text-sm">Buka Puasa Bersama</h3>
                  <p className="text-xs text-orange-600/80 dark:text-orange-400/80 font-medium mt-0.5">
                    Nanti makan bareng {todayCount} orang! Jangan lupa cek menu.
                  </p>
                </div>
                <ArrowRight className="size-4 text-orange-500 ml-auto opacity-50" />
              </Link>
            ) : (
              <Link to="/meals" className="flex items-center gap-4 p-4 rounded-2xl bg-muted/50 border border-border/50 hover:bg-muted transition-colors">
                <div className="p-3 bg-muted rounded-xl text-muted-foreground">
                  <UtensilsCrossed className="size-6" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">Buka Puasa</h3>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">
                    Belum ada yang RSVP makan hari ini.
                  </p>
                </div>
                <ArrowRight className="size-4 text-muted-foreground ml-auto opacity-50" />
              </Link>
            )}

            <Link to="/finance/costs" className="flex items-center gap-4 p-4 rounded-2xl bg-green-500/10 border border-green-500/20 hover:bg-green-500/15 transition-colors">
              <div className="p-3 bg-green-500/20 rounded-xl text-green-600 dark:text-green-400">
                <Wallet className="size-6" />
              </div>
              <div>
                <h3 className="font-bold text-green-700 dark:text-green-400 text-sm">Keuangan & Patungan</h3>
                <p className="text-xs text-green-600/80 dark:text-green-400/80 font-medium mt-0.5">
                  Cek tagihan atau catat pengeluaran baru.
                </p>
              </div>
              <ArrowRight className="size-4 text-green-500 ml-auto opacity-50" />
            </Link>
            
            <Link to="/activities" className="flex items-center gap-4 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/15 transition-colors">
              <div className="p-3 bg-blue-500/20 rounded-xl text-blue-600 dark:text-blue-400">
                <Activity className="size-6" />
              </div>
              <div>
                <h3 className="font-bold text-blue-700 dark:text-blue-400 text-sm">Aktivitas Bersama</h3>
                <p className="text-xs text-blue-600/80 dark:text-blue-400/80 font-medium mt-0.5">
                  Bagi tugas harian atau kegiatan lainnya.
                </p>
              </div>
              <ArrowRight className="size-4 text-blue-500 ml-auto opacity-50" />
            </Link>
          </div>
        </div>

        {/* ── Bekal Sehat ────────────────────────────────────── */}
        <div>
          <SectionLabel icon={Salad} label="Gaya Hidup Sehat" />
          <div className="mt-3">
            <ModuleCard
              icon={Salad}
              title="Bekal Sehat"
              description="Menu sehat 7 hari untuk bekal kerja — dikelola dengan penuh kasih 🥗"
              href="/bekal-sehat"
              className="w-full"
            />
          </div>
        </div>

        {/* ── Quick Actions for Admin ────────────────────────── */}
        <div>
          <SectionLabel icon={ClipboardList} label="Akses Cepat" />
          <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
            <QuickLink href="/community/members" icon={Users} label="Warga" />
            {isAdmin && (
              <>
                <QuickLink href="/meals/plan" icon={ClipboardList} label="Jadwal" />
                <QuickLink href="/finance/ingredients" icon={Carrot} label="Stok" />
                <QuickLink href="/finance/suppliers" icon={({className}: {className?: string}) => (
                  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                )} label="Supplier" />
              </>
            )}
            <QuickLink href="/finance/costs" icon={({className}: {className?: string}) => (
              <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            )} label="Biaya" />
          </div>
        </div>

      </div>
    </PageContainer>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3.5 text-muted-foreground" />
      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      to={href}
      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-all duration-200 touch-active group"
    >
      <div className="size-9 rounded-lg bg-background flex items-center justify-center shadow-sm group-hover:shadow transition-shadow duration-200">
        <Icon className="size-4 text-muted-foreground group-hover:text-foreground transition-colors duration-200" />
      </div>
      <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors duration-200 text-center leading-tight">
        {label}
      </span>
    </Link>
  );
}
