import { Sun, Moon, Monitor } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface DarkModeToggleProps {
  /** "icon" shows just a sun/moon icon button, "full" shows a labeled row */
  variant?: "icon" | "full";
  className?: string;
}

export function DarkModeToggle({ variant = "icon", className }: DarkModeToggleProps) {
  const { theme, setLight, setDark, setSystem } = useDarkMode();

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  if (variant === "full") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center gap-3 px-2 py-1.5 rounded-lg text-sm font-medium",
              "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors",
              className
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1 text-left">
              {theme === "dark" ? "Gelap" : theme === "light" ? "Terang" : "Ikuti Sistem"}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-44">
          <DropdownMenuItem onClick={setLight} className={cn(theme === "light" && "text-primary font-semibold")}>
            <Sun className="size-4 mr-2" /> Terang
          </DropdownMenuItem>
          <DropdownMenuItem onClick={setDark} className={cn(theme === "dark" && "text-primary font-semibold")}>
            <Moon className="size-4 mr-2" /> Gelap
          </DropdownMenuItem>
          <DropdownMenuItem onClick={setSystem} className={cn(theme === "system" && "text-primary font-semibold")}>
            <Monitor className="size-4 mr-2" /> Ikuti Sistem
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-8 text-muted-foreground hover:text-foreground",
            className
          )}
          aria-label="Toggle theme"
        >
          <Icon className="size-4 transition-transform duration-300" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom">
        <DropdownMenuItem onClick={setLight} className={cn(theme === "light" && "text-primary font-semibold")}>
          <Sun className="size-4 mr-2" /> Terang
        </DropdownMenuItem>
        <DropdownMenuItem onClick={setDark} className={cn(theme === "dark" && "text-primary font-semibold")}>
          <Moon className="size-4 mr-2" /> Gelap
        </DropdownMenuItem>
        <DropdownMenuItem onClick={setSystem} className={cn(theme === "system" && "text-primary font-semibold")}>
          <Monitor className="size-4 mr-2" /> Ikuti Sistem
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
