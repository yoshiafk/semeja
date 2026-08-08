import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({
  children,
  className,
}: PageContainerProps) {
  return (
    <main
      className={cn(
        "w-full mx-auto px-4 md:px-6 lg:px-8 max-w-6xl py-6 md:py-8 flex flex-col min-h-full",
        className
      )}
    >
      <div className="animate-page-in">
        {children}
      </div>
    </main>
  );
}
