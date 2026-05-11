// Returns ISO strings for start and end of today (local time)
export function todayRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end   = new Date(start.getTime() + 86400000)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date instanceof Date ? date : new Date(date))
}

// Returns array of 7 {label, start, end} objects for Mon–Sun this week
export function thisWeekDays() {
  const today = new Date()
  const dow = today.getDay() // 0=Sun
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((dow + 6) % 7))
  monday.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const next = new Date(d)
    next.setDate(d.getDate() + 1)
    return {
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      date: d,
      start: d.toISOString(),
      end: next.toISOString(),
    }
  })
}
