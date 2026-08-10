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
  Store,
  FlaskConical,
  ScanEye,
  Salad,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Header() {
  const { member, logout, isSuperadmin, isAdmin } = useMember();
  const location = useLocation();

  const navItems = [
    { to: "/", icon: Home, label: "Beranda" },
    {
      label: "Buka Puasa",
      icon: UtensilsCrossed,
      children: [
        { to: "/meals",          icon: UtensilsCrossed, label: "Jadwal Buka Puasa" },
        { to: "/meals/plan",     icon: ClipboardList,   label: "Atur Jadwal",       adminOnly: true },
        { to: "/meals/menus",    icon: Utensils,        label: "Daftar Resep",       adminOnly: true },
        { to: "/meals/preview",  icon: ScanEye,         label: "Review Belanja",     adminOnly: true },
        { to: "/meals/actuals",  icon: FlaskConical,    label: "Kalibrasi Bahan",    adminOnly: true },
      ],
    },
    { to: "/community/members", icon: Users, label: "Warga" },
    {
      label: "Keuangan",
      icon: Wallet,
      children: [
        { to: "/finance/costs",       icon: Wallet, label: "Ringkasan Biaya" },
        { to: "/finance/ingredients", icon: Carrot, label: "Stok Bahan",  adminOnly: true },
        { to: "/finance/suppliers",   icon: Store,  label: "Supplier" },
      ],
    },
    { to: "/activities", icon: Activity, label: "Aktivitas" },
    { to: "/bekal-sehat", icon: Salad, label: "Bekal Sehat" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 md:h-16 border-b border-white/20 dark:border-white/10 bg-background/80 backdrop-blur-xl backdrop-saturate-150 shadow-[0_1px_3px_rgba(0,0,0,0.02)] px-4 md:px-6 lg:px-8 flex items-center justify-between">
      <div className="flex items-center gap-6 lg:gap-8">
        <NavLink to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <picture>
            <source srcSet="/logo.webp" type="image/webp" />
            <img src="/logo.png" alt="Semeja" className="size-8 md:h-9 md:w-9 object-contain" />
          </picture>
          <span className="text-lg md:text-xl font-extrabold text-foreground tracking-tight">Semeja</span>
        </NavLink>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-0.5">
          {navItems.map((item, idx) =>
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
          )}
        </nav>
      </div>

      {member && (
        <div className="flex items-center gap-2.5">
          <NavLink to="/profile" className="hidden sm:flex flex-col items-end hover:opacity-80 transition-opacity">
            <span className="text-[13px] font-semibold text-foreground leading-tight">{member.name}</span>
            {isSuperadmin ? (
              <span className="text-[10px] font-bold text-amber-600 leading-tight">Superadmin</span>
            ) : isAdmin ? (
              <span className="text-[10px] font-semibold text-muted-foreground leading-tight">Admin</span>
            ) : null}
          </NavLink>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="size-8 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      )}
    </header>
  );
}

// ── Dropdown nav component ────────────────────────────────────────────────

interface NavChild {
  to: string;
  icon: any;
  label: string;
  adminOnly?: boolean;
}

interface NavGroup {
  label: string;
  icon: any;
  children: NavChild[];
}

function DropdownNav({
  item,
  isAdmin,
  currentPath,
}: {
  item: NavGroup;
  isAdmin: boolean;
  currentPath: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const visibleChildren = item.children.filter(c => !c.adminOnly || isAdmin);
  const isGroupActive = visibleChildren.some(c => currentPath.startsWith(c.to) && c.to !== "/");

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all duration-200",
          isGroupActive || open
            ? "text-primary bg-primary/10"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        <item.icon className="h-3.5 w-3.5" />
        <span>{item.label}</span>
        <ChevronDown className={cn("size-3 transition-transform duration-200", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ type: "tween", ease: "easeOut", duration: 0.2 }}
            className="absolute top-full left-0 mt-1.5 w-52 bg-white border border-border/60 rounded-xl shadow-lg overflow-hidden z-50 py-1"
          >
            {visibleChildren.map(child => (
              <NavLink
                key={child.to}
                to={child.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium transition-colors",
                    isActive
                      ? "text-primary bg-primary/8"
                      : "text-foreground hover:bg-muted"
                  )
                }
              >
                <child.icon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                <span>{child.label}</span>
                {/* New pill for admin-only tools */}
                {child.adminOnly && (
                  <span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-primary/60 bg-primary/8 px-1.5 py-0.5 rounded-full">
                    Admin
                  </span>
                )}
              </NavLink>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
