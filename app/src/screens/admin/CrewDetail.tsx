import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Readout, Section } from '../../components/bits'
import { THRESHOLDS } from '../../rules/alerts'
import { CAREER_LIMIT_MSV, formatHours } from '../../sim/mission'
import { useFleet } from '../../store/hooks'
import { useSession } from '../../store/session'
import { AlertList } from './parts'

/** One crew member in full, as Mission Control sees them. */
export function CrewDetail() {
  const { id } = useParams()
  const fleet = useFleet()
  const viewAs = useSession((s) => s.viewAs)
  const navigate = useNavigate()
  const status = fleet.crew.find((c) => c.crew.id === id)
  if (!status) return <Navigate to="/admin" replace />

  const { crew, snap, alerts } = status
  const first = crew.name.split(' ')[0]
  // Each reading takes its level from the alert the rules raised, so they always agree.
  const lvl = (alertId: string) => alerts.find((a) => a.id === alertId)?.level ?? null
  const careerShare = snap.careerDose / CAREER_LIMIT_MSV

  return (
    <>
      <p className="mc-back">
        <Link className="link" to="/admin">
          All crew
        </Link>
      </p>
      <h1 className="page-title">{crew.name}</h1>
      <p className="page-intro">
        {crew.role}. Usual resting heart rate {crew.restingHr}, needs {formatHours(crew.sleepNeed)} of sleep.
      </p>
      <div className="mc-actions">
        <button
          className="btn"
          onClick={() => {
            viewAs(crew.id)
            navigate('/')
          }}
        >
          Open {first}&rsquo;s Orb
        </button>
        <span className="muted">See exactly what {first} sees on board.</span>
      </div>

      <Section title="Alerts">
        <AlertList alerts={alerts} showCrew={false} empty={`Nothing needs attention for ${first}.`} />
      </Section>

      <Section title="Body right now">
        <div className="readouts readouts-4">
          <Readout
            label="Heart rate"
            value={Math.round(snap.vitals.heartRate)}
            unit="beats/min"
            note={snap.vitals.irregular ? 'irregular rhythm' : snap.vitals.activity}
            level={lvl('rhythm') ?? lvl('heart-rate')}
          />
          <Readout
            label="Blood oxygen"
            value={Math.round(snap.vitals.spo2)}
            unit="%"
            note={`normal is ${THRESHOLDS.spo2.watch} or more`}
            level={lvl('spo2')}
          />
          <Readout label="Breathing" value={Math.round(snap.vitals.breathing)} unit="breaths/min" />
          <Readout label="Skin temperature" value={snap.vitals.skinTemp.toFixed(1)} unit="°C" />
        </div>
      </Section>

      <Section title="Sleep, exercise and alertness">
        <div className="readouts readouts-4">
          <Readout
            label="Sleep, 7-night average"
            value={formatHours(snap.sleepAvg7)}
            note={`${formatHours(snap.sleepDebt7)} short of need this week`}
            level={lvl('sleep')}
          />
          <Readout
            label="Exercise missed"
            value={snap.missedExerciseDays}
            unit={snap.missedExerciseDays === 1 ? 'day' : 'days'}
            note="in a row"
            level={lvl('exercise')}
          />
          <Readout
            label="Reaction time"
            value={Math.round(snap.reactionMs)}
            unit="ms"
            note={`pre-flight ${snap.reactionBaselineMs} ms`}
            level={lvl('reaction')}
          />
          <Readout label="Eye check" value={snap.eyeCheckDue ? 'Due today' : 'Up to date'} note="every 14 days" />
        </div>
      </Section>

      <Section title="Radiation">
        <div className="readouts readouts-4">
          <Readout label="This mission" value={Math.round(snap.missionDose)} unit="mSv" />
          <Readout
            label="Career"
            value={Math.round(snap.careerDose)}
            unit="mSv"
            note={`${Math.round(careerShare * 100)}% of the ${CAREER_LIMIT_MSV} mSv limit`}
            level={lvl('career-dose')}
          />
          <Readout label="Earlier flights" value={crew.priorDoseMsv} unit="mSv" />
        </div>
      </Section>
    </>
  )
}
