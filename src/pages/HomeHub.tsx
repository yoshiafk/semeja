import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMember } from "@/hooks/useMember";
import { PageContainer } from "@/components/layout/PageContainer";
import { CalendarDays } from "lucide-react";
import { getTodayParticipation, getTrips } from "@/lib/api";
import type { TripSummary } from "@/types/trip";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityCard } from "@/components/ui/ActivityCard";

export default function HomeHub() {
  const { member } = useMember();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const { data: todayCount = 0, isLoading: isCountLoading } = useQuery({
    queryKey: ['today_participation'],
    queryFn: async () => {
      const { count } = await getTodayParticipation();
      return count;
    }
  });

  const { data: latestTrip, isLoading: isTripLoading } = useQuery({
    queryKey: ['latest_trip'],
    queryFn: async () => {
      const trips = await getTrips();
      if (trips?.length > 0) {
        return trips.find((t: TripSummary) => t.status !== "done") || trips[0];
      }
      return null;
    }
  });

  useEffect(() => {
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
      <div className="animate-page-in flex flex-col gap-8 pb-10">

        {/* ── Greeting Hero ─────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-primary/10 p-6 shadow-sm border border-border">
          <div className="absolute -right-8 -top-8 size-32 rounded-full bg-primary/10 pointer-events-none" />
          <div className="absolute -right-2 -bottom-10 size-24 rounded-full bg-primary/10 pointer-events-none" />
          
          <div className="relative">
            <div className="flex items-center gap-1.5 mb-2 w-fit px-3 py-1 rounded-full border border-primary/20 bg-background/50">
              <CalendarDays className="size-4 text-primary" />
              <span className="text-xs font-semibold capitalize text-primary">{dateStr}</span>
            </div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight mt-2 text-foreground">
              {greeting.emoji} {greeting.text},<br/> {firstName}!
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Here is what's happening today.
            </p>
          </div>
        </div>

        {/* ── Activity Deck (The Feed) ──────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold tracking-tight">Active Plans</h2>
          </div>
          
          <div className="flex flex-col gap-4">
            
            {/* Meal Card (Mapped from todayCount) */}
            {isCountLoading ? (
              <Skeleton className="h-[200px] w-full rounded-xl" />
            ) : todayCount > 0 && (
              <ActivityCard 
                id="meal-today"
                type="meal"
                title="Today's Meal"
                description="Dinner is scheduled for tonight. Check the menu and confirm your portions!"
                participants={todayCount}
                hasJoined={true} 
                emoji="🍱"
                onSettleUp={(id) => console.log("Settle", id)}
              />
            )}

            {/* Trip Card (Mapped from latestTrip) */}
            {isTripLoading ? (
              <Skeleton className="h-[200px] w-full rounded-xl" />
            ) : latestTrip ? (
              <ActivityCard 
                id={`trip-${latestTrip.id}`}
                type="trip"
                title={latestTrip.title || "Upcoming Trip"}
                description={latestTrip.status === "upcoming" ? "We are currently planning this trip. Join in!" : "Trip is confirmed."}
                participants={latestTrip.participant_count || 1} 
                hasJoined={false}
                emoji="🚗"
                onJoin={(id) => console.log("Join", id)}
              />
            ) : null}

            {!isCountLoading && todayCount === 0 && !isTripLoading && !latestTrip && (
              <div className="text-center p-8 bg-muted/50 rounded-xl border border-dashed">
                <p className="text-sm text-muted-foreground">No active plans at the moment. Why not start one?</p>
              </div>
            )}

          </div>
        </div>
      </div>
    </PageContainer>
  );
}
