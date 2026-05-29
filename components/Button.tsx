"use client";

import Link from "next/link";
import type { ComponentProps, PropsWithChildren } from "react";

type Variant = "primary" | "secondary" | "ghost";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98]";

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        base,
        variant === "primary" &&
        "bg-primary text-on-primary hover:brightness-110 shadow-sm hover:shadow-md",
        variant === "secondary" &&
        "border border-outline-variant bg-surface text-on-surface hover:bg-surface-container-high",
        variant === "ghost" &&
        "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
        className,
      )}
      {...props}
    />
  );
}

export function LinkButton({
  variant = "primary",
  className,
  children,
  ...props
}: PropsWithChildren<
  ComponentProps<typeof Link> & { variant?: Variant; className?: string }
>) {
  return (
    <Link
      className={cn(
        base,
        variant === "primary" &&
        "bg-primary text-on-primary hover:brightness-110 shadow-sm hover:shadow-md",
        variant === "secondary" &&
        "border border-outline-variant bg-surface text-on-surface hover:bg-surface-container-high",
        variant === "ghost" &&
        "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
