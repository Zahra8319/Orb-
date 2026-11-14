import { useEffect, useMemo, useState } from 'react'
import { evaluate, type Alert } from '../rules/alerts'
import { fleetStatus, type Fleet } from '../rules/fleet'
import { crewById, type Crew } from '../sim/crew'
import { START_MIN, dayOf, minuteOfDay } from '../sim/mission'
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

/**
 * The whole crew for Mission Control. Recomputed once a second rather than on
 * every clock tick (four people, four times a second, is wasted work), and at
 * once when anything the crew or the flight surgeon entered changes.
 */
export function useFleet(): Fleet {
  const [second, setSecond] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setSecond((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [])
  const scenarios = useStore((s) => s.scenarios)
  const sheltered = useStore((s) => s.sheltered)
  const reactions = useStore((s) => s.reactions)
  const eyeChecks = useStore((s) => s.eyeChecks)
  const acknowledged = useStore((s) => s.acknowledged)
  const earthDelay = useStore((s) => s.earthDelay)
  // A demo reset rewinds the clock; recompute straight away rather than up to a second late.
  const rewound = useStore((s) => s.t === START_MIN)
  return useMemo(
    () =>
      fleetStatus(useStore.getState().t, scenarios, { sheltered, reactions, eyeChecks, acknowledged }, {
        delayed: earthDelay,
      }),
    // `second` is the once-a-second refresh; the clock is read when it fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [second, rewound, scenarios, sheltered, reactions, eyeChecks, acknowledged, earthDelay],
  )
}

/** Crew members whose latest message has reached Earth and not been answered since. */
export function useAwaitingReply(): Set<string> {
  const messages = useStore((s) => s.messages)
  // Whole minutes are enough: a message arriving mid-minute shows a moment later.
  const t = useStore((s) => Math.floor(s.t))
  return useMemo(() => {
    const last = new Map<string, { inbound: number; outbound: number }>()
    for (const m of messages) {
      const e = last.get(m.crewId) ?? { inbound: -Infinity, outbound: -Infinity }
      if (m.from === 'me' && t >= m.arrivesAt) e.inbound = Math.max(e.inbound, m.arrivesAt)
      if (m.from === 'earth') e.outbound = Math.max(e.outbound, m.sentAt)
      last.set(m.crewId, e)
    }
    return new Set([...last].filter(([, e]) => e.inbound > e.outbound).map(([id]) => id))
  }, [messages, t])
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
