import { Sun, Moon, Settings } from "lucide-react"

interface MobileHeaderProps {
  activeTab: string
  isDarkMode: boolean
  toggleDarkMode: () => void
  onSettingsClick: () => void
}

export function MobileHeader({ activeTab, isDarkMode, toggleDarkMode, onSettingsClick }: MobileHeaderProps) {
  const getPageTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard': return 'Metrix'
      case 'food': return 'Food Log'
      case 'exercise': return 'Exercises'
      case 'progress': return 'Progress'
      case 'calculators': return 'Calculators'
      case 'settings': return 'Settings'
      default: return 'Metrix'
    }
  }

  return (
    <header className="lg:hidden sticky top-0 z-50 w-full h-16 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-6">
      <div className="flex items-center space-x-3">
        <img src="/logo.png" alt="Metrix Logo" className="w-8 h-8 object-contain rounded-lg" />
        <h1 className="text-xl font-bold tracking-tight text-foreground">{getPageTitle(activeTab)}</h1>
      </div>

      <div className="flex items-center space-x-1">
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button
          onClick={onSettingsClick}
          className="p-2 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
