import { BarChart } from '../charts/BarChart'
import { LineChart } from '../charts/LineChart'
import { Section } from '../components/bits'
import { ReactionTest } from '../components/ReactionTest'
import { formatClock, formatHours } from '../sim/mission'
import { dayRecord, sleepStats } from '../sim/model'
import { useCrew, useSnapshot } from '../store/hooks'
import { dayKey, useStore } from '../store/store'

const MOODS = ['Low', 'Flat', 'OK', 'Good', 'Great']

export function SleepMind() {
  const crew = useCrew()
  const scenarios = useStore((s) => s.scenarios)
  const moods = useStore((s) => s.moods)
  const setMood = useStore((s) => s.setMood)
  const reactions = useStore((s) => s.reactions)
  const addReaction = useStore((s) => s.addReaction)
  const snap = useSnapshot()
  const day = snap.day
  const rec = dayRecord(crew, day, scenarios)
  const stats = sleepStats(crew, day, scenarios)
  const todayMood = moods[dayKey(crew.id, day)]

  const nights = Array.from({ length: 14 }, (_, i) => {
    const d = Math.max(1, day - 13 + i)
    const r = dayRecord(crew, d, scenarios)
    return { label: `Night before day ${d}`, value: r.sleepHours, tick: i % 2 === 1 ? String(d) : undefined }
  })

  const moodDays = Array.from({ length: 14 }, (_, i) => {
    const d = Math.max(1, day - 13 + i)
    const logged = moods[dayKey(crew.id, d)]
    return { x: d, y: d === day ? (logged ?? NaN) : (logged ?? dayRecord(crew, d, scenarios).mood) }
  }).filter((p) => !Number.isNaN(p.y))

  const reactionDays = Array.from({ length: 14 }, (_, i) => {
    const d = Math.max(1, day - 13 + i)
    const mine = reactions.filter((r) => r.crewId === crew.id && r.day === d)
    return { x: d, y: mine.length ? mine[mine.length - 1].ms : dayRecord(crew, d, scenarios).reactionMs, own: mine.length > 0 }
  }).filter((p) => p.x !== day || p.own)

  const shift = stats.clockShiftMin
  const clockText =
    Math.abs(shift) < 20 ? 'On schedule' : `${formatHours(Math.abs(shift) / 60)} ${shift > 0 ? 'late' : 'early'}`

  return (
    <>
      <h1 className="page-title">Sleep and mind</h1>
      <p className="page-intro">
        Months in a small cabin with no sunrise wear on sleep, mood and attention. A few quick daily measures show a slide early, while it
        is still easy to fix.
      </p>

      <Section title="Sleep">
        <div className="split split-wide">
          <BarChart
            label="Hours of sleep on each of the last 14 nights"
            bars={nights}
            yMax={10}
            yFormat={(v) => formatHours(v)}
            xHeader="Night"
            yHeader="Sleep"
            refLine={{ y: crew.sleepNeed, label: `You need ${formatHours(crew.sleepNeed)}` }}
            height={230}
          />
          <dl className="facts">
            <div>
              <dt>Last night</dt>
              <dd>
                {formatHours(rec.sleepHours)}{' '}
                <small>
                  {formatClock(rec.sleepStart)} to {formatClock(rec.sleepEnd)}
                </small>
              </dd>
            </div>
            <div>
              <dt>7-night average</dt>
              <dd>{formatHours(stats.avg7)}</dd>
            </div>
            <div>
              <dt>Sleep owed this week</dt>
              <dd>{formatHours(stats.debt7)}</dd>
            </div>
            <div>
              <dt>Body clock</dt>
              <dd>{clockText}</dd>
            </div>
          </dl>
        </div>
      </Section>

      <div className="split">
        <Section title="How do you feel today?" note="One tap a day. Only you and the flight surgeon see this.">
          <div className="mood-row" role="group" aria-label="Mood today">
            {MOODS.map((name, i) => (
              <button key={name} className="mood-btn" aria-pressed={todayMood === i + 1} onClick={() => setMood(i + 1)}>
                {name}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 28 }}>
            <LineChart
              label="Mood logged on each of the last 14 days, from 1 low to 5 great"
              series={[{ name: 'Mood', points: moodDays }]}
              xFormat={(x) => `Day ${Math.round(x)}`}
              yFormat={(y) => MOODS[Math.round(y) - 1] ?? ''}
              xHeader="Mission day"
              yDomain={[0.5, 5.5]}
              height={200}
            />
          </div>
        </Section>

        <Section title="Reaction test" note="Slower reactions are an early sign of sleep loss. Take it once a day, at about the same time.">
          <ReactionTest baselineMs={crew.reactionBaselineMs} onResult={addReaction} />
          <div style={{ marginTop: 28 }}>
            <LineChart
              label="Average reaction time on each of the last 14 days"
              series={[{ name: 'Reaction time', points: reactionDays }]}
              xFormat={(x) => `Day ${Math.round(x)}`}
              yFormat={(y) => `${Math.round(y)} ms`}
              xHeader="Mission day"
              refs={[
                { y: crew.reactionBaselineMs, label: `Before launch ${crew.reactionBaselineMs} ms` },
                { y: Math.round(crew.reactionBaselineMs * 1.2), label: '20% slower', tone: 'watch' },
              ]}
              height={200}
            />
          </div>
        </Section>
      </div>
    </>
  )
}
