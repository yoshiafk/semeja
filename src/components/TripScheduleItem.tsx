import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, ExternalLink, Check, Clock, Pencil, Trash2, Loader2 } from "lucide-react";
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
  food:        "text-amber-500 bg-amber-50 ring-amber-50",
  attraction:  "text-blue-500 bg-blue-50 ring-blue-50",
  transit:     "text-gray-500 bg-gray-100 ring-gray-100",
  hotel:       "text-teal-500 bg-teal-50 ring-teal-50",
  event:       "text-violet-500 bg-violet-50 ring-violet-50",
  shopping:    "text-pink-500 bg-pink-50 ring-pink-50",
  leisure:     "text-orange-500 bg-orange-50 ring-orange-50",
};

interface TripScheduleItemProps {
  item: ScheduleItem;
  slug: string;
  isLast?: boolean;
  isAdmin?: boolean;
  onToggleDone?: (itemId: number, isDone: boolean) => Promise<void>;
  onDeleted?: (itemId: number) => void;
}

export function TripScheduleItem({ item, slug, isLast = false, isAdmin, onToggleDone, onDeleted }: TripScheduleItemProps) {
  const [expandedNotes, setExpandedNotes] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const Icon = ACTIVITY_ICONS[item.activity_type] ?? MapPin;
  const colorClass = ACTIVITY_COLORS[item.activity_type] ?? "text-gray-500 bg-gray-100 ring-gray-100";

  const handleMapsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(item.maps_url, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Hapus agenda "${item.name}"?`)) return;
    setIsDeleting(true);
    try {
      const { deleteTripScheduleItem } = await import("@/lib/api");
      await deleteTripScheduleItem(slug, item.id);
      if (onDeleted) onDeleted(item.id);
    } catch (err) {
      console.error("Failed to delete schedule item:", err);
      setIsDeleting(false);
      const { toast } = await import("sonner");
      toast.error("Gagal menghapus jadwal");
    }
  };

  return (
    <div className={cn(
      "relative flex gap-3 py-3 px-2 -mx-2 rounded-2xl transition-all duration-200 hover:bg-muted/40",
      item.is_done && "opacity-60"
    )}>
      {/* Time rail */}
      <div className="w-10 flex-shrink-0 flex flex-col items-end pt-1">
        <span className="text-xs font-semibold text-foreground leading-none">
          {item.time_start}
        </span>
        {item.time_end && (
          <span className="text-[10px] font-medium text-muted-foreground leading-tight mt-1">
            {item.time_end}
          </span>
        )}
      </div>

      {/* Icon & Timeline */}
      <div className="relative flex flex-col items-center flex-shrink-0">
        <div className={cn("z-10 size-7 rounded-full flex items-center justify-center ring-4 ring-background", colorClass)}>
          <Icon className="size-3.5" />
        </div>
        {!isLast && (
          <div className="absolute top-7 w-[2px] bg-border/50 bottom-[-1rem]" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-start justify-between gap-3">
          {/* Name + badges + details */}
          <div className="flex-1 min-w-0 pb-2">
            <p className={cn(
              "text-sm leading-snug pr-1",
              item.is_highlight ? "font-bold text-foreground" : "font-medium text-foreground",
              item.is_optional && "opacity-70",
              item.is_done && "line-through text-muted-foreground"
            )}>
              {item.name}
            </p>

            {/* Location & Opening Hours */}
            {(item.location || item.area || item.opening_hours || item.maps_url) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                {(item.location || item.area || item.maps_url) && (
                  <div className="flex items-center gap-1 min-w-0">
                    <MapPin className="size-3 flex-shrink-0" />
                    {(item.location || item.area) && (
                      <span className="truncate max-w-[160px] xs:max-w-[200px]">
                        {item.location || item.area}
                        {item.location && item.area && ` · ${item.area}`}
                      </span>
                    )}
                    {item.maps_url && (
                      <button
                        onClick={handleMapsClick}
                        className={cn(
                          "text-blue-500 hover:text-blue-600 active:scale-95 transition-transform flex items-center gap-1",
                          (item.location || item.area) ? "ml-1" : "ml-0"
                        )}
                        aria-label={`Buka ${item.name} di Maps`}
                      >
                        {(!item.location && !item.area) && <span className="font-medium">Lihat di Maps</span>}
                        <ExternalLink className="size-3.5" />
                      </button>
                    )}
                  </div>
                )}
                {item.opening_hours && (
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <Clock className="size-3 flex-shrink-0" />
                    <span>{item.opening_hours}</span>
                  </div>
                )}
              </div>
            )}

            {/* Badges row */}
            {(item.is_highlight || item.is_cash_only || item.requires_booking || item.is_optional) && (
              <div className="flex flex-wrap gap-1 mt-2">
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

            {/* Notes */}
            {item.notes && (
              <div className="mt-2 bg-muted/30 rounded-lg p-2.5 border border-border/40">
                <p 
                  className={cn(
                    "text-xs text-muted-foreground leading-relaxed",
                    !expandedNotes && "line-clamp-2"
                  )}
                >
                  {item.notes}
                </p>
                {item.notes.length > 80 && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setExpandedNotes(!expandedNotes); }}
                    className="text-[10px] text-primary font-medium mt-1 hover:underline active:scale-95"
                  >
                    {expandedNotes ? "Tutup" : "Lihat selengkapnya"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Action: Checkbox & Edit/Delete */}
          {isAdmin && (
            <div className="flex flex-col gap-2 mt-0.5 items-end ml-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onToggleDone) onToggleDone(item.id, !item.is_done);
                }}
                className={cn(
                  "flex-shrink-0 size-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 active:scale-90",
                  item.is_done 
                    ? "bg-primary border-primary text-primary-foreground" 
                    : "border-muted-foreground/30 hover:border-primary/50 bg-background"
                )}
                aria-label={item.is_done ? "Tandai belum selesai" : "Tandai selesai"}
              >
                {item.is_done && <Check className="size-4" strokeWidth={3} />}
              </button>
              
              <div className="flex items-center gap-1">
                <Link
                  to={`/trips/${slug}/schedule/${item.id}/edit`}
                  onClick={(e) => e.stopPropagation()}
                  className="size-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted-foreground/10 transition-colors"
                >
                  <Pencil className="size-3.5" />
                </Link>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="size-7 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
