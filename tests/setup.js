import '@testing-library/jest-dom'
import { vi } from 'vitest'

// jsdom doesn't implement these; some components reference them.
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
  })
}
if (!navigator.vibrate) navigator.vibrate = vi.fn()
