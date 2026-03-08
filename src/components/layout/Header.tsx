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
    { to: "/meal-plan", icon: ClipboardList, label: "Plan", adminOnly: true },
    { to: "/members", icon: Users, label: isAdmin ? "Members" : "Join" },
    { to: "/menus", icon: Utensils, label: "Menus", adminOnly: true },
    { to: "/ingredients", icon: Carrot, label: "Ingredients", adminOnly: true },
    { to: "/suppliers", icon: Store, label: "Vendor", adminOnly: true },
    { to: "/costs", icon: ReceiptText, label: "Costs" },
  ].filter(item => !item.adminOnly || isAdmin);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b bg-background/80 backdrop-blur-md px-4 md:px-8 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <NavLink to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img src="/logo.png" alt="Semeja Logo" className="h-10 w-10 object-contain" />
          <span className="text-2xl font-black text-stone-900 tracking-tighter">Semeja</span>
        </NavLink>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:bg-stone-100",
                  isActive ? "text-primary bg-primary/5" : "text-muted-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {member && (
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5 text-sm font-bold text-stone-900">
              <User className="h-3.5 w-3.5" />
              <span>{member.name}</span>
            </div>
            {isSuperadmin ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-800 border-amber-200 uppercase font-black tracking-wider">
                Superadmin
              </Badge>
            ) : isAdmin ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-100 text-emerald-800 border-emerald-200 uppercase font-black tracking-wider">
                Admin
              </Badge>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" onClick={logout} className="h-9 w-9 text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      )}
    </header>
  );
}
