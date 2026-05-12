import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/dateUtils'
import LogContextSheet from '../components/LogContextSheet'
import FocusTimer from '../components/FocusTimer'

export default function TodayView({ habits, logs, userId, onRefresh }) {
  const [contextHabit, setContextHabit] = useState(null)
  const [postureLogs,  setPostureLogs]  = useState([])

  const today = new Date().toISOString().slice(0, 10)

  const fetchPosture = useCallback(async () => {
    const { data } = await supabase
      .from('posture_logs').select('*')
      .eq('user_id', userId).eq('log_date', today)
    if (data) setPostureLogs(data)
  }, [userId, today])

  useEffect(() => { if (userId) fetchPosture() }, [userId, fetchPosture])

  const reduceHabits = habits.filter(h => h.type === 'reduce')
  const focusHabit   = habits.find(h => h.name === 'Focus' && h.type === 'build')

  const countForHabit = (habitId) => logs.filter(l => l.habit_id === habitId).length

  async function tapReduceHabit(habit) {
    if (habit.has_context) { setContextHabit(habit); return }
    await supabase.from('habit_logs').insert({ user_id: userId, habit_id: habit.id })
    onRefresh()
  }

  async function logPosture(outcome) {
    setPostureLogs(prev => [...prev, { outcome }])
    await supabase.from('posture_logs').insert({
      user_id: userId, outcome, source: 'manual', log_date: today,
    })
    fetchPosture()
  }

  const goodCount   = postureLogs.filter(l => l.outcome === 'good').length
  const slouchCount = postureLogs.filter(l => l.outcome === 'slouching').length

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">{formatDate(new Date())}</h2>

      <FocusTimer
        userId={userId}
        focusHabitId={focusHabit?.id}
        onSessionComplete={onRefresh}
      />

      {reduceHabits.length > 0 && (
        <section>
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Reduce</p>
          <div className="space-y-3">
            {reduceHabits.map(h => {
              const count = countForHabit(h.id)
              return (
                <div key={h.id}>
                  <button
                    onClick={() => tapReduceHabit(h)}
                    className="w-full flex items-center justify-between bg-gray-800 active:bg-gray-700 rounded-2xl px-5 py-4 transition-colors"
                  >
                    <span className="text-white font-medium text-lg">{h.name}</span>
                    <span className={`text-3xl font-bold tabular-nums ${count > 0 ? 'text-red-400' : 'text-gray-600'}`}>
                      {count}
                    </span>
                  </button>
                  {h.name === 'BFRB' && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => logPosture('good')}
                        className="flex-1 bg-gray-800 active:bg-emerald-900 rounded-xl py-2.5 text-center transition-colors"
                      >
                        <span className="text-white text-sm font-medium">Posture good</span>
                        {goodCount > 0 && <span className="text-emerald-400 text-sm ml-1.5">×{goodCount}</span>}
                      </button>
                      <button
                        onClick={() => logPosture('slouching')}
                        className="flex-1 bg-gray-800 active:bg-amber-900 rounded-xl py-2.5 text-center transition-colors"
                      >
                        <span className="text-white text-sm font-medium">Slouching</span>
                        {slouchCount > 0 && <span className="text-amber-400 text-sm ml-1.5">×{slouchCount}</span>}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {contextHabit && (
        <LogContextSheet
          habit={contextHabit}
          userId={userId}
          onDone={() => { setContextHabit(null); onRefresh() }}
          onClose={() => setContextHabit(null)}
        />
      )}
    </div>
  )
}
