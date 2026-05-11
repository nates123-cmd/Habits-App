import { useState } from 'react'
import BottomSheet from './BottomSheet'
import { supabase } from '../lib/supabase'

const MOODS      = ['bored', 'anxious', 'tired', 'fine', 'focused']
const ACTIVITIES = ['phone', 'working', 'TV', 'other']
const LOCATIONS  = ['nose', 'finger', 'face']

export default function LogContextSheet({ habit, userId, onDone, onClose }) {
  const [location, setLocation] = useState('')
  const [mood, setMood]         = useState('')
  const [activity, setActivity] = useState('')
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)

  const isBFRB = habit.name === 'BFRB'

  async function handleLog() {
    setSaving(true)
    await supabase.from('habit_logs').insert({
      user_id:  userId,
      habit_id: habit.id,
      mood:     mood || null,
      activity: activity || null,
      notes:    isBFRB ? (location || null) : (notes || null),
    })
    setSaving(false)
    onDone()
  }

  return (
    <BottomSheet title={`Log — ${habit.name}`} onClose={onClose}>
      <div className="space-y-5">
        {isBFRB && (
          <div>
            <p className="text-gray-400 text-sm mb-2">Type</p>
            <div className="flex gap-2">
              {LOCATIONS.map(l => (
                <button
                  key={l}
                  onClick={() => setLocation(location === l ? '' : l)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                    location === l
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-gray-400 text-sm mb-2">Mood</p>
          <div className="flex gap-2 flex-wrap">
            {MOODS.map(m => (
              <button
                key={m}
                onClick={() => setMood(mood === m ? '' : m)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                  mood === m
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-gray-400 text-sm mb-2">Activity</p>
          <div className="flex gap-2 flex-wrap">
            {ACTIVITIES.map(a => (
              <button
                key={a}
                onClick={() => setActivity(activity === a ? '' : a)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                  activity === a
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {!isBFRB && (
          <div>
            <p className="text-gray-400 text-sm mb-2">Notes (optional)</p>
            <textarea autoComplete="off" data-1p-ignore data-lpignore="true" data-bwignore="true"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-gray-800 text-white rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-sm placeholder-gray-500"
              placeholder="Anything else?"
            />
          </div>
        )}

        <button
          onClick={handleLog}
          disabled={saving || (isBFRB && !location)}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition-colors"
        >
          {saving ? 'Logging…' : 'Log it'}
        </button>
      </div>
    </BottomSheet>
  )
}
