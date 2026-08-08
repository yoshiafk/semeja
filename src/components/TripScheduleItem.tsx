import { useState } from "react";
import { MapPin, ExternalLink, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduleItem, ActivityType } from "@/types/trip";

// ── Icon map by activity type ────────────────────────────────────────────
import {
  Utensils, Landmark, Bus, Hotel, Music, ShoppingBag, Sun,
} from "lucide-react";

const ACTIVITY_ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  food:        Utensils,
  attraction:  Landmark,
  transit:     Bus,
  hotel:       Hotel,
  event:       Music,
  shopping:    ShoppingBag,
  leisure:     Sun,
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  food:        "text-amber-500 bg-amber-50",
  attraction:  "text-blue-500 bg-blue-50",
  transit:     "text-gray-500 bg-gray-100",
  hotel:       "text-teal-500 bg-teal-50",
  event:       "text-violet-500 bg-violet-50",
  shopping:    "text-pink-500 bg-pink-50",
  leisure:     "text-orange-500 bg-orange-50",
};

interface TripScheduleItemProps {
  item: ScheduleItem;
  isLast?: boolean;
  isAdmin?: boolean;
  onToggleDone?: (itemId: number, isDone: boolean) => Promise<void>;
}

export function TripScheduleItem({ item, isLast = false, isAdmin, onToggleDone }: TripScheduleItemProps) {
  const [expandedNotes, setExpandedNotes] = useState(false);
  const Icon = ACTIVITY_ICONS[item.activity_type] ?? MapPin;
  const colorClass = ACTIVITY_COLORS[item.activity_type] ?? "text-gray-500 bg-gray-100";

  const handleMapsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(item.maps_url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={cn(
      "relative flex gap-3 py-3 px-2 -mx-2 rounded-2xl transition-all duration-200 hover:bg-muted/40",
      !isLast && "border-b border-border/40 hover:border-transparent"
    )}>
      {/* Time rail */}
      <div className="w-11 flex-shrink-0 flex flex-col items-end pt-0.5">
        <span className="text-xs font-mono text-muted-foreground leading-tight">
          {item.time_start}
        </span>
        {item.time_end && (
          <span className="text-[10px] font-mono text-muted-foreground/60 leading-tight">
            {item.time_end}
          </span>
        )}
      </div>

      {/* Type icon */}
      <div className={cn("size-8 flex-shrink-0 rounded-lg flex items-center justify-center mt-0.5", colorClass)}>
        <Icon className="size-4" />
      </div>

      {/* Content */}
      <div className={cn("flex-1 min-w-0 transition-opacity", item.is_done && "opacity-60")}>
        <div className="flex items-start justify-between gap-2">
          {/* Name + badges */}
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-sm leading-snug pr-1",
              item.is_highlight ? "font-bold text-foreground" : "font-medium text-foreground/90",
              item.is_optional && "opacity-70",
              item.is_done && "line-through text-muted-foreground"
            )}>
              {item.name}
            </p>

            {/* Location + area */}
            {(item.location || item.area) && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <MapPin className="size-3 flex-shrink-0" />
                <span className="truncate">
                  {item.location || item.area}
                  {item.location && item.area && ` · ${item.area}`}
                </span>
              </p>
            )}

            {/* Opening hours */}
            {item.opening_hours && (
              <p className="text-xs text-muted-foreground/80 mt-0.5">
                🕐 {item.opening_hours}
              </p>
            )}

            {/* Notes */}
            {item.notes && (
              <div className="mt-0.5">
                <p 
                  className={cn(
                    "text-xs text-muted-foreground italic leading-relaxed",
                    !expandedNotes && "line-clamp-2"
                  )}
                >
                  {item.notes}
                </p>
                {item.notes.length > 80 && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setExpandedNotes(!expandedNotes); }}
                    className="text-[10px] text-primary font-medium mt-0.5 hover:underline active:scale-95"
                  >
                    {expandedNotes ? "Tutup" : "Lihat selengkapnya"}
                  </button>
                )}
              </div>
            )}

            {/* Badges row */}
            {(item.is_highlight || item.is_cash_only || item.requires_booking || item.is_optional) && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {item.is_highlight && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-yellow-100 text-yellow-700 border border-yellow-200">
                    ⭐ HIGHLIGHT
                  </span>
                )}
                {item.is_cash_only && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-700 border border-red-200">
                    💵 CASH ONLY
                  </span>
                )}
                {item.requires_booking && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-orange-100 text-orange-700 border border-orange-200">
                    📌 BOOK DULU
                  </span>
                )}
                {item.is_optional && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-500 border border-gray-200">
                    Opsional
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions (Maps & Checkbox) */}
          <div className="flex flex-col gap-2 items-end">
            {item.maps_url && (
              <button
                onClick={handleMapsClick}
                className={cn(
                  "flex-shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-medium",
                  "text-blue-600 bg-blue-50 border-blue-200",
                  "hover:bg-blue-100 active:scale-95 transition-all duration-150",
                  "min-w-[44px] min-h-[44px] items-center justify-center"
                )}
                aria-label={`Buka ${item.name} di Maps`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Maps</span>
              </button>
            )}
            
            {isAdmin && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onToggleDone) onToggleDone(item.id, !item.is_done);
                }}
                className={cn(
                  "flex-shrink-0 size-8 rounded-full border-2 flex items-center justify-center transition-all duration-200 active:scale-90",
                  item.is_done 
                    ? "bg-primary border-primary text-primary-foreground" 
                    : "border-muted-foreground/30 hover:border-primary/50 bg-background"
                )}
                aria-label={item.is_done ? "Tandai belum selesai" : "Tandai selesai"}
              >
                {item.is_done && <Check className="size-4" strokeWidth={3} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
