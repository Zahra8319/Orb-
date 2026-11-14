/** Onboard guidance. Each rule looks at the current snapshot and, if something is off,
 *  says what it saw and what to do about it. Earth may be 20 minutes away, so every
 *  alert has to stand on its own. */

import { CAREER_LIMIT_MSV, formatHours } from '../sim/mission'
import type { Snapshot } from '../sim/model'

export type Level = 'watch' | 'act' | 'urgent'

export const LEVEL_WORD: Record<Level, string> = { watch: 'Watch', act: 'Act today', urgent: 'Urgent' }

export interface Alert {
  id: string
  level: Level
  /** What the app saw. */
  title: string
  /** What to do now. */
  action: string
  /** Screen with the detail. */
  to: string
}

export const THRESHOLDS = {
  co2: { watch: 3, act: 4, urgent: 6 }, // mmHg
  o2: { watch: 19.5, urgent: 18 }, // kPa
  spo2: { watch: 94, urgent: 90 }, // percent
  restingHeartRate: 110, // beats per minute, when not exercising
  stormFactor: 5, // times the normal dose rate
  careerDoseShare: 0.8, // of the career limit
  sleep: { watch: 6, act: 5 }, // average hours a night over 7 nights
  missedExercise: { watch: 2, act: 4 }, // days in a row
  reactionSlowdown: 1.2, // times the pre-flight baseline
} as const

const ORDER: Record<Level, number> = { urgent: 0, act: 1, watch: 2 }

type Rule = (s: Snapshot) => Alert | null

