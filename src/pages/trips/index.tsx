import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Users, Calendar, Train, Plus } from "lucide-react";
import { getTrips } from "@/lib/api";
import type { TripSummary, TripDetail } from "@/types/trip";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { TripCountdownBlock } from "@/components/TripCountdownBanner";
import { Button } from "@/components/ui/button";
import { TripFormDialog } from "@/components/TripFormDialog";
import { useMember } from "@/hooks/useMember";

export default function TripsList() {
  const { isAdmin } = useMember();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    getTrips()
      .then(setTrips)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (data: Partial<TripDetail>) => {
    try {
      const { createTrip } = await import("@/lib/api");
      await createTrip({ ...data, slug: data.title!.toLowerCase().replace(/\s+/g, '-') });
      const updatedList = await getTrips();
      setTrips(updatedList);
    } catch (err) {
      console.error("Failed to create trip:", err);
    }
  };

  return (
    <PageContainer>
      <PageHeader 
        title="Perjalanan" 
        backTo={-1} 
        action={isAdmin ? (
          <Button size="icon" variant="ghost" className="rounded-full bg-primary/10 hover:bg-primary/20 text-primary" onClick={() => setIsCreateOpen(true)}>
            <Plus className="size-5" />
          </Button>
        ) : undefined}
      />
      
      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="text-center py-10 text-muted-foreground animate-pulse">Memuat perjalanan...</div>
        ) : trips.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">Belum ada perjalanan yang direncanakan.</div>
        ) : (
          trips.map(trip => (
            <div key={trip.id} className="block group relative bg-card border rounded-3xl overflow-hidden shadow-sm p-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-bold text-2xl text-foreground tracking-tight">{trip.title}</h2>
                  {trip.subtitle && (
                    <p className="text-muted-foreground text-sm mt-1">{trip.subtitle}</p>
                  )}
                </div>
                <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="18"></line><line x1="15" y1="6" x2="15" y2="21"></line></svg>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap gap-x-4 gap-y-2 mb-5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="size-4 text-primary" />
                    <span>
                      {new Date(trip.start_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – 
                      {new Date(trip.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="size-4 text-primary" />
                    <span>{trip.participant_count} orang</span>
                  </div>
                  {trip.transport && trip.transport.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Train className="size-4 text-primary" />
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

      <TripFormDialog 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen} 
        onSave={handleCreate} 
      />
    </PageContainer>
  );
}
