import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Users, Calendar, Train } from "lucide-react";
import { getTrips } from "@/lib/api";
import type { TripSummary } from "@/types/trip";
import { TripCountdownBlock } from "@/components/TripCountdownBanner";
import { Button } from "@/components/ui/button";

export default function TripsList() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTrips()
      .then(setTrips)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="p-1 -ml-1 hover:bg-muted rounded-full active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-semibold text-lg">Perjalanan</h1>
        </div>
        {/* +New button would go here for admin */}
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="text-center py-10 text-muted-foreground animate-pulse">Memuat perjalanan...</div>
        ) : trips.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">Belum ada perjalanan yang direncanakan.</div>
        ) : (
          trips.map(trip => (
            <div key={trip.id} className="block group relative bg-card border rounded-3xl overflow-hidden shadow-sm">
              {/* Gradient Hero */}
              <div className="h-32 bg-gradient-to-r from-emerald-500 to-purple-600 relative p-5 flex flex-col justify-end">
                <div className="absolute inset-0 bg-black/10 mix-blend-overlay"></div>
                <h2 className="text-white font-bold text-2xl relative z-10">{trip.title}</h2>
                {trip.subtitle && (
                  <p className="text-white/90 text-sm relative z-10">{trip.subtitle}</p>
                )}
              </div>

              {/* Content */}
              <div className="p-5">
                <div className="flex flex-wrap gap-x-4 gap-y-2 mb-5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span>
                      {new Date(trip.start_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – 
                      {new Date(trip.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-primary" />
                    <span>{trip.participant_count} orang</span>
                  </div>
                  {trip.transport && trip.transport.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Train className="w-4 h-4 text-primary" />
                      <span>{trip.transport.join(" · ")}</span>
                    </div>
                  )}
                </div>

                <TripCountdownBlock 
                  startDate={trip.start_date}
                  endDate={trip.end_date}
                  status={trip.status}
                />

                {/* Quick Jumps */}
                <div className="grid grid-cols-3 gap-2 mt-5">
                  <Button variant="outline" size="sm" className="w-full text-xs h-9" asChild>
                    <Link to={`/trips/${trip.slug}?tab=itinerary`}>Itinerary</Link>
                  </Button>
                  <Button variant="outline" size="sm" className="w-full text-xs h-9" asChild>
                    <Link to={`/trips/${trip.slug}?tab=hotel`}>Hotel</Link>
                  </Button>
                  <Button variant="outline" size="sm" className="w-full text-xs h-9" asChild>
                    <Link to={`/trips/${trip.slug}?tab=budget`}>Budget</Link>
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
