import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outline" | "destructive"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        {
          "border-transparent bg-blue-600 text-white": variant === "default",
          "border-gray-300 bg-white text-gray-900": variant === "outline",
          "border-transparent bg-red-600 text-white": variant === "destructive",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }

