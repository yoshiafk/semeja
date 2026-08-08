import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMember } from "@/hooks/useMember";
import { PageContainer } from "@/components/layout/PageContainer";
import { ModuleCard } from "@/components/ui/module-card";
import { UtensilsCrossed, Activity, Users, Sparkles, ClipboardList, Carrot, Gift, Salad, Map } from "lucide-react";
import { getTodayParticipation, getTrips } from "@/lib/api";
import type { TripSummary } from "@/types/trip";
import { TripCountdownBanner } from "@/components/TripCountdownBanner";

export default function HomeHub() {
  const { member, isAdmin } = useMember();
  const [todayCount, setTodayCount] = useState(0);
  const [latestTrip, setLatestTrip] = useState<TripSummary | null>(null);

  useEffect(() => {
    getTodayParticipation().then(({ count }) => setTodayCount(count));
    getTrips().then(trips => {
      if (trips && trips.length > 0) {
        const upcoming = trips.find(t => t.status !== "done") || trips[0];
        setLatestTrip(upcoming);
      }
    }).catch(console.error);
  }, []);

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return "Selamat pagi";
    if (hour < 15) return "Selamat siang";
    if (hour < 18) return "Selamat sore";
    return "Selamat malam";
  };

  return (
    <PageContainer>
      <div className="animate-page-in">
        {/* Greeting Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-foreground">
              {getGreeting()}, {member?.name?.split(" ")[0]}! 👋
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Apa yang mau kamu lakukan hari ini?
          </p>
        </div>

        {/* Quick Stats */}
        {todayCount > 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {todayCount} orang ikut makan hari ini
                </p>
                <p className="text-xs text-muted-foreground">
                  Gabung yuk biar makin seru!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Module Cards Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Meal Module */}
          <ModuleCard
            icon={UtensilsCrossed}
            title="Makan Bareng"
            description="Lihat menu dan gabung makan hari ini"
            href="/meals"
            badge={todayCount > 0 ? `${todayCount} ikut` : undefined}
            badgeVariant="count"
          />

          {/* Activities Module */}
          <ModuleCard
            icon={Activity}
            title="Aktivitas Seru"
            description="Olahraga dan kegiatan bareng"
            href="/activities"
          />

          {/* Gifts Module */}
          <ModuleCard
            icon={Gift}
            title="Gift Pooling"
            description="Split the cost for gifts together"
            href="/community/gifts"
          />

          {/* Bekal Sehat Module */}
          <ModuleCard
            icon={Salad}
            title="Bekal Sehat"
            description="Menu sehat 7 hari untuk bekal kerja"
            href="/bekal-sehat"
          />
        </div>

        {/* Perjalanan (Trips) Module - Full Width */}
        {latestTrip ? (
          <div className="mt-4">
            <Link to={`/trips/${latestTrip.slug}`} className="block group relative border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow active:scale-[0.98]">
              <div className="h-28 bg-gradient-to-r from-emerald-500 to-purple-600 relative p-4 flex flex-col justify-end">
                <div className="absolute inset-0 bg-black/10 mix-blend-overlay transition-opacity group-hover:opacity-0"></div>
                <div className="absolute top-3 right-3">
                  <TripCountdownBanner startDate={latestTrip.start_date} endDate={latestTrip.end_date} status={latestTrip.status} className="bg-white/95 backdrop-blur-sm shadow-sm" />
                </div>
                <h2 className="text-white font-bold text-xl relative z-10 flex items-center gap-1.5">
                  <Map className="w-5 h-5 opacity-90" />
                  {latestTrip.title}
                </h2>
                <p className="text-white/90 text-sm relative z-10 flex items-center gap-1.5 mt-0.5">
                  <span>{new Date(latestTrip.start_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – {new Date(latestTrip.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                  <span className="opacity-70">·</span>
                  <span>{latestTrip.participant_count} orang</span>
                </p>
                {/* Timeline Progress */}
                {(() => {
                  const now = new Date();
                  const start = new Date(latestTrip.start_date + "T00:00:00");
                  const end = new Date(latestTrip.end_date + "T23:59:59");
                  let progress = 0;
                  if (now > end) progress = 100;
                  else if (now > start) {
                    progress = Math.min(100, Math.max(0, ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100));
                  }
                  return (
                    <div className="w-full h-1.5 bg-white/20 rounded-full mt-3 relative z-10 overflow-hidden">
                      <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                  );
                })()}
              </div>
            </Link>
          </div>
        ) : (
          <div className="mt-4">
             <Link to="/trips" className="block p-4 rounded-2xl bg-muted/50 border hover:bg-muted transition-colors text-center text-muted-foreground text-sm font-medium">
               + Rencanakan Perjalanan Baru
             </Link>
          </div>
        )}

        {/* Additional Quick Actions for Admin */}
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Jelajahi Fitur Lainnya
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <QuickLink
              href="/community/members"
              icon={Users}
              label="Warga"
            />
            {isAdmin && (
              <>
                <QuickLink
                  href="/meals/plan"
                  icon={ClipboardList}
                  label="Jadwal"
                />
                <QuickLink
                  href="/finance/ingredients"
                  icon={Carrot}
                  label="Stok"
                />
              </>
            )}
            <QuickLink
              href="/finance/costs"
              icon={({ className }: { className?: string }) => (
                <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              )}
              label="Biaya"
            />
            <QuickLink
              href="/profile"
              icon={({ className }: { className?: string }) => (
                <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
              label="Profil"
            />
          </div>
        </div>
      </div>
    </PageContainer>
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
      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors touch-active"
    >
      <Icon className="w-5 h-5 text-muted-foreground" />
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </Link>
  );
}
