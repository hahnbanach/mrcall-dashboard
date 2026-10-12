import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import DeferredCommit from '@/utils/DeferredCommit'

/** The held write behind the Undo of a decline, which the server cannot reverse: sent once when its time is
  * up, never when cancelled, at once when flushed. Seen failing on 2026-10-11 with `cancel` keeping the held
  * write (the Undo case sent it) and with `send` keeping what it sent (the expiry case and the flush case sent
  * it a second time). */

describe('a deferred commit', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('sends exactly once when its time is up, and says so', async () => {
    const run = vi.fn().mockResolvedValue('ok')
    const settled = vi.fn()
    const c = new DeferredCommit({ onSettled: settled })
    c.schedule('r1', run, 8000)
    await vi.advanceTimersByTimeAsync(7999)
    expect(run).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(run).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(20000)
    expect(run).toHaveBeenCalledTimes(1)
    expect(settled).toHaveBeenCalledWith('r1', null)
    expect(c.pending('r1')).toBe(false)
  })

  it('sends nothing when cancelled inside the window (the Undo)', async () => {
    const run = vi.fn()
    const c = new DeferredCommit()
    c.schedule('r1', run, 8000)
    expect(c.cancel('r1')).toBe(true)
    await vi.advanceTimersByTimeAsync(20000)
    expect(run).not.toHaveBeenCalled()
    expect(c.cancel('r1')).toBe(false)
  })

  it('sends everything held at once when flushed (the page is left), and not again at expiry', async () => {
    const one = vi.fn()
    const two = vi.fn()
    const c = new DeferredCommit()
    c.schedule('r1', one, 8000)
    c.schedule('r2', two, 8000)
    await c.flush()
    expect(one).toHaveBeenCalledTimes(1)
    expect(two).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(20000)
    expect(one).toHaveBeenCalledTimes(1)
    expect(two).toHaveBeenCalledTimes(1)
  })

  it('hands a refusal to onSettled, so the request can come back', async () => {
    const error = new Error('409')
    const settled = vi.fn()
    const c = new DeferredCommit({ onSettled: settled })
    c.schedule('r1', () => Promise.reject(error), 10)
    await vi.advanceTimersByTimeAsync(10)
    expect(settled).toHaveBeenCalledWith('r1', error)
  })
})
