import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginScreen() {
  const [email, setEmail]   = useState('')
  const [code, setCode]     = useState('')
  const [sent, setSent]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)

  async function handleSend(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email })
    setLoading(false)
    if (error) { setError(error.message) } else { setSent(true) }
  }

  async function handleVerify(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    setLoading(false)
    if (error) { setError(error.message) }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-white mb-2 text-center">Tick</h1>
        <p className="text-gray-400 text-center mb-8 text-sm">Track what you want to build and reduce.</p>

        {!sent ? (
          <form onSubmit={handleSend} className="space-y-4">
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition-colors"
            >
              {loading ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <p className="text-gray-400 text-sm text-center">
              Enter the 6-digit code sent to <span className="text-white">{email}</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              placeholder="000000"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 text-center text-2xl tracking-widest"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition-colors"
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => { setSent(false); setCode(''); setError(null) }}
              className="w-full text-gray-500 text-sm py-2"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
