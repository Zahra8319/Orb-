import { describe, expect, it } from 'vitest'
import { evaluate } from '../rules/alerts'
import { CREW } from '../sim/crew'
import { MIN_PER_DAY, dayOf } from '../sim/mission'
import { snapshot } from '../sim/model'
import { NO_SCENARIOS } from '../sim/scenarios'
import { dayKey } from './store'
import { userInputFor, type InputState } from './userInput'

const t = 100 * MIN_PER_DAY + 9 * 60
const day = dayOf(t)
const [me, other] = CREW

const base: InputState = { t, crewId: me.id, sheltered: false, eyeChecks: {}, reactions: [], gamePlays: [] }

describe('userInputFor', () => {
  it("uses each crew member's own reaction reading", () => {
    const slow = Math.round(other.reactionBaselineMs * 1.4)
    const s: InputState = { ...base, reactions: [{ crewId: other.id, day, ms: slow, falseStarts: 0 }] }
    expect(userInputFor(s, other.id).reactionMs).toBe(slow)
    expect(userInputFor(s, me.id).reactionMs).toBeUndefined()
  })

  it('lets a slow reading reach that crew member’s alerts, as Command shows them', () => {
    const slow = Math.round(other.reactionBaselineMs * 1.4)
    const s: InputState = { ...base, reactions: [{ crewId: other.id, day, ms: slow, falseStarts: 0 }] }
    const alerts = evaluate(snapshot(other, t, NO_SCENARIOS, userInputFor(s, other.id)))
    expect(alerts.map((a) => a.id)).toContain('reaction')
  })

  it('counts Reaction Rush taps when no test was taken', () => {
    const taps = Array.from({ length: 5 }, () => ({ crewId: other.id, gameId: 'reaction', day, t, value: 400 }))
    expect(userInputFor({ ...base, gamePlays: taps }, other.id).reactionMs).toBe(400)
  })

  it('reads each crew member’s eye check', () => {
    const s: InputState = { ...base, eyeChecks: { [dayKey(other.id, day)]: true } }
    expect(userInputFor(s, other.id).eyeCheckDone).toBe(true)
    expect(userInputFor(s, me.id).eyeCheckDone).toBe(false)
  })

  it('applies the shelter switch only to whoever is signed in', () => {
    const s: InputState = { ...base, sheltered: true }
    expect(userInputFor(s, me.id).sheltered).toBe(true)
    expect(userInputFor(s, other.id).sheltered).toBeUndefined()
  })
})
