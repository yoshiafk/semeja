import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useMember } from "@/hooks/useMember";
import { cn } from "@/lib/utils";
import { Home, ClipboardList, Users, ReceiptText, MoreHorizontal, Utensils, Carrot, Store, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

export function BottomTabBar() {
  const { isAdmin } = useMember();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const primaryTabs = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/meal-plan", icon: ClipboardList, label: "Plan", adminOnly: true },
    { to: "/members", icon: Users, label: isAdmin ? "Members" : "Join" },
    { to: "/costs", icon: ReceiptText, label: "Costs" },
  ].filter(tab => !tab.adminOnly || isAdmin);

  const moreLinks = [
    { to: "/menus", icon: Utensils, label: "Menus", description: "Kelola daftar menu masakan" },
    { to: "/ingredients", icon: Carrot, label: "Ingredients", description: "Stok & pembelian bahan" },
    { to: "/suppliers", icon: Store, label: "Vendor", description: "Daftar toko & supplier" },
  ];

  const morePaths = moreLinks.map(l => l.to);
  const isMoreActive = isMoreOpen || morePaths.some(p => location.pathname.startsWith(p));

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-[100] lg:hidden bg-white/80 backdrop-blur-xl backdrop-saturate-150 border-t border-stone-100/60">
        <div className="flex items-end justify-around max-w-lg mx-auto px-2 pt-1.5 pb-safe" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 8px)' }}>
          {primaryTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              onClick={() => setIsMoreOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 py-1 touch-active",
                  isActive ? "text-primary" : "text-stone-400"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className={cn(
                    "relative p-1 rounded-xl transition-all duration-200",
                    isActive && "bg-primary/8"
                  )}>
                    <tab.icon className={cn(
                      "h-[22px] w-[22px] transition-all duration-200",
                      isActive ? "stroke-[2.5px]" : "stroke-[1.8px]"
                    )} />
                  </div>
                  <span className={cn(
                    "text-[10px] leading-tight transition-all duration-200",
                    isActive ? "font-bold" : "font-medium"
                  )}>
                    {tab.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}

          {/* "More" Tab — admin only */}
          {isAdmin && (
            <button
              onClick={() => setIsMoreOpen(true)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 py-1 touch-active",
                isMoreActive ? "text-primary" : "text-stone-400"
              )}
            >
              <div className={cn(
                "relative p-1 rounded-xl transition-all duration-200",
                isMoreActive && "bg-primary/8"
              )}>
                <MoreHorizontal className={cn(
                  "h-[22px] w-[22px] transition-all duration-200",
                  isMoreActive ? "stroke-[2.5px]" : "stroke-[1.8px]"
                )} />
              </div>
              <span className={cn(
                "text-[10px] leading-tight transition-all duration-200",
                isMoreActive ? "font-bold" : "font-medium"
              )}>
                More
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* Bottom Sheet for "More" links */}
      <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="rounded-t-[20px] px-5 pt-3 pb-20 max-h-[60vh]">
          <div className="flex justify-center mb-5">
            <div className="w-9 h-1 rounded-full bg-stone-200" />
          </div>
          <SheetHeader className="p-0 mb-5">
            <SheetTitle className="text-lg font-bold text-stone-900">More</SheetTitle>
            <SheetDescription className="text-xs text-stone-400">
              Halaman admin lainnya
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-1.5">
            {moreLinks.map((link) => {
              const isActive = location.pathname.startsWith(link.to);
              return (
                <button
                  key={link.to}
                  onClick={() => {
                    setIsMoreOpen(false);
                    navigate(link.to);
                  }}
                  className={cn(
                    "flex items-center gap-3.5 w-full p-3.5 rounded-2xl transition-all text-left touch-active",
                    isActive
                      ? "bg-primary/6 text-primary"
                      : "hover:bg-stone-50 text-stone-700 active:bg-stone-100"
                  )}
                >
                  <div className={cn(
                    "p-2.5 rounded-xl shrink-0 transition-colors",
                    isActive ? "bg-primary/10" : "bg-stone-100"
                  )}>
                    <link.icon className="h-[18px] w-[18px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{link.label}</p>
                    <p className={cn(
                      "text-xs truncate",
                      isActive ? "text-primary/60" : "text-stone-400"
                    )}>
                      {link.description}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
