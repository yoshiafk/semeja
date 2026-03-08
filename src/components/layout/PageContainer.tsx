import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  withHeader?: boolean;
  withTabBar?: boolean;
}

export function PageContainer({
  children,
  className,
  withHeader = true,
  withTabBar = true,
}: PageContainerProps) {
  return (
    <main
      className={cn(
        "min-h-[100dvh] w-full mx-auto px-4 md:px-8 max-w-7xl flex flex-col",
        withHeader && "pt-24",
        withTabBar && "pb-safe pb-32 md:pb-12",
        className
      )}
    >
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {children}
      </div>
    </main>
  );
}
