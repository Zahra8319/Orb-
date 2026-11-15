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

/** Glucose readings for current crew member. */
export function useGlucose() {
  const crewId = useStore((s) => s.crewId)
  const glucose = useStore((s) => s.glucose)
  return useMemo(
    () => glucose.filter((g) => g.crewId === crewId).sort((a, b) => b.timestamp - a.timestamp),
    [glucose, crewId]
  )
}

/** Today's glucose readings. */
export function useTodayGlucose() {
  const day = useStore((s) => dayOf(s.t))
  const readings = useGlucose()
  return useMemo(() => readings.filter((g) => g.day === day), [readings, day])
}

/** Latest glucose reading. */
export function useLatestGlucose() {
  const readings = useTodayGlucose()
  return readings[0]
}

/** Nutrition logs for current crew member. */
export function useNutrition() {
  const crewId = useStore((s) => s.crewId)
  const nutrition = useStore((s) => s.nutrition)
  return useMemo(
    () => nutrition.filter((n) => n.crewId === crewId).sort((a, b) => b.timestamp - a.timestamp),
    [nutrition, crewId]
  )
}

/** Today's nutrition totals. */
export function useTodayNutrition() {
  const day = useStore((s) => dayOf(s.t))
  const logs = useNutrition()
  return useMemo(
    () => logs.filter((n) => n.day === day),
    [logs, day]
  )
}

/** Today's nutrition totals summed. */
export function useNutritionTotals() {
  const logs = useTodayNutrition()
  return useMemo(
    () =>
      logs.reduce(
        (acc, n) => ({
          calories: acc.calories + n.calories,
          protein: acc.protein + n.protein,
          carbs: acc.carbs + n.carbs,
          fat: acc.fat + n.fat,
          water: acc.water + n.water,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, water: 0 }
      ),
    [logs]
  )
}

/** Add a glucose reading (convenience hook). */
export function useAddGlucose() {
  return useStore((s) => s.addGlucose)
}

/** Add a nutrition log (convenience hook). */
export function useAddNutrition() {
  return useStore((s) => s.addNutrition)
}
