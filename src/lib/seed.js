import { supabase } from './supabase'

export async function seedDefaultHabits(userId) {
  await supabase.rpc('seed_default_habits', { p_user_id: userId })
}
