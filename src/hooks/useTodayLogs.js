import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { todayRange } from '../lib/dateUtils'

export function useTodayLogs(userId) {
  const [logs, setLogs] = useState([])

  const fetchLogs = useCallback(async () => {
    if (!userId) return
    const { start, end } = todayRange()
    const { data, error } = await supabase
      .from('habit_logs')
      .select('*')
      .gte('logged_at', start)
      .lt('logged_at', end)
    if (!error) setLogs(data)
  }, [userId])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // Count logs per habit for today
  const countForHabit = (habitId) =>
    logs.filter(l => l.habit_id === habitId).length

  return { logs, refetch: fetchLogs, countForHabit }
}
