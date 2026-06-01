import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// Smoke: the REAL App module graph boots without crashing, given a mocked
// Supabase auth/query boundary. Validates App -> hooks -> views wiring imports
// resolve and the unauthenticated path renders the real LoginScreen.

vi.mock('../src/lib/supabase.js', () => {
  const noData = () => Promise.resolve({ data: [], error: null })
  function query() {
    const q = {
      select() { return this },
      eq() { return this },
      order() { return this },
      gte() { return this },
      lt() { return this },
      limit() { return noData() },
      then(resolve) { return noData().then(resolve) }, // thenable terminal
    }
    return q
  }
  return {
    supabase: {
      from: () => query(),
      rpc: () => Promise.resolve({ data: null, error: null }),
      auth: {
        getSession: () => Promise.resolve({ data: { session: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signInWithOtp: () => Promise.resolve({ error: null }),
        verifyOtp: () => Promise.resolve({ data: {}, error: null }),
      },
    },
  }
})

import App from '../src/App.jsx'

afterEach(() => vi.clearAllMocks())

describe('App smoke', () => {
  it('boots and renders the login screen when unauthenticated (no crash)', async () => {
    render(<App />)
    // useAuth resolves session=null -> App returns <LoginScreen/>. Wait past the
    // initial loading spinner.
    await waitFor(() => {
      // LoginScreen should render *something* interactive (an input or button).
      const hasInput = document.querySelector('input, button')
      expect(hasInput).toBeTruthy()
    })
  })
})
