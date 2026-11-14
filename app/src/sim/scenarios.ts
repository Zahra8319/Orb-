/** Demo scenarios. Each value is the mission minute the scenario was switched on, or null when off. */

export type ScenarioId = 'solarStorm' | 'co2Rise' | 'shortSleep' | 'missedExercise' | 'irregularHeart'

export type Scenarios = Record<ScenarioId, number | null>

export const NO_SCENARIOS: Scenarios = {
  solarStorm: null,
  co2Rise: null,
  shortSleep: null,
  missedExercise: null,
  irregularHeart: null,
}

export const SCENARIO_INFO: { id: ScenarioId; name: string; detail: string }[] = [
  { id: 'solarStorm', name: 'Solar storm', detail: 'Dose rate jumps for about 12 hours' },
  { id: 'co2Rise', name: 'CO2 scrubber fault', detail: 'Cabin CO2 climbs about 0.7 mmHg an hour' },
  { id: 'shortSleep', name: 'A week of short sleep', detail: 'The last 7 nights drop to about 4.5 hours' },
  { id: 'missedExercise', name: 'Missed exercise', detail: 'No exercise logged for the last 4 days' },
  { id: 'irregularHeart', name: 'Irregular heart rhythm', detail: 'Heart rate becomes erratic from now' },
]
