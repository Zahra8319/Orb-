import type { ReactionResult } from '../store/store'
import { listGames } from './registry'
import type { GamePlay } from './types'

/**
 * How game results reach Sleep and mind.
 *
 * Reaction: the reaction test on Sleep and mind is the calibrated measure, so on a
 * day it was taken it wins. Otherwise, once a crew member has made at least
 * MIN_GAME_TAPS taps in Reaction Rush that day, the median tap stands in for it.
 * The median keeps one lucky or distracted tap from moving the reading, and taps
 * outside 100 to 1500 ms are dropped: faster is anticipation, slower is not a reaction.
 *
 * Memory: the longest Simon Says sequence of the day.
 */

export const MIN_GAME_TAPS = 5
const TAP_MIN_MS = 100
const TAP_MAX_MS = 1500

const idsFor = (kind: 'reaction' | 'memory') =>
  new Set(listGames().filter((g) => g.health === kind).map((g) => g.id))

const REACTION_GAMES = idsFor('reaction')
const MEMORY_GAMES = idsFor('memory')

export type DayReaction =
  | { ms: number; source: 'test' }
  | { ms: number; source: 'game'; taps: number }

export function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Today's usable Reaction Rush taps for one crew member. */
export function gameTaps(plays: readonly GamePlay[], crewId: string, day: number): number[] {
  return plays
    .filter((p) => p.crewId === crewId && p.day === day && REACTION_GAMES.has(p.gameId))
    .map((p) => p.value)
    .filter((ms) => ms >= TAP_MIN_MS && ms <= TAP_MAX_MS)
}

export function reactionForDay(
  reactions: readonly ReactionResult[],
  plays: readonly GamePlay[],
  crewId: string,
  day: number,
): DayReaction | undefined {
  const tests = reactions.filter((r) => r.crewId === crewId && r.day === day)
  if (tests.length) return { ms: tests[tests.length - 1].ms, source: 'test' }
  const taps = gameTaps(plays, crewId, day)
  if (taps.length >= MIN_GAME_TAPS) return { ms: Math.round(median(taps)), source: 'game', taps: taps.length }
  return undefined
}

/** Longest Simon Says sequence on a day, if the game was played. */
export function memoryForDay(plays: readonly GamePlay[], crewId: string, day: number): number | undefined {
  let best: number | undefined
  for (const p of plays) {
    if (p.crewId === crewId && p.day === day && MEMORY_GAMES.has(p.gameId)) best = Math.max(best ?? 0, p.value)
  }
  return best
}
