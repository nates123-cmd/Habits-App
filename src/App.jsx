import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useHabits } from './hooks/useHabits'
import { useTodayLogs } from './hooks/useTodayLogs'
import { seedDefaultHabits } from './lib/seed'
import LoginScreen from './components/LoginScreen'
import NavBar from './components/NavBar'
import TodayView from './views/TodayView'
import WeeklyView from './views/WeeklyView'
import HistoryView from './views/HistoryView'

export default function App() {
  const { session, loading: authLoading } = useAuth()
  const userId = session?.user?.id
  const { habits, loading: habitsLoading, refetch: refetchHabits } = useHabits(userId)
  const { logs, refetch: refetchLogs } = useTodayLogs(userId)
  const [view, setView] = useState('today')
  const [seeded, setSeeded] = useState(false)

  // Seed default habits on first login
  useEffect(() => {
    if (!userId || seeded || habitsLoading) return
    if (habits.length === 0) {
      seedDefaultHabits(userId).then(() => {
        refetchHabits()
        setSeeded(true)
      })
    } else {
      setSeeded(true)
    }
  }, [userId, habits, habitsLoading, seeded, refetchHabits])

  function handleRefresh() {
    refetchLogs()
    refetchHabits()
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <LoginScreen />

  if (habitsLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <main className="max-w-lg mx-auto px-4 pt-8 pb-24">
        {view === 'today'   && <TodayView   habits={habits} logs={logs}   userId={userId} onRefresh={handleRefresh} />}
        {view === 'weekly'  && <WeeklyView  habits={habits}               userId={userId} />}
        {view === 'history' && <HistoryView habits={habits}               userId={userId} />}
      </main>
      <NavBar view={view} setView={setView} />
    </div>
  )
}
