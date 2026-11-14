import { BarChart } from '../charts/BarChart'
import { LineChart } from '../charts/LineChart'
import { Section } from '../components/bits'
import { formatClock } from '../sim/mission'
import { bodySeries, dayRecord, exerciseSoFar, eyeCheckDue, nextEyeCheck } from '../sim/model'
import { useCrew, useSnapshot } from '../store/hooks'
import { dayKey, useStore } from '../store/store'

export function Body() {
  const crew = useCrew()
  const t = useStore((s) => s.t)
  const scenarios = useStore((s) => s.scenarios)
  const logEyeCheck = useStore((s) => s.logEyeCheck)
  const snap = useSnapshot()
  const day = snap.day
  const eyeDone = useStore((s) => Boolean(s.eyeChecks[dayKey(s.crewId, day)]))
  const rec = dayRecord(crew, day, scenarios)
  const done = exerciseSoFar(crew, t, scenarios)

  const body = bodySeries(crew, day, scenarios)
  const last = body[body.length - 1]
  const noExerciseBone = body.map((p) => ({ x: p.day, y: (-1.25 / 30) * p.day }))

  const exerciseBars = Array.from({ length: 14 }, (_, i) => {
    const d = day - 14 + i
    const r = dayRecord(crew, Math.max(1, d), scenarios)
    return { label: `Day ${d}`, value: r.cardioDone + r.resistanceDone, tick: i % 2 === 1 ? String(d) : undefined }
  })

  const heart = Array.from({ length: 30 }, (_, i) => {
    const d = Math.max(1, day - 29 + i)
    return { x: d, y: dayRecord(crew, d, scenarios).restingHr }
  })

  const dueToday = eyeCheckDue(crew, day)
  const nextEye = dueToday && eyeDone ? nextEyeCheck(crew, day + 1) : nextEyeCheck(crew, day)

  return (
    <>
      <h1 className="page-title">Body</h1>
      <p className="page-intro">
        Without gravity, bones and muscles weaken and the heart works differently. Daily exercise is the main protection, so this page
        tracks what you have done and what it is saving.
      </p>

      <Section title="Exercise today">
        <div>
          <div className="progress-row">
            <div>
              <div className="progress-name">Cardio</div>
              <div className="muted">from {formatClock(rec.cardioStart)}</div>
            </div>
            <div className="progress-track" role="progressbar" aria-label="Cardio" aria-valuemin={0} aria-valuemax={done.cardioPlanned} aria-valuenow={Math.round(done.cardioDone)}>
              <div className="progress-fill" style={{ width: `${(done.cardioDone / done.cardioPlanned) * 100}%` }} />
            </div>
            <div className="progress-value">
              {Math.round(done.cardioDone)} of {done.cardioPlanned} min
            </div>
          </div>
          <div className="progress-row">
            <div>
              <div className="progress-name">Resistance</div>
              <div className="muted">from {formatClock(rec.resistanceStart)}</div>
            </div>
            <div className="progress-track" role="progressbar" aria-label="Resistance" aria-valuemin={0} aria-valuemax={done.resistancePlanned} aria-valuenow={Math.round(done.resistanceDone)}>
              <div className="progress-fill" style={{ width: `${(done.resistanceDone / done.resistancePlanned) * 100}%` }} />
            </div>
            <div className="progress-value">
              {Math.round(done.resistanceDone)} of {done.resistancePlanned} min
            </div>
          </div>
        </div>
      </Section>

      <Section title="Exercise, last 14 days" note="Minutes completed each day against the 100 minutes prescribed.">
        <BarChart
          label="Minutes of exercise completed on each of the last 14 days"
          bars={exerciseBars}
          yMax={120}
          yFormat={(v) => `${Math.round(v)} min`}
          xHeader="Mission day"
          yHeader="Exercise"
          refLine={{ y: 100, label: 'Prescribed 100 min' }}
        />
      </Section>

      <Section
        title="Bone and muscle since launch"
        note={`Estimated from your exercise record. Hip bone density is down ${Math.abs(last.bone).toFixed(1)}% and leg strength ${Math.abs(last.muscle).toFixed(1)}%. With no exercise, bone loss would be about ${Math.abs(noExerciseBone[noExerciseBone.length - 1].y).toFixed(1)}%.`}
      >
        <LineChart
          label="Estimated change in bone density and leg strength since launch, compared with bone loss without exercise"
          series={[
            { name: 'Hip bone density', points: body.map((p) => ({ x: p.day, y: p.bone })) },
            { name: 'Leg strength', points: body.map((p) => ({ x: p.day, y: p.muscle })), style: 'dashed' },
            { name: 'Bone, no exercise', points: noExerciseBone, style: 'dotted', tone: 2 },
          ]}
          xFormat={(x) => `Day ${Math.round(x)}`}
          yFormat={(y) => `${y.toFixed(1)}%`}
          xHeader="Mission day"
          directLabels
          height={280}
        />
      </Section>

      <div className="split">
        <Section title="Heart" note="Resting heart rate each morning for the last 30 days.">
          <LineChart
            label="Resting heart rate each morning over the last 30 days"
            series={[{ name: 'Resting heart rate', points: heart }]}
            xFormat={(x) => `Day ${Math.round(x)}`}
            yFormat={(y) => `${Math.round(y)}`}
            xHeader="Mission day"
            refs={[{ y: crew.restingHr, label: `Before launch ${crew.restingHr}` }]}
            height={200}
          />
          <dl className="facts" style={{ marginTop: 24 }}>
            <div>
              <dt>Blood pressure, this morning</dt>
              <dd>
                {rec.systolic}/{rec.diastolic} <small>mmHg</small>
              </dd>
            </div>
          </dl>
        </Section>

        <Section
          title="Eyes"
          note="Fluid shifts towards the head in weightlessness and can change the shape of the eye. A check every 14 days catches it early."
        >
          <dl className="facts">
            <div>
              <dt>Next eye check</dt>
              <dd>{dueToday && !eyeDone ? 'Due today' : `Day ${nextEye}`}</dd>
            </div>
          </dl>
          <p style={{ marginTop: 16 }}>
            {dueToday && !eyeDone ? (
              <button className="btn" onClick={logEyeCheck}>
                Log eye check as done
              </button>
            ) : dueToday ? (
              <span className="muted">Eye check logged today.</span>
            ) : (
              <span className="muted">Nothing to do until then.</span>
            )}
          </p>
        </Section>
      </div>
    </>
  )
}
