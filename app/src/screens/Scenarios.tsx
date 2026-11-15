import { useEffect, useRef, useState } from 'react'
import { Section } from '../components/bits'
import { useStore } from '../store/store'
import { getAvailableScenarios, getScenarioById, type MedicalScenario } from '../sim/scenarios'
import { dayOf } from '../sim/mission'

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Critical',
  major: 'Major',
  moderate: 'Moderate',
  minor: 'Minor',
}

export function ScenariosScreen() {
  const t = useStore((s) => s.t)
  const scenariosState = useStore((s) => s.scenarios)
  const toggleScenario = useStore((s) => s.toggleScenario)

  const allScenarios = getAvailableScenarios()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement | null>(null)

  const activeScenarios = Object.entries(scenariosState)
    .filter(([, v]) => v !== null)
    .map(([id, startMin]) => {
      const scenario = getScenarioById(id)
      return {
        id,
        scenario,
        startDay: startMin ? dayOf(startMin) : 0,
        daysActive: startMin ? Math.max(0, dayOf(t) - dayOf(startMin)) : 0,
      }
    })

  const inactiveScenarios = allScenarios.filter(
    (s) => scenariosState[s.id as keyof typeof scenariosState] === null
  )

  const currentScenario = selectedId ? getScenarioById(selectedId) : null
  const currentIsActive = selectedId
    ? scenariosState[selectedId as keyof typeof scenariosState] !== null
    : false

  const openDetails = (id: string) => setSelectedId(id)

  const handleInject = (id: string) => {
    toggleScenario(id as keyof typeof scenariosState)
    setSelectedId(id)
  }

  const handleResolve = (id: string) => {
    toggleScenario(id as keyof typeof scenariosState)
    if (selectedId === id) setSelectedId(null)
  }

  // Bring the detail panel into view when a scenario is opened from the grid.
  useEffect(() => {
    if (selectedId) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedId])

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Scenario injector</h1>
        <p className="page-intro">
          Inject clinical and environmental scenarios to test crew responses. Active scenarios change simulation parameters and
          trigger alerts — use them for training, evaluation, or a demo narrative.
        </p>
      </header>

      <Section title="Active scenarios" note={`${activeScenarios.length} running`}>
        {activeScenarios.length === 0 ? (
          <p className="muted">No active scenarios. Choose one below to inspect it, then inject it.</p>
        ) : (
          <div className="scenario-list">
            {activeScenarios.map(({ id, scenario, startDay, daysActive }) => {
              const duration = scenario?.duration ?? 1
              const pct = Math.min(100, Math.round((daysActive / duration) * 100))
              return (
                <article key={id} className={`scenario-card active ${scenario?.severity}`}>
                  <div className="scenario-header">
                    <div>
                      <h4 className="scenario-title">{scenario?.name}</h4>
                      <span className={`scenario-badge ${scenario?.severity}`}>
                        {SEVERITY_LABEL[scenario?.severity ?? ''] ?? scenario?.severity?.toUpperCase()}
                      </span>
                    </div>
                    <button className="btn btn-quiet btn-small" onClick={() => handleResolve(id)}>
                      Resolve
                    </button>
                  </div>
                  <div className="scenario-meta">
                    <span>Started Day {startDay}</span>
                    <span>Active {daysActive} day{daysActive !== 1 ? 's' : ''}</span>
                    <span>Runs {duration} day{duration !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="scenario-active-bar" aria-hidden="true">
                    <div className="scenario-active-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="scenario-narrative">{scenario?.narrative}</p>
                  <button className="btn btn-quiet btn-small" onClick={() => openDetails(id)}>
                    Open case file
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </Section>

      <Section title="Available scenarios" note="Open a card to review the full case before injecting it.">
        {inactiveScenarios.length === 0 ? (
          <p className="muted">Every scenario is running. Resolve one to make it available again.</p>
        ) : (
          <div className="scenario-grid">
            {inactiveScenarios.map((scenario) => (
              <article
                key={scenario.id}
                className={`scenario-card ${scenario.severity}`}
                role="button"
                tabIndex={0}
                aria-label={`View details for ${scenario.name}`}
                onClick={() => openDetails(scenario.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openDetails(scenario.id)
                  }
                }}
              >
                <div className="scenario-header">
                  <h4 className="scenario-title">{scenario.name}</h4>
                  <span className={`scenario-badge ${scenario.severity}`}>
                    {SEVERITY_LABEL[scenario.severity] ?? scenario.severity.toUpperCase()}
                  </span>
                </div>
                <p className="scenario-desc">{scenario.description}</p>
                <div className="scenario-meta">
                  <span>{scenario.duration} day{scenario.duration !== 1 ? 's' : ''}</span>
                  <span>{scenario.category}</span>
                </div>
                <div className="scenario-tags">
                  {scenario.triggersAlerts.map((alertId) => (
                    <span key={alertId} className="alert-tag">{alertId}</span>
                  ))}
                </div>
                <span className="scenario-open">Open case file →</span>
              </article>
            ))}
          </div>
        )}
      </Section>

      {currentScenario && (
        <Section
          title={`${currentScenario.name} — case file`}
          note={
            currentScenario.category === 'medical'
              ? 'Full clinical scenario with workup, treatment, and disposition.'
              : 'Environmental or system scenario with operational guidance.'
          }
        >
          <div
            className={`scenario-detail ${currentScenario.severity}`}
            ref={detailRef}
            tabIndex={-1}
          >
            <div className="scenario-detail-head">
              <div className="scenario-detail-tags">
                <span className={`scenario-badge ${currentScenario.severity}`}>
                  {SEVERITY_LABEL[currentScenario.severity] ?? currentScenario.severity.toUpperCase()}
                </span>
                <span className="category-badge">{currentScenario.category}</span>
                {currentIsActive && <span className="scenario-live">Running now</span>}
              </div>
              <div className="scenario-detail-actions">
                {currentIsActive ? (
                  <button className="btn btn-quiet" type="button" onClick={() => handleResolve(currentScenario.id)}>
                    Resolve scenario
                  </button>
                ) : (
                  <button className="btn" type="button" onClick={() => handleInject(currentScenario.id)}>
                    Inject scenario
                  </button>
                )}
                <button className="btn btn-quiet" type="button" onClick={() => setSelectedId(null)}>
                  Close
                </button>
              </div>
            </div>

            <div className="detail-section">
              <h4>Narrative</h4>
              <p>{currentScenario.narrative}</p>
            </div>

            <div className="detail-section">
              <h4>Guidance</h4>
              <ul>
                {currentScenario.guidance.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>

            {(currentScenario as MedicalScenario).differential && (
              <div className="detail-section">
                <h4>Differential diagnosis</h4>
                <ul>
                  {((currentScenario as MedicalScenario).differential || []).map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}

            {(currentScenario as MedicalScenario).workup && (
              <div className="detail-section">
                <h4>Recommended workup</h4>
                <ul>
                  {((currentScenario as MedicalScenario).workup || []).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {(currentScenario as MedicalScenario).treatment && (
              <div className="detail-section">
                <h4>Treatment</h4>
                {((currentScenario as MedicalScenario).treatment || []).map((tx, i) => (
                  <div key={i} className="treatment-block">
                    <h5>Option {i + 1}</h5>
                    <div className="treatment-cols">
                      <div>
                        <h6>Autonomous (crew)</h6>
                        <ul>
                          {(tx.autonomous || []).map((a, j) => (
                            <li key={j}>{a}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h6>Earth consult</h6>
                        <ul>
                          {(tx.earthConsult || []).map((e, j) => (
                            <li key={j}>{e}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(currentScenario as MedicalScenario).disposition && (
              <div className="detail-section">
                <h4>Disposition / outcomes</h4>
                <ul>
                  {((currentScenario as MedicalScenario).disposition || []).map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}

            {(currentScenario as MedicalScenario).patientId && (
              <div className="detail-section">
                <h4>Patient</h4>
                <p>
                  Crew member: <strong>{(currentScenario as MedicalScenario).patientId}</strong>
                </p>
              </div>
            )}
          </div>
        </Section>
      )}
    </>
  )
}
