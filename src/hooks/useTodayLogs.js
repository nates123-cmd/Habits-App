import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { todayRange } from '../lib/dateUtils'

export function useTodayLogs(userId) {
  const [logs,        setLogs]        = useState([])
  const [postureLogs, setPostureLogs] = useState([])

  const fetchLogs = useCallback(async () => {
    if (!userId) return
    const { start, end } = todayRange()
    const todayDate = new Date().toISOString().slice(0, 10)
    const [habitRes, postureRes] = await Promise.all([
      supabase.from('habit_logs').select('*').gte('logged_at', start).lt('logged_at', end),
      supabase.from('posture_logs').select('outcome').eq('log_date', todayDate),
    ])
    if (!habitRes.error)   setLogs(habitRes.data)
    if (!postureRes.error) setPostureLogs(postureRes.data || [])
  }, [userId])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // Count logs per habit for today
  const countForHabit = (habitId) =>
    logs.filter(l => l.habit_id === habitId).length

  const postureCounts = {
    good:      postureLogs.filter(p => p.outcome === 'good').length,
    slouching: postureLogs.filter(p => p.outcome === 'slouching').length,
  }

  return { logs, postureLogs, postureCounts, refetch: fetchLogs, countForHabit }
}
