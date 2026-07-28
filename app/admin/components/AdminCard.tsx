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
        "bg-[#161618] border border-white/10 rounded-xl",
        padding === "sm" ? "p-4" : "p-6",
        hoverable && "hover:border-white/20 transition",
        className
      )}
    >
      {children}
    </div>
  );
}
