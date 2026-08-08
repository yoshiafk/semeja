import { NavLink, useLocation } from "react-router-dom";
import { Home, UtensilsCrossed, Wallet, Map, Activity, Gift, Users, Salad, LogOut } from "lucide-react";
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
} from "@/components/ui/sidebar";
import { useMember } from "@/hooks/useMember";
import { Button } from "@/components/ui/button";

export function DesktopSidebar() {
  const location = useLocation();
  const { member, logout } = useMember();

  const navGroups = [
    {
      label: "Utama",
      items: [
        { to: "/", icon: Home, label: "Beranda" },
        { to: "/meals", icon: UtensilsCrossed, label: "Jadwal Makan" },
        { to: "/finance/costs", icon: Wallet, label: "Keuangan" },
        { to: "/trips", icon: Map, label: "Perjalanan" },
      ]
    },
    {
      label: "Komunitas",
      items: [
        { to: "/community/members", icon: Users, label: "Warga" },
        { to: "/activities", icon: Activity, label: "Aktivitas" },
        { to: "/community/gifts", icon: Gift, label: "Gift Pooling" },
        { to: "/bekal-sehat", icon: Salad, label: "Bekal Sehat" },
      ]
    }
  ];

  return (
    <Sidebar className="hidden md:flex border-r border-border/50 bg-background/50 backdrop-blur-xl">
      <SidebarHeader className="p-4 border-b border-border/30">
        <NavLink to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img src="/logo.png" alt="Semeja" className="size-8 object-contain" />
          <span className="text-xl font-extrabold tracking-tight text-foreground">Semeja</span>
        </NavLink>
      </SidebarHeader>

      <SidebarContent className="p-2 flex flex-col gap-4">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-xs font-bold text-muted-foreground px-3 mb-1">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        item.to === "/" 
                          ? location.pathname === "/" 
                          : location.pathname.startsWith(item.to)
                      }
                      className="px-3 py-2 h-auto"
                    >
                      <NavLink to={item.to} className="flex items-center gap-3">
                        <item.icon className="size-5" />
                        <span className="font-medium text-sm">{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border/30">
        {member && (
          <div className="flex flex-col gap-3">
            <NavLink to="/profile" className="flex items-center gap-3 px-2 py-1.5 hover:bg-muted/50 rounded-lg transition-colors">
              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                {member.name.charAt(0)}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold leading-none">{member.name}</span>
                <span className="text-xs text-muted-foreground mt-1 leading-none">View Profile</span>
              </div>
            </NavLink>
            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={logout}>
              <LogOut data-icon="inline-start" />
              Keluar
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
