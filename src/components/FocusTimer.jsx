import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import BottomSheet from './BottomSheet'

const POMODORO_BREAK   = 5  * 60
const DURATION_OPTIONS = [5, 10, 15, 20, 25, 30, 45, 60]
const MOODS          = ['bored', 'anxious', 'tired', 'fine', 'unsure']
const ACTIVITIES     = ['Amanda', 'Friend Message', 'Music', 'News', 'Doorbell', 'Other']

function chime() {
  const audio = new Audio('/tick-jingle.wav')
  audio.play().catch(err => console.warn('Chime playback failed:', err))
}

function fmt(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

function fmtTime(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const DB_VALID_MOODS = ['bored', 'anxious', 'tired', 'fine', 'focused']

export default function FocusTimer({ userId, focusHabitId, postureHabitId, distractionsHabitId, onSessionComplete }) {
  const [active,          setActive]          = useState(false)
  const [pomodoro,        setPomodoro]        = useState(true)
  const [workMins,        setWorkMins]        = useState(25)
  const [customMins,      setCustomMins]      = useState('')
  const [elapsed,         setElapsed]         = useState(0)
  const [phase,           setPhase]           = useState('work')
  const [sessionRowIds,   setSessionRowIds]   = useState([])
  const [cyclesDone,      setCyclesDone]      = useState(0)
  const [showFullscreen,  setShowFullscreen]  = useState(false)
  const [showDistraction, setShowDistraction] = useState(false)
  const [showPhaseEnd,    setShowPhaseEnd]    = useState(false)
  const [phaseEndPosture, setPhaseEndPosture] = useState(null)
  const [distractionsLog, setDistractionsLog] = useState([])
  const [distMood,        setDistMood]        = useState('')
  const [distActivity,    setDistActivity]    = useState('')
  const [distOther,       setDistOther]       = useState('')
  const [distNotes,       setDistNotes]       = useState('')
  const [topic,           setTopic]           = useState('')
  const [todos,           setTodos]           = useState([])
  const [todoInput,       setTodoInput]       = useState('')
  const [showTodoInput,   setShowTodoInput]   = useState(false)
  const [showBackburner,  setShowBackburner]  = useState(false)
  const [backburnerLog,   setBackburnerLog]   = useState([])
  const [backburnerInput, setBackburnerInput] = useState('')

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
          setPhaseEndPosture(null)
          recordCompletedCycle(workMins)
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

  async function recordCompletedCycle(minutes) {
    if (!userId || minutes <= 0) return
    const { data, error } = await supabase
      .from('focus_sessions')
      .insert({
        user_id:          userId,
        completed:        true,
        duration_minutes: minutes,
        what_worked_on:   topic.trim() || '',
      })
      .select()
      .single()
    if (error) { console.error('Focus session insert failed:', error); return }
    setSessionRowIds(prev => [...prev, data.id])
    setCyclesDone(c => c + 1)
    if (focusHabitId) {
      const { error: logErr } = await supabase.from('habit_logs').insert({ user_id: userId, habit_id: focusHabitId })
      if (logErr) console.error('Focus habit_log insert failed:', logErr)
    }
  }

  function startSession() {
    startTimeRef.current = Date.now()
    setElapsed(0)
    setPhase('work')
    setDistractionsLog([])
    setBackburnerLog([])
    setTodos([])
    setShowTodoInput(false)
    setTodoInput('')
    setBackburnerInput('')
    setSessionRowIds([])
    setCyclesDone(0)
    setActive(true)
    setShowFullscreen(true)
  }

  function addTodo() {
    const text = todoInput.trim()
    if (!text) return
    setTodos(prev => [...prev, { id: Date.now() + Math.random(), text, done: false }])
    setTodoInput('')
  }
  function toggleTodo(id) {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }
  function removeTodo(id) {
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  function logBackburner() {
    const text = backburnerInput.trim()
    if (!text) return
    setBackburnerLog(prev => [...prev, { text, at: fmtTime(new Date()) }])
    setBackburnerInput('')
  }
  function sendToReminders(text) {
    // Opens an iOS Shortcut named "Add Tick Reminder" that takes the text as input.
    // Set up once on iPhone: Shortcuts app → new shortcut named exactly "Add Tick Reminder"
    // → "Add new reminder" action using Shortcut Input as the title.
    if (!text) return
    const url = 'shortcuts://run-shortcut?name=' + encodeURIComponent('Add Tick Reminder') + '&input=text&text=' + encodeURIComponent(text)
    window.location.href = url
  }

  async function logDistraction() {
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
    if (distractionsHabitId) {
      const noteParts = [activity, distNotes.trim()].filter(Boolean)
      const { error } = await supabase.from('habit_logs').insert({
        user_id:  userId,
        habit_id: distractionsHabitId,
        mood:     DB_VALID_MOODS.includes(distMood) ? distMood : null,
        notes:    noteParts.length > 0 ? noteParts.join(' — ') : null,
        source:   'focus',
        log_date: new Date().toISOString().slice(0, 10),
      })
      if (error) console.error('Distraction habit_log insert failed:', error)
    }
    setDistMood('')
    setDistActivity('')
    setDistOther('')
    setDistNotes('')
    setShowDistraction(false)
  }

  async function endSession() {
    setActive(false)
    setShowFullscreen(false)

    const minutes = Math.ceil(elapsed / 60)
    const shouldSavePartial =
      (!pomodoro && minutes > 0) ||
      (pomodoro && phase === 'work' && elapsed > 0 && elapsed < workMins * 60)

    const hasExtras = distractionsLog.length > 0 || backburnerLog.length > 0 || todos.length > 0
    const distractionsPayload = hasExtras
      ? JSON.stringify({
          logs: distractionsLog,
          backburner: backburnerLog,
          todos,
        })
      : null

    let partialId = null
    if (shouldSavePartial) {
      const { data, error } = await supabase
        .from('focus_sessions')
        .insert({
          user_id:          userId,
          completed:        true,
          duration_minutes: minutes,
          what_worked_on:   topic.trim() || '',
        })
        .select()
        .single()
      if (error) {
        console.error('Focus session partial insert failed:', error)
      } else {
        partialId = data.id
        if (focusHabitId) {
          const { error: logErr } = await supabase.from('habit_logs').insert({ user_id: userId, habit_id: focusHabitId })
          if (logErr) console.error('Focus habit_log insert failed:', logErr)
        }
      }
    }

    const finalRowId = partialId || sessionRowIds[sessionRowIds.length - 1]
    if (finalRowId && distractionsPayload) {
      await supabase
        .from('focus_sessions')
        .update({ distractions: distractionsPayload })
        .eq('id', finalRowId)
    }

    setSessionRowIds([])
    setCyclesDone(0)
    setElapsed(0)
    setTopic('')
    setDistractionsLog([])
    setBackburnerLog([])
    setTodos([])
    setShowTodoInput(false)
    setTodoInput('')
    setBackburnerInput('')
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
          {active && (
            <div className="flex items-center gap-2 text-xs">
              {cyclesDone > 0 && (
                <span className="text-indigo-400">{cyclesDone} done</span>
              )}
              {distractionsLog.length > 0 && (
                <span className="text-amber-400">{distractionsLog.length} distraction{distractionsLog.length !== 1 ? 's' : ''}</span>
              )}
            </div>
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
            <div className="ml-auto flex items-center gap-3 text-xs">
              {cyclesDone > 0 && (
                <span className="text-indigo-400">{cyclesDone} done</span>
              )}
              {distractionsLog.length > 0 && (
                <span className="text-amber-400">
                  {distractionsLog.length} distraction{distractionsLog.length !== 1 ? 's' : ''}
                </span>
              )}
              {backburnerLog.length > 0 && (
                <span className="text-sky-400">
                  {backburnerLog.length} backburner
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
            <p className="text-5xl font-bold text-white text-center leading-tight">
              {phase === 'break' ? 'Break' : (topic || '')}
            </p>
            <span className="text-3xl font-mono text-gray-500 tabular-nums">{displayTime}</span>
            {pomodoro && (
              <p className="text-xs text-gray-600 uppercase tracking-widest">
                {phase === 'work' ? 'Focus' : ''}
              </p>
            )}

            {phase !== 'break' && (todos.length > 0 || showTodoInput) && (
              <div className="w-full max-w-md space-y-3 mt-6">
                {todos.map(t => (
                  <div key={t.id} className="flex items-center gap-3">
                    <button
                      onClick={() => toggleTodo(t.id)}
                      className={`w-7 h-7 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        t.done ? 'bg-indigo-600 border-indigo-600' : 'border-gray-600'
                      }`}
                      aria-label={t.done ? 'Mark as not done' : 'Mark as done'}
                    >
                      {t.done && (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className={`flex-1 text-lg ${t.done ? 'line-through text-gray-500' : 'text-gray-100'}`}>
                      {t.text}
                    </span>
                    <button
                      onClick={() => removeTodo(t.id)}
                      className="text-gray-700 hover:text-gray-500 text-xl px-1"
                      aria-label="Remove task"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <input
                  type="text" autoComplete="off" data-1p-ignore data-lpignore="true" data-bwignore="true"
                  value={todoInput}
                  onChange={e => setTodoInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addTodo() }}
                  placeholder="Add a task…"
                  className="w-full bg-gray-800/60 text-white rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 text-center"
                />
              </div>
            )}
            {phase !== 'break' && todos.length === 0 && !showTodoInput && (
              <button
                onClick={() => setShowTodoInput(true)}
                className="w-full max-w-md mt-6 border-2 border-dashed border-gray-700 hover:border-gray-600 text-gray-400 hover:text-gray-300 rounded-2xl py-3 text-base font-medium transition-colors"
              >
                + Add session tasks
              </button>
            )}
          </div>

          <div className="px-6 pb-16 space-y-3">
            {phase === 'break' ? (
              <button
                onClick={() => {
                  setPhase('work')
                  startTimeRef.current = Date.now()
                  setElapsed(0)
                  setActive(true)
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl py-4 text-lg transition-colors"
              >
                Hop back in
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowDistraction(true)}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-2xl py-4 text-base transition-colors"
                >
                  Distraction
                </button>
                <button
                  onClick={() => setShowBackburner(true)}
                  className="bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-2xl py-4 text-base transition-colors"
                >
                  Backburner
                </button>
              </div>
            )}
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

      {/* Backburner sheet */}
      {showBackburner && (
        <BottomSheet title="Backburner" onClose={() => setShowBackburner(false)}>
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">
              Capture something to come back to later — without pulling yourself off task right now.
            </p>
            <textarea
              autoComplete="off" data-1p-ignore data-lpignore="true" data-bwignore="true"
              value={backburnerInput}
              onChange={e => setBackburnerInput(e.target.value)}
              rows={3}
              autoFocus
              placeholder="What's on your mind?"
              className="w-full bg-gray-800 text-white rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500 resize-none text-sm placeholder-gray-500"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={logBackburner}
                disabled={!backburnerInput.trim()}
                className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  const text = backburnerInput.trim()
                  if (!text) return
                  sendToReminders(text)
                  logBackburner()
                }}
                disabled={!backburnerInput.trim()}
                className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white font-semibold rounded-xl py-3 transition-colors text-sm"
              >
                Save + → Reminders
              </button>
            </div>
            {backburnerLog.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-gray-800">
                <p className="text-xs text-gray-500">
                  {backburnerLog.length} item{backburnerLog.length !== 1 ? 's' : ''} this session
                </p>
                {backburnerLog.map((b, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-gray-500 text-xs flex-shrink-0 pt-0.5">{b.at}</span>
                    <span className="text-gray-300 flex-1">{b.text}</span>
                    <button
                      onClick={() => sendToReminders(b.text)}
                      className="text-sky-400 hover:text-sky-300 text-xs flex-shrink-0"
                      aria-label="Send to Apple Reminders"
                    >
                      → Reminders
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </BottomSheet>
      )}

      {/* Work phase end prompt */}
      {showPhaseEnd && (
        <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col px-8">
          <div className="pt-12 pb-4 -mx-8 px-5">
            <button
              onClick={() => setShowPhaseEnd(false)}
              className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <p className="text-white text-3xl font-bold text-center">{workMins} minutes done</p>

          {/* Posture check */}
          <div className="w-full">
            <p className="text-gray-400 text-xs uppercase tracking-widest text-center mb-3">Posture check</p>
            <div className="flex gap-3">
              {[{ value: 'good', label: 'Good', color: phaseEndPosture === 'good' ? 'bg-emerald-600' : 'bg-gray-800' },
                { value: 'slouching', label: 'Slouching', color: phaseEndPosture === 'slouching' ? 'bg-amber-600' : 'bg-gray-800' }]
                .map(o => (
                  <button
                    key={o.value}
                    onClick={async () => {
                      if (phaseEndPosture) return
                      setPhaseEndPosture(o.value)
                      await supabase.from('posture_logs').insert({
                        user_id: userId,
                        outcome: o.value,
                        source:  'pomodoro',
                      })
                    }}
                    className={`flex-1 ${o.color} text-white font-medium rounded-xl py-3 transition-colors`}
                  >
                    {o.value === phaseEndPosture ? '✓ ' : ''}{o.label}
                  </button>
                ))
              }
            </div>
          </div>

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
        </div>
      )}
    </>
  )
}
