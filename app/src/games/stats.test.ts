import { describe, expect, it } from 'vitest'
import { getGame, listGames } from './registry'
import { summarize } from './stats'
import type { GamePlay } from './types'

const plays = (gameId: string, values: number[]): GamePlay[] =>
  values.map((value) => ({ crewId: 'a', gameId, value, day: 1, t: 0 }))

describe('summarize', () => {
  it('says when a game has not been played', () => {
    expect(summarize(getGame('snake')!, [])).toBe('Not played yet')
  })
  it('shows the best for higher-is-better and lower-is-better games', () => {
    expect(summarize(getGame('snake')!, plays('snake', [3, 12, 7]))).toBe('Best 12 points')
    expect(summarize(getGame('memory')!, plays('memory', [20, 14, 18]))).toBe('Best 14 moves')
    expect(summarize(getGame('reaction')!, plays('reaction', [310, 255]))).toBe('Best 255 ms')
  })
  it('shows a win record and puzzles solved', () => {
    expect(summarize(getGame('tictactoe')!, plays('tictactoe', [1, 0, 0.5, 1]))).toBe('Won 2 of 4')
    expect(summarize(getGame('lights-out')!, plays('lights-out', [1, 1, 1]))).toBe('3 solved')
  })
})

describe('catalog', () => {
  it('gives every game rules and a scoring format', () => {
    for (const g of listGames()) {
      expect(g.rules.length).toBeGreaterThan(1)
      expect(g.scoring.format).toContain('{v}')
    }
  })
})
