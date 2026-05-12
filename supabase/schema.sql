-- ============================================================
-- Habits App — Supabase Schema + RLS
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID extension (already on by default in Supabase)
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

create type habit_type as enum ('reduce', 'build');
create type habit_tracking as enum ('instance', 'count', 'checkbox');

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists habits (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  type         habit_type not null,
  tracking     habit_tracking not null,
  has_context  boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists habit_logs (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  habit_id   uuid not null references habits(id) on delete cascade,
  logged_at  timestamptz not null default now(),
  mood       text check (mood in ('bored', 'anxious', 'tired', 'fine', 'focused')),
  activity   text check (activity in ('driving', 'phone', 'working', 'working out', 'TV', 'other')),
  notes      text,
  outcome    text check (outcome in ('acted', 'caught_mid', 'urge_only')),
  source     text default 'tick',
  log_date   date
);

create table if not exists focus_sessions (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  started_at        timestamptz not null default now(),
  duration_minutes  int,
  what_worked_on    text not null default '',
  distractions      text,
  completed         boolean not null default false,
  log_date          date,
  source            text default 'tick'
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists habit_logs_user_habit_idx on habit_logs(user_id, habit_id);
create index if not exists habit_logs_logged_at_idx   on habit_logs(logged_at desc);
create index if not exists focus_sessions_user_idx    on focus_sessions(user_id, started_at desc);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

alter table habits         enable row level security;
alter table habit_logs     enable row level security;
alter table focus_sessions enable row level security;

-- habits
create policy "habits: select own"  on habits for select using (auth.uid() = user_id);
create policy "habits: insert own"  on habits for insert with check (auth.uid() = user_id);
create policy "habits: update own"  on habits for update using (auth.uid() = user_id);
create policy "habits: delete own"  on habits for delete using (auth.uid() = user_id);

-- habit_logs
create policy "habit_logs: select own"  on habit_logs for select using (auth.uid() = user_id);
create policy "habit_logs: insert own"  on habit_logs for insert with check (auth.uid() = user_id);
create policy "habit_logs: update own"  on habit_logs for update using (auth.uid() = user_id);
create policy "habit_logs: delete own"  on habit_logs for delete using (auth.uid() = user_id);

-- focus_sessions
create policy "focus: select own"  on focus_sessions for select using (auth.uid() = user_id);
create policy "focus: insert own"  on focus_sessions for insert with check (auth.uid() = user_id);
create policy "focus: update own"  on focus_sessions for update using (auth.uid() = user_id);
create policy "focus: delete own"  on focus_sessions for delete using (auth.uid() = user_id);

-- ============================================================
-- SEED FUNCTION  (called client-side after first login)
-- Creates default habits for a user if they have none yet.
-- ============================================================

create or replace function seed_default_habits(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Only seed if the user has no habits yet
  if exists (select 1 from habits where user_id = p_user_id) then
    return;
  end if;

  insert into habits (user_id, name, type, tracking, has_context) values
    -- Reduce habits
    (p_user_id, 'BFRB',           'reduce', 'instance', true),
    -- Build habits
    (p_user_id, 'Gym',            'build',  'checkbox', false),
    (p_user_id, 'Healthy Eating', 'build',  'checkbox', false),
    (p_user_id, 'Meditate',       'build',  'checkbox', false),
    (p_user_id, 'Focus',          'build',  'checkbox', false);
end;
$$;

-- Grant execute to authenticated users
grant execute on function seed_default_habits(uuid) to authenticated;
