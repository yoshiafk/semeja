import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMember } from "@/hooks/useMember";
import { PageContainer } from "@/components/layout/PageContainer";
import { ModuleCard } from "@/components/ui/module-card";
import { UtensilsCrossed, Activity, Users, Sparkles, ClipboardList, Carrot } from "lucide-react";
import { getTodayParticipation } from "@/lib/api";

export default function HomeHub() {
  const { member, isAdmin } = useMember();
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    getTodayParticipation().then(({ count }) => setTodayCount(count));
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

          {/* Activities Module - Coming Soon */}
          <ModuleCard
            icon={Activity}
            title="Aktivitas Seru"
            description="Olahraga dan kegiatan bareng"
            href="/activities"
            badge="Segera Hadir"
            badgeVariant="coming-soon"
          />
        </div>

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
