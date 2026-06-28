import Link from "next/link";
import { cn } from "./cn";

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

type SharedProps = {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  className?: string;
  children: React.ReactNode;
};

type AdminButtonAsLink = SharedProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof SharedProps | "href"> & {
    href: string;
  };

type AdminButtonAsButton = SharedProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof SharedProps> & {
    href?: undefined;
  };

type AdminButtonProps = AdminButtonAsLink | AdminButtonAsButton;

const base =
  "inline-flex items-center justify-center rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary: "bg-white text-black font-medium hover:bg-gray-200",
  secondary: "bg-white/10 text-white hover:bg-white/15",
  danger:
    "text-red-400 border border-red-500/30 hover:bg-red-500/10 hover:text-red-300",
  ghost: "text-white/70 hover:text-white hover:bg-white/10",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-2 text-sm",
  md: "px-5 py-3 text-sm",
};

function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
}: Pick<SharedProps, "variant" | "size" | "fullWidth" | "className">) {
  return cn(base, variants[variant], sizes[size], fullWidth && "w-full", className);
}

export default function AdminButton(props: AdminButtonProps) {
  const {
    variant = "primary",
    size = "md",
    fullWidth,
    loading,
    loadingLabel = "Se procesează...",
    href,
    className,
    children,
    ...rest
  } = props;

  const classes = buttonClasses({ variant, size, fullWidth, className });
  const content = loading ? loadingLabel : children;

  if (href) {
    const { href: _href, ...linkProps } = rest as AdminButtonAsLink;

    if (isExternalHref(href)) {
      return (
        <a href={href} className={classes} {...linkProps}>
          {content}
        </a>
      );
    }

    return (
      <Link href={href} className={classes} {...linkProps}>
        {content}
      </Link>
    );
  }

  const { disabled, type = "button", ...buttonProps } = rest as AdminButtonAsButton;

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      {...buttonProps}
    >
      {content}
    </button>
  );
}
