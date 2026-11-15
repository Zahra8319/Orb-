import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Section, Readout } from '../components/bits'
import { evaluate } from '../rules/alerts'
import { nextEyeCheck, snapshot } from '../sim/model'
import { CREW } from '../sim/crew'
import { dayOf, formatClock, minuteOfDay } from '../sim/mission'
import { useStore } from '../store/store'

const LEVEL_RANK: Record<string, number> = { urgent: 0, act: 1, watch: 2, nominal: 3 }

function statusOf(alerts: ReturnType<typeof evaluate>): string {
  if (alerts.some((a) => a.level === 'urgent')) return 'urgent'
  if (alerts.some((a) => a.level === 'act')) return 'act'
  return alerts.length > 0 ? 'watch' : 'nominal'
}

export function Command() {
  const t = useStore((s) => s.t)
  const scenarios = useStore((s) => s.scenarios)
  const crewId = useStore((s) => s.crewId)
  const [openCrew, setOpenCrew] = useState<string | null>(null)

  // Snapshot every crew member, then rank the most urgent first.
  const allSnapshots = useMemo(() => {
    return CREW.map((crew) => {
      const snap = snapshot(crew, t, scenarios)
      const alerts = evaluate(snap)
      return { crew, snap, alerts, rank: LEVEL_RANK[statusOf(alerts)] }
    }).sort((a, b) => a.rank - b.rank || a.crew.name.localeCompare(b.crew.name))
  }, [t, scenarios])

  const currentCrew = CREW.find((c) => c.id === crewId) ?? CREW[0]
  const day = dayOf(t)

  const totalAlerts = allSnapshots.reduce((sum, s) => sum + s.alerts.length, 0)
  const urgentAlerts = allSnapshots.reduce((sum, s) => sum + s.alerts.filter((a) => a.level === 'urgent').length, 0)
  const actAlerts = allSnapshots.reduce((sum, s) => sum + s.alerts.filter((a) => a.level === 'act').length, 0)
  const watchAlerts = allSnapshots.reduce((sum, s) => sum + s.alerts.filter((a) => a.level === 'watch').length, 0)

  const medicalIds = ['rhythm', 'spo2', 'heart-rate', 'co2', 'o2', 'solar-storm']
  const needsMedical = allSnapshots.filter((s) => s.alerts.some((a) => medicalIds.includes(a.id)))
  const exerciseIssues = allSnapshots.filter((s) => s.alerts.some((a) => a.id === 'exercise'))
  const sleepIssues = allSnapshots.filter((s) => s.alerts.some((a) => ['sleep', 'reaction'].includes(a.id)))

  const radiationData = allSnapshots.map((s) => ({
    name: s.crew.name,
    role: s.crew.role,
    careerDose: Math.round(s.snap.careerDose),
    missionDose: Math.round(s.snap.missionDose),
    doseRate: Math.round(s.snap.doseRate * 10) / 10,
    priorDose: s.crew.priorDoseMsv,
  }))

  // Eye checks come from the model; planned events are mission-level.
  const eyeDue = CREW.map((c) => ({ day: nextEyeCheck(c, day), name: c.name })).sort((a, b) => a.day - b.day)
  const timeline = [
    ...eyeDue.slice(0, 2).map((e, i) => ({
      day: e.day,
      event: `Eye check due: ${e.name}`,
      note: i === 0 ? 'First in the 14-day rotation' : 'Second in the rotation — confirm slot',
    })),
    { day: day + 7, event: 'Scheduled EVA: Tanaka and Reyes', note: 'Verify pre-EVA checklists complete' },
    { day: day + 21, event: 'Mid-mission medical conference', note: 'Prepare crew health summary for Earth' },
    { day: day + 30, event: 'Radiation shelter drill', note: 'Verify storm shelter readiness' },
  ].sort((a, b) => a.day - b.day)

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Command dashboard</h1>
        <p className="page-intro">
          Commander&rsquo;s view of all four crew members. Alerts lead, followed by resource conflicts and mission-critical
          metrics. Viewer: <strong>{currentCrew.name}</strong> ({currentCrew.role}). As of{' '}
          {formatClock(minuteOfDay(t))} ship time, Day {day}.
        </p>
      </header>

      <Section
        title="Crew alert summary"
        note={`${totalAlerts} alerts across crew · ${urgentAlerts} urgent, ${actAlerts} act, ${watchAlerts} watch`}
      >
        <div className="command-summary">
          <Readout big label="Urgent" value={urgentAlerts} unit="alerts" level="urgent" note="Immediate action required" />
          <Readout big label="Act today" value={actAlerts} unit="alerts" level="act" note="Action required today" />
          <Readout big label="Watch" value={watchAlerts} unit="alerts" level="watch" note="Monitor closely" />
          <Readout big label="Total crew" value={CREW.length} unit="members" note="All accounted for" />
        </div>
      </Section>

      <Section title="Crew status" note="Most urgent first. Open a card for the full alert list and direct links to each reading.">
        <p className="sort-note">
          Sorted by <strong>severity</strong>, then name. Top strip on each card carries the current status.
        </p>
        <div className="crew-grid">
          {allSnapshots.map(({ crew, snap, alerts }) => {
            const statusClass = statusOf(alerts)
            const open = openCrew === crew.id
            const detailId = `crew-detail-${crew.id}`

            return (
              <article key={crew.id} className={`crew-card ${statusClass} ${crew.id === crewId ? 'current' : ''}`}>
                <div className="crew-card-header">
                  <div className="crew-avatar" aria-hidden="true">{crew.name.split(' ')[1][0]}</div>
                  <div className="crew-info">
                    <h4>{crew.name}</h4>
                    <span className="crew-role">
                      {crew.role}
                      {crew.id === crewId && <span className="you-marker"> · you</span>}
                    </span>
                  </div>
                  <span className={`status-badge ${statusClass}`}>
                    {statusClass === 'urgent'
                      ? 'URGENT'
                      : statusClass === 'act'
                        ? 'ACT'
                        : statusClass === 'watch'
                          ? 'WATCH'
                          : 'NOMINAL'}
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

                <button
                  className="btn btn-quiet btn-small crew-switch-btn"
                  aria-expanded={open}
                  aria-controls={detailId}
                  onClick={() => setOpenCrew(open ? null : crew.id)}
                >
                  {open ? 'Hide details' : 'View details'}
                </button>

                {open && (
                  <div className="crew-detail" id={detailId}>
                    {alerts.length === 0 ? (
                      <p className="muted">No active alerts. This crew member is fully nominal.</p>
                    ) : (
                      alerts.map((a) => (
                        <div key={a.id} className={`crew-detail-alert ${a.level}`}>
                          <strong>{a.title}</strong>
                          <span>{a.action}</span>
                          <Link to={a.to}>Open the reading</Link>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </Section>

      <Section title="Resource conflicts and priorities" note="Conflicts that need a Commander decision today.">
        <div className="conflicts-grid">
          {needsMedical.length > 0 && (
            <div className="conflict-card medical">
              <h4>Medical officer attention required</h4>
              <p>
                {needsMedical.length} crew member{needsMedical.length !== 1 ? 's need' : ' needs'} medical officer
                evaluation.
              </p>
              <ul>
                {needsMedical.map((s) => (
                  <li key={s.crew.id}>
                    <strong>{s.crew.name}</strong> —{' '}
                    {s.alerts
                      .filter((a) => medicalIds.includes(a.id))
                      .map((a) => a.title)
                      .join(', ')}
                  </li>
                ))}
              </ul>
              <div className="conflict-action">
                <strong>Commander decision:</strong> Protect medical officer time. Route non-critical cases to a telemedicine
                consult instead.
              </div>
            </div>
          )}

          {exerciseIssues.length > 0 && (
            <div className="conflict-card exercise">
              <h4>Exercise non-compliance</h4>
              <p>
                {exerciseIssues.length} crew member{exerciseIssues.length !== 1 ? 's are' : ' is'} behind on the exercise
                prescription.
              </p>
              <ul>
                {exerciseIssues.map((s) => (
                  <li key={s.crew.id}>
                    <strong>{s.crew.name}</strong> — {s.alerts.find((a) => a.id === 'exercise')?.action}
                  </li>
                ))}
              </ul>
              <div className="conflict-action">
                <strong>Commander decision:</strong> Mandate protected exercise time. Adjust the work schedule if needed.
              </div>
            </div>
          )}

          {sleepIssues.length > 0 && (
            <div className="conflict-card sleep">
              <h4>Sleep and cognitive degradation</h4>
              <p>
                {sleepIssues.length} crew member{sleepIssues.length !== 1 ? 's are' : ' is'} showing sleep debt or cognitive
                slowing.
              </p>
              <ul>
                {sleepIssues.map((s) => (
                  <li key={s.crew.id}>
                    <strong>{s.crew.name}</strong> —{' '}
                    {s.alerts
                      .filter((a) => ['sleep', 'reaction'].includes(a.id))
                      .map((a) => a.title)
                      .join(', ')}
                  </li>
                ))}
              </ul>
              <div className="conflict-action">
                <strong>Commander decision:</strong> Reassign critical tasks (piloting, robotics). Authorize protected sleep
                periods.
              </div>
            </div>
          )}

          {needsMedical.length === 0 && exerciseIssues.length === 0 && sleepIssues.length === 0 && (
            <div className="conflict-card nominal">
              <h4>No resource conflicts</h4>
              <p>All crew within nominal parameters. No Commander intervention required at this time.</p>
            </div>
          )}
        </div>
      </Section>

      <Section title="Radiation exposure comparison" note="Career dose includes prior missions. NASA career limit: 600 mSv.">
        <div className="radiation-table">
          <table>
            <thead>
              <tr>
                <th scope="col">Crew member</th>
                <th scope="col">Role</th>
                <th scope="col">Prior dose (mSv)</th>
                <th scope="col">Mission dose (mSv)</th>
                <th scope="col">Career total (mSv)</th>
                <th scope="col">% of limit</th>
                <th scope="col">Current rate (mSv/day)</th>
              </tr>
            </thead>
            <tbody>
              {radiationData.map((r) => (
                <tr key={r.name}>
                  <th scope="row">{r.name}</th>
                  <td>{r.role}</td>
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

      <Section title="Mission timeline" note="Upcoming events, including each crew member's next 14-day eye check.">
        <div className="timeline">
          {timeline.map((item) => (
            <div className="timeline-item" key={`${item.day}-${item.event}`}>
              <span className="timeline-time">Day {item.day}</span>
              <span className="timeline-event">{item.event}</span>
              <span className="timeline-note">{item.note}</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}
