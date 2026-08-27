import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 h-11 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600";

const variants: Record<Variant, string> = {
  primary: "bg-red-600 text-white hover:bg-red-700",
  secondary:
    "border border-zinc-300 text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800",
  ghost: "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
};

function cx(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(" ");
}

type ButtonAsButton = { as?: "button"; variant?: Variant } & ComponentProps<"button">;
type ButtonAsLink = { as: "link"; variant?: Variant; children: ReactNode } & ComponentProps<
  typeof Link
>;

export function Button(props: ButtonAsButton | ButtonAsLink) {
  if (props.as === "link") {
    const { as: _as, variant = "primary", className, children, ...rest } = props;
    return (
      <Link className={cx(base, variants[variant], className)} {...rest}>
        {children}
      </Link>
    );
  }
  const { as: _as, variant = "primary", className, children, type, ...rest } = props;
  return (
    <button
      type={type ?? "button"}
      className={cx(base, variants[variant], className)}
      {...rest}
    >
      {children}
    </button>
  );
}
