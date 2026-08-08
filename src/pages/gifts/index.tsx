import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { Gift as GiftIcon, Plus, Calendar, Users, ChevronRight, Info } from "lucide-react";
import { getGifts } from "@/lib/api";
import type { Gift as GiftType } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { cn, formatRupiah } from "@/lib/utils";

export default function GiftsList() {
  const [gifts, setGifts] = useState<GiftType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGifts()
      .then(setGifts)
      .finally(() => setLoading(false));
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return "bg-success/10 text-success border-success/20";
      case 'completed': return "bg-info/10 text-info border-info/20";
      case 'cancelled': return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gift Pooling</h1>
          <p className="text-sm text-muted-foreground">Plan and split gift costs together</p>
        </div>
        <Link
          to="/community/gifts/new"
          className="size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 transition-transform active:scale-95"
        >
          <Plus className="size-5" />
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Loading gifts...</p>
        </div>
      ) : gifts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <GiftIcon className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">No gifts found</h3>
          <p className="text-sm text-muted-foreground max-w-[240px]">
            No gift pooling plans have been created yet.
          </p>
          <Link
            to="/community/gifts/new"
            className="mt-6 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm shadow-lg shadow-primary/10"
          >
            Start First Gift Plan
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {gifts.map((gift) => (
            <Link key={gift.id} to={`/community/gifts/${gift.id}`}>
              <Card className="p-4 bg-white/50 backdrop-blur-sm border-border/50 hover:bg-white hover:shadow-md transition-all active:scale-[0.98] relative overflow-hidden group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-wider py-0", getStatusColor(gift.status))}>
                        {gift.status}
                      </Badge>
                      {gift.participant_count && gift.participant_count > 0 && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          <Users className="size-3" />
                          {gift.participant_count}
                        </div>
                      )}
                    </div>
                    <h3 className="font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                      {gift.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                       {gift.event_date && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(new Date(gift.event_date), "MMM d, yyyy")}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                        <Info className="w-3.5 h-3.5" />
                        Est. {formatRupiah(gift.total_estimated_price || 0)}
                      </div>
                    </div>
                  </div>
                  <div className="size-8 rounded-full bg-muted/50 flex items-center justify-center group-hover:bg-primary/20 transition-colors self-center">
                    <ChevronRight className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
