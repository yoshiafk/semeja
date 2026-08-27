import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-2xl bg-muted/20 w-full", className)}>
      <div className="size-16 rounded-3xl bg-background flex items-center justify-center shadow-sm border border-border/50 mb-4 text-primary">
        {icon}
      </div>
      <h2 className="text-lg font-bold text-foreground mb-2 tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6 font-medium leading-relaxed">{description}</p>
      {action && (
        <div>{action}</div>
      )}
    </div>
  );
}

