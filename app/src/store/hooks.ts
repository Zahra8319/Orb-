import { useEffect, useMemo } from 'react'
import { evaluate, type Alert } from '../rules/alerts'
import { crewById, type Crew } from '../sim/crew'
import { dayOf, minuteOfDay } from '../sim/mission'
import { dayRecord, snapshot, usualWake, type Snapshot } from '../sim/model'
import { dayKey, useStore } from './store'

export function useCrew(): Crew {
  return crewById(useStore((s) => s.crewId))
}

/** Latest reaction test this crew member took today, if any. */
export function useTodayReaction(): number | undefined {
  const crewId = useStore((s) => s.crewId)
  const day = useStore((s) => dayOf(s.t))
  const reactions = useStore((s) => s.reactions)
  return useMemo(() => {
    const mine = reactions.filter((r) => r.crewId === crewId && r.day === day)
    return mine.length ? mine[mine.length - 1].ms : undefined
  }, [reactions, crewId, day])
}

export function useSnapshot(): Snapshot {
  const crew = useCrew()
  const t = useStore((s) => s.t)
  const scenarios = useStore((s) => s.scenarios)
  const sheltered = useStore((s) => s.sheltered)
  const eyeCheckDone = useStore((s) => Boolean(s.eyeChecks[dayKey(s.crewId, dayOf(s.t))]))
  const reactionMs = useTodayReaction()
  return useMemo(
    () => snapshot(crew, t, scenarios, { sheltered, eyeCheckDone, reactionMs }),
    [crew, t, scenarios, sheltered, eyeCheckDone, reactionMs],
  )
}

export function useAlerts(): Alert[] {
  const snap = useSnapshot()
  return useMemo(() => evaluate(snap), [snap])
}

/** True from two hours before this crew member's bedtime until they wake. */
export function useSleepShift(): boolean {
  const crew = useCrew()
  const t = useStore((s) => s.t)
  const scenarios = useStore((s) => s.scenarios)
  const mode = useStore((s) => s.themeMode)
  if (mode !== 'auto') return mode === 'sleep'
  const m = minuteOfDay(t)
  const tonight = dayRecord(crew, dayOf(t) + 1, scenarios).sleepStart + 1440
  return m >= Math.min(tonight, crew.bedtime) - 120 || m < usualWake(crew)
}

/** Advances the simulated clock four times a second. */
export function useSimClock() {
  const tick = useStore((s) => s.tick)
  useEffect(() => {
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      tick(Math.min(1, (now - last) / 1000))
      last = now
    }, 250)
    return () => window.clearInterval(id)
  }, [tick])
}
