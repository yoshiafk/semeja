import { NavLink } from "react-router-dom";
import { useMember } from "@/hooks/useMember";
import { cn } from "@/lib/utils";
import { Home, ClipboardList, Users, ReceiptText, Utensils } from "lucide-react";

export function BottomTabBar() {
  const { isAdmin } = useMember();

  const tabs = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/meal-plan", icon: ClipboardList, label: "Plan", adminOnly: true },
    { to: "/members", icon: Users, label: isAdmin ? "Members" : "Join" },
    { to: "/costs", icon: ReceiptText, label: "Costs" },
    { to: "/menus", icon: Utensils, label: "Menus", adminOnly: true }
  ].filter(tab => !tab.adminOnly || isAdmin);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] h-16 sm:h-20 lg:hidden px-4 pb-safe bg-white border-t border-stone-100 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
      <div className="flex h-full items-center justify-between sm:justify-around max-w-md mx-auto">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 w-16 transition-all",
                isActive ? "text-emerald-600" : "text-stone-400 hover:text-stone-600"
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  "p-1.5 rounded-2xl transition-all duration-300",
                  isActive ? "bg-emerald-50 scale-110" : "bg-transparent scale-100"
                )}>
                   <tab.icon className={cn("h-5 w-5 sm:h-6 sm:w-6 transition-all duration-300", isActive && "stroke-[2.5px]")} />
                </div>
                <span className={cn(
                  "text-[10px] sm:text-xs transition-all duration-300", 
                  isActive ? "font-black" : "font-semibold"
                )}>
                  {tab.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
