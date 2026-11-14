import { useState } from 'react'
import { Section } from '../components/bits'
import { useStore } from '../store/store'
import { getAvailableScenarios, getScenarioById, type MedicalScenario } from '../sim/scenarios'
import { dayOf } from '../sim/mission'

export function ScenariosScreen() {
  const t = useStore((s) => s.t)
  const scenariosState = useStore((s) => s.scenarios)
  const toggleScenario = useStore((s) => s.toggleScenario)

  const allScenarios = getAvailableScenarios()
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)

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

  const handleTrigger = (id: string) => {
    toggleScenario(id as any)
    setSelectedScenario(id)
    setShowDetails(true)
  }

  const handleResolve = (id: string) => {
    toggleScenario(id as any)
    if (selectedScenario === id) {
      setSelectedScenario(null)
      setShowDetails(false)
    }
  }

  const currentScenario = selectedScenario ? getScenarioById(selectedScenario) : null

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Scenario Injector</h1>
        <p className="page-intro">
          Inject clinical and environmental scenarios to test crew responses. Active scenarios modify simulation parameters and trigger alerts.
          Use for training, evaluation, or demo narratives.
        </p>
      </header>

      <Section title="Active Scenarios" note={`${activeScenarios.length} running`}>
        {activeScenarios.length === 0 ? (
          <p className="muted">No active scenarios. Inject one below to begin.</p>
        ) : (
          <div className="scenario-list">
            {activeScenarios.map(({ id, scenario, startDay, daysActive }) => (
              <article key={id} className={`scenario-card active ${scenario?.severity}`}>
                <div className="scenario-header">
                  <div>
                    <h4 className="scenario-title">{scenario?.name}</h4>
                    <span className="scenario-badge">{scenario?.severity?.toUpperCase()}</span>
                  </div>
                  <button className="btn btn-quiet btn-small" onClick={() => handleResolve(id)}>
                    Resolve
                  </button>
                </div>
                <div className="scenario-meta">
                  <span>Started: Day {startDay}</span>
                  <span>Active: {daysActive} day{daysActive !== 1 ? 's' : ''}</span>
                  <span>Duration: {scenario?.duration} day{scenario?.duration !== 1 ? 's' : ''}</span>
                </div>
                <p className="scenario-narrative">{scenario?.narrative}</p>
                <button
                  className="btn btn-quiet btn-small"
                  onClick={() => { setSelectedScenario(id); setShowDetails(true); }}
                >
                  View Details
                </button>
              </article>
            ))}
          </div>
        )}
      </Section>

      <Section title="Available Scenarios" note="Click to inject. Medical scenarios include full clinical workup, treatment, and Earth-consult guidance.">
        <div className="scenario-grid">
          {inactiveScenarios.map((scenario) => (
            <article key={scenario.id} className={`scenario-card ${scenario.severity}`} onClick={() => handleTrigger(scenario.id)}>
              <div className="scenario-header">
                <h4 className="scenario-title">{scenario.name}</h4>
                <span className="scenario-badge">{scenario.severity.toUpperCase()}</span>
              </div>
              <p className="scenario-desc">{scenario.description}</p>
              <div className="scenario-meta">
                <span>Duration: {scenario.duration} day{scenario.duration !== 1 ? 's' : ''}</span>
                <span>Category: {scenario.category}</span>
              </div>
              <div className="scenario-tags">
                {scenario.triggersAlerts.map((alertId) => (
                  <span key={alertId} className="alert-tag">{alertId}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </Section>

      {showDetails && currentScenario && (
        <Section title={`${currentScenario.name} Details`} note={currentScenario.category === 'medical' ? 'Full clinical scenario with workup, treatment, and disposition.' : 'Environmental/system scenario with operational guidance.'}>
          <div className="scenario-detail">
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
                <h4>Differential Diagnosis</h4>
                <ul>
                  {((currentScenario as MedicalScenario).differential || []).map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}

            {(currentScenario as MedicalScenario).workup && (
              <div className="detail-section">
                <h4>Recommended Workup</h4>
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
                        <h6>Autonomous (Crew)</h6>
                        <ul>
                          {(tx.autonomous || []).map((a, j) => (
                            <li key={j}>{a}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h6>Earth Consult</h6>
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
                <h4>Disposition / Outcomes</h4>
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
                <p>Crew member: <strong>{(currentScenario as MedicalScenario).patientId}</strong></p>
              </div>
            )}

            <button className="btn btn-quiet" onClick={() => { setShowDetails(false); setSelectedScenario(null); }}>
              Close Details
            </button>
          </div>
        </Section>
      )}
    </>
  )
}