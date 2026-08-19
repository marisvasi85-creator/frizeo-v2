import { cn } from "./cn";

export default function AdminCard({
  children,
  className,
  padding = "md",
  hoverable,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  padding?: "sm" | "md";
  hoverable?: boolean;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        "bg-white border border-frz-line rounded-2xl",
        padding === "sm" ? "p-4" : "p-6",
        hoverable && "hover:border-frz-steel/25 transition",
        className
      )}
    >
      {children}
    </div>
  );
}
