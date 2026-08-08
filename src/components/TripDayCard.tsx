import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TripDay } from "@/types/trip";
import { TripScheduleItem } from "./TripScheduleItem";
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
  onToggleDone?: (itemId: number, isDone: boolean) => Promise<void>;
}

const CITY_COLORS: Record<string, string> = {
  semarang: "bg-chart-1",
  yogyakarta: "bg-chart-2",
  transit: "bg-gradient-to-r from-chart-1 to-chart-2",
};

export function TripDayCard({ day, tripTitle, defaultExpanded = false, isStandalone = false, isAdmin, onToggleDone }: TripDayCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const dotClass = CITY_COLORS[day.city] || "bg-gray-400";
  
  const content = (
    <div className={cn("px-4 pb-4", isStandalone ? "pt-4" : "")}>
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
            isLast={idx === day.schedule.length - 1}
            isAdmin={isAdmin}
            onToggleDone={onToggleDone}
          />
        ))}
        {day.schedule.length === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground italic">
            Belum ada jadwal
          </div>
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
      <div className="bg-card border border-border/60 rounded-3xl overflow-hidden shadow-sm animate-page-in">
        <div className="w-full px-5 py-4 flex items-center justify-between border-b bg-muted/20">
          <div className="flex items-center gap-3">
            <div className={cn("w-2.5 h-2.5 rounded-full", dotClass)} />
            <div>
              <h3 className="font-bold text-foreground">
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
    <div className="bg-card border border-border/60 rounded-3xl overflow-hidden shadow-md mb-6 hover:shadow-lg transition-shadow duration-300" id={`day-${day.day_number}`}>
      {/* Header (Tap to toggle) */}
      <button
        onClick={() => {
          triggerHaptic("light");
          setExpanded(!expanded);
        }}
        className="w-full px-5 py-5 flex items-center justify-between text-left touch-active hover:bg-muted/30"
      >
        <div className="flex items-center gap-3">
          <div className={cn("w-2.5 h-2.5 rounded-full", dotClass)} />
          <div>
            <h3 className="font-bold text-foreground">
              H{day.day_number} · {day.label}
            </h3>
            {/* If there was an area subtitle we'd show it here, currently it's just in the day object but maybe we can derive from schedule or area_note */}
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
