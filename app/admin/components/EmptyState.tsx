import { cn } from "./cn";

export default function EmptyState({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-center py-12 px-4 text-frz-muted rounded-2xl border border-dashed border-frz-line bg-frz-fog/60",
        className,
      )}
    >
      {children}
    </div>
  );
}
