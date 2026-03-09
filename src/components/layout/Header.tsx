import { NavLink } from "react-router-dom";
import { useMember } from "@/hooks/useMember";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, LogOut, Home, ClipboardList, Users, Carrot, ReceiptText, Store, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header() {
  const { member, logout, isSuperadmin, isAdmin } = useMember();

  const navItems = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/meal-plan", icon: ClipboardList, label: "Meal Plan", adminOnly: true },
    { to: "/members", icon: Users, label: isAdmin ? "Members" : "Join" },
    { to: "/menus", icon: Utensils, label: "Menus", adminOnly: true },
    { to: "/ingredients", icon: Carrot, label: "Ingredients", adminOnly: true },
    { to: "/suppliers", icon: Store, label: "Vendor", adminOnly: true },
    { to: "/costs", icon: ReceiptText, label: "Costs" },
  ].filter(item => !item.adminOnly || isAdmin);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 md:h-16 border-b border-stone-100/80 bg-white/70 backdrop-blur-xl backdrop-saturate-150 px-4 md:px-6 lg:px-8 flex items-center justify-between">
      <div className="flex items-center gap-6 lg:gap-8">
        <NavLink to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <img src="/logo.png" alt="Semeja" className="h-8 w-8 md:h-9 md:w-9 object-contain" />
          <span className="text-lg md:text-xl font-extrabold text-stone-900 tracking-tight">Semeja</span>
        </NavLink>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all duration-200",
                  isActive
                    ? "text-primary bg-primary/8"
                    : "text-stone-500 hover:text-stone-800 hover:bg-stone-50"
                )
              }
            >
              <item.icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {member && (
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[13px] font-semibold text-stone-700 leading-tight">{member.name}</span>
            {isSuperadmin ? (
              <span className="text-[10px] font-bold text-amber-600 leading-tight">Superadmin</span>
            ) : isAdmin ? (
              <span className="text-[10px] font-bold text-teal-600 leading-tight">Admin</span>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <div className="h-8 w-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 text-xs font-bold">
              {member.name.substring(0, 2).toUpperCase()}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="h-8 w-8 text-stone-400 hover:text-rose-500 hover:bg-rose-50/80 rounded-full transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
