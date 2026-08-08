import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface ModuleCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  badge?: string;
  badgeVariant?: "default" | "coming-soon" | "count";
  disabled?: boolean;
  className?: string;
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
}: ModuleCardProps) {
  const content = (
    <Card
      className={cn(
        "relative flex flex-col items-center justify-center p-6 rounded-2xl transition-all duration-200",
        !disabled && "touch-scale hover:shadow-lg hover:border-primary/20 cursor-pointer",
        disabled && "opacity-60 cursor-not-allowed",
        className
      )}
    >
      {/* Badge */}
      {badge && (
        <div
          className={cn(
            "absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold",
            badgeVariant === "coming-soon" && "bg-accent/20 text-accent-foreground",
            badgeVariant === "count" && "bg-primary/10 text-primary",
            badgeVariant === "default" && "bg-muted text-muted-foreground"
          )}
        >
          {badge}
        </div>
      )}

      {/* Icon */}
      <div
        className={cn(
          "size-14 rounded-2xl flex items-center justify-center mb-4 transition-colors",
          disabled ? "bg-muted" : "bg-primary/10"
        )}
      >
        <Icon
          className={cn(
            "size-7",
            disabled ? "text-muted-foreground" : "text-primary"
          )}
        />
      </div>

      {/* Title */}
      <h3 className="text-base font-bold text-foreground mb-1">{title}</h3>

      {/* Description */}
      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        {description}
      </p>
    </Card>
  );

  if (disabled) {
    return content;
  }

  return (
    <Link to={href} className="block">
      {content}
    </Link>
  );
}
