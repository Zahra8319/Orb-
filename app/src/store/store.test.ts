import { beforeEach, describe, expect, it } from 'vitest'
import { commsDelaySec } from '../sim/mission'
import { STORE_KEY, useStore } from './store'

const saved = () => JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as { state: Record<string, unknown> } | null

describe('saved demo', () => {
  beforeEach(() => {
    useStore.getState().resetDemo()
  })

  it('saves results and game rounds so a reload keeps them', () => {
    useStore.getState().addReaction(287, 1)
    useStore.getState().addGamePlay('snake', 12, 'Score 12')
    const state = saved()!.state
    expect(state.reactions).toEqual([expect.objectContaining({ ms: 287, falseStarts: 1 })])
    expect(state.gamePlays).toEqual([expect.objectContaining({ gameId: 'snake', value: 12 })])
  })

  it('restores what was saved', async () => {
    useStore.getState().addGamePlay('merge', 900)
    const snapshot = localStorage.getItem(STORE_KEY)!
    useStore.getState().resetDemo()
    expect(useStore.getState().gamePlays).toHaveLength(0)
    localStorage.setItem(STORE_KEY, snapshot)
    await useStore.persist.rehydrate()
    expect(useStore.getState().gamePlays).toEqual([expect.objectContaining({ gameId: 'merge', value: 900 })])
  })

  it('does not save who is signed in, which the session owns', () => {
    useStore.getState().setCrew('lindqvist')
    expect(saved()!.state).not.toHaveProperty('crewId')
  })

  it('reset demo clears the saved results too', () => {
    useStore.getState().addReaction(300, 0)
    useStore.getState().resetDemo()
    expect(saved()!.state.reactions).toEqual([])
  })
})

describe('Mission Control messages', () => {
  beforeEach(() => {
    useStore.getState().resetDemo()
  })

  it('reach the crew member after the one-way radio delay, not instantly', () => {
    const { t } = useStore.getState()
    useStore.getState().sendAdminMessage('Please log your dose after the storm.', 'reyes')
    const sent = useStore.getState().messages.at(-1)!
    expect(sent).toMatchObject({ crewId: 'reyes', from: 'admin', sentAt: t })
    expect(sent.arrivesAt).toBeCloseTo(t + commsDelaySec(t) / 60)
    expect(sent.arrivesAt).toBeGreaterThan(t)
  })

  it('ignores an empty message', () => {
    const before = useStore.getState().messages.length
    useStore.getState().sendAdminMessage('   ', 'reyes')
    expect(useStore.getState().messages).toHaveLength(before)
  })
})
