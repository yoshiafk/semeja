import { NavLink, useLocation } from "react-router-dom";
import {
  Home, UtensilsCrossed, Wallet, Map, Activity, Gift, Users, Salad, LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useMember } from "@/hooks/useMember";
import { Button } from "@/components/ui/button";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { cn } from "@/lib/utils";

// ── Nav structure ───────────────────────────────────────────────────────────
const navGroups = [
  {
    label: "Utama",
    items: [
      { to: "/",              icon: Home,           label: "Beranda",       module: null },
      { to: "/meals",         icon: UtensilsCrossed, label: "Jadwal Buka Puasa", module: "module-meals" },
      { to: "/finance/costs", icon: Wallet,          label: "Keuangan",     module: "module-finance" },
      { to: "/trips",         icon: Map,             label: "Perjalanan",   module: "module-trips" },
    ],
  },
  {
    label: "Komunitas",
    items: [
      { to: "/community/members", icon: Users,    label: "Warga",        module: "module-community" },
      { to: "/activities",        icon: Activity, label: "Aktivitas",    module: "module-activities" },
      { to: "/community/gifts",   icon: Gift,     label: "Gift Pooling", module: "module-community" },
      { to: "/bekal-sehat",       icon: Salad,    label: "Bekal Sehat",  module: "module-bekal" },
    ],
  },
];

// ── Component ───────────────────────────────────────────────────────────────
export function DesktopSidebar() {
  const location = useLocation();
  const { member, logout } = useMember();
  const { open } = useSidebar();

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  return (
    <Sidebar
      className="hidden md:flex border-r border-sidebar-border bg-sidebar"
      collapsible="icon"
    >
      {/* ── Header ── */}
      <SidebarHeader className="px-3 py-4 border-b border-sidebar-border/60">
        <div className="flex items-center justify-between gap-2">
          <NavLink
            to="/"
            className={cn(
              "flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity",
              !open && "justify-center"
            )}
          >
            <div className="shrink-0 size-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <img src="/logo.png" alt="Semeja" className="size-5 object-contain" />
            </div>
            {open && (
              <span className="text-[17px] font-extrabold tracking-tight text-foreground truncate">
                Semeja
              </span>
            )}
          </NavLink>
          {open && <SidebarTrigger className="shrink-0 size-7 text-muted-foreground hover:text-foreground" />}
        </div>
        {!open && (
          <div className="mt-2 flex justify-center">
            <SidebarTrigger className="size-7 text-muted-foreground hover:text-foreground" />
          </div>
        )}
      </SidebarHeader>

      {/* ── Nav Content ── */}
      <SidebarContent className="px-2 py-3 flex flex-col gap-5 overflow-y-auto">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="gap-1">
            {open && (
              <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-3 mb-0.5">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.to);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            className={cn(
                              "h-9 px-3 rounded-lg transition-all duration-200 group/nav-item",
                              active && item.module
                                ? `${item.module} bg-[color-mix(in_oklch,var(--module-color)_12%,transparent)] text-[color:var(--module-color)] hover:bg-[color-mix(in_oklch,var(--module-color)_18%,transparent)]`
                                : active
                                ? "bg-primary/12 text-primary hover:bg-primary/18"
                                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                            )}
                          >
                            <NavLink to={item.to} className="flex items-center gap-3">
                              <item.icon
                                className={cn(
                                  "size-[18px] shrink-0 transition-all duration-200",
                                  active
                                    ? "stroke-[2.2px]"
                                    : "stroke-[1.7px] opacity-70 group-hover/nav-item:opacity-100"
                                )}
                              />
                              {open && (
                                <span
                                  className={cn(
                                    "text-[13px] font-medium truncate",
                                    active && "font-semibold"
                                  )}
                                >
                                  {item.label}
                                </span>
                              )}
                            </NavLink>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        {!open && (
                          <TooltipContent side="right" className="text-xs font-medium">
                            {item.label}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter className="px-2 py-3 border-t border-sidebar-border/60 flex flex-col gap-1">
        {/* Dark mode toggle */}
        <DarkModeToggle variant={open ? "full" : "icon"} />

        {/* Profile + Logout */}
        {member && (
          <div className={cn("flex items-center", open ? "gap-2" : "flex-col gap-1.5")}>
            <NavLink
              to="/profile"
              className={cn(
                "flex items-center gap-2.5 min-w-0 flex-1 px-2 py-1.5 rounded-lg",
                "hover:bg-sidebar-accent transition-colors group",
                !open && "justify-center px-0"
              )}
            >
              <Avatar className="size-7 shrink-0">
                <AvatarFallback className="text-[11px] font-bold bg-primary/15 text-primary">
                  {member.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {open && (
                <div className="flex flex-col min-w-0">
                  <span className="text-[12px] font-semibold leading-tight text-sidebar-foreground truncate">
                    {member.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    Lihat Profil
                  </span>
                </div>
              )}
            </NavLink>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={logout}
                >
                  <LogOut className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={open ? "top" : "right"} className="text-xs">
                Keluar
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
