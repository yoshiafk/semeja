import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TripDay, ScheduleItem } from "@/types/trip";
import { TripScheduleItem } from "./TripScheduleItem";
import { Link } from "react-router-dom";
import { WhatsAppShareButton } from "./WhatsAppShareButton";
import { formatTripDayWhatsApp } from "@/lib/whatsapp";
import { motion, AnimatePresence } from "framer-motion";
import { triggerHaptic } from "@/lib/haptics";

interface TripDayCardProps {
  day: TripDay;
  tripTitle: string;
  defaultExpanded?: boolean;
  isStandalone?: boolean;
  isAdmin?: boolean;
  slug?: string;
  onToggleDone?: (itemId: number, isDone: boolean) => Promise<void>;
  onDeleted?: (itemId: number) => void;
  onUpdated?: (itemId: number, data: Partial<ScheduleItem>) => void;
  onAddBudget?: (data: { category: string, detail?: string, amount_rp?: number, is_accommodation?: boolean }) => Promise<void>;
}

const CITY_COLORS: Record<string, string> = {
  semarang: "bg-chart-1",
  yogyakarta: "bg-chart-2",
  transit: "bg-gradient-to-r from-chart-1 to-chart-2",
};

export function TripDayCard({ day, tripTitle, defaultExpanded = false, isStandalone = false, isAdmin, slug, onToggleDone, onDeleted, onUpdated, onAddBudget }: TripDayCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const dotClass = CITY_COLORS[day.city] || "bg-gray-400";
  
  const content = (
    <div className={cn("pt-2", isStandalone ? "px-0" : "px-1")}>
      {/* Banners */}
      {day.warning_note && (
        <div className="mb-3 px-3 py-2.5 rounded-xl bg-warning/10 text-warning-foreground text-sm flex items-start gap-2 border border-warning/20">
          <AlertTriangle className="size-4 flex-shrink-0 mt-0.5 text-warning" />
          <p className="leading-snug">{day.warning_note}</p>
        </div>
      )}
      
      {day.area_note && (
        <div className="mb-3 px-3 py-2.5 rounded-xl bg-info/10 text-info text-sm flex items-start gap-2 border border-info/20">
          <Info className="size-4 flex-shrink-0 mt-0.5 text-info" />
          <p className="leading-snug">{day.area_note}</p>
        </div>
      )}

      {/* Schedule Items */}
      <div className="flex flex-col">
        {day.schedule.map((item, idx) => (
          <TripScheduleItem
            key={item.id}
            item={item}
            slug={slug || ""}
            isLast={idx === day.schedule.length - 1}
            isAdmin={isAdmin}
            onToggleDone={onToggleDone}
            onDeleted={onDeleted}
            onUpdated={onUpdated}
            onAddBudget={onAddBudget}
          />
        ))}
        {day.schedule.length === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground italic">
            Belum ada jadwal
          </div>
        )}
        {isAdmin && slug && (
          <Link 
            to={`/trips/${slug}/schedule/new?dayId=${day.id}`}
            className="mt-3 w-full py-3 flex items-center justify-center border-2 border-dashed border-primary/30 rounded-xl text-primary font-medium hover:bg-primary/5 hover:border-primary/50 transition-colors"
          >
            + Tambah Agenda Baru
          </Link>
        )}
      </div>

      {/* Share button */}
      <div className="mt-4 pt-4 border-t">
        <WhatsAppShareButton
          message={formatTripDayWhatsApp(day, tripTitle)}
          label="Bagikan jadwal hari ini"
          className="w-full justify-center"
        />
      </div>
    </div>
  );

  if (isStandalone) {
    return (
      <div className="animate-page-in">
        <div className="sticky top-0 z-20 w-full px-4 py-4 flex items-center justify-between bg-background/95 backdrop-blur-md mb-2">
          <div className="flex items-center gap-3">
            <div className={cn("w-3 h-3 rounded-full shadow-sm", dotClass)} />
            <div>
              <h3 className="font-extrabold text-xl text-foreground">
                H{day.day_number} · {day.label}
              </h3>
            </div>
          </div>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div className="mb-8" id={`day-${day.day_number}`}>
      {/* Header (Sticky & Tap to toggle) */}
      <button
        onClick={() => {
          triggerHaptic("light");
          setExpanded(!expanded);
        }}
        className="sticky top-[60px] z-20 w-full px-4 py-3 flex items-center justify-between text-left bg-background/95 backdrop-blur-md touch-active rounded-2xl -mx-4 w-[calc(100%+2rem)]"
      >
        <div className="flex items-center gap-3">
          <div className={cn("w-3 h-3 rounded-full shadow-sm", dotClass)} />
          <div>
            <h3 className="font-extrabold text-lg text-foreground">
              H{day.day_number} · {day.label}
            </h3>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="size-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-5 text-muted-foreground" />
        )}
      </button>

      {/* Collapsible Content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "tween", ease: "easeInOut", duration: 0.25 }}
            className="overflow-hidden"
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
