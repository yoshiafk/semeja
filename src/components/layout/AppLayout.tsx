import { DesktopSidebar } from "./DesktopSidebar";
import { MobileNav } from "./MobileNav";
import { UniversalFAB } from "./UniversalFAB";
import { SidebarProvider } from "@/components/ui/sidebar";
import React from "react";

import { TooltipProvider } from "@/components/ui/tooltip";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={true}>
        <div className="flex min-h-[100dvh] w-full bg-background relative overflow-hidden">
          <DesktopSidebar />
          <main className="flex-1 w-full pb-20 md:pb-0 overflow-y-auto">
            {children}
          </main>
          <MobileNav />
          <UniversalFAB />
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
