import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

/** Maps a route prefix to a module CSS class for accent colors */
function routeToModule(href: string): string | null {
  if (href.startsWith("/meals"))              return "module-meals";
  if (href.startsWith("/finance"))            return "module-finance";
  if (href.startsWith("/trips"))              return "module-trips";
  if (href.startsWith("/activities"))         return "module-activities";
  if (href.startsWith("/community"))          return "module-community";
  if (href.startsWith("/bekal-sehat"))        return "module-bekal";
  return null;
}

interface ModuleCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  badge?: string;
  badgeVariant?: "default" | "coming-soon" | "count";
  disabled?: boolean;
  className?: string;
  /** Optional stat label shown at bottom, e.g. "3 orang ikut" */
  stat?: string;
}

export function ModuleCard({
  icon: Icon,
  title,
  description,
  href,
  badge,
  badgeVariant = "default",
  disabled = false,
  className,
  stat,
}: ModuleCardProps) {
  const moduleClass = routeToModule(href);

  const content = (
    <Card
      className={cn(
        "relative flex flex-col p-5 rounded-2xl transition-all duration-300 overflow-hidden",
        "border-border/60 hover:border-border shadow-sm",
        !disabled && "touch-scale hover:shadow-md cursor-pointer group",
        disabled && "opacity-60 cursor-not-allowed",
        className
      )}
    >
      {/* Subtle gradient glow on hover */}
      {!disabled && moduleClass && (
        <div
          className={cn(
            "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
            moduleClass
          )}
          style={{
            background:
              "radial-gradient(ellipse at top left, color-mix(in oklch, var(--module-color) 8%, transparent) 0%, transparent 60%)",
          }}
        />
      )}

      {/* Badge */}
      {badge && (
        <div className="absolute top-3 right-3">
          <Badge
            variant="secondary"
            className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full",
              badgeVariant === "coming-soon" && "bg-accent/15 text-accent-foreground border-0",
              badgeVariant === "count" && moduleClass
                ? `${moduleClass} module-badge border-0`
                : badgeVariant === "count"
                ? "bg-primary/10 text-primary border-0"
                : "bg-muted text-muted-foreground border-0"
            )}
          >
            {badge}
          </Badge>
        </div>
      )}

      {/* Icon */}
      <div
        className={cn(
          "size-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110",
          moduleClass ? `${moduleClass} module-icon-bg` : "bg-primary/10"
        )}
      >
        <Icon
          className={cn(
            "size-6 transition-all duration-200",
            moduleClass ? "module-text stroke-[1.8px]" : "text-primary stroke-[1.8px]"
          )}
        />
      </div>

      {/* Title + description */}
      <div className="flex-1">
        <h3 className="text-[15px] font-bold text-foreground leading-tight mb-1.5">{title}</h3>
        <p className="text-[12px] text-muted-foreground leading-relaxed">{description}</p>
      </div>

      {/* Stat + arrow row */}
      {(stat || !disabled) && (
        <div className="flex items-center justify-between mt-4">
          {stat ? (
            <span
              className={cn(
                "text-[11px] font-semibold",
                moduleClass ? "module-text" : "text-primary"
              )}
            >
              {stat}
            </span>
          ) : (
            <span />
          )}
          <ArrowRight
            className={cn(
              "size-3.5 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-0.5",
              moduleClass ? "module-text" : "text-primary"
            )}
          />
        </div>
      )}
    </Card>
  );

  if (disabled) return content;

  return (
    <Link to={href} className="block">
      {content}
    </Link>
  );
}
