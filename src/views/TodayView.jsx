import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/dateUtils'
import LogContextSheet from '../components/LogContextSheet'
import FocusTimer from '../components/FocusTimer'

function HabitIcon({ name, className = 'w-6 h-6' }) {
  if (name === 'BFRB') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 12a1.5 1.5 0 1 1 1.5 1.5A3 3 0 0 1 10.5 10.5 4.5 4.5 0 0 1 15 6a6 6 0 0 1 6 6 7.5 7.5 0 0 1-15 0" />
      </svg>
    )
  }
  if (name === 'Slouching') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="5" r="2.5" />
        <path d="M11 7.5C9.5 10 8.5 12.5 9.5 15.5" />
        <path d="M9.5 15.5C11 17 14 17 16.5 16.5" />
        <path d="M9 21l1-5.5" />
        <path d="M14 16.5l2 4.5" />
      </svg>
    )
  }
  if (name === 'LTMs') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="5" width="14" height="10" rx="1" />
        <path d="M5 15l-2 4h18l-2-4" />
      </svg>
    )
  }
  if (name === 'Distractions') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 8l4 3-4 3" />
        <path d="M20 8l-4 3 4 3" />
        <path d="M9 5l3 3 3-3" />
        <path d="M9 19l3-3 3 3" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    )
  }
  return null
}

