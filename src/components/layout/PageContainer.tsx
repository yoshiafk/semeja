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
        "min-h-[100dvh] w-full mx-auto px-4 md:px-6 lg:px-8 max-w-6xl flex flex-col",
        withHeader && "pt-20 md:pt-22",
        withTabBar && "pb-24 md:pb-8",
        className
      )}
    >
      <div className="animate-page-in">
        {children}
      </div>
    </main>
  );
}
