import { cn } from "./cn";

export const adminInputClass =
  "w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40";

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

export function AdminLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block text-sm text-white/60 mb-2", className)}>
      {children}
    </label>
  );
}
