import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  description?: string;
  backTo?: string | -1;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, backTo, action }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-4 mb-6">
      {backTo && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (backTo === -1) navigate(-1);
            else navigate(backTo as string);
          }}
          className="rounded-full size-10 bg-muted/50 hover:bg-muted border border-border/50 flex-shrink-0 touch-none active:scale-95 transition-transform"
        >
          <ArrowLeft className="size-5" />
        </Button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl md:text-3xl font-extrabold text-foreground truncate tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm md:text-base text-muted-foreground font-medium truncate">{description}</p>
        )}
      </div>
      {action && (
        <div className="flex-shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}
