import { Users, UtensilsCrossed, Map, Sparkles, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type ActivityType = "meal" | "trip" | "activity";

export interface ActivityCardProps {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  costEstimate?: number;
  emoji?: string;
  participants: number;
  hasJoined: boolean;
  isCompleted?: boolean;
  onJoin?: (id: string) => void;
  onSettleUp?: (id: string) => void;
  className?: string;
}

const typeConfig = {
  meal: {
    icon: UtensilsCrossed,
    bgClass: "bg-card text-card-foreground border-border",
    label: "Meal",
  },
  trip: {
    icon: Map,
    bgClass: "bg-card text-card-foreground border-border",
    label: "Trip",
  },
  activity: {
    icon: Sparkles,
    bgClass: "bg-card text-card-foreground border-border",
    label: "Activity",
  },
};

export function ActivityCard({
  id,
  type,
  title,
  description,
  costEstimate,
  emoji,
  participants,
  hasJoined,
  isCompleted,
  onJoin,
  onSettleUp,
  className,
}: ActivityCardProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "relative rounded-xl p-5 shadow-sm border transition-all hover:shadow-md",
        config.bgClass,
        className
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="size-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            {config.label}
          </span>
        </div>
        {emoji && <div className="text-3xl opacity-90">{emoji}</div>}
      </div>

      <div className="mb-6">
        <h3 className="text-xl font-bold leading-tight mb-2">
          {title}
        </h3>
        {description && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {description}
          </p>
        )}
      </div>

      <div className="flex items-end justify-between mt-auto">
        <div className="flex flex-col gap-1">
          {costEstimate !== undefined && (
            <div className="text-sm font-semibold text-foreground">
              Est: Rp {costEstimate.toLocaleString("id-ID")}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="size-4" />
            <span>{participants} {participants === 1 ? 'person' : 'people'} in</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {isCompleted ? (
            <Button
              onClick={() => onSettleUp?.(id)}
              variant="outline"
              className="rounded-lg font-semibold shadow-sm"
            >
              Settle Up
            </Button>
          ) : hasJoined ? (
            <Button
              variant="secondary"
              disabled
              className="rounded-lg font-semibold opacity-100"
            >
              <CheckCircle2 className="mr-2 size-4 text-primary" />
              You're In
            </Button>
          ) : (
            <Button
              onClick={() => onJoin?.(id)}
              className="rounded-lg font-semibold shadow-sm"
            >
              I'm In!
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}


