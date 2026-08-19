import { cn } from "./cn";

export default function AdminPageHeader({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 md:flex-row md:items-center md:justify-between",
        className
      )}
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-frz-ink">
          {title}
        </h1>
        {subtitle && <p className="text-frz-muted mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
