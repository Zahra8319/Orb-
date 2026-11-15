import { describe, expect, it } from 'vitest'
import type { ReactionResult } from '../store/store'
import { gameTaps, median, memoryForDay, MIN_GAME_TAPS, reactionForDay } from './health'
import type { GamePlay } from './types'

const tap = (value: number, day = 5, crewId = 'a', gameId = 'reaction'): GamePlay => ({ crewId, gameId, value, day, t: 0 })

describe('reactionForDay', () => {
  it('needs enough taps before a game gives a reading', () => {
    const taps = Array.from({ length: MIN_GAME_TAPS - 1 }, () => tap(300))
    expect(reactionForDay([], taps, 'a', 5)).toBeUndefined()
    expect(reactionForDay([], [...taps, tap(300)], 'a', 5)).toEqual({ ms: 300, source: 'game', taps: MIN_GAME_TAPS })
  })

  it('uses the median so one odd tap does not move the reading', () => {
    const plays = [tap(250), tap(260), tap(270), tap(280), tap(900)]
    expect(reactionForDay([], plays, 'a', 5)?.ms).toBe(270)
  })

  it('drops anticipations and lapses', () => {
    const plays = [tap(40), tap(250), tap(260), tap(270), tap(280), tap(2400)]
    expect(gameTaps(plays, 'a', 5)).toEqual([250, 260, 270, 280])
    expect(reactionForDay([], plays, 'a', 5)).toBeUndefined()
  })

  it('prefers the reaction test on a day it was taken', () => {
    const tests: ReactionResult[] = [{ crewId: 'a', day: 5, ms: 312, falseStarts: 0 }]
    const plays = Array.from({ length: 6 }, () => tap(250))
    expect(reactionForDay(tests, plays, 'a', 5)).toEqual({ ms: 312, source: 'test' })
  })

  it('keeps crew members, days and games apart', () => {
    const plays = [
      ...Array.from({ length: 5 }, () => tap(250, 5, 'b')),
      ...Array.from({ length: 5 }, () => tap(250, 4)),
      ...Array.from({ length: 5 }, () => tap(250, 5, 'a', 'snake')),
    ]
    expect(reactionForDay([], plays, 'a', 5)).toBeUndefined()
  })
})

describe('memoryForDay', () => {
  it('is the longest Simon Says sequence that day', () => {
    const plays = [tap(6, 5, 'a', 'simon-says'), tap(9, 5, 'a', 'simon-says'), tap(12, 4, 'a', 'simon-says')]
    expect(memoryForDay(plays, 'a', 5)).toBe(9)
    expect(memoryForDay(plays, 'a', 3)).toBeUndefined()
  })
})

describe('median', () => {
  it('handles odd and even counts', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })
})
