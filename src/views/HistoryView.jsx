import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 20

export default function HistoryView({ habits, userId }) {
  const visibleHabits = habits.filter(h => h.type !== 'build' || h.name === 'Focus')
  const [selectedId,  setSelectedId]  = useState(visibleHabits[0]?.id || null)
  const [logs,        setLogs]        = useState([])
  const [focusSessions, setFocusSessions] = useState([])
  const [page,        setPage]        = useState(0)
  const [hasMore,     setHasMore]     = useState(false)
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')
  const [totalFocusMinutes, setTotalFocusMinutes] = useState(0)

  const selectedHabit = habits.find(h => h.id === selectedId)
  const isFocus = selectedHabit?.name === 'Focus'

  useEffect(() => {
    if (!selectedId) return
    setPage(0)
    setLogs([])
  }, [selectedId, dateFrom, dateTo])

  useEffect(() => {
    if (!selectedId) return
    fetchLogs()
  }, [selectedId, page, dateFrom, dateTo])

  useEffect(() => {
    if (isFocus) fetchFocusSessions()
  }, [isFocus, userId])

  async function fetchLogs() {
    let q = supabase
      .from('habit_logs')
      .select('*')
      .eq('habit_id', selectedId)
      .order('logged_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

    if (dateFrom) q = q.gte('logged_at', new Date(dateFrom).toISOString())
    if (dateTo)   q = q.lt('logged_at', new Date(new Date(dateTo).getTime() + 86400000).toISOString())

    const { data } = await q
    if (data) {
      setLogs(prev => page === 0 ? data : [...prev, ...data])
      setHasMore(data.length === PAGE_SIZE + 1)
    }
  }

  async function fetchFocusSessions() {
    const { data } = await supabase
      .from('focus_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', true)
      .order('started_at', { ascending: false })
    if (data) {
      setFocusSessions(data)
      setTotalFocusMinutes(data.reduce((sum, s) => sum + (s.duration_minutes || 0), 0))
    }
  }

  function moodDist() {
    const counts = {}
    logs.forEach(l => { if (l.mood) counts[l.mood] = (counts[l.mood] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }

  function actDist() {
    const counts = {}
    logs.forEach(l => { if (l.activity) counts[l.activity] = (counts[l.activity] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }

  function typeDist() {
    const counts = {}
    logs.forEach(l => { if (l.notes) counts[l.notes] = (counts[l.notes] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">History</h2>

      {/* Habit selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {visibleHabits.map(h => (
          <button
            key={h.id}
            onClick={() => setSelectedId(h.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedId === h.id
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {h.name}
          </button>
        ))}
      </div>

      {/* Date filters */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-gray-500 block mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="w-full bg-gray-800 text-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 block mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="w-full bg-gray-800 text-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Focus sessions history */}
      {isFocus && (
        <div className="bg-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-3">All-time: <span className="text-indigo-400 font-semibold">{(totalFocusMinutes / 60).toFixed(1)}h</span> across <span className="text-indigo-400 font-semibold">{focusSessions.length}</span> sessions</p>
          <div className="space-y-3">
            {focusSessions.map(s => (
              <div key={s.id} className="border-b border-gray-700 pb-3 last:border-0">
                <div className="flex justify-between items-start">
                  <p className="text-white text-sm font-medium">{s.what_worked_on}</p>
                  <p className="text-indigo-400 text-sm font-semibold ml-3">{s.duration_minutes}m</p>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(s.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                {s.distractions && (() => {
                  try {
                    const d = JSON.parse(s.distractions)
                    return (
                      <div className="mt-1 space-y-0.5">
                        {d.logs?.map((l, i) => (
                          <p key={i} className="text-xs text-gray-500">
                            <span className="text-amber-500/70">{l.at}</span>
                            {l.text && ` — ${l.text}`}
                            {l.mood && <span className="text-yellow-600/70"> · {l.mood}</span>}
                            {l.activity && <span className="text-blue-600/70"> · {l.activity}</span>}
                          </p>
                        ))}
                        {d.note && <p className="text-xs text-gray-600 italic">{d.note}</p>}
                      </div>
                    )
                  } catch {
                    return <p className="text-xs text-gray-500 mt-0.5">Distractions: {s.distractions}</p>
                  }
                })()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regular habit logs */}
      {!isFocus && (
        <>
          {/* Mood/activity distribution */}
          {selectedHabit?.type === 'reduce' && logs.length > 0 && (
            <div className="flex gap-6 flex-wrap">
              {selectedHabit?.name === 'BFRB' && typeDist().length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Type</p>
                  {typeDist().map(([t, c]) => (
                    <p key={t} className="text-sm text-gray-300 capitalize">{t} <span className="text-gray-500">×{c}</span></p>
                  ))}
                </div>
              )}
              {moodDist().length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Mood</p>
                  {moodDist().map(([m, c]) => (
                    <p key={m} className="text-sm text-gray-300 capitalize">{m} <span className="text-gray-500">×{c}</span></p>
                  ))}
                </div>
              )}
              {actDist().length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Activity</p>
                  {actDist().map(([a, c]) => (
                    <p key={a} className="text-sm text-gray-300 capitalize">{a} <span className="text-gray-500">×{c}</span></p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            {logs.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-8">No logs yet</p>
            )}
            {logs.map(l => (
              <div key={l.id} className="bg-gray-800 rounded-xl px-4 py-3 text-sm">
                <div className="flex justify-between items-start">
                  <p className="text-gray-300">
                    {new Date(l.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                    <span className="text-gray-500 text-xs">
                      {new Date(l.logged_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </p>
                  <div className="flex gap-2 text-xs text-right">
                    {l.mood     && <span className="text-yellow-400 capitalize">{l.mood}</span>}
                    {l.activity && <span className="text-blue-400 capitalize">{l.activity}</span>}
                  </div>
                </div>
                {l.notes && <p className="text-gray-500 text-xs mt-1">{l.notes}</p>}
              </div>
            ))}
          </div>

          {hasMore && (
            <button
              onClick={() => setPage(p => p + 1)}
              className="w-full py-3 text-sm text-indigo-400 hover:text-indigo-300"
            >
              Load more
            </button>
          )}
        </>
      )}
    </div>
  )
}
