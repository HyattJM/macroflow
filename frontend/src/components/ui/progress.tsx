import * as React from "react"
import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value?: number, max?: number, indicatorColor?: string }
>(({ className, value = 0, max = 100, indicatorColor="bg-primary", ...props }, ref) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div
      ref={ref}
      className={cn("relative h-4 w-full overflow-hidden rounded-full bg-secondary", className)}
      {...props}
    >
      <div
        className={cn("h-full w-full flex-1 transition-all", indicatorColor)}
        style={{ transform: `translateX(-${100 - (percentage || 0)}%)` }}
      />
    </div>
  )
})
Progress.displayName = "Progress"

export { Progress }
