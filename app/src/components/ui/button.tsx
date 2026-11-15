import * as React from "react"
import { Slot } from "radix-ui"
import { cn } from "cn"

const buttonVariants = (
  variant: string,
  size: string,
  className?: string
) => {
  const base =
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
  const variants: Record<string, string> = {
    default: "bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary)]/90 active:bg-[var(--primary)] active:scale-[0.99]",
    destructive: "bg-[var(--urgent)] text-white hover:bg-[var(--urgent)]/90 active:bg-[var(--urgent)] active:scale-[0.99]",
    outline: "border border-[var(--rule-strong)] bg-[var(--bg)] hover:bg-[var(--light-track)] active:bg-[var(--light-track)] active:scale-[0.99]",
    secondary: "bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface)]/80 active:bg-[var(--surface)] active:scale-[0.99]",
    ghost: "bg-transparent hover:bg-[var(--light-track)] active:bg-[var(--light-track)] active:scale-[0.99]",
    link: "text-[var(--primary)] underline-offset-4 hover:underline",
  }
  const sizes: Record<string, string> = {
    default: "h-10 px-4 py-2",
    xs: "h-6 gap-1 rounded-md px-2 text-xs",
    sm: "h-8 gap-1.5 rounded-md px-3",
    lg: "h-12 rounded-md px-6",
    icon: "size-10",
    "icon-xs": "size-6 rounded-md",
    "icon-sm": "size-8",
    "icon-lg": "size-12",
  }
  return cn(base, variants[variant] || variants.default, sizes[size] || sizes.default, className)
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"
  asChild?: boolean
}) {
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={buttonVariants(variant, size, className)}
      {...props}
    />
  )
}

export { Button }