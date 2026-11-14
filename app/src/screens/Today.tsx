import { Link } from 'react-router-dom'
import { DayRing } from '../charts/DayRing'
import { dayBlocks } from '../charts/dayBlocks'
import { TrendStrip } from '../charts/TrendStrip'
import { LevelIcon, Readout } from '../components/bits'
import { LEVEL_WORD } from '../rules/alerts'
import { CAREER_LIMIT_MSV, dayOf, formatClock, formatHours } from '../sim/mission'
import { bodySeries, dayRecord, missionDose, sleepStats, vitalsAt } from '../sim/model'
import { useAlerts, useCrew, useSnapshot, useTodayReaction } from '../store/hooks'
import { dayKey, useStore } from '../store/store'

interface Task {
  id: string
  title: string
  detail: string
  to: string
}

const ACTIVITY_NOTE = { sleep: 'asleep', cardio: 'during cardio', resistance: 'during resistance', awake: 'at rest' } as const

export function Today() {
  const crew = useCrew()
  const t = useStore((s) => s.t)
  const scenarios = useStore((s) => s.scenarios)
  const moodLogged = useStore((s) => s.moods[dayKey(s.crewId, dayOf(s.t))] !== undefined)
  const reactionToday = useTodayReaction()
  const snap = useSnapshot()
  const alerts = useAlerts()
  const day = snap.day
  const firstName = crew.name.split(' ')[0]

  const { sleep, exercise, light, rec } = dayBlocks(crew, t, scenarios)
  const exerciseDone = exercise.reduce((sum, b) => sum + (b.done - b.from), 0)
  const exercisePlanned = rec.cardioPlanned + rec.resistancePlanned
  const lightHours = light.reduce((sum, b) => sum + (b.done - b.from), 0) / 60
  const cardioLeft = Math.round(rec.cardioDone - (exercise[0].done - exercise[0].from))
  const resistanceLeft = Math.round(rec.resistanceDone - (exercise[1].done - exercise[1].from))

  const tasks: Task[] = []
  if (cardioLeft > 0) {
    tasks.push({ id: 'cardio', title: `Cardio, ${cardioLeft} min`, detail: `Starts at ${formatClock(rec.cardioStart)}`, to: '/body' })
  }
  if (resistanceLeft > 0) {
    tasks.push({ id: 'resistance', title: `Resistance exercise, ${resistanceLeft} min`, detail: `Starts at ${formatClock(rec.resistanceStart)}`, to: '/body' })
  }
  if (snap.eyeCheckDue) {
    tasks.push({ id: 'eye', title: 'Eye check', detail: 'Due today, every 14 days', to: '/body' })
  }
  if (!moodLogged) {
    tasks.push({ id: 'mood', title: 'Log how you feel', detail: 'One tap', to: '/sleep' })
  }
  if (reactionToday === undefined) {
    tasks.push({ id: 'reaction', title: 'Reaction test', detail: 'About a minute', to: '/sleep' })
  }

  // The alert band already carries the most serious alert, so the headline counts them instead.
  const COUNT = ['', 'One thing needs', 'Two things need', 'Three things need', 'Four things need', 'Five things need']
  const headline = alerts.length
    ? `${COUNT[alerts.length] ?? `${alerts.length} things need`} you, ${firstName}.`
    : `All clear, ${firstName}.`
  const sub = alerts.length
    ? 'They are listed below, most serious first. Each one says what to do.'
    : tasks.length
      ? `Nothing needs attention. ${tasks.length} ${tasks.length === 1 ? 'thing is' : 'things are'} left on today’s plan.`
      : 'Nothing needs attention, and today’s plan is done.'

  // Last 30 minutes of heart rate, one reading a minute.
  const heartTrace = Array.from({ length: 31 }, (_, i) => vitalsAt(crew, t - (30 - i), scenarios).heartRate)

  const body = bodySeries(crew, day, scenarios)
  const every = (n: number) => body.filter((_, i) => i % n === 0 || i === body.length - 1)
  const doseTrend = every(4).map((p) => missionDose(crew, p.day * 1440, scenarios))
  const sleepTrend = Array.from({ length: 14 }, (_, i) => dayRecord(crew, Math.max(1, day - 13 + i), scenarios).sleepHours)
  const stats = sleepStats(crew, day, scenarios)
  const last = body[body.length - 1]

  return (
    <>
      <h1 className="headline">{headline}</h1>
      <p className="headline-sub">{sub}</p>

      <div className="today-grid">
        <div className="ring-wrap">
          <DayRing crew={crew} t={t} scenarios={scenarios} />
          <ul className="ring-legend">
            <li>
              <i className="swatch" style={{ background: 'var(--series-1)' }} />
              Sleep
              <b>{formatHours(rec.sleepHours)} last night</b>
            </li>
            <li>
              <i className="swatch" style={{ background: 'var(--live)' }} />
              Exercise
              <b>
                {Math.round(exerciseDone)} of {exercisePlanned} min
              </b>
            </li>
            <li>
              <i className="swatch" style={{ background: 'var(--light-done)' }} />
              Bright light
              <b>{formatHours(lightHours)} so far</b>
            </li>
            <li className="muted">
              <i className="swatch" style={{ background: 'var(--planned)' }} />
              Still planned today
              <span>next sleep {formatClock(sleep[1].from)}</span>
            </li>
          </ul>
        </div>

        <div className="today-side">
          <section>
            <h2 className="subhead">Right now</h2>
            <div className="readouts readouts-4">
              <Readout
                label="Heart rate"
                value={snap.vitals.heartRate}
                unit="beats/min"
                note={snap.vitals.irregular ? 'Irregular rhythm' : ACTIVITY_NOTE[snap.vitals.activity]}
                level={snap.vitals.irregular ? 'urgent' : null}
              >
                <TrendStrip values={heartTrace} live />
              </Readout>
              <Readout
                label="Blood oxygen"
                value={snap.vitals.spo2}
                unit="%"
                note={snap.vitals.spo2 >= 94 ? 'normal is 94 or more' : 'below 94'}
                level={snap.vitals.spo2 < 90 ? 'urgent' : snap.vitals.spo2 < 94 ? 'watch' : null}
              />
              <Readout label="Breathing" value={snap.vitals.breathing} unit="breaths/min" />
              <Readout label="Skin temperature" value={snap.vitals.skinTemp.toFixed(1)} unit={'°C'} />
            </div>
          </section>

          <section>
            <h2 className="subhead">Needs you today</h2>
            {alerts.length + tasks.length === 0 ? (
              <p className="empty">Nothing left. Enjoy the quiet.</p>
            ) : (
              <ul className="needs">
                {alerts.map((a) => (
                  <li key={a.id} className="need">
                    <LevelIcon level={a.level} />
                    <div>
                      <div className="need-title">
                        <Link to={a.to}>{a.title}</Link>
                      </div>
                      <div className="need-action">{a.action}</div>
                    </div>
                    <div className="need-level">{LEVEL_WORD[a.level]}</div>
                  </li>
                ))}
                {tasks.map((task) => (
                  <li key={task.id} className="need">
                    <LevelIcon level="todo" />
                    <div>
                      <div className="need-title">
                        <Link to={task.to}>{task.title}</Link>
                      </div>
                      <div className="need-action">{task.detail}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="section">
        <h2 className="section-title">Since launch</h2>
        <div className="section-body strips">
          <Link className="strip" to="/body">
            <div className="strip-label">Hip bone density, estimated</div>
            <div className="strip-value">{last.bone.toFixed(1)}%</div>
            <TrendStrip values={every(4).map((p) => p.bone)} />
          </Link>
          <Link className="strip" to="/body">
            <div className="strip-label">Leg strength, estimated</div>
            <div className="strip-value">{last.muscle.toFixed(1)}%</div>
            <TrendStrip values={every(4).map((p) => p.muscle)} />
          </Link>
          <Link className="strip" to="/radiation">
            <div className="strip-label">Career radiation dose</div>
            <div className="strip-value">
              {Math.round(snap.careerDose)} <small>of {CAREER_LIMIT_MSV} mSv</small>
            </div>
            <TrendStrip values={doseTrend} />
          </Link>
          <Link className="strip" to="/sleep">
            <div className="strip-label">Sleep, 7-night average</div>
            <div className="strip-value">{formatHours(stats.avg7)}</div>
            <TrendStrip values={sleepTrend} />
          </Link>
        </div>
      </section>
    </>
  )
}
