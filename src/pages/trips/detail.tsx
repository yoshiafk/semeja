import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Share } from "lucide-react";
import { getTripDetail } from "@/lib/api";
import type { TripDetail, TripCity } from "@/types/trip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TripDaySelector } from "@/components/TripDaySelector";
import { TripDayCard } from "@/components/TripDayCard";
import { TripHotelCard } from "@/components/TripHotelCard";
import { TripBudgetTable } from "@/components/TripBudgetTable";
import { shareToWhatsApp } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

export default function TripDetailView() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const currentTab = searchParams.get("tab") || "itinerary";
  
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [cityFilter, setCityFilter] = useState<TripCity | "all">("all");
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

  // Update active day based on scroll position
  useEffect(() => {
    if (currentTab !== "itinerary" || !trip?.days) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          const topVisible = visible.reduce((a, b) => 
            a.intersectionRatio > b.intersectionRatio ? a : b
          );
          const dayIdStr = topVisible.target.id.replace("day-", "");
          const dayNum = parseInt(dayIdStr, 10);
          if (!isNaN(dayNum)) setActiveDay(dayNum);
        }
      },
      { root: null, rootMargin: "-100px 0px -50% 0px", threshold: [0.1, 0.5] }
    );
    
    trip.days.forEach(day => {
      const el = document.getElementById(`day-${day.day_number}`);
      if (el) observer.observe(el);
    });
    
    return () => observer.disconnect();
  }, [trip, currentTab]);

  const handleSelectDay = (dayNum: number) => {
    setActiveDay(dayNum);
    const el = document.getElementById(`day-${dayNum}`);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 160;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const handleCityFilter = (city: TripCity | "all") => {
    setCityFilter(city);
    if (city !== "all" && trip) {
      const firstDayOfCity = trip.days.find(d => d.city === city || d.city === "transit");
      if (firstDayOfCity) {
        handleSelectDay(firstDayOfCity.day_number);
      }
    }
  };

  const handleShareTrip = () => {
    if (!trip) return;
    const url = window.location.href;
    const msg = `Yuk cek itinerary *${trip.title}* di Semeja!\n\n${url}`;
    shareToWhatsApp(msg);
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

  const visibleDays = cityFilter === "all" 
    ? trip.days 
    : trip.days.filter(d => d.city === cityFilter || d.city === "transit");

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate("/trips")}
              className="p-1 -ml-1 hover:bg-muted rounded-full active:scale-95 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <h1 className="font-semibold text-lg truncate max-w-[200px] sm:max-w-md">{trip.title}</h1>
          </div>
          <button 
            onClick={handleShareTrip}
            className="p-2 hover:bg-muted rounded-full text-muted-foreground active:scale-95 transition-all"
          >
            <Share className="w-5 h-5" />
          </button>
        </div>
        
        <div className="max-w-screen-xl mx-auto">
          <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full flex justify-center py-2">
            <TabsList className="inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
              <TabsTrigger 
                value="itinerary" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-5 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
              >
                Itinerary
              </TabsTrigger>
              <TabsTrigger 
                value="hotel"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-5 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
              >
                Hotel
              </TabsTrigger>
              <TabsTrigger 
                value="budget"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-5 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
              >
                Budget
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="p-4 max-w-screen-xl mx-auto" ref={scrollContainerRef}>
        {/* TAB 1: ITINERARY */}
        {currentTab === "itinerary" && (
          <div className="md:grid md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr] md:gap-8 items-start">
            {/* Sidebar (Sticky on desktop) */}
            <div className="md:sticky md:top-[120px] z-30">
              {/* City Filters */}
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide md:flex-wrap md:overflow-visible">
                <button
                  onClick={() => handleCityFilter("all")}
                  className={cn(
                    "px-4 py-1.5 rounded-full border text-sm font-medium whitespace-nowrap transition-all",
                    cityFilter === "all" ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card text-muted-foreground hover:bg-muted"
                  )}
                >
                  Semua
                </button>
                <button
                  onClick={() => handleCityFilter("semarang")}
                  className={cn(
                    "px-4 py-1.5 rounded-full border text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5",
                    cityFilter === "semarang" ? "bg-green-600 text-white border-green-600 shadow-sm" : "bg-card text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full", cityFilter === "semarang" ? "bg-white" : "bg-green-500")} />
                  Semarang
                </button>
                <button
                  onClick={() => handleCityFilter("yogyakarta")}
                  className={cn(
                    "px-4 py-1.5 rounded-full border text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5",
                    cityFilter === "yogyakarta" ? "bg-purple-600 text-white border-purple-600 shadow-sm" : "bg-card text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full", cityFilter === "yogyakarta" ? "bg-white" : "bg-purple-500")} />
                  Yogyakarta
                </button>
              </div>

              {/* Sticky Day Selector (below header on mobile, static on desktop) */}
              <div className="sticky top-[112px] md:static z-30 bg-background/95 md:bg-transparent backdrop-blur-sm py-2 -mx-4 px-4 md:mx-0 md:px-0 md:py-0 border-b border-border/40 md:border-none shadow-sm md:shadow-none">
                <TripDaySelector 
                  days={trip.days} 
                  activeDay={activeDay} 
                  cityFilter={cityFilter}
                  onSelectDay={handleSelectDay}
                />
              </div>
            </div>

            {/* Days Content */}
            <div className="mt-6 md:mt-0 space-y-6">
              {visibleDays.map(day => (
                <TripDayCard 
                  key={day.id} 
                  day={day} 
                  tripTitle={trip.title}
                  defaultExpanded={day.day_number === activeDay}
                />
              ))}
              {visibleDays.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  Tidak ada itinerary untuk filter ini.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: HOTEL */}
        {currentTab === "hotel" && (
          <div className="space-y-4 pt-2">
            {trip.hotels.map(hotel => (
              <TripHotelCard key={hotel.id} hotel={hotel} />
            ))}
            {trip.hotels.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                Belum ada data penginapan.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BUDGET */}
        {currentTab === "budget" && (
          <div className="space-y-4 pt-2">
            {trip.budget.length > 0 ? (
              <TripBudgetTable 
                rows={trip.budget} 
                tripTitle={trip.title}
                participantCount={trip.participant_count}
              />
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                Belum ada data budget.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
