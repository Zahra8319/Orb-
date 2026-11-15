import { useMemo } from 'react'
import { Section, Readout } from '../components/bits'
import { evaluate } from '../rules/alerts'
import { snapshot } from '../sim/model'
import { CREW } from '../sim/crew'
import { dayOf } from '../sim/mission'
import { useStore } from '../store/store'

export function Command() {
  const t = useStore((s) => s.t)
  const scenarios = useStore((s) => s.scenarios)
  const crewId = useStore((s) => s.crewId)

  // Get snapshots for all crew members
  const allSnapshots = useMemo(() => {
    return CREW.map((crew) => ({
      crew,
      snap: snapshot(crew, t, scenarios),
      alerts: evaluate(snapshot(crew, t, scenarios)),
    }))
  }, [t, scenarios])

  const currentCrew = CREW.find((c) => c.id === crewId) ?? CREW[0]

  // Summary stats
  const totalAlerts = allSnapshots.reduce((sum, s) => sum + s.alerts.length, 0)
  const urgentAlerts = allSnapshots.reduce((sum, s) => sum + s.alerts.filter((a) => a.level === 'urgent').length, 0)
  const actAlerts = allSnapshots.reduce((sum, s) => sum + s.alerts.filter((a) => a.level === 'act').length, 0)
  const watchAlerts = allSnapshots.reduce((sum, s) => sum + s.alerts.filter((a) => a.level === 'watch').length, 0)

  // Crew needing medical officer attention
  const needsMedical = allSnapshots.filter((s) =>
    s.alerts.some((a) => ['rhythm', 'spo2', 'heart-rate', 'co2', 'o2', 'solar-storm'].includes(a.id))
  )

  // Crew with exercise issues
  const exerciseIssues = allSnapshots.filter((s) =>
    s.alerts.some((a) => a.id === 'exercise')
  )

  // Crew with sleep issues
  const sleepIssues = allSnapshots.filter((s) =>
    s.alerts.some((a) => ['sleep', 'reaction'].includes(a.id))
  )

  // Radiation exposure comparison
  const radiationData = allSnapshots.map((s) => ({
    name: s.crew.name,
    careerDose: Math.round(s.snap.careerDose),
    missionDose: Math.round(s.snap.missionDose),
    doseRate: Math.round(s.snap.doseRate * 10) / 10,
    priorDose: s.crew.priorDoseMsv,
  }))

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Command Dashboard</h1>
        <p className="page-intro">
          Commander's overview of all crew health status. View alerts, resource conflicts, and mission-critical metrics at a glance.
          Current viewer: <strong>{currentCrew.name}</strong> ({currentCrew.role}).
        </p>
      </header>

      <Section title="Crew Alert Summary" note={`${totalAlerts} total alerts across crew • ${urgentAlerts} urgent, ${actAlerts} act, ${watchAlerts} watch`}>
        <div className="command-summary">
          <Readout big label="Urgent" value={urgentAlerts} unit="alerts" level="urgent" note="Immediate action required" />
          <Readout big label="Act Today" value={actAlerts} unit="alerts" level="act" note="Action required today" />
          <Readout big label="Watch" value={watchAlerts} unit="alerts" level="watch" note="Monitor closely" />
          <Readout big label="Total Crew" value={CREW.length} unit="members" note="All accounted for" />
        </div>
      </Section>

      <Section title="Crew Status Grid" note="Click a crew member to view their detailed alerts.">
        <div className="crew-grid">
          {allSnapshots.map(({ crew, snap, alerts }) => {
            const hasUrgent = alerts.some((a) => a.level === 'urgent')
            const hasAct = alerts.some((a) => a.level === 'act')
            const statusClass = hasUrgent ? 'urgent' : hasAct ? 'act' : alerts.length > 0 ? 'watch' : 'nominal'

            return (
              <article key={crew.id} className={`crew-card ${statusClass} ${crew.id === crewId ? 'current' : ''}`}>
                <div className="crew-card-header">
                  <div className="crew-avatar">{crew.name.split(' ')[1][0]}</div>
                  <div className="crew-info">
                    <h4>{crew.name}</h4>
                    <span className="crew-role">{crew.role}</span>
                  </div>
                  <span className={`status-badge ${statusClass}`}>
                    {hasUrgent ? 'URGENT' : hasAct ? 'ACT' : alerts.length > 0 ? 'WATCH' : 'NOMINAL'}
                  </span>
                </div>

                <div className="crew-vitals">
                  <div className="vital">
                    <span className="vital-label">HR</span>
                    <span className="vital-value">{snap.vitals.heartRate}</span>
                    <span className="vital-unit">bpm</span>
                  </div>
                  <div className="vital">
                    <span className="vital-label">SpO₂</span>
                    <span className="vital-value">{snap.vitals.spo2}</span>
                    <span className="vital-unit">%</span>
                  </div>
                  <div className="vital">
                    <span className="vital-label">Sleep</span>
                    <span className="vital-value">{snap.sleepAvg7.toFixed(1)}</span>
                    <span className="vital-unit">h/night</span>
                  </div>
                  <div className="vital">
                    <span className="vital-label">Dose</span>
                    <span className="vital-value">{Math.round(snap.careerDose)}</span>
                    <span className="vital-unit">mSv</span>
                  </div>
                </div>

                <div className="crew-alerts">
                  {alerts.length === 0 ? (
                    <span className="no-alerts">All systems nominal</span>
                  ) : (
                    alerts.map((a) => (
                      <span key={a.id} className={`alert-pill ${a.level}`}>
                        {a.title}
                      </span>
                    ))
                  )}
                </div>

                {crew.id !== crewId && (
                  <button className="btn btn-quiet btn-small crew-switch-btn">
                    View details →
                  </button>
                )}
              </article>
            )
          })}
        </div>
      </Section>

      <Section title="Resource Conflicts & Priorities" note="Identified conflicts requiring Commander decisions.">
        <div className="conflicts-grid">
          {needsMedical.length > 0 && (
            <div className="conflict-card medical">
              <h4>🏥 Medical Officer Attention Required</h4>
              <p>{needsMedical.length} crew member{needsMedical.length !== 1 ? 's' : ''} need medical officer evaluation.</p>
              <ul>
                {needsMedical.map((s) => (
                  <li key={s.crew.id}>
                    <strong>{s.crew.name}</strong> — {s.alerts.filter((a) => ['rhythm', 'spo2', 'heart-rate', 'co2', 'o2', 'solar-storm'].includes(a.id)).map((a) => a.title).join(', ')}
                  </li>
                ))}
              </ul>
              <div className="conflict-action">
                <strong>Commander decision:</strong> Prioritize medical officer time. Consider telemedicine consult for non-critical cases.
              </div>
            </div>
          )}

          {exerciseIssues.length > 0 && (
            <div className="conflict-card exercise">
              <h4>💪 Exercise Non-Compliance</h4>
              <p>{exerciseIssues.length} crew member{exerciseIssues.length !== 1 ? 's' : ''} behind on exercise prescription.</p>
              <ul>
                {exerciseIssues.map((s) => (
                  <li key={s.crew.id}>
                    <strong>{s.crew.name}</strong> — {s.alerts.find((a) => a.id === 'exercise')?.action}
                  </li>
                ))}
              </ul>
              <div className="conflict-action">
                <strong>Commander decision:</strong> Mandate protected exercise time. Adjust work schedule if needed.
              </div>
            </div>
          )}

          {sleepIssues.length > 0 && (
            <div className="conflict-card sleep">
              <h4>😴 Sleep / Cognitive Degradation</h4>
              <p>{sleepIssues.length} crew member{sleepIssues.length !== 1 ? 's' : ''} showing sleep debt or cognitive slowing.</p>
              <ul>
                {sleepIssues.map((s) => (
                  <li key={s.crew.id}>
                    <strong>{s.crew.name}</strong> — {s.alerts.filter((a) => ['sleep', 'reaction'].includes(a.id)).map((a) => a.title).join(', ')}
                  </li>
                ))}
              </ul>
              <div className="conflict-action">
                <strong>Commander decision:</strong> Reassign critical tasks (piloting, robotics). Authorize protected sleep periods.
              </div>
            </div>
          )}

          {needsMedical.length === 0 && exerciseIssues.length === 0 && sleepIssues.length === 0 && (
            <div className="conflict-card nominal">
              <h4>✅ No Resource Conflicts</h4>
              <p>All crew within nominal parameters. No Commander intervention required at this time.</p>
            </div>
          )}
        </div>
      </Section>

      <Section title="Radiation Exposure Comparison" note="Career dose includes prior missions. Career limit: 600 mSv.">
        <div className="radiation-table">
          <table>
            <thead>
              <tr>
                <th>Crew Member</th>
                <th>Role</th>
                <th>Prior Dose (mSv)</th>
                <th>Mission Dose (mSv)</th>
                <th>Career Total (mSv)</th>
                <th>% of Limit</th>
                <th>Current Rate (mSv/day)</th>
              </tr>
            </thead>
            <tbody>
              {radiationData.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td>{CREW.find((c) => c.name === r.name)?.role}</td>
                  <td>{r.priorDose}</td>
                  <td>{r.missionDose}</td>
                  <td><strong>{r.careerDose}</strong></td>
                  <td>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${(r.careerDose / 600) * 100}%` }} />
                    </div>
                    <span>{((r.careerDose / 600) * 100).toFixed(0)}%</span>
                  </td>
                  <td>{r.doseRate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Mission Timeline & Critical Events" note="Upcoming events requiring Commander awareness.">
        <div className="timeline">
          <div className="timeline-item">
            <span className="timeline-time">Day {dayOf(t) + 7}</span>
            <span className="timeline-event">Scheduled EVA: Tanaka & Reyes</span>
            <span className="timeline-note">Verify pre-EVA checklists complete</span>
          </div>
          <div className="timeline-item">
            <span className="timeline-time">Day {dayOf(t) + 14}</span>
            <span className="timeline-event">Eye checks due: Okafor, Reyes</span>
            <span className="timeline-note">Schedule fundoscopy sessions</span>
          </div>
          <div className="timeline-item">
            <span className="timeline-time">Day {dayOf(t) + 21}</span>
            <span className="timeline-event">Mid-mission medical conference</span>
            <span className="timeline-note">Prepare crew health summary for Earth</span>
          </div>
          <div className="timeline-item">
            <span className="timeline-time">Day {dayOf(t) + 30}</span>
            <span className="timeline-event">Radiation shelter drill</span>
            <span className="timeline-note">Verify storm shelter readiness</span>
          </div>
        </div>
      </Section>
    </>
  )
}