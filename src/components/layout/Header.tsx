import { NavLink, useLocation } from "react-router-dom";
import { useMember } from "@/hooks/useMember";
import { Button } from "@/components/ui/button";
import { 
  LogOut, 
  Home, 
  UtensilsCrossed, 
  Users, 
  Wallet,
  Activity,
  ChevronDown,
  ClipboardList,
  Utensils,
  Carrot,
  Store
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

export function Header() {
  const { member, logout, isSuperadmin, isAdmin } = useMember();
  const location = useLocation();

  const navItems = [
    { to: "/", icon: Home, label: "Beranda" },
    { 
      label: "Makan",
      icon: UtensilsCrossed,
      children: [
        { to: "/meals", icon: UtensilsCrossed, label: "Jadwal Makan" },
        { to: "/meals/plan", icon: ClipboardList, label: "Atur Jadwal", adminOnly: true },
        { to: "/meals/menus", icon: Utensils, label: "Daftar Resep", adminOnly: true },
      ]
    },
    { to: "/community/members", icon: Users, label: "Warga" },
    { 
      label: "Keuangan",
      icon: Wallet,
      children: [
        { to: "/finance/costs", icon: Wallet, label: "Ringkasan Biaya" },
        { to: "/finance/ingredients", icon: Carrot, label: "Stok Bahan", adminOnly: true },
        { to: "/finance/suppliers", icon: Store, label: "Supplier" },
      ]
    },
    { to: "/activities", icon: Activity, label: "Aktivitas" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 md:h-16 border-b border-border/80 bg-white/70 backdrop-blur-xl backdrop-saturate-150 px-4 md:px-6 lg:px-8 flex items-center justify-between">
      <div className="flex items-center gap-6 lg:gap-8">
        <NavLink to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <picture>
            <source srcSet="/logo.webp" type="image/webp" />
            <img src="/logo.png" alt="Semeja" className="h-8 w-8 md:h-9 md:w-9 object-contain" />
          </picture>
          <span className="text-lg md:text-xl font-extrabold text-foreground tracking-tight">Semeja</span>
        </NavLink>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-0.5">
          {navItems.map((item, idx) => (
            item.children ? (
              <DropdownNav 
                key={idx} 
                item={item} 
                isAdmin={isAdmin} 
                currentPath={location.pathname}
              />
            ) : (
              <NavLink
                key={item.to}
                to={item.to!}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all duration-200 relative",
                    isActive
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )
                }
              >
                <item.icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </NavLink>
            )
          ))}
        </nav>
      </div>

      {member && (
        <div className="flex items-center gap-2.5">
          <NavLink to="/profile" className="hidden sm:flex flex-col items-end hover:opacity-80 transition-opacity">
            <span className="text-[13px] font-semibold text-foreground leading-tight">{member.name}</span>
            {isSuperadmin ? (
              <span className="text-[10px] font-bold text-amber-600 leading-tight">Superadmin</span>
            ) : isAdmin ? (
              <span className="text-[10px] font-bold text-primary leading-tight">Admin</span>
            ) : null}
          </NavLink>
          <div className="flex items-center gap-1">
            <NavLink 
              to="/profile"
              className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
            >
              {member.name.substring(0, 2).toUpperCase()}
            </NavLink>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

// Dropdown Navigation Component
function DropdownNav({ 
  item, 
  isAdmin,
  currentPath 
}: { 
  item: any; 
  isAdmin: boolean;
  currentPath: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter children based on admin status
  const visibleChildren = item.children.filter((child: any) => !child.adminOnly || isAdmin);
  
  // Check if any child is active
  const isChildActive = visibleChildren.some((child: any) => currentPath.startsWith(child.to));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all duration-200",
          isChildActive
            ? "text-primary bg-primary/10"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        <item.icon className="h-3.5 w-3.5" />
        <span>{item.label}</span>
        <ChevronDown className={cn(
          "h-3 w-3 transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 py-1 w-48 bg-card border border-border rounded-xl shadow-lg z-50">
          {visibleChildren.map((child: any) => (
            <NavLink
              key={child.to}
              to={child.to}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 text-[13px] font-medium transition-colors",
                  isActive
                    ? "text-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )
              }
            >
              <child.icon className="h-4 w-4" />
              <span>{child.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
