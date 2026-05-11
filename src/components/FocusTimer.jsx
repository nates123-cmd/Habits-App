import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import BottomSheet from './BottomSheet'

const POMODORO_WORK  = 25 * 60
const POMODORO_BREAK = 5  * 60

function fmt(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

export default function FocusTimer({ userId, focusHabitId, onSessionComplete }) {
  const [active,    setActive]    = useState(false)
  const [pomodoro,  setPomodoro]  = useState(false)
  const [elapsed,   setElapsed]   = useState(0)
  const [phase,     setPhase]     = useState('work') // 'work' | 'break'
  const [sessionId, setSessionId] = useState(null)
  const [showWrap,  setShowWrap]  = useState(false)
  const [worked,    setWorked]    = useState('')
  const [distractions, setDistractions] = useState('')
  const [saving,    setSaving]    = useState(false)

  const intervalRef = useRef(null)

  useEffect(() => {
    if (active) {
      intervalRef.current = setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1
          if (pomodoro && phase === 'work' && next >= POMODORO_WORK) {
            setPhase('break')
            return 0
          }
          if (pomodoro && phase === 'break' && next >= POMODORO_BREAK) {
            setPhase('work')
            return 0
          }
          return next
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [active, pomodoro, phase])

  async function startSession() {
    const { data, error } = await supabase
      .from('focus_sessions')
      .insert({ user_id: userId, what_worked_on: '', completed: false })
      .select()
      .single()
    if (!error) setSessionId(data.id)
    setElapsed(0)
    setPhase('work')
    setActive(true)
  }

  function stopSession() {
    setActive(false)
    setShowWrap(true)
  }

  async function completeSession() {
    if (!worked.trim()) return
    setSaving(true)
    const minutes = Math.ceil(elapsed / 60)
    await supabase
      .from('focus_sessions')
      .update({
        completed:        true,
        duration_minutes: minutes,
        what_worked_on:   worked.trim(),
        distractions:     distractions.trim() || null,
      })
      .eq('id', sessionId)

    // Auto-check Focus habit for today
    if (focusHabitId) {
      await supabase.from('habit_logs').insert({
        user_id:  userId,
        habit_id: focusHabitId,
      })
    }

    setSaving(false)
    setShowWrap(false)
    setSessionId(null)
    setElapsed(0)
    setWorked('')
    setDistractions('')
    onSessionComplete?.()
  }

  const displayTime = pomodoro
    ? fmt((phase === 'work' ? POMODORO_WORK : POMODORO_BREAK) - elapsed)
    : fmt(elapsed)

  return (
    <div className="bg-gray-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">Focus Session</h3>
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
          <span>Pomodoro</span>
          <div
            onClick={() => !active && setPomodoro(p => !p)}
            className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
              pomodoro ? 'bg-indigo-600' : 'bg-gray-600'
            } ${active ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              pomodoro ? 'translate-x-5' : ''
            }`} />
          </div>
        </label>
      </div>

      {pomodoro && active && (
        <p className="text-xs text-center text-gray-400 uppercase tracking-wide">
          {phase === 'work' ? '25 min work' : '5 min break'}
        </p>
      )}

      <div className="text-center">
        <span className="text-5xl font-mono font-bold text-white tabular-nums">{displayTime}</span>
      </div>

      {!active ? (
        <button
          onClick={startSession}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl py-3 transition-colors"
        >
          Start
        </button>
      ) : (
        <button
          onClick={stopSession}
          className="w-full bg-red-700 hover:bg-red-600 text-white font-semibold rounded-xl py-3 transition-colors"
        >
          Stop
        </button>
      )}

      {showWrap && (
        <BottomSheet title="Session complete" onClose={() => setShowWrap(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm block mb-1">What did you work on? <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={worked}
                onChange={e => setWorked(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm placeholder-gray-500"
                placeholder="e.g. Deep work on project X"
                autoFocus
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-1">Any distractions? (optional)</label>
              <input
                type="text"
                value={distractions}
                onChange={e => setDistractions(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm placeholder-gray-500"
                placeholder="e.g. Phone, email"
              />
            </div>
            <button
              onClick={completeSession}
              disabled={saving || !worked.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition-colors"
            >
              {saving ? 'Saving…' : 'Save session'}
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  )
}
