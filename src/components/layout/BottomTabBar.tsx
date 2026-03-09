import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Home, UtensilsCrossed, Activity, User } from "lucide-react";

export function BottomTabBar() {
  const location = useLocation();

  const tabs = [
    { to: "/", icon: Home, label: "Beranda" },
    { to: "/meals", icon: UtensilsCrossed, label: "Makan" },
    { to: "/activities", icon: Activity, label: "Aktivitas", badge: "Segera" },
    { to: "/profile", icon: User, label: "Profil" },
  ];

  // Check if current path starts with the tab path (for nested routes)
  const isTabActive = (tabPath: string) => {
    if (tabPath === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(tabPath);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] lg:hidden bg-white/80 backdrop-blur-xl backdrop-saturate-150 border-t border-border/60">
      <div className="flex items-end justify-around max-w-lg mx-auto px-2 pt-1.5 pb-safe" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 8px)' }}>
        {tabs.map((tab) => {
          const isActive = isTabActive(tab.to);
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 py-1 touch-active relative",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "relative p-1.5 rounded-xl transition-all duration-200",
                isActive && "bg-primary/10"
              )}>
                <tab.icon className={cn(
                  "h-[22px] w-[22px] transition-all duration-200",
                  isActive ? "stroke-[2.5px]" : "stroke-[1.8px]"
                )} />
                {/* Badge for Coming Soon */}
                {tab.badge && (
                  <span className="absolute -top-1 -right-1 px-1 py-0.5 text-[8px] font-bold bg-accent text-accent-foreground rounded-full leading-none">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-[10px] leading-tight transition-all duration-200",
                isActive ? "font-bold" : "font-medium"
              )}>
                {tab.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
