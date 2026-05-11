import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useHabits(userId) {
  const [habits, setHabits] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchHabits = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .order('created_at', { ascending: true })
    if (!error) setHabits(data)
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchHabits() }, [fetchHabits])

  return { habits, loading, refetch: fetchHabits }
}