const rules: Rule[] = [
  (s) => {
    const factor = s.doseRate / s.baseDoseRate
    if (factor <= THRESHOLDS.stormFactor) return null
    const times = Math.round(factor)
    return s.sheltered
      ? {
          id: 'solar-storm',
          level: 'act',
          title: `Solar storm: radiation is ${times} times normal`,
          action: 'Stay in the storm shelter until the dose rate falls below 5 times normal.',
          to: '/radiation',
        }
      : {
          id: 'solar-storm',
          level: 'urgent',
          title: `Solar storm: radiation is ${times} times normal`,
          action: 'Go to the storm shelter now and stay there. Tell the crew.',
          to: '/radiation',
        }
  },
  (s) => {
    if (!s.vitals.irregular) return null
    return {
      id: 'rhythm',
      level: 'urgent',
      title: 'Your heart rhythm is irregular',
      action: 'Stop what you are doing, sit still, and call the medical officer. Record a 30-second ECG.',
      to: '/body',
    }
  },
  (s) => {
    const { spo2 } = s.vitals
    if (spo2 >= THRESHOLDS.spo2.watch) return null
    if (spo2 < THRESHOLDS.spo2.urgent) {
      return {
        id: 'spo2',
        level: 'urgent',
        title: `Blood oxygen is ${spo2}%`,
        action: 'Put on an oxygen mask and call the medical officer. Check cabin oxygen.',
        to: '/ship',
      }
    }
    return {
      id: 'spo2',
      level: 'watch',
      title: `Blood oxygen is ${spo2}%, a little low`,
      action: 'Reseat the sensor and take five slow breaths. Check again in 10 minutes.',
      to: '/ship',
    }
  },
  (s) => {
    const { co2 } = s.cabin
    const t = THRESHOLDS.co2
    if (co2 <= t.watch) return null
    const value = co2.toFixed(1)
    if (co2 > t.urgent) {
      return {
        id: 'co2',
        level: 'urgent',
        title: `Cabin CO2 is ${value} mmHg`,
        action: 'Put on a mask, move to the forward module, and start the backup scrubber.',
        to: '/ship',
      }
    }
    if (co2 > t.act) {
      return {
        id: 'co2',
        level: 'act',
        title: `Cabin CO2 is ${value} mmHg and rising`,
        action: 'Swap the scrubber cartridge and turn the cabin fans to high. Expect headaches above 4 mmHg.',
        to: '/ship',
      }
    }
    return {
      id: 'co2',
      level: 'watch',
      title: `Cabin CO2 is ${value} mmHg, above the 3 mmHg target`,
      action: 'Check the scrubber status. Avoid hard exercise until it drops.',
      to: '/ship',
    }
  },
  (s) => {
    const { o2 } = s.cabin
    if (o2 >= THRESHOLDS.o2.watch) return null
    const urgent = o2 < THRESHOLDS.o2.urgent
    return {
      id: 'o2',
      level: urgent ? 'urgent' : 'watch',
      title: `Cabin oxygen is ${o2.toFixed(1)} kPa`,
      action: urgent
        ? 'Put on an oxygen mask now, then check the oxygen supply valve.'
        : 'Check the oxygen generator status and watch your blood oxygen.',
      to: '/ship',
    }
  },
  (s) => {
    const { heartRate, activity } = s.vitals
    if (activity === 'cardio' || activity === 'resistance') return null
    if (s.vitals.irregular || heartRate <= THRESHOLDS.restingHeartRate) return null
    return {
      id: 'heart-rate',
      level: 'act',
      title: `Heart rate is ${heartRate} at rest`,
      action: 'Sit down, drink water, and breathe slowly for 5 minutes. Call the medical officer if it stays high.',
      to: '/body',
    }
  },
  (s) => {
    const t = THRESHOLDS.sleep
    if (s.sleepAvg7 >= t.watch) return null
    const avg = formatHours(s.sleepAvg7)
    return s.sleepAvg7 < t.act
      ? {
          id: 'sleep',
          level: 'act',
          title: `You have averaged ${avg} of sleep this week`,
          action: 'Ask the commander to move tomorrow’s critical tasks. Go to bed an hour early tonight.',
          to: '/sleep',
        }
      : {
          id: 'sleep',
          level: 'watch',
          title: `You have averaged ${avg} of sleep this week`,
          action: 'Dim your cabin lights two hours before bed and skip caffeine after midday.',
          to: '/sleep',
        }
  },
  (s) => {
    const t = THRESHOLDS.missedExercise
    if (s.missedExerciseDays < t.watch) return null
    const act = s.missedExerciseDays >= t.act
    return {
      id: 'exercise',
      level: act ? 'act' : 'watch',
      title: `No full exercise session for ${s.missedExerciseDays} days`,
      action: act
        ? 'Do today’s resistance session before anything else. Bone and muscle loss speeds up without it.'
        : 'Fit in both of today’s sessions to stay on your plan.',
      to: '/body',
    }
  },
  (s) => {
    if (s.reactionMs <= s.reactionBaselineMs * THRESHOLDS.reactionSlowdown) return null
    const slower = Math.round((s.reactionMs / s.reactionBaselineMs - 1) * 100)
    return {
      id: 'reaction',
      level: 'watch',
      title: `Your reactions are ${slower}% slower than before launch`,
      action: 'Avoid piloting and robotics tasks today if you can, and retest after a rest.',
      to: '/sleep',
    }
  },
  (s) => {
    if (s.careerDose <= CAREER_LIMIT_MSV * THRESHOLDS.careerDoseShare) return null
    return {
      id: 'career-dose',
      level: 'watch',
      title: `Career radiation dose is ${Math.round(s.careerDose)} of ${CAREER_LIMIT_MSV} mSv`,
      action: 'Sleep in the shielded bunk and keep spacewalk time to a minimum.',
      to: '/radiation',
    }
  },
]

/** All alerts for this snapshot, most serious first. */
export function evaluate(s: Snapshot): Alert[] {
  const alerts: Alert[] = []
  for (const rule of rules) {
    const alert = rule(s)
    if (alert) alerts.push(alert)
  }
  return alerts.sort((a, b) => ORDER[a.level] - ORDER[b.level])
}

export function worstLevel(alerts: Alert[]): Level | null {
  return alerts.length ? alerts[0].level : null
}
