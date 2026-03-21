import { LayoutDashboard, Utensils, Dumbbell, TrendingUp, Settings, Sun, Moon, Calculator } from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  isDarkMode: boolean
  toggleDarkMode: () => void
}

export function Sidebar({ activeTab, setActiveTab, isDarkMode, toggleDarkMode }: SidebarProps) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "food", label: "Food", icon: Utensils },
    { id: "exercise", label: "Exercise", icon: Dumbbell },
    { id: "progress", label: "Progress", icon: TrendingUp },
    { id: "calculators", label: "Calculators", icon: Calculator },
    { id: "settings", label: "Settings", icon: Settings },
  ]

  return (
    <div className="hidden lg:flex w-64 border-r border-border bg-card h-screen flex-col pt-6 pb-4">
      <div className="px-6 mb-8 flex items-center space-x-3">
        <img src="/logo.png" alt="Metrix Logo" className="w-10 h-10 object-contain rounded-xl" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Metrix</h1>
          <p className="text-xs text-muted-foreground mt-1">Track. Lift. Grow.</p>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="px-4 mt-auto space-y-4">
        <button
          onClick={toggleDarkMode}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
        </button>
      </div>
    </div>
  )
}
