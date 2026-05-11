import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDate, todayRange } from '../lib/dateUtils'
import LogContextSheet from '../components/LogContextSheet'
import FocusTimer from '../components/FocusTimer'

export default function TodayView({ habits, logs, userId, onRefresh }) {
  const [contextHabit, setContextHabit] = useState(null)

  const reduceHabits = habits.filter(h => h.type === 'reduce')
  const buildHabits  = habits.filter(h => h.type === 'build')
  const focusHabit   = habits.find(h => h.name === 'Focus' && h.type === 'build')

  const countForHabit = (habitId) =>
    logs.filter(l => l.habit_id === habitId).length

  const isChecked = (habitId) => countForHabit(habitId) > 0

  async function tapReduceHabit(habit) {
    if (habit.has_context) {
      setContextHabit(habit)
      return
    }
    await supabase.from('habit_logs').insert({ user_id: userId, habit_id: habit.id })
    onRefresh()
  }

  async function toggleBuildHabit(habit) {
    const checked = isChecked(habit.id)
    if (checked) {
      const { start, end } = todayRange()
      await supabase
        .from('habit_logs')
        .delete()
        .eq('habit_id', habit.id)
        .gte('logged_at', start)
        .lt('logged_at', end)
    } else {
      await supabase.from('habit_logs').insert({ user_id: userId, habit_id: habit.id })
    }
    onRefresh()
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">{formatDate(new Date())}</h2>

      {/* Reduce habits */}
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

      {/* Build habits */}
      {buildHabits.length > 0 && (
        <section>
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Build</p>
          <div className="space-y-2">
            {buildHabits.map(h => {
              const checked = isChecked(h.id)
              const isFocus = h.name === 'Focus'
              return (
                <button
                  key={h.id}
                  onClick={() => !isFocus && toggleBuildHabit(h)}
                  className={`w-full flex items-center gap-4 rounded-2xl px-5 py-4 transition-colors ${
                    isFocus
                      ? 'bg-gray-800/50 cursor-default'
                      : 'bg-gray-800 active:bg-gray-700'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    checked ? 'bg-green-500 border-green-500' : 'border-gray-600'
                  }`}>
                    {checked && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-base font-medium ${checked ? 'text-gray-300' : 'text-white'}`}>{h.name}</span>
                  {isFocus && <span className="ml-auto text-xs text-gray-600">auto</span>}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* Focus timer */}
      <FocusTimer
        userId={userId}
        focusHabitId={focusHabit?.id}
        onSessionComplete={onRefresh}
      />

      {/* Context log sheet */}
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
