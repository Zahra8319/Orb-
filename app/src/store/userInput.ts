import { reactionForDay } from '../games/health'
import type { GamePlay } from '../games/types'
import { dayOf } from '../sim/mission'
import type { UserInput } from '../sim/model'
import { dayKey, type ReactionResult } from './store'

export interface InputState {
  t: number
  /** The signed-in crew member. */
  crewId: string
  sheltered: boolean
  eyeChecks: Record<string, boolean>
  reactions: ReactionResult[]
  gamePlays: GamePlay[]
}

/**
 * What a crew member has entered themselves today, for their health snapshot:
 * their reaction reading (test, or enough Reaction Rush taps), whether the eye check
 * is done, and whether they are in the storm shelter. Used by the crew member's own
 * screens and by Command, so both show the same alerts for the same person.
 *
 * The shelter switch belongs to whoever is signed in, so it only applies to them.
 */
export function userInputFor(s: InputState, crewId: string): UserInput {
  const day = dayOf(s.t)
  return {
    reactionMs: reactionForDay(s.reactions, s.gamePlays, crewId, day)?.ms,
    eyeCheckDone: Boolean(s.eyeChecks[dayKey(crewId, day)]),
    sheltered: crewId === s.crewId ? s.sheltered : undefined,
  }
}