export default function TodayView({ habits, logs, postureCounts = { good: 0, slouching: 0 }, userId, onRefresh }) {
  const [contextHabit, setContextHabit]   = useState(null)
  const [posturePending, setPosturePending] = useState(false)
  const [ltmsStreak, setLtmsStreak]       = useState(null)

  const reduceHabits      = habits
    .filter(h => h.type === 'reduce' && h.name !== 'Posture')
    .filter((h, i, arr) => arr.findIndex(x => x.name === h.name) === i)
  const topReduceHabits   = reduceHabits.filter(h => h.name !== 'LTMs')
  const ltmsHabit         = reduceHabits.find(h => h.name === 'LTMs')
  const focusHabit        = habits.find(h => h.name === 'Focus' && h.type === 'build')
  const distractionsHabit = habits.find(h => h.name === 'Distractions' && h.type === 'reduce')

  const creatingDistractionsRef = useRef(false)
  useEffect(() => {
    if (!userId || habits.length === 0 || distractionsHabit || creatingDistractionsRef.current) return
    creatingDistractionsRef.current = true
    async function createIfMissing() {
      const { data: existing } = await supabase
        .from('habits').select('id').eq('user_id', userId).eq('name', 'Distractions').limit(1)
      if (existing && existing.length > 0) { onRefresh(); return }
      const { error } = await supabase.from('habits').insert({
        user_id: userId, name: 'Distractions', type: 'reduce', tracking: 'instance', has_context: false,
      })
      if (error) { console.error('Distractions habit create failed:', error); creatingDistractionsRef.current = false; return }
      onRefresh()
    }
    createIfMissing()
  }, [userId, habits, distractionsHabit, onRefresh])

  useEffect(() => {
    if (!userId || !ltmsHabit) { setLtmsStreak(null); return }
    let cancelled = false
    async function loadStreak() {
      const { data } = await supabase
        .from('habit_logs')
        .select('logged_at')
        .eq('user_id', userId)
        .eq('habit_id', ltmsHabit.id)
        .order('logged_at', { ascending: false })
        .limit(1)
      if (cancelled) return
      const startIso = (data && data.length > 0) ? data[0].logged_at : ltmsHabit.created_at
      const startDay = new Date(startIso); startDay.setHours(0, 0, 0, 0)
      const today    = new Date();          today.setHours(0, 0, 0, 0)
      const days     = Math.max(0, Math.floor((today - startDay) / 86400000))
      setLtmsStreak(days)
    }
    loadStreak()
    return () => { cancelled = true }
  }, [userId, ltmsHabit?.id, ltmsHabit?.created_at, logs])

  const creatingLtmsRef = useRef(false)
  useEffect(() => {
    if (!userId || habits.length === 0 || ltmsHabit || creatingLtmsRef.current) return
    creatingLtmsRef.current = true
    async function createIfMissing() {
      const { data: existing } = await supabase
        .from('habits').select('id').eq('user_id', userId).eq('name', 'LTMs').limit(1)
      if (existing && existing.length > 0) { onRefresh(); return }
      const { error } = await supabase.from('habits').insert({
        user_id: userId, name: 'LTMs', type: 'reduce', tracking: 'instance', has_context: true,
      })
      if (error) { console.error('LTMs habit create failed:', error); creatingLtmsRef.current = false; return }
      onRefresh()
    }
    createIfMissing()
  }, [userId, habits, ltmsHabit, onRefresh])

  const countForHabit = (habitId) => logs.filter(l => l.habit_id === habitId).length

  async function tapReduceHabit(habit) {
    if (habit.has_context) { setContextHabit(habit); return }
    await supabase.from('habit_logs').insert({ user_id: userId, habit_id: habit.id })
    onRefresh()
  }

  async function logPosture(outcome) {
    if (posturePending) return
    setPosturePending(true)
    const { error } = await supabase.from('posture_logs').insert({
      user_id: userId,
      outcome,
      source:  'manual',
    })
    setPosturePending(false)
    if (error) { console.error('Posture insert failed:', error); alert(`Could not log: ${error.message}`); return }
    onRefresh()
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">{formatDate(new Date())}</h2>

      <FocusTimer
        userId={userId}
        focusHabitId={focusHabit?.id}
        distractionsHabitId={distractionsHabit?.id}
        onSessionComplete={onRefresh}
      />

      {reduceHabits.length > 0 && (
        <section>
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Reduce</p>
          <div className="space-y-3">
            {topReduceHabits.map(h => {
              const count = countForHabit(h.id)
              return (
                <div key={h.id}>
                  <button
                    onClick={() => tapReduceHabit(h)}
                    className="w-full flex items-center justify-between bg-gray-800 active:bg-gray-700 rounded-2xl px-5 py-4 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <HabitIcon name={h.name} className={`w-6 h-6 ${count > 0 ? 'text-red-400' : 'text-gray-500'}`} />
                      <span className="text-white font-medium text-lg">{h.name}</span>
                    </span>
                    <span className={`text-3xl font-bold tabular-nums ${count > 0 ? 'text-red-400' : 'text-gray-600'}`}>
                      {count}
                    </span>
                  </button>
                </div>
              )
            })}
            <button
              onClick={() => logPosture('slouching')}
              disabled={posturePending}
              className="w-full flex items-center justify-between bg-gray-800 active:bg-gray-700 disabled:opacity-60 rounded-2xl px-5 py-4 transition-colors"
            >
              <span className="flex items-center gap-3">
                <HabitIcon name="Slouching" className={`w-6 h-6 ${postureCounts.slouching > 0 ? 'text-red-400' : 'text-gray-500'}`} />
                <span className="text-white font-medium text-lg">Slouching</span>
              </span>
              <span className={`text-3xl font-bold tabular-nums ${postureCounts.slouching > 0 ? 'text-red-400' : 'text-gray-600'}`}>
                {postureCounts.slouching}
              </span>
            </button>
            {ltmsHabit && (() => {
              const count       = countForHabit(ltmsHabit.id)
              const loggedToday = count > 0
              const display     = loggedToday ? count : (ltmsStreak ?? 0)
              const numberColor = loggedToday
                ? 'text-red-400'
                : (ltmsStreak && ltmsStreak > 0 ? 'text-emerald-400' : 'text-gray-600')
              return (
                <button
                  onClick={() => tapReduceHabit(ltmsHabit)}
                  className="w-full flex items-center justify-between bg-gray-800 active:bg-gray-700 rounded-2xl px-5 py-4 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <HabitIcon name="LTMs" className={`w-6 h-6 ${loggedToday ? 'text-red-400' : 'text-gray-500'}`} />
                    <span className="text-white font-medium text-lg">LTMs</span>
                  </span>
                  <span className={`text-3xl font-bold tabular-nums ${numberColor}`}>
                    {display}
                  </span>
                </button>
              )
            })()}
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
