# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server (Vite)
npm run build     # production build
npm run preview   # preview production build locally
npm run lint      # ESLint (zero warnings policy)
```

There is no test suite.

## Environment

Copy `.env.example` to `.env` and fill in:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Architecture

Single-page React app (Vite + Tailwind) backed entirely by Supabase (auth + database). No router — view state is managed with a `useState('today' | 'weekly' | 'history')` in `App.jsx`.

**Data flow:** `App.jsx` owns the top-level data fetching via three hooks (`useAuth`, `useHabits`, `useTodayLogs`) and passes data down to views as props. Views call Supabase directly for mutations, then call `onRefresh()` to trigger a re-fetch in the parent.

**Habit model:** Each habit has a `type` (`reduce` | `build`) and a `tracking` mode (`instance` | `count` | `checkbox`). "Reduce" habits track occurrences you want to decrease; "build" habits are checkbox-style. Habits with `has_context: true` open a `LogContextSheet` on tap to capture mood and activity alongside the log entry.

**Focus timer** (`FocusTimer.jsx`) is a special case: it writes to the `focus_sessions` table (not `habit_logs`) and auto-checks the "Focus" build habit on session completion. It supports an optional Pomodoro mode (25/5 min).

**Views:**
- `TodayView` — log habits for today; reduce habits show a tap counter, build habits show a toggle checkbox
- `WeeklyView` — read-only stats; reduce habits render Recharts bar charts with mood/activity breakdowns; build habits show streak and weekly completion rate
- `HistoryView` — historical log data

**Database schema** is in `supabase/schema.sql`. All three tables (`habits`, `habit_logs`, `focus_sessions`) have RLS enabled — every query is automatically scoped to `auth.uid()`. Default habits are seeded via a Supabase SQL function `seed_default_habits()` called client-side after first login (`src/lib/seed.js`).

**Date handling:** All date range queries use local-time ISO strings from `src/lib/dateUtils.js`. `todayRange()` and `thisWeekDays()` both produce `{ start, end }` pairs used in Supabase `.gte()` / `.lt()` filters.
