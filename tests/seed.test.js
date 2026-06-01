import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase client module BEFORE importing the code under test.
// seed.js imports `supabase` from ./supabase, which would otherwise throw on
// missing env. We replace it with a chainable test double and capture calls.
const calls = { updates: [], deletes: [], selectResult: null }

vi.mock('../src/lib/supabase.js', () => {
  function makeQuery(table) {
    // habits select chain: .select(...).eq(...).order(...) -> resolves to {data,error}
    const selectChain = {
      select() { return this },
      eq() { return this },
      order() { return Promise.resolve(calls.selectResult) },
    }
    // habit_logs update chain: .update(...).in(...)
    const updateChain = (payload) => ({
      in(col, ids) {
        calls.updates.push({ table, payload, ids })
        return Promise.resolve({ error: null })
      },
    })
    // delete chain: .delete().in(...)
    const deleteChain = () => ({
      in(col, ids) {
        calls.deletes.push({ table, ids })
        return Promise.resolve({ error: null })
      },
    })
    return {
      select: selectChain.select.bind(selectChain),
      eq: selectChain.eq.bind(selectChain),
      order: selectChain.order.bind(selectChain),
      update: (payload) => updateChain(payload),
      delete: () => deleteChain(),
    }
  }
  return { supabase: { from: (table) => makeQuery(table) } }
})

import { mergeDuplicateHabits } from '../src/lib/seed.js'

beforeEach(() => {
  calls.updates = []
  calls.deletes = []
  calls.selectResult = null
})

describe('mergeDuplicateHabits() — REAL grouping logic', () => {
  it('does nothing when there are no duplicates', async () => {
    calls.selectResult = {
      data: [
        { id: 'a', name: 'BFRB', created_at: '2026-01-01' },
        { id: 'b', name: 'LTMs', created_at: '2026-01-02' },
      ],
      error: null,
    }
    await mergeDuplicateHabits('user1')
    expect(calls.updates).toHaveLength(0)
    expect(calls.deletes).toHaveLength(0)
  })

  it('keeps the OLDEST (first by created_at asc) and reassigns logs + deletes the rest', async () => {
    // Source relies on the query ordering by created_at asc; first in group = keep.
    calls.selectResult = {
      data: [
        { id: 'keep', name: 'LTMs', created_at: '2026-01-01' },
        { id: 'dup1', name: 'LTMs', created_at: '2026-02-01' },
        { id: 'dup2', name: 'LTMs', created_at: '2026-03-01' },
      ],
      error: null,
    }
    await mergeDuplicateHabits('user1')
    // logs reassigned to the kept id, for the duplicate ids
    expect(calls.updates).toHaveLength(1)
    expect(calls.updates[0].payload).toEqual({ habit_id: 'keep' })
    expect(calls.updates[0].ids).toEqual(['dup1', 'dup2'])
    // duplicates deleted
    expect(calls.deletes).toHaveLength(1)
    expect(calls.deletes[0].ids).toEqual(['dup1', 'dup2'])
  })

  it('handles multiple distinct duplicate groups independently', async () => {
    calls.selectResult = {
      data: [
        { id: 'l1', name: 'LTMs', created_at: '2026-01-01' },
        { id: 'b1', name: 'BFRB', created_at: '2026-01-02' },
        { id: 'l2', name: 'LTMs', created_at: '2026-01-03' },
        { id: 'b2', name: 'BFRB', created_at: '2026-01-04' },
      ],
      error: null,
    }
    await mergeDuplicateHabits('user1')
    expect(calls.updates).toHaveLength(2)
    const byKeep = Object.fromEntries(calls.updates.map(u => [u.payload.habit_id, u.ids]))
    expect(byKeep['l1']).toEqual(['l2'])
    expect(byKeep['b1']).toEqual(['b2'])
    expect(calls.deletes).toHaveLength(2)
  })

  it('returns early on a query error without touching update/delete', async () => {
    calls.selectResult = { data: null, error: { message: 'boom' } }
    await mergeDuplicateHabits('user1')
    expect(calls.updates).toHaveLength(0)
    expect(calls.deletes).toHaveLength(0)
  })
})
