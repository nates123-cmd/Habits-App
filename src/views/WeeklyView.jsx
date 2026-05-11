import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { thisWeekDays } from '../lib/dateUtils'

export default function WeeklyView({ habits, userId }) {
  const [weekLogs,        setWeekLogs]        = useState([])
  const [focusSessions,   setFocusSessions]   = useState([])
  const weekDays = thisWeekDays()

  useEffect(() => {
    if (!userId) return
    const start = weekDays[0].start
    const end   = weekDays[6].end

    async function load() {
      const [{ data: logs }, { data: sessions }] = await Promise.all([
        supabase.from('habit_logs').select('*').gte('logged_at', start).lt('logged_at', end),
        supabase.from('focus_sessions').select('*').eq('completed', true).gte('started_at', start).lt('started_at', end),
      ])
      if (logs)     setWeekLogs(logs)
      if (sessions) setFocusSessions(sessions)
    }
    load()
  }, [userId])

  const reduceHabits = habits.filter(h => h.type === 'reduce')
  const buildHabits  = habits.filter(h => h.type === 'build')

  function barDataForHabit(habit) {
    return weekDays.map(day => ({
      label: day.label,
      count: weekLogs.filter(l =>
        l.habit_id === habit.id &&
        l.logged_at >= day.start &&
        l.logged_at < day.end
      ).length,
    }))
  }

  function moodBreakdown(habitId) {
    const relevant = weekLogs.filter(l => l.habit_id === habitId && l.mood)
    const counts = {}
    relevant.forEach(l => { counts[l.mood] = (counts[l.mood] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }

  function activityBreakdown(habitId) {
    const relevant = weekLogs.filter(l => l.habit_id === habitId && l.activity)
    const counts = {}
    relevant.forEach(l => { counts[l.activity] = (counts[l.activity] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }

  function typeBreakdown(habitId) {
    const relevant = weekLogs.filter(l => l.habit_id === habitId && l.notes)
    const counts = {}
    relevant.forEach(l => { const t = l.notes.split('\n')[0]; counts[t] = (counts[t] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }

  function buildStreak(habitId) {
    let streak = 0
    for (let i = weekDays.length - 1; i >= 0; i--) {
      const day = weekDays[i]
      const hasLog = weekLogs.some(
        l => l.habit_id === habitId && l.logged_at >= day.start && l.logged_at < day.end
      )
      if (hasLog) streak++; else break
    }
    return streak
  }

  function buildWeeklyRate(habitId) {
    const daysWithLog = weekDays.filter(day =>
      weekLogs.some(l => l.habit_id === habitId && l.logged_at >= day.start && l.logged_at < day.end)
    ).length
    return Math.round((daysWithLog / 7) * 100)
  }

  const totalFocusMinutes = focusSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0)

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold text-white">This Week</h2>

      {/* Focus summary */}
      <section className="bg-gray-800 rounded-2xl p-5">
        <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Focus</p>
        <div className="flex gap-6">
          <div>
            <p className="text-3xl font-bold text-indigo-400">{(totalFocusMinutes / 60).toFixed(1)}h</p>
            <p className="text-xs text-gray-500 mt-0.5">Total this week</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-indigo-400">{focusSessions.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Sessions</p>
          </div>
        </div>
      </section>

      {/* Reduce habits */}
      {reduceHabits.length > 0 && (
        <section>
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-4">Reduce</p>
          <div className="space-y-6">
            {reduceHabits.map(h => {
              const data = barDataForHabit(h)
              const moods = moodBreakdown(h.id)
              const acts  = activityBreakdown(h.id)
              return (
                <div key={h.id} className="bg-gray-800 rounded-2xl p-4">
                  <p className="text-white font-medium mb-3">{h.name}</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={data} barSize={20}>
                      <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis hide allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8 }}
                        labelStyle={{ color: '#d1d5db' }}
                        itemStyle={{ color: '#f87171' }}
                        cursor={{ fill: '#374151' }}
                      />
                      <Bar dataKey="count" radius={4}>
                        {data.map((entry, i) => (
                          <Cell key={i} fill={entry.count > 0 ? '#f87171' : '#374151'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {(() => {
                    const types = h.name === 'BFRB' ? typeBreakdown(h.id) : []
                    return (moods.length > 0 || acts.length > 0 || types.length > 0) && (
                      <div className="mt-3 flex gap-4 flex-wrap">
                        {types.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Type</p>
                            {types.map(([t, c]) => (
                              <p key={t} className="text-sm text-gray-300 capitalize">{t} <span className="text-gray-500">×{c}</span></p>
                            ))}
                          </div>
                        )}
                        {moods.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Top moods</p>
                            {moods.slice(0, 3).map(([m, c]) => (
                              <p key={m} className="text-sm text-gray-300 capitalize">{m} <span className="text-gray-500">×{c}</span></p>
                            ))}
                          </div>
                        )}
                        {acts.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Top activities</p>
                            {acts.slice(0, 3).map(([a, c]) => (
                              <p key={a} className="text-sm text-gray-300 capitalize">{a} <span className="text-gray-500">×{c}</span></p>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        </section>
      )}

    </div>
  )
}
