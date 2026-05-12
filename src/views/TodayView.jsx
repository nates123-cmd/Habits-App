import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/dateUtils'
import LogContextSheet from '../components/LogContextSheet'
import FocusTimer from '../components/FocusTimer'

export default function TodayView({ habits, logs, userId, onRefresh }) {
  const [contextHabit, setContextHabit] = useState(null)

  const reduceHabits = habits.filter(h => h.type === 'reduce')
  const focusHabit   = habits.find(h => h.name === 'Focus' && h.type === 'build')
  const postureHabit = habits.find(h => h.name === 'Posture' && h.type === 'reduce')

  const countForHabit = (habitId) => logs.filter(l => l.habit_id === habitId).length

  async function tapReduceHabit(habit) {
    if (habit.has_context) { setContextHabit(habit); return }
    await supabase.from('habit_logs').insert({ user_id: userId, habit_id: habit.id })
    onRefresh()
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">{formatDate(new Date())}</h2>

      <FocusTimer
        userId={userId}
        focusHabitId={focusHabit?.id}
        postureHabitId={postureHabit?.id}
        onSessionComplete={onRefresh}
      />

      {reduceHabits.length > 0 && (
        <section>
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Reduce</p>
          <div className="space-y-3">
            {reduceHabits.map(h => {
              const count = countForHabit(h.id)
              return (
                <button
                  key={h.id}
                  onClick={() => tapReduceHabit(h)}
                  className="w-full flex items-center justify-between bg-gray-800 active:bg-gray-700 rounded-2xl px-5 py-4 transition-colors"
                >
                  <span className="text-white font-medium text-lg">{h.name}</span>
                  <span className={`text-3xl font-bold tabular-nums ${count > 0 ? 'text-red-400' : 'text-gray-600'}`}>
                    {count}
                  </span>
                </button>
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
