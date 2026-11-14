import { create } from 'zustand'
import { CREW } from '../sim/crew'
import { START_MIN, commsDelaySec, dayOf } from '../sim/mission'
import { NO_SCENARIOS, type ScenarioId, type Scenarios } from '../sim/scenarios'
import type { Level } from '../rules/alerts'

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
  from: 'me' | 'earth'
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

interface State {
  t: number
  speed: number
  crewId: string
  scenarios: Scenarios
  themeMode: ThemeMode
  sheltered: boolean
  moods: Record<string, number>
  reactions: ReactionResult[]
  eyeChecks: Record<string, boolean>
  messages: Message[]
  /** Alerts the flight surgeon has seen: `${crewId}:${alertId}` -> level when seen. */
  acknowledged: Record<string, Level>
  /** Mission Control sees readings as old as the radio delay. */
  earthDelay: boolean
  /** Canned Earth replies to crew messages; off while a flight surgeon answers. */
  autoReply: boolean
  tick: (realSeconds: number) => void
  setSpeed: (speed: number) => void
  setCrew: (id: string) => void
  toggleScenario: (id: ScenarioId) => void
  resetDemo: () => void
  setThemeMode: (mode: ThemeMode) => void
  setSheltered: (value: boolean) => void
  setMood: (mood: number) => void
  addReaction: (ms: number, falseStarts: number) => void
  logEyeCheck: () => void
  sendMessage: (text: string) => void
  replyAsEarth: (crewId: string, text: string) => void
  acknowledge: (key: string, level: Level) => void
  setEarthDelay: (value: boolean) => void
  setAutoReply: (value: boolean) => void
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
  eyeChecks: {} as Record<string, boolean>,
  messages: seedMessages(),
  acknowledged: {} as Record<string, Level>,
})

export const useStore = create<State>((set, get) => ({
  ...initial(),
  crewId: CREW[0].id,
  themeMode: 'auto',
  earthDelay: true,
  autoReply: true,

  tick: (realSeconds) => {
    const { speed, t } = get()
    if (speed > 0) set({ t: t + speed * realSeconds })
  },
  setSpeed: (speed) => set({ speed }),
  setCrew: (crewId) => set({ crewId }),
  toggleScenario: (id) =>
    set((s) => ({
      scenarios: { ...s.scenarios, [id]: s.scenarios[id] === null ? s.t : null },
      sheltered: id === 'solarStorm' ? false : s.sheltered,
    })),
  resetDemo: () => set(initial()),
  setThemeMode: (themeMode) => set({ themeMode }),
  setSheltered: (sheltered) => set({ sheltered }),
  setMood: (mood) => set((s) => ({ moods: { ...s.moods, [dayKey(s.crewId, dayOf(s.t))]: mood } })),
  addReaction: (ms, falseStarts) =>
    set((s) => ({ reactions: [...s.reactions, { crewId: s.crewId, day: dayOf(s.t), ms, falseStarts }] })),
  logEyeCheck: () => set((s) => ({ eyeChecks: { ...s.eyeChecks, [dayKey(s.crewId, dayOf(s.t))]: true } })),
  sendMessage: (text) =>
    set((s) => {
      const trimmed = text.trim()
      if (!trimmed) return s
      const nextId = s.messages.reduce((m, x) => Math.max(m, x.id), 0) + 1
      const out = delayMin(s.t)
      const replySent = s.t + out + 4
      const sent: Message = { id: nextId, crewId: s.crewId, from: 'me', text: trimmed, sentAt: s.t, arrivesAt: s.t + out }
      // With a flight surgeon signed in, a person answers instead of the canned replies.
      if (!s.autoReply) return { messages: [...s.messages, sent] }
      return {
        messages: [
          ...s.messages,
          sent,
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
  replyAsEarth: (crewId, text) =>
    set((s) => {
      const trimmed = text.trim()
      if (!trimmed) return s
      const id = s.messages.reduce((m, x) => Math.max(m, x.id), 0) + 1
      return {
        messages: [
          ...s.messages,
          { id, crewId, from: 'earth', text: trimmed, sentAt: s.t, arrivesAt: s.t + delayMin(s.t) },
        ],
      }
    }),
  acknowledge: (key, level) => set((s) => ({ acknowledged: { ...s.acknowledged, [key]: level } })),
  setEarthDelay: (earthDelay) => set({ earthDelay }),
  setAutoReply: (autoReply) => set({ autoReply }),
}))
