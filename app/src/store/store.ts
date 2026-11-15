import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { GamePlay } from '../games/types'
import { CREW } from '../sim/crew'
import { START_MIN, commsDelaySec, dayOf } from '../sim/mission'
import { NO_SCENARIOS, type ScenarioId, type Scenarios } from '../sim/scenarios'

export type ThemeMode = 'auto' | 'day' | 'sleep'

/** Simulated minutes that pass per real second. */
export const SPEEDS = [
  { value: 0, label: 'Paused' },
  { value: 1 / 60, label: 'Real time' },
  { value: 60, label: '1 hour a second' },
  { value: 1440, label: '1 day a second' },
] as const

export interface Message {
  id: number
  crewId: string
  /** 'me' is the crew member, 'earth' the flight surgeon, 'admin' Mission Control. */
  from: 'me' | 'earth' | 'admin'
  text: string
  /** Mission minute it was sent. */
  sentAt: number
  /** Mission minute it reaches the other end. */
  arrivesAt: number
}

export interface ReactionResult {
  crewId: string
  day: number
  ms: number
  falseStarts: number
}

export interface GlucoseReading {
  crewId: string
  day: number
  value: number // mg/dL
  timestamp: number // mission minute
  context: 'fasting' | 'pre-meal' | 'post-meal' | 'bedtime'
}

export interface NutritionLog {
  crewId: string
  day: number
  calories: number
  protein: number // grams
  carbs: number // grams
  fat: number // grams
  water: number // liters
  timestamp: number
}

interface State {
  t: number
  speed: number
  crewId: string
  scenarios: Scenarios
  themeMode: ThemeMode
  sheltered: boolean
  moods: Record<string, number>
  reactions: ReactionResult[]
  glucose: GlucoseReading[]
  nutrition: NutritionLog[]
  /** Every round finished in a game, for every crew member. */
  gamePlays: GamePlay[]
  eyeChecks: Record<string, boolean>
  messages: Message[]
  tick: (realSeconds: number) => void
  setSpeed: (speed: number) => void
  setCrew: (id: string) => void
  toggleScenario: (id: ScenarioId) => void
  resetDemo: () => void
  setThemeMode: (mode: ThemeMode) => void
  setSheltered: (value: boolean) => void
  setMood: (mood: number) => void
  addReaction: (ms: number, falseStarts: number) => void
  addGamePlay: (gameId: string, value: number, detail?: string) => void
  logEyeCheck: () => void
  sendMessage: (text: string) => void
  /** Mission Control writes to one crew member; it reaches the ship after the radio delay. */
  sendAdminMessage: (text: string, toCrewId: string) => void
  addGlucose: (reading: Omit<GlucoseReading, 'crewId' | 'day'>) => void
  addNutrition: (log: Omit<NutritionLog, 'crewId' | 'day'>) => void
}

export const dayKey = (crewId: string, day: number) => `${crewId}:${day}`

const delayMin = (t: number) => commsDelaySec(t) / 60

function seedMessages(): Message[] {
  const out: Message[] = []
  let id = 1
  for (const crew of CREW) {
    const asked = START_MIN - 14 * 60
    const d = delayMin(asked)
    out.push({
      id: id++,
      crewId: crew.id,
      from: 'me',
      text: 'Left knee is sore after yesterday’s squats. No swelling. OK to keep the resistance plan?',
      sentAt: asked,
      arrivesAt: asked + d,
    })
    out.push({
      id: id++,
      crewId: crew.id,
      from: 'earth',
      text: 'Thanks for flagging it. Keep the plan but drop squat load by 20% for three days and ice after. Tell us if it swells.',
      sentAt: asked + d + 35,
      arrivesAt: asked + d + 35 + delayMin(asked + 60),
    })
  }
  return out
}

function replyTo(text: string): string {
  const q = text.toLowerCase()
  if (/(storm|radiation|dose|shelter)/.test(q)) {
    return 'Copy. We see the same particle flux from here. Stay sheltered until Orb shows the rate under 5 times normal, then log your dose.'
  }
  if (/(sleep|tired|fatigue|insomnia)/.test(q)) {
    return 'Understood. We are moving tomorrow’s robotics block to the afternoon. Keep lights dim from two hours before bed.'
  }
  if (/(heart|chest|rhythm|ecg|pulse)/.test(q)) {
    return 'Received. Send the 30-second ECG when you can. Rest until the medical officer has looked at it, and no exercise today.'
  }
  if (/(co2|air|headache|scrubber|oxygen)/.test(q)) {
    return 'Copy. Run the backup scrubber and report the CO2 reading every 30 minutes. Headaches should ease under 3 mmHg.'
  }
  return 'Received, thank you. The flight surgeon has read your note and will follow up at the next scheduled check-in.'
}

