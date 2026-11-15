import { arc as d3arc } from 'd3-shape'
import type { Crew } from '../sim/crew'
import { MIN_PER_DAY, formatClock } from '../sim/mission'
import { activityAt } from '../sim/model'
import type { Scenarios } from '../sim/scenarios'
import { dayBlocks, type Block } from './dayBlocks'

interface Props {
  crew: Crew
  t: number
  scenarios: Scenarios
}

const C = 220
const TRACKS = {
  light: { inner: 178, outer: 186 },
  exercise: { inner: 148, outer: 168 },
  sleep: { inner: 118, outer: 138 },
}
const angle = (minute: number) => (minute / MIN_PER_DAY) * 2 * Math.PI

function arcPath(track: { inner: number; outer: number }, from: number, to: number, round = 4): string {
  if (to <= from) return ''
  return (
    d3arc().cornerRadius(round)({
      innerRadius: track.inner,
      outerRadius: track.outer,
      startAngle: angle(from),
      endAngle: angle(to),
    }) ?? ''
  )
}

const STATE = { sleep: 'Asleep', cardio: 'Cardio session', resistance: 'Resistance session', awake: 'Awake' } as const

/** Hover text for a block, for example "Sleep, 00:00 to 05:34". */
const span = (name: string, b: Block) => `${name}, ${formatClock(b.from)} to ${formatClock(b.to)}`

/** The 24-hour day drawn as a clock: sleep, exercise and bright light, filling in as the day goes. */
export function DayRing({ crew, t, scenarios }: Props) {
  const { sleep, exercise, light, now } = dayBlocks(crew, t, scenarios)
  const activity = activityAt(crew, t, scenarios)
  const lightHours = light.reduce((sum, b) => sum + (b.done - b.from), 0) / 60
  const exerciseMin = exercise.reduce((sum, b) => sum + (b.done - b.from), 0)
  const label = `Your day at ${formatClock(now)} ship time. ${STATE[activity]}. ${Math.round(exerciseMin)} minutes of exercise done and ${lightHours.toFixed(1)} hours of bright light so far.`

  return (
    <svg className="day-ring" viewBox="0 0 440 440" role="img" aria-label={label}>
      <defs>
        <mask id="ring-reveal" maskUnits="userSpaceOnUse" x={-200} y={-200} width={400} height={400}>
          <circle className="ring-reveal" cx={0} cy={0} r={152} fill="none" stroke="#fff" strokeWidth={90} pathLength={1} transform="rotate(-90)" />
        </mask>
      </defs>

      {/* hour ticks */}
      {Array.from({ length: 24 }, (_, h) => {
        const a = angle(h * 60) - Math.PI / 2
        const major = h % 6 === 0
        const r1 = 192
        const r2 = major ? 201 : 197
        return (
          <line
            key={h}
            x1={C + Math.cos(a) * r1}
            y1={C + Math.sin(a) * r1}
            x2={C + Math.cos(a) * r2}
            y2={C + Math.sin(a) * r2}
            stroke={major ? 'var(--ink)' : 'var(--nasa-grey)'}
            strokeWidth={major ? 2 : 1}
          />
        )
      })}
      {[0, 6, 12, 18].map((h) => {
        const a = angle(h * 60) - Math.PI / 2
        return (
          <text key={h} x={C + Math.cos(a) * 212} y={C + Math.sin(a) * 212} textAnchor="middle" dominantBaseline="central">
            {String(h).padStart(2, '0')}
          </text>
        )
      })}

      <g transform={`translate(${C},${C})`} mask="url(#ring-reveal)">
        {/* track beds */}
        {Object.values(TRACKS).map((track) => (
          <path key={track.inner} d={arcPath(track, 0, MIN_PER_DAY, 0)} fill="var(--light-track)" opacity={0.55} />
        ))}

        {light.map((b, i) => (
          <g key={`l${i}`}>
            <title>{span('Bright light', b)}</title>
            <path d={arcPath(TRACKS.light, b.from, b.to)} fill="var(--planned)" />
            <path d={arcPath(TRACKS.light, b.from, b.done)} fill="var(--light-done)" />
          </g>
        ))}
        {exercise.map((b, i) => (
          <g key={`e${i}`}>
            <title>{span(i === 0 ? 'Cardio' : 'Resistance exercise', b)}</title>
            <path d={arcPath(TRACKS.exercise, b.from, b.to)} fill="var(--planned)" />
            <path d={arcPath(TRACKS.exercise, b.from, b.done)} fill="var(--live)" />
          </g>
        ))}
        {sleep.map((b, i) => (
          <g key={`s${i}`}>
            <title>{span('Sleep', b)}</title>
            <path d={arcPath(TRACKS.sleep, b.from, b.to)} fill="var(--planned)" />
            <path d={arcPath(TRACKS.sleep, b.from, b.done)} fill="var(--series-1)" />
          </g>
        ))}
      </g>

      {/* now hand */}
      <g className="ring-hand" style={{ transform: `rotate(${(now / MIN_PER_DAY) * 360}deg)`, transformOrigin: `${C}px ${C}px` }}>
        <line x1={C} y1={C - 108} x2={C} y2={C - 194} stroke="var(--ink)" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={C} cy={C - 194} r={5} fill="var(--ink)" />
      </g>

      <text x={C} y={C - 44} textAnchor="middle">
        Ship time
      </text>
      <text className="ring-time" x={C} y={C + 14} textAnchor="middle">
        {formatClock(now)}
      </text>
      <text className="ring-state" x={C} y={C + 46} textAnchor="middle">
        {STATE[activity]}
      </text>
    </svg>
  )
}
