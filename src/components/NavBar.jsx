import { supabase } from '../lib/supabase'

const VIEWS = [
  { id: 'today',   label: 'Today' },
  { id: 'weekly',  label: 'Weekly' },
  { id: 'history', label: 'History' },
]

export default function NavBar({ view, setView }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-gray-900 border-t border-gray-800 flex items-center justify-around px-2 pb-safe z-40">
      {VIEWS.map(v => (
        <button
          key={v.id}
          onClick={() => setView(v.id)}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            view === v.id ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {v.label}
        </button>
      ))}
      <button
        onClick={() => supabase.auth.signOut()}
        className="flex-1 py-3 text-sm font-medium text-gray-600 hover:text-gray-400 transition-colors"
      >
        Sign out
      </button>
    </nav>
  )
}
