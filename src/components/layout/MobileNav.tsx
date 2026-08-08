import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Home, UtensilsCrossed, Wallet, Map, Menu, Activity, Gift, Users, Salad, User, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { triggerHaptic } from "@/lib/haptics";
import { useMember } from "@/hooks/useMember";
import { Button } from "@/components/ui/button";

export function MobileNav() {
  const location = useLocation();
  const { member, logout } = useMember();

  const mainTabs = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/meals", icon: UtensilsCrossed, label: "Meals" },
    { to: "/finance/costs", icon: Wallet, label: "Finance" },
    { to: "/trips", icon: Map, label: "Trips" },
  ];

  const moreTabs = [
    { to: "/activities", icon: Activity, label: "Aktivitas" },
    { to: "/community/gifts", icon: Gift, label: "Gifts" },
    { to: "/community/members", icon: Users, label: "Warga" },
    { to: "/bekal-sehat", icon: Salad, label: "Bekal Sehat" },
    { to: "/profile", icon: User, label: "Profil" },
  ];

  const isTabActive = (tabPath: string) => {
    if (tabPath === "/") return location.pathname === "/";
    return location.pathname.startsWith(tabPath);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] md:hidden bg-background/80 backdrop-blur-xl backdrop-saturate-150 border-t border-white/20 dark:border-white/10 shadow-[0_-1px_3px_rgba(0,0,0,0.02)]">
      <div className="flex items-end justify-around w-full px-2 pt-1.5 pb-safe" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 8px)' }}>
        {mainTabs.map((tab) => {
          const isActive = isTabActive(tab.to);
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              onClick={() => triggerHaptic("light")}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 py-1 relative touch-none",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex flex-col items-center justify-center w-full active:scale-95 transition-transform duration-150">
                <div className={cn("relative p-1.5 rounded-xl transition-colors duration-200", isActive && "bg-primary/10")}>
                  <tab.icon className={cn("size-[22px] transition-all duration-200", isActive ? "stroke-[2.5px]" : "stroke-[1.8px]")} />
                </div>
                <span className={cn("text-[10px] tracking-wide leading-tight mt-0.5 transition-all duration-200", isActive ? "font-bold" : "font-medium")}>
                  {tab.label}
                </span>
              </div>
            </NavLink>
          );
        })}

        <Sheet>
          <SheetTrigger asChild>
            <button
              onClick={() => triggerHaptic("medium")}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 relative touch-none text-muted-foreground hover:text-foreground"
            >
              <div className="flex flex-col items-center justify-center w-full active:scale-95 transition-transform duration-150">
                <div className="relative p-1.5 rounded-xl transition-colors duration-200">
                  <Menu className="size-[22px] stroke-[1.8px]" />
                </div>
                <span className="text-[10px] tracking-wide leading-tight mt-0.5 font-medium transition-all duration-200">
                  More
                </span>
              </div>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="px-4 pb-8 rounded-t-3xl pt-2 max-h-[85vh] overflow-y-auto">
            <div className="mx-auto w-12 h-1.5 rounded-full bg-muted mb-6" />
            <SheetHeader className="mb-6 text-left">
              <SheetTitle>Menu Lainnya</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-4 gap-y-6 gap-x-2">
              {moreTabs.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) => cn(
                    "flex flex-col items-center gap-2",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <div className={cn(
                    "size-12 rounded-full flex items-center justify-center bg-muted/50",
                    isTabActive(tab.to) && "bg-primary/10 text-primary"
                  )}>
                    <tab.icon className="size-6" />
                  </div>
                  <span className="text-xs font-medium text-center leading-tight">{tab.label}</span>
                </NavLink>
              ))}
            </div>
            
            {member && (
              <div className="mt-8 pt-6 border-t flex flex-col items-center gap-4">
                <div className="flex flex-col items-center text-center">
                  <span className="text-sm font-semibold">{member.name}</span>
                </div>
                <Button variant="outline" className="w-full rounded-xl h-12 text-destructive border-destructive/20 hover:bg-destructive/10" onClick={logout}>
                  <LogOut data-icon="inline-start" />
                  Keluar
                </Button>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
