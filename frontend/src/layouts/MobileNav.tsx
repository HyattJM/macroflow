import { LayoutDashboard, Utensils, Dumbbell, TrendingUp, Calculator } from "lucide-react"
import { cn } from "@/lib/utils"

interface MobileNavProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

export function MobileNav({ activeTab, setActiveTab }: MobileNavProps) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "food", label: "Food", icon: Utensils },
    { id: "exercise", label: "Exercise", icon: Dumbbell },
    { id: "progress", label: "Progress", icon: TrendingUp },
    { id: "calculators", label: "Calcs", icon: Calculator },
  ]

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 z-50 w-full h-20 bg-card border-t border-border flex items-center justify-around px-2 pb-safe">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = activeTab === item.id
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex flex-col items-center justify-center space-y-1 px-3 py-2 rounded-2xl transition-all duration-200",
              isActive 
                ? "text-primary scale-110" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className={cn(
              "p-1 rounded-xl transition-colors",
              isActive && "bg-primary/10"
            )}>
              <Icon className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
