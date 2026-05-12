import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import BottomSheet from './BottomSheet'

const POMODORO_BREAK   = 5  * 60
const DURATION_OPTIONS = [5, 10, 15, 20, 25, 30, 45, 60]
const MOODS          = ['bored', 'anxious', 'tired', 'fine', 'unsure']
const ACTIVITIES     = ['Amanda', 'Friend Message', 'Music', 'News', 'Doorbell', 'Other']

function chime() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  // IV → I resolution: FMaj → CMaj, each chord hit simultaneously
  const chords = [
    [349.23, 440.00, 523.25],  // FMaj: F4-A4-C5
    [523.25, 659.25, 783.99],  // CMaj: C5-E5-G5
  ]

  chords.forEach((chord, ci) => {
    const t = ctx.currentTime + ci * 0.45
    chord.forEach(freq => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.12, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
      osc.start(t)
      osc.stop(t + 0.9)
    })
  })
}

function fmt(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

function fmtTime(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function FocusTimer({ userId, focusHabitId, onSessionComplete }) {
  const [active,          setActive]          = useState(false)
  const [pomodoro,        setPomodoro]        = useState(true)
  const [workMins,        setWorkMins]        = useState(25)
  const [customMins,      setCustomMins]      = useState('')
  const [elapsed,         setElapsed]         = useState(0)
  const [phase,           setPhase]           = useState('work')
  const [sessionId,       setSessionId]       = useState(null)
  const [showFullscreen,  setShowFullscreen]  = useState(false)
  const [showDistraction, setShowDistraction] = useState(false)
  const [showPhaseEnd,    setShowPhaseEnd]    = useState(false)
  const [distractionsLog, setDistractionsLog] = useState([])
  const [distMood,        setDistMood]        = useState('')
  const [distActivity,    setDistActivity]    = useState('')
  const [distOther,       setDistOther]       = useState('')
  const [distNotes,       setDistNotes]       = useState('')
  const [topic,           setTopic]           = useState('')
  const [showWrap,        setShowWrap]        = useState(false)
  const [worked,          setWorked]          = useState('')
  const [finalNote,       setFinalNote]       = useState('')
  const [saving,          setSaving]          = useState(false)

  const intervalRef  = useRef(null)
  const startTimeRef = useRef(null)

  useEffect(() => {
    if (active) {
      intervalRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startTimeRef.current) / 1000)
        if (pomodoro && phase === 'work' && secs >= workMins * 60) {
          setActive(false)
          setElapsed(workMins * 60)
          chime()
          navigator.vibrate?.([200, 100, 200])
          setShowPhaseEnd(true)
        } else if (pomodoro && phase === 'break' && secs >= POMODORO_BREAK) {
          startTimeRef.current = Date.now()
          setElapsed(0)
          setPhase('work')
          chime()
        } else {
          setElapsed(secs)
        }
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [active, pomodoro, phase])

  // Re-sync immediately when returning to the app after screen lock
  useEffect(() => {
    if (!active) return
    const sync = () => {
      if (!document.hidden && startTimeRef.current) {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }
    }
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [active])

  async function startSession() {
    const { data, error } = await supabase
      .from('focus_sessions')
      .insert({ user_id: userId, what_worked_on: '', completed: false })
      .select()
      .single()
    if (!error) setSessionId(data.id)
    startTimeRef.current = Date.now()
    setElapsed(0)
    setPhase('work')
    setDistractionsLog([])
    setWorked(topic)
    setActive(true)
    setShowFullscreen(true)
  }

  function logDistraction() {
    if (!distMood && !distActivity) return
    const activity = distActivity === 'Other' && distOther.trim() ? distOther.trim() : distActivity
    setDistractionsLog(prev => [
      ...prev,
      {
        activity: activity || null,
        mood:     distMood || null,
        notes:    distNotes.trim() || null,
        at:       fmtTime(new Date()),
      },
    ])
    setDistMood('')
    setDistActivity('')
    setDistOther('')
    setDistNotes('')
    setShowDistraction(false)
  }

  function endSession() {
    setActive(false)
    setShowFullscreen(false)
    setShowWrap(true)
  }

  async function completeSession() {
    setSaving(true)
    const minutes = Math.ceil(elapsed / 60)

    const distractionsPayload = JSON.stringify({
      logs: distractionsLog,
      note: finalNote.trim() || null,
    })

    await supabase
      .from('focus_sessions')
      .update({
        completed:        true,
        duration_minutes: minutes,
        what_worked_on:   worked.trim() || '',
        distractions:     distractionsLog.length > 0 || finalNote.trim()
          ? distractionsPayload
          : null,
      })
      .eq('id', sessionId)

    if (focusHabitId) {
      await supabase.from('habit_logs').insert({ user_id: userId, habit_id: focusHabitId })
    }

    setSaving(false)
    setShowWrap(false)
    setSessionId(null)
    setElapsed(0)
    setTopic('')
    setWorked('')
    setFinalNote('')
    setDistractionsLog([])
    onSessionComplete?.()
  }

  const displayTime = pomodoro
    ? fmt((phase === 'work' ? workMins * 60 : POMODORO_BREAK) - elapsed)
    : fmt(elapsed)

  return (
    <>
      {/* Card */}
      <div className="bg-gray-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">Focus Session</h3>
          {!active && (
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
              <span>Pomodoro</span>
              <div
                onClick={() => setPomodoro(p => !p)}
                className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                  pomodoro ? 'bg-indigo-600' : 'bg-gray-600'
                }`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  pomodoro ? 'translate-x-5' : ''
                }`} />
              </div>
            </label>
          )}
          {active && distractionsLog.length > 0 && (
            <span className="text-xs text-amber-400">{distractionsLog.length} distraction{distractionsLog.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        <div className="text-center">
          <span className="text-5xl font-mono font-bold text-white tabular-nums">{displayTime}</span>
          {pomodoro && active && (
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">
              {phase === 'work' ? `${workMins} min work` : '5 min break'}
            </p>
          )}
        </div>

        {!active && pomodoro && (
          <select
            value={customMins !== '' ? 'custom' : workMins}
            onChange={e => {
              if (e.target.value === 'custom') {
                setCustomMins(String(workMins))
              } else {
                setCustomMins('')
                setWorkMins(Number(e.target.value))
              }
            }}
            className="w-full bg-gray-700 text-white rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {DURATION_OPTIONS.map(m => (
              <option key={m} value={m}>{m} minutes</option>
            ))}
            <option value="custom">Custom…</option>
          </select>
        )}
        {!active && pomodoro && customMins !== '' && (
          <input
            type="number"
            min={1}
            max={180}
            placeholder="Minutes"
            value={customMins}
            onChange={e => {
              setCustomMins(e.target.value)
              const v = parseInt(e.target.value)
              if (v > 0) setWorkMins(v)
            }}
            className="w-full bg-gray-700 text-white rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
          />
        )}

        {!active && (
          <input
            type="text" autoComplete="off" data-1p-ignore data-lpignore="true" data-bwignore="true"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startSession()}
            placeholder="What do you want to focus on?"
            className="w-full bg-gray-700 text-white rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm placeholder-gray-500"
          />
        )}

        {!active ? (
          <button
            onClick={startSession}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl py-3 transition-colors"
          >
            Start
          </button>
        ) : (
          <button
            onClick={() => setShowFullscreen(true)}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl py-3 transition-colors"
          >
            Open session
          </button>
        )}
      </div>

      {/* Fullscreen timer overlay */}
      {showFullscreen && (
        <div className="fixed inset-0 z-40 bg-gray-950 flex flex-col">
          <div className="flex items-center px-5 pt-12 pb-4">
            <button
              onClick={() => setShowFullscreen(false)}
              className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            {distractionsLog.length > 0 && (
              <span className="ml-auto text-xs text-amber-400">
                {distractionsLog.length} distraction{distractionsLog.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
            {topic && (
              <p className="text-5xl font-bold text-white text-center leading-tight">{topic}</p>
            )}
            <span className="text-3xl font-mono text-gray-500 tabular-nums">{displayTime}</span>
            {pomodoro && (
              <p className="text-xs text-gray-600 uppercase tracking-widest">
                {phase === 'work' ? 'Focus' : 'Break'}
              </p>
            )}
          </div>

          <div className="px-6 pb-16 space-y-3">
            <button
              onClick={() => setShowDistraction(true)}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-2xl py-4 text-lg transition-colors"
            >
              Distraction
            </button>
            <button
              onClick={endSession}
              className="w-full bg-gray-800 hover:bg-gray-700 text-red-400 font-semibold rounded-2xl py-4 transition-colors"
            >
              End Session
            </button>
          </div>
        </div>
      )}

      {/* Distraction log sheet */}
      {showDistraction && (
        <BottomSheet title="Log distraction" onClose={() => setShowDistraction(false)}>
          <div className="space-y-5">
            <div>
              <p className="text-gray-400 text-sm mb-2">What pulled you away?</p>
              <div className="flex gap-2 flex-wrap">
                {ACTIVITIES.map(a => (
                  <button
                    key={a}
                    onClick={() => { setDistActivity(distActivity === a ? '' : a); setDistOther('') }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                      distActivity === a
                        ? 'bg-amber-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
              {distActivity === 'Other' && (
                <input
                  type="text" autoComplete="off" data-1p-ignore data-lpignore="true" data-bwignore="true"
                  value={distOther}
                  onChange={e => setDistOther(e.target.value)}
                  className="mt-3 w-full bg-gray-800 text-white rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-amber-500 text-sm placeholder-gray-500"
                  placeholder="What was it?"
                  autoFocus
                />
              )}
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-2">Mood</p>
              <div className="flex gap-2 flex-wrap">
                {MOODS.map(m => (
                  <button
                    key={m}
                    onClick={() => setDistMood(distMood === m ? '' : m)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                      distMood === m
                        ? 'bg-amber-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-2">Additional notes (optional)</p>
              <textarea
                autoComplete="off" data-1p-ignore data-lpignore="true" data-bwignore="true"
                value={distNotes}
                onChange={e => setDistNotes(e.target.value)}
                rows={2}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-amber-500 resize-none text-sm placeholder-gray-500"
                placeholder="Anything else?"
              />
            </div>
            <button
              onClick={logDistraction}
              disabled={!distMood && !distActivity}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 transition-colors"
            >
              Log it
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Wrap-up sheet */}
      {showWrap && (
        <BottomSheet title="Session complete" onClose={() => setShowWrap(false)}>
          <div className="space-y-4">
            {distractionsLog.length > 0 && (
              <p className="text-xs text-amber-400">{distractionsLog.length} distraction{distractionsLog.length !== 1 ? 's' : ''} logged</p>
            )}
            <div>
              <label className="text-gray-400 text-sm block mb-1">What did you work on? (optional)</label>
              <input
                type="text" autoComplete="off" data-1p-ignore data-lpignore="true" data-bwignore="true"
                value={worked}
                onChange={e => setWorked(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm placeholder-gray-500"
                placeholder="e.g. Deep work on project X"
                autoFocus
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-1">Any distraction notes? (optional)</label>
              <input
                type="text" autoComplete="off" data-1p-ignore data-lpignore="true" data-bwignore="true"
                value={finalNote}
                onChange={e => setFinalNote(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm placeholder-gray-500"
                placeholder="Overall notes on distractions"
              />
            </div>
            <button
              onClick={completeSession}
              disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition-colors"
            >
              {saving ? 'Saving…' : 'Save session'}
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Work phase end prompt */}
      {showPhaseEnd && (
        <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center px-8 gap-6">
          <p className="text-white text-3xl font-bold text-center">{workMins} minutes done</p>
          <p className="text-gray-400 text-center">What do you want to do?</p>
          <button
            onClick={() => {
              setShowPhaseEnd(false)
              startTimeRef.current = Date.now()
              setElapsed(0)
              setActive(true)
            }}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl py-5 text-lg transition-colors"
          >
            Keep going
          </button>
          <button
            onClick={() => {
              setShowPhaseEnd(false)
              setPhase('break')
              startTimeRef.current = Date.now()
              setElapsed(0)
              setActive(true)
              setShowFullscreen(true)
            }}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-2xl py-5 text-lg transition-colors"
          >
            Take a break
          </button>
        </div>
      )}
    </>
  )
}
