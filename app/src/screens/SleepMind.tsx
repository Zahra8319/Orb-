import { Link } from 'react-router-dom'
import { BarChart } from '../charts/BarChart'
import { gameTaps, memoryForDay, MIN_GAME_TAPS, reactionForDay } from '../games/health'
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
  const gamePlays = useStore((s) => s.gamePlays)
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
    const own = reactionForDay(reactions, gamePlays, crew.id, d)
    return { x: d, y: own?.ms ?? dayRecord(crew, d, scenarios).reactionMs, own: own !== undefined }
  }).filter((p) => p.x !== day || p.own)

  const today = reactionForDay(reactions, gamePlays, crew.id, day)
  const tapsToday = gameTaps(gamePlays, crew.id, day).length
  const spanToday = memoryForDay(gamePlays, crew.id, day)
  const spanWeek = Array.from({ length: 7 }, (_, i) => memoryForDay(gamePlays, crew.id, day - i)).reduce<number | undefined>(
    (m, v) => (v === undefined ? m : Math.max(m ?? 0, v)),
    undefined,
  )

  const shift = stats.clockShiftMin
  const clockText =
    Math.abs(shift) < 20 ? 'On schedule' : `${formatHours(Math.abs(shift) / 60)} ${shift > 0 ? 'late' : 'early'}`
  const debtNights = stats.debt7 / crew.sleepNeed

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Sleep and mind</h1>
        <p className="page-intro">
          Months in a small cabin with no sunrise wear on sleep, mood and attention. A few quick daily measures show a slide early, while it
          is still easy to fix.
        </p>
      </header>

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

        <div className={`debt-callout ${debtNights >= 2 ? 'act' : debtNights >= 1 ? 'watch' : 'nominal'}`}>
          <div className="debt-head">
            <span>Sleep debt, last 7 nights</span>
            <strong>{formatHours(stats.debt7)}</strong>
          </div>
          <div
            className="debt-track"
            role="progressbar"
            aria-label="Seven-night sleep debt"
            aria-valuemin={0}
            aria-valuemax={3}
            aria-valuenow={Math.round(Math.min(3, debtNights) * 10) / 10}
          >
            <div className="debt-fill" style={{ width: `${Math.min(100, (debtNights / 3) * 100)}%` }} />
          </div>
          <p>
            {debtNights < 1
              ? 'Debt is under one night. The routine is holding.'
              : `About ${debtNights.toFixed(1)} nights of sleep owed. Two nights or more triggers a medical review and a protected sleep period.`}
          </p>
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
          <p className="mood-caption">
            <span>{todayMood ? `Logged today: ${MOODS[todayMood - 1]}` : 'Not logged yet today'}</span>
            <span className="mood-scale">1 Low · 5 Great</span>
          </p>
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

      <Section
        title="From your games"
        note="Breaks count too. The reaction test above wins on days you take it, because it is the calibrated measure."
      >
        <dl className="facts">
          <div>
            <dt>Reaction Rush today</dt>
            <dd>
              {today?.source === 'game' ? (
                <>
                  {today.ms} ms <small>median of {today.taps} taps, counted above</small>
                </>
              ) : today?.source === 'test' ? (
                <>
                  {tapsToday} {tapsToday === 1 ? 'tap' : 'taps'} <small>today's reading is from the test</small>
                </>
              ) : (
                <>
                  {tapsToday} of {MIN_GAME_TAPS} taps <small>needed for a reading</small>
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>Simon Says today</dt>
            <dd>
              {spanToday !== undefined ? `Sequence of ${spanToday}` : 'Not played'}{' '}
              {spanWeek !== undefined && <small>best this week {spanWeek}</small>}
            </dd>
          </div>
        </dl>
        <p style={{ marginTop: 16 }}>
          <Link className="link" to="/games/reaction">Play Reaction Rush</Link>
          {'  ·  '}
          <Link className="link" to="/games/simon-says">Play Simon Says</Link>
        </p>
      </Section>
    </>
  )
}
