# Tick — Spec

Tick is the behavioral / habit-tracking app in the personal-OS suite (repo `Habits-App`,
live at https://nates123-cmd.github.io/Habits-App/). It is a single-page React + Vite +
Tailwind PWA backed entirely by Supabase. Architecture and data flow are documented in
`CLAUDE.md`; this file captures product behavior and the rolling change log.

## Core surfaces

- **Today** — log habits for the day. Reduce habits show a tap counter; build habits a
  checkbox. `has_context` habits open `LogContextSheet` for mood/activity/outcome.
- **Weekly** — read-only stats and charts.
- **History** — historical log data.
- **Focus Session** (`FocusTimer.jsx`) — a timer (optional 25/5 Pomodoro) that writes to
  `focus_sessions` and auto-checks the "Focus" build habit. During a session the user can:
  - log a **Distraction** (what pulled them away + mood + notes),
  - capture a **Backburner** note (park a thought without leaving the task; optionally push
    it to Apple Reminders via the `Add Tick Reminder` iOS Shortcut),
  - add lightweight **session tasks** (a transient checklist, not persisted as habits).

### Apple Reminders integration

`sendToReminders(text)` opens `shortcuts://run-shortcut?name=Add Tick Reminder&input=text&text=…`.
The user sets up an iOS Shortcut named exactly **Add Tick Reminder** that takes the Shortcut
Input as the reminder title. Because the deeplink navigates away from the PWA, items are
pushed **one deeplink at a time**; the PWA state survives the round-trip so the user returns
and continues.

## Change log

### 2026-05-15 — Tick fixes (3)

1. **Push backburner to Reminders at end of session (opt-in).**
   Previously backburner items could only be pushed to Reminders per-item, mid-session.
   Now, when a session ends *and there are backburner items*, an end-of-session wrap screen
   appears offering to push them to Apple Reminders before finishing:
   - per-item `→ Reminders` buttons (mark `✓ Sent` once tapped),
   - a `Send all → Reminders` button (joins items newline-separated into a single Shortcut
     input — the `Add Tick Reminder` shortcut can be configured to split lines into multiple
     reminders; with the default single-reminder shortcut it creates one combined reminder),
   - a `Done` button to finalize.
   Scope is **backburner items only** (per decision) — distractions and unfinished session
   tasks are not offered. When there are no backburner items the session ends immediately,
   exactly as before (the prior "skip wrap sheet on early end" behavior is preserved for the
   common case; the wrap is strictly conditional). Session persistence to Supabase happens
   before the wrap, so the session is saved even if the user backgrounds the app while the
   Shortcut runs.

2. **New app icon.** Replaced the generic white-checkmark icon with a **stopwatch + tick**
   mark (white stopwatch ring with crown/button and a checkmark inside, on the indigo
   `#4F46E5` rounded square), tying the icon to the focus-session core. `public/icon.svg`
   only; referenced unchanged by `index.html` and `manifest.json`.
   **Name:** kept as **Tick** for now — a rename is deferred (decided "later"). Repo stays
   `Habits-App` regardless.

3. **"App dev" distraction.** Added `App dev` to the focus-session distraction activity
   list (`ACTIVITIES` in `FocusTimer.jsx`), before `Other`.
