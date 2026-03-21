import { useState, useEffect, useRef } from "react"
import { Sidebar } from "./layouts/Sidebar"
import { Dashboard } from "./features/dashboard/Dashboard"
import { Settings } from "./features/settings/Settings"
import { FoodLog } from "./features/food/FoodLog"
import { ExerciseLog } from "./features/exercise/ExerciseLog"
import { ProgressTracker } from "./features/progress/ProgressTracker"
import { Calculators } from "./features/calculators/Calculators"

import { MobileHeader } from "./layouts/MobileHeader"
import { MobileNav } from "./layouts/MobileNav"

function App() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [isDarkMode, setIsDarkMode] = useState(true)
  const dashboardRefreshKey = useRef(0)

  useEffect(() => {
    // Apply dark mode by default unless changed
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full bg-background overflow-hidden relative selection:bg-primary/30">
      <MobileHeader 
        activeTab={activeTab} 
        isDarkMode={isDarkMode} 
        toggleDarkMode={() => setIsDarkMode(!isDarkMode)} 
        onSettingsClick={() => setActiveTab('settings')}
      />
      
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          if (tab === 'dashboard') dashboardRefreshKey.current += 1;
          setActiveTab(tab);
        }} 
        isDarkMode={isDarkMode} 
        toggleDarkMode={() => setIsDarkMode(!isDarkMode)} 
      />

      <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
        {activeTab === 'dashboard' && <Dashboard refreshKey={dashboardRefreshKey.current} />}
        {activeTab === 'food' && <FoodLog />}
        {activeTab === 'exercise' && <ExerciseLog />}
        {activeTab === 'progress' && <ProgressTracker />}
        {activeTab === 'calculators' && <Calculators />}
        {activeTab === 'settings' && <Settings />}
      </main>

      <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  )
}

export default App
