import { useState, useEffect, useMemo } from 'react'
import { Section, Readout } from '../components/bits'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useStore } from '../store/store'
import { useSession } from '../store/session'

// Mission types
interface Mission {
  id: string
  name: string
  program: string // 'Artemis', 'ISS', 'Mars', 'Gateway', 'Custom'
  description: string
  status: 'planning' | 'training' | 'active' | 'completed' | 'scrubbed'
  startDate: number // mission day
  endDate: number // mission day
  destination: string // 'Moon', 'ISS', 'Mars', 'Gateway', 'LEO'
  crew: MissionCrewMember[]
  objectives: string[]
  createdAt: number
}

interface MissionCrewMember {
  crewId: string // references CREW.id
  role: 'commander' | 'pilot' | 'medical_officer' | 'flight_engineer' | 'mission_specialist' | 'payload_specialist' | 'spacecraft_commander' | 'other'
  primary: boolean // primary vs backup
  notes?: string
}

interface CrewMember {
  id: string
  name: string
  role: string // their training role/specialty
  specialties: string[]
  status: 'available' | 'assigned' | 'training' | 'medical_hold' | 'retired'
  avatar?: string
}

const STORAGE_KEY = 'orb-mission-control'

function getDefaultCrew(): CrewMember[] {
  return [
    { id: 'okafor', name: 'Amara Okafor', role: 'Commander', specialties: ['Command', 'EVA', 'Robotics'], status: 'available' },
    { id: 'lindqvist', name: 'Jonas Lindqvist', role: 'Flight Engineer', specialties: ['Systems', 'EVA', 'Robotics'], status: 'available' },
    { id: 'reyes', name: 'Sofia Reyes', role: 'Medical Officer', specialties: ['Emergency Medicine', 'Space Physiology', 'Psychology'], status: 'available' },
    { id: 'tanaka', name: 'Kenji Tanaka', role: 'Mission Scientist', specialties: ['Geology', 'Biology', 'Sample Collection'], status: 'available' },
    { id: 'chen', name: 'Wei Chen', role: 'Pilot', specialties: ['Orbital Mechanics', 'Rendezvous', 'Entry/Descent/Landing'], status: 'available' },
    { id: 'petrov', name: 'Alexei Petrov', role: 'Systems Engineer', specialties: ['Life Support', 'Power Systems', 'Thermal'], status: 'available' },
    { id: 'williams', name: 'Sarah Williams', role: 'Mission Specialist', specialties: ['EVA', 'Robotics', 'Science Operations'], status: 'available' },
    { id: 'okonkwo', name: 'Chidi Okonkwo', role: 'Payload Specialist', specialties: ['Materials Science', 'Combustion', 'Fluid Physics'], status: 'available' },
  ]
}

function loadData(): { missions: Mission[]; crew: CrewMember[] } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return { missions: [], crew: getDefaultCrew() }
}

function saveData(missions: Mission[], crew: CrewMember[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ missions, crew }))
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

