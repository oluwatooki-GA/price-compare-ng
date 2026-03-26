import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:translate-y-0.5 active:shadow-inner",
  {
    variants: {
      variant: {
        default: "bg-[#1edc6a] text-[#0A0A0A] hover:bg-[#17c55e] focus-visible:ring-[#1edc6a] shadow-lg hover:shadow-md active:shadow-sm",
        secondary: "bg-white text-[#0A0A0A] hover:bg-slate-200 shadow-lg hover:shadow-md active:shadow-sm",
        outline: "border border-[#262626] bg-transparent text-white hover:bg-[#1a1a1a] shadow-lg hover:shadow-md active:shadow-sm",
        ghost: "text-white hover:bg-[#1a1a1a] active:bg-[#0f0f0f]",
        destructive: "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 active:bg-red-500/30 shadow-lg hover:shadow-md active:shadow-sm",
        link: "text-[#1edc6a] underline-offset-4 hover:underline hover:text-[#17c55e] active:text-[#14b350]",
      },
      size: {
        default: "h-14 px-6 py-3",
        sm: "h-10 px-4 py-2",
        lg: "h-16 px-8 py-4 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
