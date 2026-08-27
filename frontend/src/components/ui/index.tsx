import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------- Button */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-emerald text-background hover:bg-brand-emerald/90 shadow-glow-emerald font-semibold",
  secondary:
    "bg-surface-elevated text-text-primary border border-surface-border-strong hover:bg-surface-subtle",
  outline:
    "border border-surface-border-strong text-text-primary hover:border-brand-emerald/50 hover:text-brand-emerald",
  ghost: "text-text-secondary hover:text-text-primary hover:bg-surface-subtle",
  danger: "bg-brand-red/90 text-white hover:bg-brand-red shadow-glow-red font-semibold",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap rounded-xl transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "active:scale-[0.98]",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";

/* ---------------------------------------------------------------------- Card */

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card-hairline overflow-hidden", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-surface-border px-5 py-4">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface-subtle text-brand-emerald">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* --------------------------------------------------------------------- Badge */

type Tone = "emerald" | "cyan" | "amber" | "red" | "violet" | "neutral";

const TONES: Record<Tone, string> = {
  emerald: "border-brand-emerald/30 bg-brand-emerald/10 text-brand-emerald",
  cyan: "border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan",
  amber: "border-brand-amber/30 bg-brand-amber/10 text-brand-amber",
  red: "border-brand-red/30 bg-brand-red/10 text-brand-red",
  violet: "border-brand-violet/30 bg-brand-violet/10 text-brand-violet",
  neutral: "border-surface-border-strong bg-surface-subtle text-text-secondary",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  dot,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        TONES[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- LiveDot */

export function LiveDot({ tone = "emerald" }: { tone?: "emerald" | "red" }) {
  const color = tone === "emerald" ? "bg-brand-emerald" : "bg-brand-red";
  return (
    <span className="relative flex h-2 w-2">
      <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60", color, "animate-pulse-ring")} />
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", color)} />
    </span>
  );
}

/* ---------------------------------------------------------------- ProgressBar */

export function ProgressBar({
  value,
  tone = "emerald",
  className,
}: {
  value: number;
  tone?: Tone;
  className?: string;
}) {
  const fill: Record<Tone, string> = {
    emerald: "bg-brand-emerald",
    cyan: "bg-brand-cyan",
    amber: "bg-brand-amber",
    red: "bg-brand-red",
    violet: "bg-brand-violet",
    neutral: "bg-text-muted",
  };
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-700 ease-out", fill[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/* ---------------------------------------------------------------------- Field */

export function Field({
  label,
  hint,
  children,
  suffix,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-medium text-text-secondary">{label}</span>
        {suffix && <span className="font-mono text-[10px] text-text-muted">{suffix}</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass = cn(
  "w-full rounded-xl border border-surface-border bg-surface-subtle px-3.5 py-2.5",
  "font-mono text-sm text-text-primary placeholder:text-text-muted",
  "transition-colors focus:border-brand-emerald/50 focus:outline-none focus:ring-1 focus:ring-brand-emerald/30"
);

/* --------------------------------------------------------------- SectionLabel */

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-brand-emerald">
      <span className="h-px w-6 bg-brand-emerald/40" />
      {children}
    </span>
  );
}
