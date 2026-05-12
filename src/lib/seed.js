import { supabase } from './supabase'

export async function seedDefaultHabits(userId) {
  await supabase.rpc('seed_default_habits', { p_user_id: userId })
}

// Merges any same-name habits for the user: keeps the oldest, reassigns logs
// from duplicates to it, then deletes the duplicates.
export async function mergeDuplicateHabits(userId) {
  const { data: habits, error } = await supabase
    .from('habits')
    .select('id, name, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error || !habits) return

  const byName = new Map()
  for (const h of habits) {
    if (!byName.has(h.name)) byName.set(h.name, [])
    byName.get(h.name).push(h)
  }

  for (const group of byName.values()) {
    if (group.length <= 1) continue
    const [keep, ...remove] = group
    const removeIds = remove.map(h => h.id)
    await supabase.from('habit_logs').update({ habit_id: keep.id }).in('habit_id', removeIds)
    await supabase.from('habits').delete().in('id', removeIds)
  }
}