// Simple Select component
function Select({ value, onChange, options, ...props }: { value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: { value: string; label: string }[]; className?: string; disabled?: boolean }) {
  return (
    <select value={value} onChange={onChange} className={props.className} disabled={props.disabled} {...props}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}

export function Admin() {
  const { signOut } = useSession()
  const t = useStore((s) => s.t)
  const currentDay = Math.floor(t / 1440) + 1

  const [data, setData] = useState<{ missions: Mission[]; crew: CrewMember[] }>(() => loadData())
  const [activeTab, setActiveTab] = useState<'missions' | 'crew' | 'schedule' | 'reports'>('missions')
  const [editingMission, setEditingMission] = useState<Mission | null>(null)
  const [editingCrew, setEditingCrew] = useState<CrewMember | null>(null)
  const [showMissionModal, setShowMissionModal] = useState(false)
  const [showCrewModal, setShowCrewModal] = useState(false)
  const [newMissionForm, setNewMissionForm] = useState<Partial<Mission>>({})
  const [newCrewForm, setNewCrewForm] = useState<Partial<CrewMember>>({})

  useEffect(() => {
    saveData(data.missions, data.crew)
  }, [data])

  const availableCrew = data.crew.filter((c) => c.status === 'available')
  const assignedCrew = data.crew.filter((c) => c.status === 'assigned')
  const activeMissions = data.missions.filter((m) => m.status === 'active')
  const upcomingMissions = data.missions.filter((m) => m.status === 'planning' || m.status === 'training')

  // Mission management
  const addMission = (mission: Mission) => {
    setData((prev) => ({ ...prev, missions: [...prev.missions, { ...mission, id: mission.id || generateId(), createdAt: Date.now() }] }))
    setShowMissionModal(false)
    setNewMissionForm({})
  }

  const updateMission = (updated: Mission) => {
    setData((prev) => ({ ...prev, missions: prev.missions.map((m) => (m.id === updated.id ? updated : m)) }))
    setEditingMission(null)
  }

  const deleteMission = (id: string) => {
    setData((prev) => ({
      ...prev,
      missions: prev.missions.filter((m) => m.id !== id),
      crew: prev.crew.map((c) => (c.status === 'assigned' ? { ...c, status: 'available' } : c)),
    }))
  }

  const duplicateMission = (mission: Mission) => {
    const newMission: Mission = {
      ...mission,
      id: generateId(),
      name: `${mission.name} (Copy)`,
      status: 'planning',
      startDate: mission.startDate + 365,
      endDate: mission.endDate + 365,
      createdAt: Date.now(),
    }
    addMission(newMission)
  }

  // Crew management
  const addCrew = (crew: CrewMember) => {
    setData((prev) => ({ ...prev, crew: [...prev.crew, { ...crew, id: crew.id || generateId() }] }))
    setShowCrewModal(false)
    setNewCrewForm({})
  }

  const updateCrew = (updated: CrewMember) => {
    setData((prev) => ({ ...prev, crew: prev.crew.map((c) => (c.id === updated.id ? updated : c)) }))
    setEditingCrew(null)
  }

  const deleteCrew = (id: string) => {
    // Unassign from any missions first
    setData((prev) => ({
      ...prev,
      crew: prev.crew.filter((c) => c.id !== id),
      missions: prev.missions.map((m) => ({
        ...m,
        crew: m.crew.filter((mc) => mc.crewId !== id),
      })),
    }))
  }

  // Stats
  const stats = useMemo(() => ({
    totalMissions: data.missions.length,
    activeMissions: activeMissions.length,
    planningMissions: upcomingMissions.length,
    availableCrew: availableCrew.length,
    assignedCrew: assignedCrew.length,
  }), [data.missions, data.crew])

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-left">
          <h1>Mission Control Center</h1>
          <span className="admin-badge">Earth • Day {currentDay}</span>
        </div>
        <div className="admin-header-right">
          <span className="admin-user">Mission Control Administrator</span>
          <Button onClick={signOut} variant="outline">Sign Out</Button>
        </div>
      </header>

      <div className="admin-stats">
        <Readout big label="Active Missions" value={stats.activeMissions} unit="missions" />
        <Readout big label="In Planning" value={stats.planningMissions} unit="missions" />
        <Readout big label="Crew Available" value={stats.availableCrew} unit="astronauts" level={stats.availableCrew < 3 ? 'act' : null} />
        <Readout big label="Crew Assigned" value={stats.assignedCrew} unit="astronauts" />
      </div>

      <nav className="admin-tabs" role="tablist">
        {['missions', 'crew', 'schedule', 'reports'].map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={`admin-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab as typeof activeTab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      {activeTab === 'missions' && (
        <Section title="Mission Portfolio" note={`${data.missions.length} total missions • ${activeMissions.length} active • ${upcomingMissions.length} upcoming`}>
          <div className="admin-actions">
            <Button onClick={() => { setEditingMission(null); setNewMissionForm({ status: 'planning', crew: [], objectives: [] }); setShowMissionModal(true); }}>New Mission</Button>
          </div>
          <div className="missions-grid">
            {data.missions.length === 0 ? (
              <div className="empty-state">
                <p>No missions created yet.</p>
                <Button onClick={() => { setEditingMission(null); setNewMissionForm({ status: 'planning', crew: [], objectives: [] }); setShowMissionModal(true); }}>Create First Mission</Button>
              </div>
            ) : (
              data.missions.map((mission) => {
                const primaryCrew = mission.crew.filter((c) => c.primary).map((c) => data.crew.find((cm) => cm.id === c.crewId)?.name).filter(Boolean).join(', ')
                const daysUntilStart = mission.startDate - currentDay
                const isUpcoming = daysUntilStart > 0
                const isOngoing = daysUntilStart <= 0 && mission.endDate >= currentDay
                return (
                  <Card key={mission.id} className={`mission-card ${mission.status}`}>
                    <CardHeader>
                      <div className="mission-card-header">
                        <div>
                          <CardTitle>{mission.name}</CardTitle>
                          <CardDescription>{mission.program} • {mission.destination}</CardDescription>
                        </div>
                        <span className={`mission-status ${mission.status}`}>{mission.status}</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="mission-details">
                        <div className="detail-row">
                          <span className="detail-label">Timeline:</span>
                          <span>Day {mission.startDate} – Day {mission.endDate} ({mission.endDate - mission.startDate + 1} days)</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Crew:</span>
                          <span>{primaryCrew || 'TBD'} ({mission.crew.length} assigned)</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Status:</span>
                          <span>{isUpcoming ? `T-${daysUntilStart} days` : isOngoing ? 'IN PROGRESS' : 'COMPLETED'}</span>
                        </div>
                        <p className="mission-description">{mission.description}</p>
                        {mission.objectives.length > 0 && (
                          <div className="mission-objectives">
                            <strong>Objectives:</strong>
                            <ul>
                              {mission.objectives.map((obj, i) => <li key={i}>{obj}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div className="mission-actions">
                        <Button size="sm" variant="outline" onClick={() => { setEditingMission(mission); setNewMissionForm(mission); setShowMissionModal(true); }}>Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => duplicateMission(mission)}>Duplicate</Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteMission(mission.id)}>Delete</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
            )}
          </div>
        </Section>
      )}

      {activeTab === 'crew' && (
        <Section title="Astronaut Corps" note={`${data.crew.length} total • ${availableCrew.length} available • ${assignedCrew.length} assigned to missions`}>
          <div className="admin-actions">
            <Button onClick={() => { setEditingCrew(null); setNewCrewForm({ specialties: [], status: 'available' }); setShowCrewModal(true); }}>Add Astronaut</Button>
          </div>
          <div className="crew-grid">
            {data.crew.map((member) => {
              const currentMission = data.missions.find((m) => m.crew.some((mc) => mc.crewId === member.id && mc.primary))
              return (
                <Card key={member.id} className={`crew-card ${member.status}`}>
                  <CardHeader>
                    <div className="crew-card-header">
                      <div className="crew-avatar">{member.name.split(' ').map((n) => n[0]).join('')}</div>
                      <div className="crew-info">
                        <CardTitle>{member.name}</CardTitle>
                        <CardDescription>{member.role}</CardDescription>
                      </div>
                      <span className={`crew-status ${member.status}`}>{member.status}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="detail-row">
                      <span className="detail-label">Specialties:</span>
                      <span>{member.specialties.join(', ')}</span>
                    </div>
                    {currentMission && (
                      <div className="detail-row">
                        <span className="detail-label">Assigned:</span>
                        <span>{currentMission.name} ({currentMission.program})</span>
                      </div>
                    )}
                    <div className="detail-row">
                      <span className="detail-label">Status:</span>
                      <span className={`status-badge ${member.status}`}>{member.status}</span>
                    </div>
                    <div className="crew-actions">
                      <Button size="sm" variant="outline" onClick={() => { setEditingCrew(member); setNewCrewForm(member); setShowCrewModal(true); }}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteCrew(member.id)}>Remove</Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </Section>
      )}

      {activeTab === 'schedule' && (
        <Section title="Mission Schedule & Timeline" note="Overview of all mission timelines">
          <div className="schedule-view">
            {data.missions.length === 0 ? (
              <p className="muted">No missions scheduled. Create missions to see timeline.</p>
            ) : (
              <div className="timeline">
                {data.missions
                  .sort((a, b) => a.startDate - b.startDate)
                  .map((mission) => (
                    <div key={mission.id} className={`timeline-item ${mission.status}`} style={{ '--start': `${((mission.startDate - 1) / 730) * 100}%`, '--end': `${((mission.endDate - 1) / 730) * 100}%` }}>
                      <div className="timeline-bar">
                        <div className="timeline-fill" style={{ left: `var(--start)`, width: `calc(var(--end) - var(--start))` }} />
                      </div>
                      <div className="timeline-info">
                        <div className="timeline-name">{mission.name}</div>
                        <div className="timeline-meta">{mission.program} • Day {mission.startDate}–{mission.endDate} • {mission.crew.length} crew</div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </Section>
      )}

      {activeTab === 'reports' && (
        <Section title="Mission Reports & Export" note="Generate reports and export data">
          <div className="reports-grid">
            <Card>
              <CardHeader>
                <CardTitle>Crew Assignment Report</CardTitle>
                <CardDescription>All crew with current mission assignments</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={() => {
                  const report = data.crew.map((c) => {
                    const mission = data.missions.find((m) => m.crew.some((mc) => mc.crewId === c.id && mc.primary))
                    return `${c.name},${c.role},${c.status},${mission?.name || 'Unassigned'}`
                  }).join('\n')
                  navigator.clipboard.writeText('Name,Role,Status,Current Mission\n' + report)
                  alert('Report copied to clipboard')
                }}>Copy CSV</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Mission Summary Report</CardTitle>
                <CardDescription>All missions with status, dates, and crew</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={() => {
                  const report = data.missions.map((m) => {
                    const crewNames = m.crew.filter((mc) => mc.primary).map((mc) => data.crew.find((c) => c.id === mc.crewId)?.name).join('; ')
                    return `${m.name},${m.program},${m.status},Day ${m.startDate}-${m.endDate},${crewNames}`
                  }).join('\n')
                  navigator.clipboard.writeText('Mission,Program,Status,Timeline,Crew\n' + report)
                  alert('Report copied to clipboard')
                }}>Copy CSV</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Full Data Export</CardTitle>
                <CardDescription>Complete backup of all missions and crew</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={() => {
                  const backup = JSON.stringify(data, null, 2)
                  navigator.clipboard.writeText(backup)
                  alert('Full data exported to clipboard')
                }}>Copy JSON</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Import Data</CardTitle>
                <CardDescription>Restore from backup (overwrites current)</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={() => {
                  const file = document.createElement('input')
                  file.type = 'file'
                  file.accept = '.json'
                  file.onchange = (e) => {
                    const reader = new FileReader()
                    reader.onload = (event) => {
                      try {
                        const imported = JSON.parse(event.target?.result as string)
                        setData(imported)
                        alert('Data imported successfully')
                      } catch {
                        alert('Invalid JSON file')
                      }
                    }
                    reader.readAsText((e.target as HTMLInputElement).files?.[0]!)
                  }
                  file.click()
                }}>Import JSON</Button>
              </CardContent>
            </Card>
          </div>
        </Section>
      )}

      {/* Mission Modal */}
      {showMissionModal && (
        <div className="modal-overlay" onClick={() => setShowMissionModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <Card style={{ maxWidth: '700px' }}>
              <CardHeader>
                <CardTitle>{editingMission ? 'Edit Mission' : 'Create Mission'}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => { e.preventDefault(); const missionData = { ...newMissionForm, id: editingMission?.id || generateId(), crew: newMissionForm.crew || [], objectives: newMissionForm.objectives || [] } as Mission; if (editingMission) { updateMission(missionData) } else { addMission(missionData) } }}>
                  <div className="form-grid">
                    <div>
                      <Label>Mission Name <Input value={newMissionForm.name || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMissionForm({ ...newMissionForm, name: e.target.value })} placeholder="Artemis IV" required /></Label>
                    </div>
                    <div>
                      <Label>Program
                        <Select
                          value={newMissionForm.program || 'Artemis'}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewMissionForm({ ...newMissionForm, program: e.target.value })}
                          options={['Artemis', 'ISS', 'Mars', 'Gateway', 'Commercial', 'Custom'].map((v) => ({ value: v, label: v }))}
                        />
                      </Label>
                    </div>
                    <div>
                      <Label>Destination
                        <Select
                          value={newMissionForm.destination || 'Moon'}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewMissionForm({ ...newMissionForm, destination: e.target.value })}
                          options={['Moon', 'ISS', 'Mars', 'Gateway', 'LEO', 'Lunar Orbit'].map((v) => ({ value: v, label: v }))}
                        />
                      </Label>
                    </div>
                    <div>
                      <Label>Status
                        <Select
                          value={newMissionForm.status || 'planning'}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewMissionForm({ ...newMissionForm, status: e.target.value as Mission['status'] })}
                          options={['planning', 'training', 'active', 'completed', 'scrubbed'].map((v) => ({ value: v, label: v }))}
                        />
                      </Label>
                    </div>
                    <div>
                      <Label>Start Day <Input type="number" min={1} max={730} value={newMissionForm.startDate || currentDay + 30} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMissionForm({ ...newMissionForm, startDate: parseInt(e.target.value) })} /></Label>
                    </div>
                    <div>
                      <Label>End Day <Input type="number" min={1} max={730} value={newMissionForm.endDate || currentDay + 60} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMissionForm({ ...newMissionForm, endDate: parseInt(e.target.value) })} /></Label>
                    </div>
                    <div className="full-width">
                      <Label>Description <textarea value={newMissionForm.description || ''} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewMissionForm({ ...newMissionForm, description: e.target.value })} rows={3} placeholder="Mission description and context..." /></Label>
                    </div>
                    <div className="full-width">
                      <Label>Objectives (one per line) <textarea value={(newMissionForm.objectives || []).join('\n')} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewMissionForm({ ...newMissionForm, objectives: e.target.value.split('\n').filter((o) => o.trim()) })} rows={4} placeholder="Objective 1&#10;Objective 2&#10;..." /></Label>
                    </div>
                    <div className="full-width">
                      <Label>Crew Assignments
                        <div className="crew-assignment-list">
                          {(newMissionForm.crew || []).map((assignment, idx) => (
                            <div key={idx} className="assignment-row">
                              <Select
                                value={assignment.crewId}
                                onChange={(e) => {
                                  const updated = [...(newMissionForm.crew || [])]
                                  updated[idx] = { ...updated[idx], crewId: e.target.value }
                                  setNewMissionForm({ ...newMissionForm, crew: updated })
                                }}
                                options={data.crew.map((c) => ({ value: c.id, label: `${c.name} (${c.role})` }))}
                              />
                              <Select
                                value={assignment.role}
                                onChange={(e) => {
                                  const updated = [...(newMissionForm.crew || [])]
                                  updated[idx] = { ...updated[idx], role: e.target.value as MissionCrewMember['role'] }
                                  setNewMissionForm({ ...newMissionForm, crew: updated })
                                }}
                                options={['commander', 'pilot', 'medical_officer', 'flight_engineer', 'mission_specialist', 'payload_specialist', 'spacecraft_commander', 'other'].map((v) => ({ value: v, label: v }))}
                              />
                              <label className="primary-checkbox">
                                <input type="checkbox" checked={assignment.primary} onChange={(e) => {
                                  const updated = [...(newMissionForm.crew || [])]
                                  updated[idx] = { ...updated[idx], primary: e.target.checked }
                                  setNewMissionForm({ ...newMissionForm, crew: updated })
                                }} />
                                Primary
                              </label>
                              <Button type="button" size="sm" variant="destructive" onClick={() => {
                                const updated = (newMissionForm.crew || []).filter((_, i) => i !== idx)
                                setNewMissionForm({ ...newMissionForm, crew: updated })
                              }}>Remove</Button>
                            </div>
                          ))}
                          <Button type="button" size="sm" variant="outline" onClick={() => setNewMissionForm({ ...newMissionForm, crew: [...(newMissionForm.crew || []), { crewId: availableCrew[0]?.id || '', role: 'mission_specialist', primary: false }] })}>+ Add Crew Member</Button>
                        </div>
                      </Label>
                    </div>
                  </div>
                  <div className="modal-actions">
                    <Button type="button" variant="outline" onClick={() => setShowMissionModal(false)}>Cancel</Button>
                    <Button type="submit">{editingMission ? 'Update Mission' : 'Create Mission'}</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Crew Modal */}
      {showCrewModal && (
        <div className="modal-overlay" onClick={() => setShowCrewModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <Card>
              <CardHeader>
                <CardTitle>{editingCrew ? 'Edit Astronaut' : 'Add Astronaut'}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => { e.preventDefault(); const crewData = { ...newCrewForm, id: newCrewForm.id || generateId(), specialties: (newCrewForm.specialties as string)?.split(',').map((s) => s.trim()).filter(Boolean) || [] } as CrewMember; if (editingCrew) { updateCrew(crewData) } else { addCrew(crewData) } }}>
                  <div className="form-grid">
                    <div>
                      <Label>ID <Input value={newCrewForm.id || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCrewForm({ ...newCrewForm, id: e.target.value })} placeholder="unique-id" required /></Label>
                    </div>
                    <div>
                      <Label>Name <Input value={newCrewForm.name || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCrewForm({ ...newCrewForm, name: e.target.value })} placeholder="Full Name" required /></Label>
                    </div>
                    <div>
                      <Label>Role <Input value={newCrewForm.role || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCrewForm({ ...newCrewForm, role: e.target.value })} placeholder="Commander, Pilot, Medical Officer, etc." required /></Label>
                    </div>
                    <div className="full-width">
                      <Label>Specialties (comma-separated) <Input value={(newCrewForm.specialties as string) || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCrewForm({ ...newCrewForm, specialties: e.target.value })} placeholder="EVA, Robotics, Geology, etc." /></Label>
                    </div>
                    <div>
                      <Label>Status
                        <Select
                          value={newCrewForm.status || 'available'}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewCrewForm({ ...newCrewForm, status: e.target.value as CrewMember['status'] })}
                          options={['available', 'assigned', 'training', 'medical_hold', 'retired'].map((v) => ({ value: v, label: v }))}
                        />
                      </Label>
                    </div>
                  </div>
                  <div className="modal-actions">
                    <Button type="button" variant="outline" onClick={() => setShowCrewModal(false)}>Cancel</Button>
                    <Button type="submit">{editingCrew ? 'Update Astronaut' : 'Add Astronaut'}</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}