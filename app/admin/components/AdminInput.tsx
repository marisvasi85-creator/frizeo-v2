import { cn } from "./cn";

export const adminInputClass =
  "w-full bg-white border border-frz-line rounded-xl px-4 py-3 text-frz-ink placeholder:text-frz-muted outline-none transition focus:ring-2 focus:ring-frz-ink/10 focus:border-frz-ink/25";

export function AdminInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(adminInputClass, className)} {...props} />;
}

export function AdminSelect({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(adminInputClass, className)} {...props} />;
}

export function AdminTextarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(adminInputClass, className)} {...props} />;
}

export function AdminLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block text-sm text-frz-muted mb-2", className)}>
      {children}
    </label>
  );
}

export function AdminBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const tones = {
    neutral: "bg-frz-fog text-frz-steel",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-800",
    danger: "bg-red-50 text-red-700",
    info: "bg-frz-accent-soft text-frz-accent",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
