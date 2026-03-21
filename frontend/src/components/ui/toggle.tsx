import { cn } from "@/lib/utils"

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  className?: string
}

export function Toggle({ checked, onChange, label, className }: ToggleProps) {
  return (
    <div className={cn("flex items-center space-x-3 cursor-pointer select-none", className)} onClick={() => onChange(!checked)}>
      <div
        className={cn(
          "relative w-12 h-6 rounded-full transition-colors duration-300 ease-in-out",
          checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ease-in-out",
            checked ? "translate-x-6" : "translate-x-0"
          )}
        />
      </div>
      {label && <span className="text-sm font-medium">{label}</span>}
    </div>
  )
}
