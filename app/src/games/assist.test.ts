import { describe, expect, it } from 'vitest'
import { assistFor, assistLevel, MAX_ASSIST, outcomeOf, type Outcome } from './assist'
import { getGame, listGames } from './registry'
import type { GamePlay } from './types'

const L: Outcome = 'loss'
const W: Outcome = 'win'
const D: Outcome = 'draw'

describe('assistLevel', () => {
  it('stays at normal with no rounds or a single loss', () => {
    expect(assistLevel([])).toBe(0)
    expect(assistLevel([L])).toBe(0)
  })

  it('rises from the second loss in a row, one step per further loss', () => {
    expect(assistLevel([L, L])).toBe(1)
    expect(assistLevel([L, L, L])).toBe(2)
    expect(assistLevel([L, L, L, L])).toBe(3)
  })

  it('never goes past the easiest setting', () => {
    expect(assistLevel(Array(20).fill(L))).toBe(MAX_ASSIST)
  })

  it('does not rise when losses alternate with wins', () => {
    expect(assistLevel([L, W, L, W, L, W, L])).toBe(0)
  })

  it('eases back by one for every two wins in a row', () => {
    expect(assistLevel([L, L, L, L, W])).toBe(3)
    expect(assistLevel([L, L, L, L, W, W])).toBe(2)
    expect(assistLevel([L, L, L, L, W, W, W, W])).toBe(1)
    expect(assistLevel([L, L, L, L, W, W, W, W, W, W])).toBe(0)
  })

  it('a win resets the losing streak', () => {
    expect(assistLevel([L, W, L])).toBe(0)
    expect(assistLevel([L, L, W, L])).toBe(1)
  })

  it('ignores draws', () => {
    expect(assistLevel([L, D, L])).toBe(1)
    expect(assistLevel([L, L, W, D, W])).toBe(0)
  })
})

describe('outcomeOf', () => {
  const ttt = getGame('tictactoe')!
  const snake = getGame('snake')!

  it('reads a win/draw/loss game', () => {
    expect(outcomeOf(ttt, 1)).toBe('win')
    expect(outcomeOf(ttt, 0.5)).toBe('draw')
    expect(outcomeOf(ttt, 0)).toBe('loss')
  })

  it('counts a points round under the threshold as a loss', () => {
    expect(outcomeOf(snake, 2)).toBe('loss')
    expect(outcomeOf(snake, snake.assist!.lossBelow!)).toBe('win')
  })

  it('never assists games that feed health readings or cannot be lost', () => {
    for (const g of listGames()) {
      if (g.health || !g.assist) expect(outcomeOf(g, 0)).toBeNull()
    }
    expect(getGame('reaction')!.assist).toBeUndefined()
    expect(getGame('simon-says')!.assist).toBeUndefined()
  })
})

describe('assistFor', () => {
  it('only counts this player in this game', () => {
    const ttt = getGame('tictactoe')!
    const play = (crewId: string, gameId: string, value: number): GamePlay => ({ crewId, gameId, value, day: 1, t: 0 })
    const plays = [
      play('a', 'tictactoe', 0),
      play('b', 'tictactoe', 0),
      play('a', 'connect-four', 0),
      play('a', 'tictactoe', 0),
    ]
    expect(assistFor(ttt, plays, 'a')).toBe(1)
    expect(assistFor(ttt, plays, 'b')).toBe(0)
  })
})
