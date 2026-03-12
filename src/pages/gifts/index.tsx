import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMember } from "@/hooks/useMember";
import { PageContainer } from "@/components/layout/PageContainer";
import { Gift as GiftIcon, Plus, Calendar, Users, ChevronRight, Info } from "lucide-react";
import { getGifts } from "@/lib/api";
import type { Gift as GiftType } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { cn, formatRupiah } from "@/lib/utils";

export default function GiftsList() {
  const { isAdmin } = useMember();
  const [gifts, setGifts] = useState<GiftType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGifts()
      .then(setGifts)
      .finally(() => setLoading(false));
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return "bg-green-500/10 text-green-600 border-green-200";
      case 'completed': return "bg-blue-500/10 text-blue-600 border-blue-200";
      case 'cancelled': return "bg-red-500/10 text-red-600 border-red-200";
      default: return "bg-gray-500/10 text-gray-600 border-gray-200";
    }
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gift Pooling</h1>
          <p className="text-sm text-muted-foreground">Plan and split gift costs together</p>
        </div>
        {isAdmin && (
          <Link
            to="/community/gifts/new"
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 transition-transform active:scale-95"
          >
            <Plus className="w-5 h-5" />
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Loading gifts...</p>
        </div>
      ) : gifts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <GiftIcon className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">No gifts found</h3>
          <p className="text-sm text-muted-foreground max-w-[240px]">
            No gift pooling plans have been created yet.
          </p>
          {isAdmin && (
            <Link
              to="/community/gifts/new"
              className="mt-6 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm shadow-lg shadow-primary/10"
            >
              Start First Gift Plan
            </Link>
          )}
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
                          <Users className="w-3 h-3" />
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
                  <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center group-hover:bg-primary/20 transition-colors self-center">
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
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
