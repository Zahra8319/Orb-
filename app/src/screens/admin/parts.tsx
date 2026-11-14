import { Link } from 'react-router-dom'
import { LevelIcon } from '../../components/bits'
import { LEVEL_WORD } from '../../rules/alerts'
import type { CrewStatus, FleetAlert } from '../../rules/fleet'
import { CAREER_LIMIT_MSV, formatHours } from '../../sim/mission'
import { crewById } from '../../sim/crew'
import { useStore } from '../../store/store'

const ACTIVITY = { sleep: 'asleep', cardio: 'on cardio', resistance: 'on resistance', awake: 'awake' } as const

/** One alert in Mission Control's lists, with who it is for and a way to mark it seen. */
export function AlertRow({ alert, showCrew = true }: { alert: FleetAlert; showCrew?: boolean }) {
  const acknowledge = useStore((s) => s.acknowledge)
  const crew = crewById(alert.crewId)
  return (
    <li className="need mc-alert" data-seen={alert.seen || undefined}>
      <LevelIcon level={alert.level} />
      <div>
        <div className="need-title">
          {showCrew && (
            <>
              <Link to={`/admin/crew/${crew.id}`}>{crew.name}</Link>:{' '}
            </>
          )}
          {alert.title}
        </div>
        <div className="need-action">They have been told: {alert.action}</div>
      </div>
      <div className="mc-alert-side">
        <span className="need-level">{LEVEL_WORD[alert.level]}</span>
        {alert.seen ? (
          <span className="mc-seen">Seen</span>
        ) : (
          <button className="btn btn-quiet btn-small" onClick={() => acknowledge(alert.key, alert.level)}>
            Mark seen
          </button>
        )}
      </div>
    </li>
  )
}

export function AlertList({ alerts, showCrew = true, empty }: { alerts: FleetAlert[]; showCrew?: boolean; empty: string }) {
  if (!alerts.length) return <p className="empty">{empty}</p>
  return (
    <ul className="needs">
      {alerts.map((a) => (
        <AlertRow key={a.key} alert={a} showCrew={showCrew} />
      ))}
    </ul>
  )
}

/** A crew member at a glance: their worst alert and the readings that matter most. */
export function CrewCard({ status }: { status: CrewStatus }) {
  const { crew, snap, worst, unseen } = status
  const careerShare = snap.careerDose / CAREER_LIMIT_MSV
  return (
    <Link to={`/admin/crew/${crew.id}`} className="mc-card" data-level={worst ?? undefined}>
      <div className="mc-card-head">
        <div>
          <div className="mc-card-name">{crew.name}</div>
          <div className="mc-card-role">
            {crew.role}, {ACTIVITY[snap.vitals.activity]}
          </div>
        </div>
        <div className="mc-card-state">
          {worst ? (
            <>
              <LevelIcon level={worst} /> {LEVEL_WORD[worst]}
            </>
          ) : (
            'All clear'
          )}
        </div>
      </div>
      <dl className="mc-card-facts">
        <div>
          <dt>Heart rate</dt>
          <dd>
            {Math.round(snap.vitals.heartRate)}
            <small> /min{snap.vitals.irregular ? ', irregular' : ''}</small>
          </dd>
        </div>
        <div>
          <dt>Blood oxygen</dt>
          <dd>
            {Math.round(snap.vitals.spo2)}
            <small> %</small>
          </dd>
        </div>
        <div>
          <dt>Sleep, 7 nights</dt>
          <dd>{formatHours(snap.sleepAvg7)}</dd>
        </div>
        <div>
          <dt>Career dose</dt>
          <dd>
            {Math.round(careerShare * 100)}
            <small> % of limit</small>
          </dd>
        </div>
      </dl>
      <div className="mc-card-foot">
        {unseen > 0 ? `${unseen} alert${unseen === 1 ? '' : 's'} not yet seen` : status.alerts.length ? 'All alerts seen' : 'No alerts'}
      </div>
    </Link>
  )
}
