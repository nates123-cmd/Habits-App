# Tick (Habits-App) — Automated QA Test Plan

Stack under test: React 18 + Vite 5 + Tailwind, Supabase JS client. Tests use
**Vitest** (jsdom env) + **@testing-library/react**. All tests import and exercise
the REAL shipped source in `src/` — no logic is re-implemented. Supabase is the only
thing mocked (network boundary), via `vi.mock('../src/lib/supabase')`.

ADDITIVE ONLY: no `src/**` or build-config changes were made.

## Risk ranking (highest first)

1. **Day-boundary / "today" window logic** (`src/lib/dateUtils.js → todayRange`,
   `thisWeekDays`). Everything that counts "today" or "this week" depends on these
   local-midnight → ISO conversions. Off-by-one here silently mis-buckets logs.
   - REAL, exported, pure → tested directly.

2. **Weekly streak computation** (`WeeklyView.buildStreak`). Counts consecutive days
   (from end of week backward) that have ≥1 log; breaks on first empty day. Classic
   spot for off-by-one / break-on-gap bugs.
   - NOT exported (inline component fn). Tested via REAL integration path: render
     `<WeeklyView>` with a mocked Supabase returning crafted `habit_logs`, then assert
     on the rendered streak. NOTE: streak value is computed but **never rendered** in
     the current JSX (see "NOT covered"), so it is exercised through `buildWeeklyRate`
     /`barDataForHabit` which share the identical day-bucketing predicate.

3. **Weekly per-day bucketing & rate** (`WeeklyView.barDataForHabit`,
   `buildWeeklyRate`). Buckets logs into 7 day-slots using `logged_at >= start && < end`
   string comparison on ISO timestamps. Tested via integration render (bars are
   rendered) — confirms each log lands in exactly one day and rate = round(days/7*100).

4. **"LTMs" days-since streak** (`TodayView` loadStreak effect): days between last log's
   local midnight and today's local midnight via `floor(diff/86400000)`. DST-sensitive
   arithmetic. NOT exported; logic re-derived in plan only — see "NOT covered". The
   underlying `Math.floor(diff/86400000)` day-delta pattern is validated indirectly by
   the `todayRange`/`thisWeekDays` boundary tests.

5. **Focus timer mm:ss formatting & partial-save gate** (`FocusTimer.fmt`,
   `persistSession` `shouldSavePartial`). NOT exported (module-private). See "NOT
   covered".

6. **Duplicate-habit merge grouping** (`src/lib/seed.js → mergeDuplicateHabits`).
   Exported, but tightly coupled to Supabase chained query builder. Tested by mocking
   the chained builder and asserting the real grouping/keep-oldest/reassign logic.

7. **Smoke**: app boots without crashing given env + mocked Supabase
   (`App.jsx` render). Validates the module graph wires together.

## What is NOT covered (and why)

- **`buildStreak` return value assertion is indirect.** The streak number computed in
  `WeeklyView.buildStreak` is dead in the current JSX (never displayed). We exercise the
  identical day-membership predicate through `buildWeeklyRate`/`barDataForHabit` which
  ARE rendered. A true unit test of `buildStreak` would require exporting it — flagged,
  not patched. (Possible REAL finding: dead code — streak never shown to user.)
- **`TodayView` LTMs days-since streak** is not unit-tested in isolation: it lives in a
  `useEffect` that fires a Supabase query and depends on `ltmsHabit` existing. It is
  covered only at the algorithm-description level here; testing it for real needs the
  effect's query path, which overlaps the smoke render. Not exported.
- **`FocusTimer.fmt`, `primeChime`, `chime`, `persistSession`** are module-private
  (not exported). The timer also relies on `setInterval`/AudioContext/`navigator.vibrate`
  — exercising the real countdown is timing-flaky and out of scope for additive unit
  tests. Documented, not tested. To unit-test the pure `fmt`/`shouldSavePartial`
  logic without flakiness, source would need to export them.
- **Supabase RLS / real network** — out of scope; the client is mocked at the boundary.
- **Service worker** (`public/sw.js`) caching/bypass behavior — not unit-testable here.
- **Playwright smoke** against `npm run dev` — omitted: dev server needs real
  `VITE_SUPABASE_*` env or `src/lib/supabase.js` throws on import, making it unreliable
  in CI/headless. The jsdom render-smoke covers "app module graph boots" instead.
