import { PageContainer } from "@/components/layout/PageContainer";
import type { Activity } from "@/contexts/ActivityContext";
import { useActivity } from "@/contexts/ActivityContext";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { MapPin, Users, Calendar, Clock, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function ActivitiesPage() {
  const { activities, loading } = useActivity();
  const navigate = useNavigate();

  const handleCreateNew = () => {
    navigate("/activities/new");
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Aktifitas</h1>
          <p className="text-sm text-muted-foreground">Ikuti kegiatan seru warga Semeja</p>
        </div>
        <Button onClick={handleCreateNew} size="sm" className="rounded-xl">
          <Plus className="w-4 h-4 mr-1" />
          Buat
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center p-8 border border-border/50 rounded-2xl bg-card">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Calendar className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Belum ada aktifitas</h3>
          <p className="text-sm text-muted-foreground">Pantau terus untuk kegiatan seru selanjutnya!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {activities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} onClick={() => navigate(`/activities/${activity.id}`)} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function ActivityCard({ activity, onClick }: { activity: Activity; onClick: () => void }) {
  const dateObj = new Date(activity.date);
  
  // Format cost
  let costDisplay = "Gratis";
  if (activity.cost_type === "fixed") {
    costDisplay = `Rp ${activity.cost_amount.toLocaleString('id-ID')}`;
  } else if (activity.cost_type === "split") {
    costDisplay = "Bagi Rata (nanti)";
  }

  return (
    <div 
      onClick={onClick}
      className="p-4 rounded-2xl border border-border/50 bg-card hover:border-primary/30 transition-all cursor-pointer shadow-sm"
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-lg text-foreground line-clamp-1">{activity.title}</h3>
        <span className="shrink-0 inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium bg-primary/10 text-primary uppercase tracking-wider">
          {costDisplay}
        </span>
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 shrink-0 text-muted-foreground/70" />
          <span>{format(dateObj, "EEEE, d MMM yyyy", { locale: id })}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 shrink-0 text-muted-foreground/70" />
          <span>{activity.time.substring(0, 5)} WIB</span>
        </div>
        {activity.location && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground/70" />
            <span className="line-clamp-2 leading-tight">{activity.location}</span>
          </div>
        )}
        <div className="flex items-center gap-2 pt-2 mt-2 border-t border-border/40">
          <Users className="w-4 h-4 shrink-0 text-muted-foreground/70" />
          <span className="font-medium text-foreground">
            {activity.participant_count || 0} orang
            {activity.guests_count_total ? ` (+${activity.guests_count_total} tamu)` : ""}
          </span>
          {activity.max_participants && (
            <span className="text-muted-foreground">
              / {activity.max_participants}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
