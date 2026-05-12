import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/dateUtils'
import LogContextSheet from '../components/LogContextSheet'
import BottomSheet from '../components/BottomSheet'
import FocusTimer from '../components/FocusTimer'

const SLOUCH_ACTIVITIES = [
  { label: 'working',     value: 'working' },
  { label: 'exercising',  value: 'working out' },
  { label: 'watching TV', value: 'TV' },
  { label: 'Other',       value: 'other' },
]

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
  return null
}

export default function TodayView({ habits, logs, userId, onRefresh }) {
  const [contextHabit,   setContextHabit]   = useState(null)
  const [slouchOpen,     setSlouchOpen]     = useState(false)
  const [slouchActivity, setSlouchActivity] = useState('')
  const [slouchNotes,    setSlouchNotes]    = useState('')
  const [slouchSaving,   setSlouchSaving]   = useState(false)

  const reduceHabits = habits.filter(h => h.type === 'reduce' && h.name !== 'Posture')
  const focusHabit   = habits.find(h => h.name === 'Focus' && h.type === 'build')
  const postureHabit = habits.find(h => h.name === 'Posture' && h.type === 'reduce')

  const countForHabit = (habitId) => logs.filter(l => l.habit_id === habitId).length

  async function tapReduceHabit(habit) {
    if (habit.has_context) { setContextHabit(habit); return }
    await supabase.from('habit_logs').insert({ user_id: userId, habit_id: habit.id })
    onRefresh()
  }

  function openSlouchSheet() {
    setSlouchActivity('')
    setSlouchNotes('')
    setSlouchOpen(true)
  }

  async function ensurePostureHabit() {
    if (postureHabit) return postureHabit.id
    const { data, error } = await supabase
      .from('habits')
      .insert({ user_id: userId, name: 'Posture', type: 'reduce', tracking: 'instance', has_context: true })
      .select()
      .single()
    if (error) { console.error('Posture habit create failed:', error); alert(`Could not create Posture habit: ${error.message}`); return null }
    return data.id
  }

  async function saveSlouching() {
    setSlouchSaving(true)
    const habitId = await ensurePostureHabit()
    if (!habitId) { setSlouchSaving(false); return }
    const { error } = await supabase.from('habit_logs').insert({
      user_id:  userId,
      habit_id: habitId,
      outcome:  'slouching',
      activity: slouchActivity || null,
      notes:    slouchNotes.trim() || null,
      source:   'tick',
      log_date: new Date().toISOString().slice(0, 10),
    })
    setSlouchSaving(false)
    if (error) { console.error('Slouching insert failed:', error); alert(`Could not log slouching: ${error.message}`); return }
    setSlouchOpen(false)
    onRefresh()
  }

  const slouchCount = postureHabit
    ? logs.filter(l => l.habit_id === postureHabit.id && l.outcome === 'slouching').length
    : 0

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
                  {h.name === 'BFRB' && (
                    <button
                      onClick={openSlouchSheet}
                      className="w-full mt-3 flex items-center justify-between bg-gray-800 active:bg-gray-700 rounded-2xl px-5 py-4 transition-colors"
                    >
                      <span className="flex items-center gap-3">
                        <HabitIcon name="Slouching" className={`w-6 h-6 ${slouchCount > 0 ? 'text-amber-400' : 'text-gray-500'}`} />
                        <span className="text-white font-medium text-lg">Slouching</span>
                      </span>
                      <span className={`text-3xl font-bold tabular-nums ${slouchCount > 0 ? 'text-amber-400' : 'text-gray-600'}`}>
                        {slouchCount}
                      </span>
                    </button>
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

      {slouchOpen && (
        <BottomSheet title="Log — Slouching" onClose={() => setSlouchOpen(false)}>
          <div className="space-y-5">
            <div>
              <p className="text-gray-400 text-sm mb-2">Activity</p>
              <div className="flex gap-2 flex-wrap">
                {SLOUCH_ACTIVITIES.map(a => (
                  <button
                    key={a.value}
                    onClick={() => setSlouchActivity(slouchActivity === a.value ? '' : a.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                      slouchActivity === a.value
                        ? 'bg-amber-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-gray-400 text-sm mb-2">Notes (optional)</p>
              <textarea autoComplete="off" data-1p-ignore data-lpignore="true" data-bwignore="true"
                value={slouchNotes}
                onChange={e => setSlouchNotes(e.target.value)}
                rows={2}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-amber-500 resize-none text-sm placeholder-gray-500"
                placeholder="Anything else?"
              />
            </div>

            <button
              onClick={saveSlouching}
              disabled={slouchSaving}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition-colors"
            >
              {slouchSaving ? 'Logging…' : 'Log it'}
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  )
}
