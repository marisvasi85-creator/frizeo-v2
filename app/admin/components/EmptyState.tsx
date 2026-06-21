import { cn } from "./cn";

export default function EmptyState({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("text-center py-12 text-white/60", className)}>
      {children}
    </div>
  );
}
