import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Share, Edit2, LogIn, LogOut } from "lucide-react";
import { getTripDetail, updateTrip, joinTrip, leaveTrip } from "@/lib/api";
import type { TripDetail } from "@/types/trip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TripDaySelector } from "@/components/TripDaySelector";
import { TripDayCard } from "@/components/TripDayCard";
import { TripHotelCard } from "@/components/TripHotelCard";
import { TripBudgetTable } from "@/components/TripBudgetTable";
import { shareToWhatsApp } from "@/lib/whatsapp";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { TripFormDialog } from "@/components/TripFormDialog";
import { useMember } from "@/hooks/useMember";

export default function TripDetailView() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, member } = useMember();
  
  const currentTab = searchParams.get("tab") || "itinerary";
  
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  
  const [activeDay, setActiveDay] = useState<number>(1);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;
    getTripDetail(slug)
      .then(data => {
        setTrip(data);
        if (data.days && data.days.length > 0) {
          setActiveDay(data.days[0].day_number);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  // We no longer update active day based on scroll position 
  // since we only show one day at a time in standalone mode.

  const handleSelectDay = (dayNum: number) => {
    setActiveDay(dayNum);
  };

  const handleUpdateActual = async (rowId: number, actualAmount: number) => {
    if (!slug) return;
    try {
      // Optimistic update
      setTrip(prev => {
        if (!prev) return prev;
        const newBudget = prev.budget.map(r => r.id === rowId ? { ...r, actual_amount_rp: actualAmount } : r);
        return { ...prev, budget: newBudget };
      });
      // Import the api function
      const { updateTripBudgetActual } = await import("@/lib/api");
      await updateTripBudgetActual(slug, rowId, actualAmount);
    } catch (err) {
      console.error("Failed to update actual amount:", err);
      // Fallback: re-fetch if failed
      getTripDetail(slug).then(setTrip).catch(console.error);
    }
  };

  const handleToggleDone = async (itemId: number, isDone: boolean) => {
    if (!slug) return;
    try {
      // Optimistic update
      setTrip(prev => {
        if (!prev) return prev;
        const newDays = prev.days.map(d => {
          const hasItem = d.schedule.some(s => s.id === itemId);
          if (!hasItem) return d;
          return {
            ...d,
            schedule: d.schedule.map(s => s.id === itemId ? { ...s, is_done: isDone } : s)
          };
        });
        return { ...prev, days: newDays };
      });
      // Import the api function
      const { toggleTripScheduleItem } = await import("@/lib/api");
      await toggleTripScheduleItem(slug, itemId, isDone);
    } catch (err) {
      console.error("Failed to toggle item done status:", err);
      // Fallback: re-fetch if failed
      getTripDetail(slug).then(setTrip).catch(console.error);
    }
  };

  const handleAddBudget = async (data: { category: string, detail?: string, amount_rp?: number, is_accommodation?: boolean }) => {
    if (!slug) return;
    try {
      const { createTripBudget } = await import("@/lib/api");
      await createTripBudget(slug, data);
      // Re-fetch to get correct sort orders and total rows
      const newData = await getTripDetail(slug);
      setTrip(newData);
    } catch (err) {
      console.error("Failed to add budget row:", err);
    }
  };

  const handleShareTrip = () => {
    if (!trip) return;
    const url = window.location.href;
    const msg = `Yuk cek itinerary *${trip.title}* di Semeja!\n\n${url}`;
    shareToWhatsApp(msg);
  };

  const handleEditTrip = async (data: Partial<TripDetail>) => {
    if (!slug) return;
    try {
      await updateTrip(slug, data);
      const newData = await getTripDetail(slug);
      setTrip(newData);
    } catch (err) {
      console.error("Failed to update trip:", err);
    }
  };

  const handleJoinLeave = async () => {
    if (!slug || !member || !trip) return;
    setIsJoining(true);
    try {
      const isParticipating = trip.participants?.some(p => p.id === member.id);
      if (isParticipating) {
        await leaveTrip(slug, member.id);
      } else {
        await joinTrip(slug, member.id);
      }
      const newData = await getTripDetail(slug);
      setTrip(newData);
    } catch (err) {
      console.error("Failed to join/leave trip:", err);
    } finally {
      setIsJoining(false);
    }
  };

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
    window.scrollTo({ top: 0 });
  };

  if (loading) {
    return <div className="min-h-screen pt-20 text-center text-muted-foreground animate-pulse">Memuat detail perjalanan...</div>;
  }
  
  if (!trip) {
    return <div className="min-h-screen pt-20 text-center text-muted-foreground">Perjalanan tidak ditemukan.</div>;
  }

  const visibleDays = trip.days;

  return (
    <PageContainer>
      <PageHeader 
        title={trip.title} 
        backTo="/trips"
        action={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsEditOpen(true)}
                className="rounded-full size-10 bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
              >
                <Edit2 className="size-5" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleShareTrip} 
              className="rounded-full size-10 bg-muted/50 hover:bg-muted border border-border/50 transition-colors"
            >
              <Share className="size-5" />
            </Button>
          </div>
        }
      />

      <div className="max-w-3xl mx-auto w-full flex flex-col" ref={scrollContainerRef}>
        {/* Join/Leave Action Bar */}
        <div className="px-4 md:px-0 mb-4 flex items-center justify-between">
          <div className="text-sm font-medium">
            <span className="text-foreground">{trip.participants?.length || trip.participant_count}</span>
            <span className="text-muted-foreground"> orang ikut</span>
          </div>
          {member && (
            <Button 
              variant={trip.participants?.some(p => p.id === member.id) ? "outline" : "default"}
              size="sm"
              className="rounded-xl h-9"
              onClick={handleJoinLeave}
              disabled={isJoining}
            >
              {trip.participants?.some(p => p.id === member.id) ? (
                <><LogOut className="size-4 mr-1.5" /> Batal Ikut</>
              ) : (
                <><LogIn className="size-4 mr-1.5" /> Ikut Trip</>
              )}
            </Button>
          )}
        </div>

        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full mb-6">
          <TabsList className="grid w-full grid-cols-3 rounded-xl p-1 bg-muted/50 border">
            <TabsTrigger 
              value="itinerary" 
              className="rounded-lg text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              Itinerary
            </TabsTrigger>
            <TabsTrigger 
              value="hotel" 
              className="rounded-lg text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              Hotel
            </TabsTrigger>
            <TabsTrigger 
              value="budget" 
              className="rounded-lg text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              Budget
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* TAB 1: ITINERARY */}
        {currentTab === "itinerary" && (
          <div className="flex flex-col gap-6 animate-page-in">
            {/* Filter Section */}
            <div className="flex flex-col gap-4">
              {/* Day Selector */}
              <div className="sticky top-[72px] z-20 bg-background/90 backdrop-blur-md py-2 -mx-4 px-4 md:mx-0 md:px-0">
                <TripDaySelector 
                  days={trip.days} 
                  activeDay={activeDay} 
                  onSelectDay={handleSelectDay}
                />
              </div>
            </div>

            {/* Days Content */}
            <div className="flex flex-col gap-6 mt-2">
              {visibleDays.filter(d => d.day_number === activeDay).map(day => (
                <TripDayCard 
                  key={day.id} 
                  day={day} 
                  tripTitle={trip.title}
                  isStandalone={true}
                  isAdmin={isAdmin}
                  onToggleDone={handleToggleDone}
                />
              ))}
              {visibleDays.length === 0 && (
                <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-2xl border border-dashed">
                  Tidak ada itinerary untuk filter ini.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: HOTEL */}
        {currentTab === "hotel" && (
          <div className="flex flex-col gap-4 animate-page-in">
            {trip.hotels.map(hotel => (
              <TripHotelCard key={hotel.id} hotel={hotel} />
            ))}
            {trip.hotels.length === 0 && (
              <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-2xl border border-dashed">
                Belum ada data penginapan.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BUDGET */}
        {currentTab === "budget" && (
          <div className="flex flex-col gap-4 animate-page-in">
            {trip.budget.length > 0 ? (
              <TripBudgetTable 
                rows={trip.budget} 
                tripTitle={trip.title}
                participantCount={trip.participants?.length || trip.participant_count}
                isAdmin={isAdmin}
                onUpdateActual={handleUpdateActual}
                onAddBudget={handleAddBudget}
              />
            ) : (
              <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-2xl border border-dashed">
                Belum ada data budget.
              </div>
            )}
          </div>
        )}
      </div>

      <TripFormDialog 
        open={isEditOpen} 
        onOpenChange={setIsEditOpen} 
        trip={trip}
        onSave={handleEditTrip} 
      />
    </PageContainer>
  );
}
