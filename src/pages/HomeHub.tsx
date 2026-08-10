import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMember } from "@/hooks/useMember";
import { PageContainer } from "@/components/layout/PageContainer";
import { ModuleCard } from "@/components/ui/module-card";
import {
  UtensilsCrossed, Activity, Users, Sparkles, ClipboardList,
  Carrot, Gift, Salad, Map, ArrowRight, CalendarDays, Wallet,
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

        {/* ── Main Module Cards ──────────────────────────────── */}
        <div>
          <SectionLabel icon={Sparkles} label="Modul Utama" />
          <div className="grid grid-cols-2 gap-3 mt-3">
            <ModuleCard
              icon={UtensilsCrossed}
              title="Makan Bareng"
              description="Lihat menu dan gabung makan hari ini"
              href="/meals"
              stat={todayCount > 0 ? `${todayCount} orang ikut` : undefined}
              badge={todayCount > 0 ? `${todayCount} ikut` : undefined}
              badgeVariant="count"
            />
            <ModuleCard
              icon={Wallet}
              title="Keuangan"
              description="Ringkasan biaya dan tagihan mingguan"
              href="/finance/costs"
            />
            <ModuleCard
              icon={Activity}
              title="Aktivitas"
              description="Olahraga dan kegiatan bareng"
              href="/activities"
            />
            <ModuleCard
              icon={Gift}
              title="Gift Pooling"
              description="Split the cost for gifts together"
              href="/community/gifts"
            />
          </div>
        </div>

        {/* ── Trip Card (full width) ─────────────────────────── */}
        <div>
          <SectionLabel icon={Map} label="Perjalanan" />
          <div className="mt-3">
            {latestTrip ? (
              <TripCard trip={latestTrip} />
            ) : (
              <Link
                to="/trips"
                className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-muted/50 border border-dashed border-border hover:bg-muted transition-colors text-muted-foreground text-sm font-semibold"
              >
                <Map className="size-4" />
                Rencanakan Perjalanan Baru
                <ArrowRight className="size-4" />
              </Link>
            )}
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

function TripCard({ trip }: { trip: TripSummary }) {
  const now = new Date();
  const start = new Date(trip.start_date + "T00:00:00");
  const end = new Date(trip.end_date + "T23:59:59");
  let progress = 0;
  if (now > end) progress = 100;
  else if (now > start) {
    progress = Math.min(100, ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100);
  }

  return (
    <Link
      to={`/trips/${trip.slug}`}
      className="block group relative rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm hover:shadow-md hover:border-[color:var(--module-trips)] transition-all duration-300 module-trips"
    >
      {/* Gradient accent bar */}
      <div
        className="absolute inset-x-0 top-0 h-0.5 opacity-60"
        style={{ background: "linear-gradient(to right, var(--module-trips), transparent)" }}
      />

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl module-icon-bg flex items-center justify-center shrink-0">
              <Map className="size-5 module-text stroke-[1.8px]" />
            </div>
            <div>
              <h2 className="font-bold text-[15px] text-foreground leading-tight">{trip.title}</h2>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <span>
                  {new Date(trip.start_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                  {" – "}
                  {new Date(trip.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <span className="opacity-40">·</span>
                <span>{trip.participant_count} orang</span>
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <TripCountdownBanner
              startDate={trip.start_date}
              endDate={trip.end_date}
              status={trip.status}
            />
          </div>
        </div>

        {/* Progress bar */}
        {progress > 0 && (
          <div className="mt-4 w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress}%`, background: "var(--module-trips)" }}
            />
          </div>
        )}
      </div>
    </Link>
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
