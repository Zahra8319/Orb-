import { useEffect, useMemo } from 'react'
import { reactionForDay, type DayReaction } from '../games/health'
import type { GamePlay } from '../games/types'
import { evaluate, type Alert } from '../rules/alerts'
import { crewById, type Crew } from '../sim/crew'
import { dayOf, minuteOfDay } from '../sim/mission'
import { dayRecord, snapshot, usualWake, type Snapshot } from '../sim/model'
import { useStore } from './store'
import { userInputFor } from './userInput'

export function useCrew(): Crew {
  return crewById(useStore((s) => s.crewId))
}

/** Today's reaction reading: the reaction test if taken, else enough Reaction Rush taps. */
export function useTodayReaction(): DayReaction | undefined {
  const crewId = useStore((s) => s.crewId)
  const day = useStore((s) => dayOf(s.t))
  const reactions = useStore((s) => s.reactions)
  const plays = useStore((s) => s.gamePlays)
  return useMemo(() => reactionForDay(reactions, plays, crewId, day), [reactions, plays, crewId, day])
}

/** This crew member's rounds, oldest first. */
export function useMyGamePlays(): GamePlay[] {
  const crewId = useStore((s) => s.crewId)
  const plays = useStore((s) => s.gamePlays)
  return useMemo(() => plays.filter((p) => p.crewId === crewId), [plays, crewId])
}

export function useSnapshot(): Snapshot {
  const crew = useCrew()
  const t = useStore((s) => s.t)
  const scenarios = useStore((s) => s.scenarios)
  const sheltered = useStore((s) => s.sheltered)
  const eyeChecks = useStore((s) => s.eyeChecks)
  const reactions = useStore((s) => s.reactions)
  const gamePlays = useStore((s) => s.gamePlays)
  return useMemo(
    () =>
      snapshot(crew, t, scenarios, userInputFor({ t, crewId: crew.id, sheltered, eyeChecks, reactions, gamePlays }, crew.id)),
    [crew, t, scenarios, sheltered, eyeChecks, reactions, gamePlays],
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
