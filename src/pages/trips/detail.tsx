import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Share, Edit2, LogIn, LogOut } from "lucide-react";
import { getTripDetail, updateTrip, joinTrip, leaveTrip, addTripPackingItem, updateTripPackingItem, deleteTripPackingItem } from "@/lib/api";
import { shareToWhatsApp } from "@/lib/whatsapp";
import { geocodeCity, getWeatherForecast, type WeatherData } from "@/lib/weather";
import type { TripDetail, ScheduleItem } from "@/types/trip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TripDaySelector } from "@/components/TripDaySelector";
import { TripDayCard } from "@/components/TripDayCard";
import { TripBudgetTable } from "@/components/TripBudgetTable";
import { TripHotelCard } from "@/components/TripHotelCard";
import { LedgerDashboard } from "@/components/LedgerDashboard";
import { TripPackingTab } from "@/components/TripPackingTab";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { TripFormDialog } from "@/components/TripFormDialog";
import { useMember } from "@/hooks/useMember";
import { api } from "@/lib/api";

export default function TripDetailView() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, member } = useMember();
  
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [activeDay, setActiveDay] = useState<number>(1);
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const [ledgerId, setLedgerId] = useState<number | null>(null);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTab = searchParams.get("tab") || "itinerary";

  useEffect(() => {
    if (!slug) return;
    
    const fetchLedgerId = async (tripId: number) => {
      try {
        const ledgerObj = await api.get<any>(`/ledgers/by-reference/trip/${tripId}`);
        if (ledgerObj) setLedgerId(ledgerObj.id);
      } catch (e) {
        console.error("No ledger found for trip", e);
      }
    };

    getTripDetail(slug)
      .then(data => {
        setTrip(data);
        if (data && data.id) fetchLedgerId(data.id);
        if (data.days && data.days.length > 0) {
          setActiveDay(data.days[0].day_number);
        }
        
        if (data.cover_city) {
          const startDate = new Date(data.start_date);
          const today = new Date();
          const diffDays = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
          
          if (diffDays >= 0 && diffDays <= 16) {
            geocodeCity(data.cover_city).then(geo => {
              if (geo) {
                getWeatherForecast(geo.latitude, geo.longitude).then(forecast => {
                  const tripDates = forecast.filter(f => {
                    const fDate = new Date(f.time);
                    return fDate >= startDate && fDate <= new Date(data.end_date);
                  });
                  setWeatherData(tripDates.length > 0 ? tripDates : forecast.slice(0, 3));
                }).catch(console.error);
              }
            }).catch(console.error);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  const handleSelectDay = (dayNum: number) => {
    setActiveDay(dayNum);
  };

  const handleToggleDone = async (itemId: number, isDone: boolean) => {
    if (!slug) return;
    try {
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
      const { toggleTripScheduleItem } = await import("@/lib/api");
      await toggleTripScheduleItem(slug, itemId, isDone);
    } catch (err) {
      console.error("Failed to toggle item done status:", err);
      getTripDetail(slug).then(setTrip).catch(console.error);
    }
  };

  const handleUpdateScheduleItem = async (itemId: number, data: Partial<ScheduleItem>) => {
    if (!slug) return;
    try {
      setTrip(prev => {
        if (!prev) return prev;
        const newDays = prev.days.map(d => {
          const hasItem = d.schedule.some(s => s.id === itemId);
          if (!hasItem) return d;
          return {
            ...d,
            schedule: d.schedule.map(s => s.id === itemId ? { ...s, ...data } : s)
          };
        });
        return { ...prev, days: newDays };
      });
      const { updateTripScheduleItem } = await import("@/lib/api");
      await updateTripScheduleItem(slug, itemId, data);
    } catch (err) {
      console.error("Failed to update item:", err);
      getTripDetail(slug).then(setTrip).catch(console.error);
    }
  };

  const handleUpdateActual = async (rowId: number, actualAmount: number) => {
    if (!slug) return;
    try {
      setTrip(prev => {
        if (!prev) return prev;
        const newBudget = prev.budget.map(r => r.id === rowId ? { ...r, actual_amount_rp: actualAmount } : r);
        return { ...prev, budget: newBudget };
      });
      const { updateTripBudgetActual } = await import("@/lib/api");
      await updateTripBudgetActual(slug, rowId, actualAmount);
    } catch (err) {
      console.error("Failed to update actual amount:", err);
      getTripDetail(slug).then(setTrip).catch(console.error);
    }
  };

  const handleAddBudget = async (data: { category: string, detail?: string, amount_rp?: number, is_accommodation?: boolean }) => {
    if (!slug) return;
    try {
      const { createTripBudget } = await import("@/lib/api");
      await createTripBudget(slug, data);
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
    const isParticipating = trip.participants?.some(p => p.id === member.id);
    const previousTrip = { ...trip };
    
    // Optimistic Update
    setTrip(prev => {
      if (!prev) return prev;
      let newParticipants = prev.participants || [];
      if (isParticipating) {
        newParticipants = newParticipants.filter(p => p.id !== member.id);
      } else {
        newParticipants = [...newParticipants, { 
          id: member.id, 
          name: member.name || '', 
          avatar_url: `https://api.dicebear.com/7.x/notionists/svg?seed=${member.id}`,
          joined_at: new Date().toISOString()
        }];
      }
      return { ...prev, participants: newParticipants };
    });

    try {
      if (isParticipating) {
        await leaveTrip(slug, member.id);
      } else {
        await joinTrip(slug, member.id);
      }
      // Sync silently
      getTripDetail(slug).then(setTrip).catch(console.error);
    } catch (err) {
      console.error("Failed to join/leave trip:", err);
      setTrip(previousTrip); // Revert on failure
    }
  };

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
    window.scrollTo({ top: 0 });
  };

  const handleAddPackingItem = async (data: { category: string; item_name: string; assignee_id: number | null }) => {
    if (!slug) return;
    try {
      await addTripPackingItem(slug, data);
      const newData = await getTripDetail(slug);
      setTrip(newData);
    } catch (err) {
      console.error("Failed to add packing item", err);
    }
  };

  const handleTogglePackingItem = async (itemId: number, is_checked: boolean) => {
    if (!slug) return;
    try {
      setTrip(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          packing: prev.packing.map(p => p.id === itemId ? { ...p, is_checked } : p)
        };
      });
      await updateTripPackingItem(slug, itemId, { is_checked });
    } catch (err) {
      console.error("Failed to toggle schedule item", err);
      const newData = await getTripDetail(slug);
      setTrip(newData);
    }
  };

  const handleDeletedItem = (itemId: number) => {
    if (!trip) return;
    setTrip({
      ...trip,
      days: trip.days.map(d => ({
        ...d,
        schedule: d.schedule.filter(s => s.id !== itemId)
      }))
    });
  };

  const handleAssignPackingItem = async (itemId: number, assignee_id: number | null) => {
    if (!slug) return;
    try {
      await updateTripPackingItem(slug, itemId, { assignee_id });
      const newData = await getTripDetail(slug);
      setTrip(newData);
    } catch (err) {
      console.error("Failed to assign packing item", err);
    }
  };

  const handleDeletePackingItem = async (itemId: number) => {
    if (!slug) return;
    try {
      await deleteTripPackingItem(slug, itemId);
      setTrip(prev => prev ? { ...prev, packing: prev.packing.filter(p => p.id !== itemId) } : prev);
    } catch (err) {
      console.error("Failed to delete packing item", err);
    }
  };

  if (loading) return <div className="min-h-screen pt-20 text-center text-muted-foreground animate-pulse">Memuat detail perjalanan...</div>;
  if (!trip) return <div className="min-h-screen pt-20 text-center text-muted-foreground">Perjalanan tidak ditemukan.</div>;

  return (
    <PageContainer>
      <PageHeader 
        title={trip.title} 
        backTo="/trips"
        action={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => setIsEditOpen(true)} className="rounded-full size-10 bg-primary/10 text-primary"><Edit2 className="size-5" /></Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleShareTrip} className="rounded-full size-10"><Share className="size-5" /></Button>
          </div>
        }
      />

      <div className="max-w-3xl mx-auto w-full flex flex-col" ref={scrollContainerRef}>
        <div className="px-4 md:px-0 mb-4 flex items-center justify-between">
          <div className="text-sm font-medium">
            {trip.participants && trip.participants.length > 0 && trip.participant_count > trip.participants.length ? (
              <span className="text-foreground">{trip.participants.length} <span className="text-muted-foreground font-normal">dari {trip.participant_count}</span></span>
            ) : (
              <span className="text-foreground">{Math.max(trip.participants?.length || 0, trip.participant_count || 0)}</span>
            )}
            <span className="text-muted-foreground ml-1">orang ikut</span>
          </div>
          {member && (
            <Button variant={trip.participants?.some(p => p.id === member.id) ? "outline" : "default"} size="sm" className="rounded-xl h-9" onClick={handleJoinLeave}>
              {trip.participants?.some(p => p.id === member.id) ? <><LogOut className="size-4 mr-1.5" /> Batal Ikut</> : <><LogIn className="size-4 mr-1.5" /> Ikut Trip</>}
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="px-4 mb-4">
            <TabsList className="relative w-full bg-muted/50 rounded-xl p-1 flex items-center h-auto">
              {['itinerary', 'hotel', 'budget', 'bawaan'].map(tab => (
                <TabsTrigger 
                  key={tab}
                  value={tab} 
                  className="relative flex-1 rounded-lg text-xs py-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  {activeTab === tab && (
                    <motion.div
                      layoutId="active-tab"
                      className="absolute inset-0 bg-background rounded-[8px] shadow-sm"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                  <span className="relative z-10 capitalize">{tab === 'bawaan' ? 'Bawaan' : tab === 'hotel' ? 'Hotel' : tab === 'budget' ? 'Budget' : 'Itinerary'}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="px-4 pb-24">
            <TabsContent value="itinerary" className="mt-0 outline-none">
              <div className="sticky top-[72px] z-20 bg-background/90 backdrop-blur-md py-2 -mx-4 px-4 md:mx-0 md:px-0">
                <TripDaySelector days={trip.days} activeDay={activeDay} onSelectDay={handleSelectDay} weatherData={weatherData} />
              </div>
              <div className="flex flex-col gap-6 mt-2">
                {trip.days.filter(d => d.day_number === activeDay).map(day => (
                  <TripDayCard 
                  key={day.id} 
                  day={day} 
                  tripTitle={trip.title} 
                  isStandalone={true} 
                  isAdmin={isAdmin} 
                  slug={slug}
                  onToggleDone={handleToggleDone} 
                  onDeleted={handleDeletedItem}
                  onUpdated={handleUpdateScheduleItem}
                  onAddBudget={handleAddBudget}
                />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="hotel" className="mt-0 outline-none">
              <div className="flex flex-col gap-4">
                {trip.hotels.map(h => <TripHotelCard key={h.id} hotel={h} />)}
              </div>
            </TabsContent>

            <TabsContent value="budget" className="mt-0 outline-none flex flex-col gap-6">
              <TripBudgetTable rows={trip.budget} tripTitle={trip.title} participantCount={trip.participants?.length || trip.participant_count} isAdmin={isAdmin} onUpdateActual={handleUpdateActual} onAddBudget={handleAddBudget} />
              {ledgerId ? <LedgerDashboard ledgerId={ledgerId} /> : <div className="text-center p-4">Memuat Ledger...</div>}
            </TabsContent>

            <TabsContent value="bawaan" className="mt-0 outline-none">
              <TripPackingTab trip={trip} isAdmin={isAdmin} onAddItem={handleAddPackingItem} onToggleItem={handleTogglePackingItem} onAssignItem={handleAssignPackingItem} onDeleteItem={handleDeletePackingItem} />
            </TabsContent>
          </div>
        </Tabs>
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
