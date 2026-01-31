import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface SettingsCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingsCard({ title, description, children, className }: SettingsCardProps) {
  return (
    <div className={cn(
      "rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden",
      className
    )}>
      <div className="px-4 sm:px-6 py-4 border-b border-border/30">
        <h3 className="font-barlow text-lg sm:text-xl font-bold uppercase tracking-wide text-foreground">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="px-4 sm:px-6 py-4 sm:py-5">
        {children}
      </div>
    </div>
  );
}

export function SettingsCardSkeleton() {
  return (
    <div className="rounded-lg border border-border/50 bg-card/50 overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-border/30">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48 mt-2" />
      </div>
      <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
      </div>
    </div>
  );
}
