import { NavLink } from "react-router-dom";
import { useMember } from "@/hooks/useMember";
import { cn } from "@/lib/utils";
import { Home, ClipboardList, Users, Carrot, ReceiptText, Store } from "lucide-react";

export function BottomTabBar() {
  const { isAdmin } = useMember();

  const tabs = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/meal-plan", icon: ClipboardList, label: "Plan", adminOnly: true },
    { to: "/members", icon: Users, label: isAdmin ? "Members" : "Join" },
    { to: "/ingredients", icon: Carrot, label: "Ingredients", adminOnly: true },
    { to: "/suppliers", icon: Store, label: "Vendor", adminOnly: true },
    { to: "/costs", icon: ReceiptText, label: "Costs" },
  ].filter(tab => !tab.adminOnly || isAdmin);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t bg-background/80 backdrop-blur-md pb-safe md:hidden">
      <div className="flex h-full items-center justify-around px-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 transition-colors px-3 py-1 rounded-xl",
                isActive ? "text-primary bg-primary/5" : "text-muted-foreground"
              )
            }
          >
            <tab.icon className="h-5 w-5" />
            <span className="text-[10px] font-bold">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
