import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Home, UtensilsCrossed, Wallet, Map, MoreHorizontal,
  Activity, Gift, Users, Salad, User, LogOut,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { triggerHaptic } from "@/lib/haptics";
import { useMember } from "@/hooks/useMember";
import { Button } from "@/components/ui/button";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";

// ── Tab definitions ─────────────────────────────────────────────────────────
const mainTabs = [
  { to: "/",              icon: Home,           label: "Home",    module: null },
  { to: "/meals",         icon: UtensilsCrossed, label: "Makan",  module: "module-meals" },
  { to: "/finance/costs", icon: Wallet,          label: "Finance", module: "module-finance" },
  { to: "/trips",         icon: Map,             label: "Trips",   module: "module-trips" },
];

const moreTabs = [
  { to: "/activities",        icon: Activity, label: "Aktivitas",   module: "module-activities" },
  { to: "/community/gifts",   icon: Gift,     label: "Gifts",       module: "module-community" },
  { to: "/community/members", icon: Users,    label: "Warga",       module: "module-community" },
  { to: "/bekal-sehat",       icon: Salad,    label: "Bekal Sehat", module: "module-bekal" },
  { to: "/profile",           icon: User,     label: "Profil",      module: null },
];

// ── Component ────────────────────────────────────────────────────────────────
export function MobileNav() {
  const location = useLocation();
  const { member, logout } = useMember();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isTabActive = (tabPath: string) =>
    tabPath === "/" ? location.pathname === "/" : location.pathname.startsWith(tabPath);

  const isMoreActive = moreTabs.some((t) => isTabActive(t.to));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] md:hidden bg-background/85 backdrop-blur-2xl backdrop-saturate-200 border-t border-border/40">
      <div
        className="flex items-end justify-around w-full px-1 pt-1"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 10px), 10px)" }}
      >
        {/* ── Main Tabs ── */}
        {mainTabs.map((tab) => {
          const active = isTabActive(tab.to);
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              onClick={() => triggerHaptic("light")}
              className="flex flex-col items-center justify-end gap-0.5 flex-1 py-1.5 touch-none"
            >
              <div className="relative flex flex-col items-center">
                {/* Active pill indicator */}
                <div
                  className={cn(
                    "absolute -top-1 h-1 rounded-full transition-all duration-300",
                    active
                      ? tab.module
                        ? `${tab.module} w-6 bg-[color:var(--module-color)]`
                        : "w-6 bg-primary"
                      : "w-0 bg-transparent"
                  )}
                />
                {/* Icon container */}
                <div
                  className={cn(
                    "flex items-center justify-center p-1.5 rounded-xl transition-all duration-200",
                    active && tab.module
                      ? `${tab.module} bg-[color-mix(in_oklch,var(--module-color)_12%,transparent)]`
                      : active
                      ? "bg-primary/10"
                      : ""
                  )}
                >
                  <tab.icon
                    className={cn(
                      "size-[22px] transition-all duration-200",
                      active
                        ? tab.module
                          ? "module-text stroke-[2.3px]"
                          : "text-primary stroke-[2.3px]"
                        : "text-muted-foreground stroke-[1.7px]"
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px] leading-tight mt-0.5 transition-all duration-200",
                    active
                      ? tab.module
                        ? "module-text font-bold"
                        : "text-primary font-bold"
                      : "text-muted-foreground font-medium"
                  )}
                >
                  {tab.label}
                </span>
              </div>
            </NavLink>
          );
        })}

        {/* ── More Drawer (vaul — swipe-to-dismiss) ── */}
        <Drawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          direction="bottom"
          // vaul snaps — allow the user to swipe down to dismiss
          snapPoints={[1]}
          shouldScaleBackground={false}
        >
          <DrawerTrigger asChild>
            <button
              onClick={() => triggerHaptic("medium")}
              className="flex flex-col items-center justify-end gap-0.5 flex-1 py-1.5 touch-none"
            >
              <div className="relative flex flex-col items-center">
                {/* Active pill */}
                <div
                  className={cn(
                    "absolute -top-1 h-1 w-6 rounded-full transition-all duration-300",
                    isMoreActive ? "bg-primary" : "bg-transparent w-0"
                  )}
                />
                <div
                  className={cn(
                    "flex items-center justify-center p-1.5 rounded-xl transition-colors duration-200",
                    isMoreActive && "bg-primary/10"
                  )}
                >
                  <MoreHorizontal
                    className={cn(
                      "size-[22px] transition-all duration-200",
                      isMoreActive
                        ? "text-primary stroke-[2.3px]"
                        : "text-muted-foreground stroke-[1.7px]"
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px] leading-tight mt-0.5 font-medium",
                    isMoreActive ? "text-primary font-bold" : "text-muted-foreground"
                  )}
                >
                  Lainnya
                </span>
              </div>
            </button>
          </DrawerTrigger>

          <DrawerContent className="rounded-t-3xl max-h-[88vh] px-4 pb-0 gap-0 border-0 outline-none">
            {/* The handle bar is already rendered by DrawerContent (vaul built-in) */}

            <DrawerHeader className="mb-4 text-left px-1 pt-2 pb-0 gap-0">
              <DrawerTitle className="text-lg font-bold">Menu Lainnya</DrawerTitle>
            </DrawerHeader>

            {/* Scrollable body */}
            <div className="overflow-y-auto">
              {/* More module grid */}
              <div className="grid grid-cols-4 gap-y-5 gap-x-2 mb-6">
                {moreTabs.map((tab) => {
                  const active = isTabActive(tab.to);
                  return (
                    <NavLink
                      key={tab.to}
                      to={tab.to}
                      onClick={() => setDrawerOpen(false)}
                      className="flex flex-col items-center gap-2"
                    >
                      <div
                        className={cn(
                          "size-14 rounded-2xl flex items-center justify-center transition-all duration-200",
                          active && tab.module
                            ? `${tab.module} module-icon-bg ring-2 ring-[color:var(--module-color)]/20`
                            : active
                            ? "bg-primary/10 ring-2 ring-primary/20"
                            : "bg-muted/60"
                        )}
                      >
                        <tab.icon
                          className={cn(
                            "size-6 transition-all duration-200",
                            active && tab.module
                              ? "module-text stroke-[2px]"
                              : active
                              ? "text-primary stroke-[2px]"
                              : "text-muted-foreground stroke-[1.7px]"
                          )}
                        />
                      </div>
                      <span
                        className={cn(
                          "text-xs font-medium text-center leading-tight",
                          active
                            ? tab.module
                              ? "module-text"
                              : "text-primary"
                            : "text-muted-foreground"
                        )}
                      >
                        {tab.label}
                      </span>
                    </NavLink>
                  );
                })}
              </div>

              <Separator className="mb-4" />

              {/* Profile + Theme + Logout */}
              {member && (
                <div className="flex flex-col gap-3 mb-6">
                  {/* User info */}
                  <NavLink
                    to="/profile"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted/60 transition-colors"
                  >
                    <Avatar className="size-9 shrink-0">
                      <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                        {member.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold truncate">{member.name}</span>
                      <span className="text-xs text-muted-foreground">Lihat Profil</span>
                    </div>
                  </NavLink>

                  {/* Dark mode toggle */}
                  <DarkModeToggle variant="full" />

                  {/* Logout */}
                  <Button
                    variant="outline"
                    className="w-full rounded-xl h-11 text-destructive border-destructive/20 hover:bg-destructive/10"
                    onClick={() => { logout(); setDrawerOpen(false); }}
                  >
                    <LogOut data-icon="inline-start" />
                    Keluar
                  </Button>
                </div>
              )}
            </div>

            {/* Safe-area bottom padding */}
            <div style={{ paddingBottom: "max(env(safe-area-inset-bottom, 16px), 16px)" }} />
          </DrawerContent>
        </Drawer>
      </div>
    </nav>
  );
}
