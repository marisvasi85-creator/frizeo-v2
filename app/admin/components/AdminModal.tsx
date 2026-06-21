"use client";

import { cn } from "./cn";

export default function AdminModal({
  title,
  subtitle,
  children,
  onClose,
  maxWidth = "max-w-md",
  className,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  onClose?: () => void;
  maxWidth?: string;
  className?: string;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={
        onClose
          ? (e) => {
              if (e.target === e.currentTarget) onClose();
            }
          : undefined
      }
    >
      <div
        className={cn(
          "bg-[#161618] border border-white/10 p-6 rounded-xl w-full space-y-4 max-h-[90vh] overflow-y-auto",
          maxWidth,
          className
        )}
      >
        {(title || subtitle) && (
          <div>
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {subtitle && (
              <p className="text-sm text-white/60 mt-1">{subtitle}</p>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
