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
  saved?: boolean;
  savedLabel?: string;
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
  "inline-flex items-center justify-center rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary: "bg-frz-ink text-frz-ink-contrast font-semibold hover:opacity-90",
  secondary:
    "bg-frz-card text-frz-ink font-medium border border-frz-line hover:bg-frz-fog",
  danger:
    "bg-frz-card text-frz-danger border border-frz-danger/20 hover:bg-frz-danger-soft font-medium",
  ghost: "text-frz-muted hover:text-frz-ink hover:bg-frz-mist",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-2 text-sm min-h-10",
  md: "px-5 py-3 text-sm min-h-11",
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
    saved = false,
    savedLabel = "Salvat ✔",
    href,
    className,
    children,
    ...rest
  } = props;

  const classes = cn(
    buttonClasses({ variant, size, fullWidth, className }),
    saved && "bg-emerald-600 text-white hover:bg-emerald-600 font-semibold border-transparent",
  );
  const content = loading ? loadingLabel : saved ? savedLabel : children;

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
      disabled={disabled || loading || saved}
      {...buttonProps}
    >
      {content}
    </button>
  );
}