const initial = () => ({
  t: START_MIN,
  speed: 1 / 60,
  scenarios: { ...NO_SCENARIOS },
  sheltered: false,
  moods: {} as Record<string, number>,
  reactions: [] as ReactionResult[],
  glucose: [] as GlucoseReading[],
  nutrition: [] as NutritionLog[],
  gamePlays: [] as GamePlay[],
  eyeChecks: {} as Record<string, boolean>,
  messages: seedMessages(),
})

/** Sent on window when the demo resets, for screens that keep their own saved state. */
export const DEMO_RESET_EVENT = 'orb:demo-reset'

/** Saved outside this store (Consult Earth keeps one key per crew member). */
function clearOtherDemoKeys() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('orb-consultations')) localStorage.removeItem(key)
    }
  } catch {
    // Blocked storage: nothing was saved.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DEMO_RESET_EVENT))
}

/** Where the demo is saved in this browser. Bump VERSION when the saved shape changes. */
export const STORE_KEY = 'orb.demo'
const VERSION = 1

/**
 * The demo is saved in this browser, so a reload keeps the mission clock,
 * scenarios, test results, game rounds, moods and messages. The signed-in crew
 * member is not saved here (the session handles that), and "Reset demo" clears it all.
 * If storage is blocked the demo still runs; it just starts fresh on reload.
 */
export const useStore = create<State>()(
  persist(
    (set, get) => ({
  ...initial(),
  crewId: CREW[0].id,
  themeMode: 'auto',

  tick: (realSeconds) => {
    const { speed, t } = get()
    if (speed > 0) set({ t: t + speed * realSeconds })
  },
  setSpeed: (speed) => set({ speed }),
  setCrew: (crewId) => set({ crewId }),
  toggleScenario: (id) =>
    set((s) => ({
      scenarios: { ...s.scenarios, [id]: s.scenarios[id] === null ? s.t : null },
      sheltered: id === 'solar-storm' ? false : s.sheltered,
    })),
  resetDemo: () => {
    clearOtherDemoKeys()
    set(initial())
  },
  setThemeMode: (themeMode) => set({ themeMode }),
  setSheltered: (sheltered) => set({ sheltered }),
  setMood: (mood) => set((s) => ({ moods: { ...s.moods, [dayKey(s.crewId, dayOf(s.t))]: mood } })),
  addReaction: (ms, falseStarts) =>
    set((s) => ({ reactions: [...s.reactions, { crewId: s.crewId, day: dayOf(s.t), ms, falseStarts }] })),
  addGamePlay: (gameId, value, detail) =>
    set((s) => ({ gamePlays: [...s.gamePlays, { crewId: s.crewId, gameId, day: dayOf(s.t), t: s.t, value, detail }] })),
  logEyeCheck: () => set((s) => ({ eyeChecks: { ...s.eyeChecks, [dayKey(s.crewId, dayOf(s.t))]: true } })),
  sendMessage: (text) =>
    set((s) => {
      const trimmed = text.trim()
      if (!trimmed) return s
      const nextId = s.messages.reduce((m, x) => Math.max(m, x.id), 0) + 1
      const out = delayMin(s.t)
      const replySent = s.t + out + 4
      return {
        messages: [
          ...s.messages,
          { id: nextId, crewId: s.crewId, from: 'me', text: trimmed, sentAt: s.t, arrivesAt: s.t + out },
          {
            id: nextId + 1,
            crewId: s.crewId,
            from: 'earth',
            text: replyTo(trimmed),
            sentAt: replySent,
            arrivesAt: replySent + delayMin(replySent),
          },
        ],
      }
    }),
  sendAdminMessage: (text, toCrewId) =>
    set((s) => {
      const trimmed = text.trim()
      if (!trimmed) return s
      const nextId = s.messages.reduce((m, x) => Math.max(m, x.id), 0) + 1
      return {
        messages: [
          ...s.messages,
          { id: nextId, crewId: toCrewId, from: 'admin', text: trimmed, sentAt: s.t, arrivesAt: s.t + delayMin(s.t) },
        ],
      }
    }),
  addGlucose: (reading) =>
    set((s) => ({
      glucose: [...s.glucose, { ...reading, crewId: s.crewId, day: dayOf(s.t) }],
    })),
  addNutrition: (log) =>
    set((s) => ({
      nutrition: [...s.nutrition, { ...log, crewId: s.crewId, day: dayOf(s.t) }],
    })),
    }),
    {
      name: STORE_KEY,
      version: VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        t: s.t,
        speed: s.speed,
        scenarios: s.scenarios,
        themeMode: s.themeMode,
        sheltered: s.sheltered,
        moods: s.moods,
        reactions: s.reactions,
        glucose: s.glucose,
        nutrition: s.nutrition,
        gamePlays: s.gamePlays,
        eyeChecks: s.eyeChecks,
        messages: s.messages,
      }),
    },
  ),
)
