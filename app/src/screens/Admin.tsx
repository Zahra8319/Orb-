import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Database, Download, FileSpreadsheet, Plus, Upload, X } from 'lucide-react'

import { Readout, Section } from '../components/bits'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { useSession } from '../store/session'
import { useStore } from '../store/store'

/* Mission Control: the Earth side of Orb. Creates upcoming trips and assigns
   astronauts to them; the crew pages only ever show each astronaut their own
   assignment. Data lives in localStorage so the demo keeps its state. */

interface Mission {
  id: string
  name: string
  program: string
  description: string
  status: 'planning' | 'training' | 'active' | 'completed' | 'scrubbed'
  startDate: number
  endDate: number
  destination: string
  crew: MissionCrewMember[]
  objectives: string[]
  createdAt: number
}

interface MissionCrewMember {
  crewId: string
  role: 'commander' | 'pilot' | 'medical_officer' | 'flight_engineer' | 'mission_specialist' | 'payload_specialist' | 'spacecraft_commander' | 'other'
  primary: boolean
  notes?: string
}

interface CrewMember {
  id: string
  name: string
  role: string
  specialties: string[]
  status: 'available' | 'assigned' | 'training' | 'medical_hold' | 'retired'
  avatar?: string
}

type TabId = 'missions' | 'crew' | 'schedule' | 'reports'

/* Versioned after the Mission Control rework so a demo opens on the fresh
   console rather than state saved by the earlier admin screens. */
const STORAGE_KEY = 'orb-mission-control.v2'

/** Missions are plotted on a two-year planning horizon. */
const PLANNING_HORIZON = 730

const MISSION_ROLES = ['commander', 'pilot', 'medical_officer', 'flight_engineer', 'mission_specialist', 'payload_specialist', 'spacecraft_commander', 'other']
const MISSION_STATUSES = ['planning', 'training', 'active', 'completed', 'scrubbed']
const CREW_STATUSES = ['available', 'assigned', 'training', 'medical_hold', 'retired']

const prettify = (s: string) => s.replace(/_/g, ' ')
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

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

/** One example trip so the console opens with something to look at. Dated
    relative to the running mission clock so it reads as upcoming (T-30)
    whenever the demo is opened. */
function getDefaultMissions(): Mission[] {
  const day = Math.floor(useStore.getState().t / 1440) + 1
  const startDate = Math.min(day + 30, PLANNING_HORIZON - 61)
  return [
    {
      id: 'artemis-iv',
      name: 'Artemis IV',
      program: 'Artemis',
      description: 'Crewed lunar landing staged from Gateway, with a surface stay for habitat checkout and polar science.',
      status: 'planning',
      startDate,
      endDate: startDate + 60,
      destination: 'Moon',
      crew: [
        { crewId: 'okafor', role: 'commander', primary: true },
        { crewId: 'chen', role: 'pilot', primary: false },
        { crewId: 'reyes', role: 'medical_officer', primary: false },
      ],
      objectives: ['Crewed lunar landing', 'Surface habitat checkout', 'Deploy polar science payload'],
      createdAt: 0,
    },
  ]
}

/** Crew on a mission read as assigned; released crew go back to available.
    Other statuses (training, medical hold) are left alone. */
function withSyncedCrew(missions: Mission[], crew: CrewMember[]): CrewMember[] {
  const onMission = new Set(missions.flatMap((m) => m.crew.map((mc) => mc.crewId)))
  return crew.map((c) => {
    if (onMission.has(c.id)) return c.status === 'available' ? { ...c, status: 'assigned' } : c
    return c.status === 'assigned' ? { ...c, status: 'available' } : c
  })
}

function loadData(): { missions: Mission[]; crew: CrewMember[] } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed?.missions) && Array.isArray(parsed?.crew)) return parsed
    }
  } catch {
    // Corrupt or very old backup: fall through to the defaults.
  }
  const missions = getDefaultMissions()
  return { missions, crew: withSyncedCrew(missions, getDefaultCrew()) }
}

function saveData(missions: Mission[], crew: CrewMember[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ missions, crew }))
  } catch {
    // Private mode or blocked storage: the session lasts until reload.
  }
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function downloadFile(filename: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n')
}

/** Theme-styled select for the admin forms. */
function Select({ value, onChange, options, className, disabled }: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  options: { value: string; label: string }[]
  className?: string
  disabled?: boolean
}) {
  return (
    <select value={value} onChange={onChange} className={className ?? 'admin-select'} disabled={disabled}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}

export function Admin() {
  const { signOut } = useSession()
  const navigate = useNavigate()
  const t = useStore((s) => s.t)
  const currentDay = Math.floor(t / 1440) + 1

  const [data, setData] = useState<{ missions: Mission[]; crew: CrewMember[] }>(() => loadData())
  const [activeTab, setActiveTab] = useState<TabId>('missions')
  const [editingMission, setEditingMission] = useState<Mission | null>(null)
  const [editingCrew, setEditingCrew] = useState<CrewMember | null>(null)
  const [showMissionModal, setShowMissionModal] = useState(false)
  const [showCrewModal, setShowCrewModal] = useState(false)
  const [newMissionForm, setNewMissionForm] = useState<Partial<Mission>>({})
  const [newCrewForm, setNewCrewForm] = useState<Partial<CrewMember> & { specialtiesStr?: string }>({})
  const [reportMsg, setReportMsg] = useState('')

  const missionDialog = useRef<HTMLDivElement>(null)
  const crewDialog = useRef<HTMLDivElement>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const flashTimer = useRef<number | undefined>(undefined)

  /* Mission Control runs the day shift, so this screen always uses the light
     palette. The crew Shell re-applies the sleep shift when it mounts again. */
  useEffect(() => {
    document.documentElement.dataset.theme = 'day'
  }, [])

  const dialogOpen = showMissionModal || showCrewModal

  /* Escape closes the open dialog; the console behind it stops scrolling. */
  useEffect(() => {
    if (!dialogOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setShowMissionModal(false)
      setShowCrewModal(false)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [dialogOpen])

  useEffect(() => {
    if (showMissionModal) missionDialog.current?.focus()
    else if (showCrewModal) crewDialog.current?.focus()
  }, [showMissionModal, showCrewModal])

  useEffect(() => () => window.clearTimeout(flashTimer.current), [])

  useEffect(() => {
    saveData(data.missions, data.crew)
  }, [data])

  const availableCrew = data.crew.filter((c) => c.status === 'available')
  const assignedCrew = data.crew.filter((c) => c.status === 'assigned')
  const activeMissions = data.missions.filter((m) => m.status === 'active')
  const upcomingMissions = data.missions.filter((m) => m.status === 'planning' || m.status === 'training')

  function flash(message: string) {
    setReportMsg(message)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setReportMsg(''), 4000)
  }

  function handleSignOut() {
    signOut()
    navigate('/login')
  }

  // Mission management
  const addMission = (mission: Mission) => {
    setData((prev) => {
      const missions = [...prev.missions, { ...mission, id: mission.id || generateId(), createdAt: Date.now() }]
      return { missions, crew: withSyncedCrew(missions, prev.crew) }
    })
    setShowMissionModal(false)
    setNewMissionForm({})
  }

  const updateMission = (updated: Mission) => {
    setData((prev) => {
      const missions = prev.missions.map((m) => (m.id === updated.id ? updated : m))
      return { missions, crew: withSyncedCrew(missions, prev.crew) }
    })
    setEditingMission(null)
    setNewMissionForm({})
    setShowMissionModal(false)
  }

  const deleteMission = (id: string) => {
    if (!window.confirm('Delete this mission? Crew assigned to it return to available.')) return
    setData((prev) => {
      const missions = prev.missions.filter((m) => m.id !== id)
      return { missions, crew: withSyncedCrew(missions, prev.crew) }
    })
  }

  const duplicateMission = (mission: Mission) => {
    const newMission: Mission = {
      ...mission,
      id: generateId(),
      name: `${mission.name} (Copy)`,
      status: 'planning',
      startDate: Math.min(mission.startDate + 365, PLANNING_HORIZON - (mission.endDate - mission.startDate)),
      endDate: Math.min(mission.endDate + 365, PLANNING_HORIZON),
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
    setNewCrewForm({})
    setShowCrewModal(false)
  }

  const deleteCrew = (id: string) => {
    if (!window.confirm('Remove this astronaut? They are released from every mission.')) return
    setData((prev) => ({
      ...prev,
      crew: prev.crew.filter((c) => c.id !== id),
      missions: prev.missions.map((m) => ({ ...m, crew: m.crew.filter((mc) => mc.crewId !== id) })),
    }))
  }

  function openNewMission() {
    setEditingMission(null)
    setNewMissionForm({ status: 'planning', crew: [], objectives: [], startDate: currentDay + 30, endDate: currentDay + 60 })
    setShowMissionModal(true)
  }

  function openEditMission(mission: Mission) {
    setEditingMission(mission)
    setNewMissionForm(mission)
    setShowMissionModal(true)
  }

  function openNewCrew() {
    setEditingCrew(null)
    setNewCrewForm({ specialties: [], specialtiesStr: '', status: 'available' })
    setShowCrewModal(true)
  }

  function openEditCrew(member: CrewMember) {
    setEditingCrew(member)
    setNewCrewForm({ ...member, specialtiesStr: member.specialties.join(', ') })
    setShowCrewModal(true)
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(String(ev.target?.result))
        if (!Array.isArray(imported?.missions) || !Array.isArray(imported?.crew)) throw new Error('shape')
        if (!window.confirm('Replace the current missions and crew with this file?')) {
          flash('Import cancelled')
          return
        }
        setData({ missions: imported.missions, crew: imported.crew })
        flash('Backup imported')
      } catch {
        flash('That file is not an Orb backup')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Stats
  const stats = useMemo(() => ({
    totalMissions: data.missions.length,
    activeMissions: activeMissions.length,
    planningMissions: upcomingMissions.length,
    availableCrew: availableCrew.length,
    assignedCrew: assignedCrew.length,
  }), [data.missions, data.crew, activeMissions.length, upcomingMissions.length, availableCrew.length, assignedCrew.length])

  const nowFraction = Math.min(Math.max((currentDay - 1) / PLANNING_HORIZON, 0), 1)
  const presentStatuses = MISSION_STATUSES.filter((s) => data.missions.some((m) => m.status === s))

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'missions', label: 'Missions', count: data.missions.length },
    { id: 'crew', label: 'Crew', count: data.crew.length },
    { id: 'schedule', label: 'Schedule' },
    { id: 'reports', label: 'Reports' },
  ]

  return (
    <div className="orb-ui admin-page">
      <header className="admin-topbar">
        <div className="page admin-topbar-inner">
          <span className="wordmark">Orb</span>
          <span className="admin-topbar-sep" aria-hidden="true" />
          <span className="admin-topbar-title">Mission Control</span>
          <div className="admin-topbar-right">
            <span className="admin-badge">Earth &bull; Day {currentDay}</span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>Sign out</Button>
          </div>
        </div>
      </header>

      <div className="page">
        <div className="admin-header">
          <h1>Mission Control Center</h1>
          <p className="admin-sub">
            Plan upcoming trips and assign crew to them. Astronauts only ever see their own
            assignment on their own pages.
          </p>
        </div>

        <div className="admin-stats">
          <Readout big label="Active missions" value={stats.activeMissions} unit="missions" />
          <Readout big label="In planning" value={stats.planningMissions} unit="missions" />
          <Readout big label="Crew available" value={stats.availableCrew} unit="astronauts" level={stats.availableCrew < 3 ? 'act' : null} />
          <Readout big label="Crew assigned" value={stats.assignedCrew} unit="astronauts" />
        </div>

        <nav className="admin-tabs" role="tablist" aria-label="Mission control sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.count !== undefined && <span className="admin-tab-count">{tab.count}</span>}
            </button>
          ))}
        </nav>

        {activeTab === 'missions' && (
          <div role="tabpanel" id="panel-missions" aria-labelledby="tab-missions" className="admin-panel">
            <Section title="Mission portfolio" note={`${data.missions.length} total • ${activeMissions.length} active • ${upcomingMissions.length} upcoming`}>
              <div className="admin-actions">
                <Button onClick={openNewMission}><Plus size={16} aria-hidden="true" /> New mission</Button>
              </div>
              <div className="missions-grid">
                {data.missions.length === 0 ? (
                  <div className="empty-state">
                    <p className="empty-state-title">No missions yet</p>
                    <p>Create the first trip, then assign astronauts to it from the mission form.</p>
                    <Button onClick={openNewMission}><Plus size={16} aria-hidden="true" /> Create first mission</Button>
                  </div>
                ) : (
                  data.missions.map((mission) => {
                    const primaryCrew = mission.crew
                      .filter((c) => c.primary)
                      .map((c) => data.crew.find((cm) => cm.id === c.crewId)?.name)
                      .filter(Boolean)
                      .join(', ')
                    const daysUntilStart = mission.startDate - currentDay
                    const isUpcoming = daysUntilStart > 0
                    const isOngoing = daysUntilStart <= 0 && mission.endDate >= currentDay
                    const windowLeft = ((mission.startDate - 1) / PLANNING_HORIZON) * 100
                    const windowWidth = ((mission.endDate - mission.startDate + 1) / PLANNING_HORIZON) * 100
                    return (
                      <Card key={mission.id} className={`mission-card ${mission.status}`}>
                        <CardHeader>
                          <div className="mission-card-head">
                            <div>
                              <CardTitle>{mission.name}</CardTitle>
                              <CardDescription>{mission.program} &bull; {mission.destination}</CardDescription>
                            </div>
                            <span className={`mission-status ${mission.status}`}>{prettify(mission.status)}</span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="mission-window" aria-hidden="true">
                            <span className={mission.status} style={{ left: `${windowLeft}%`, width: `${windowWidth}%` }} />
                          </div>
                          <div className="mission-details">
                            <div className="detail-row">
                              <span className="detail-label">Timeline</span>
                              <span>Day {mission.startDate} &ndash; Day {mission.endDate} ({mission.endDate - mission.startDate + 1} days)</span>
                            </div>
                            <div className="detail-row">
                              <span className="detail-label">Countdown</span>
                              <span>{isUpcoming ? `T-${daysUntilStart} days` : isOngoing ? 'In progress' : 'Complete'}</span>
                            </div>
                            <div className="detail-row">
                              <span className="detail-label">Crew</span>
                              <span>{primaryCrew || 'Unassigned'}{mission.crew.length > 0 && ` (${mission.crew.length} assigned)`}</span>
                            </div>
                          </div>
                          {mission.description && <p className="mission-description">{mission.description}</p>}
                          {mission.objectives.length > 0 && (
                            <div className="mission-objectives">
                              <span className="detail-label">Objectives</span>
                              <ul>
                                {mission.objectives.map((obj, i) => <li key={i}>{obj}</li>)}
                              </ul>
                            </div>
                          )}
                          <div className="mission-actions">
                            <Button size="sm" variant="outline" onClick={() => openEditMission(mission)}>Edit</Button>
                            <Button size="sm" variant="outline" onClick={() => duplicateMission(mission)}>Duplicate</Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteMission(mission.id)}>Delete</Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>
            </Section>
          </div>
        )}

        {activeTab === 'crew' && (
          <div role="tabpanel" id="panel-crew" aria-labelledby="tab-crew" className="admin-panel">
            <Section title="Astronaut corps" note={`${data.crew.length} total • ${availableCrew.length} available • ${assignedCrew.length} assigned`}>
              <div className="admin-actions">
                <Button onClick={openNewCrew}><Plus size={16} aria-hidden="true" /> Add astronaut</Button>
              </div>
              <div className="crew-grid">
                {data.crew.map((member) => {
                  const currentMission = data.missions.find((m) => m.crew.some((mc) => mc.crewId === member.id))
                  return (
                    <Card key={member.id} className="crew-card">
                      <CardHeader>
                        <div className="crew-card-header">
                          <div className="crew-avatar" aria-hidden="true">{member.name.split(' ').map((n) => n[0]).join('')}</div>
                          <div className="crew-info">
                            <CardTitle>{member.name}</CardTitle>
                            <CardDescription>{member.role}</CardDescription>
                          </div>
                          <span className={`crew-status ${member.status}`}>{prettify(member.status)}</span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="chip-row">
                          {member.specialties.map((s) => <span key={s} className="chip">{s}</span>)}
                        </div>
                        <div className="mission-details">
                          <div className="detail-row">
                            <span className="detail-label">Assignment</span>
                            <span>{currentMission ? `${currentMission.name} (${currentMission.program})` : 'Unassigned'}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Corps ID</span>
                            <span>{member.id}</span>
                          </div>
                        </div>
                        <div className="mission-actions">
                          <Button size="sm" variant="outline" onClick={() => openEditCrew(member)}>Edit</Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteCrew(member.id)}>Remove</Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </Section>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div role="tabpanel" id="panel-schedule" aria-labelledby="tab-schedule" className="admin-panel">
            <Section title="Mission schedule" note={`Every mission plotted across the ${PLANNING_HORIZON}-day planning horizon, with today marked.`}>
              {data.missions.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-state-title">Nothing scheduled</p>
                  <p>Missions appear here on a shared timeline once you create them.</p>
                  <Button onClick={openNewMission}><Plus size={16} aria-hidden="true" /> New mission</Button>
                </div>
              ) : (
                <div className="gantt">
                  <div className="gantt-head">
                    <div className="gantt-corner">Mission</div>
                    <div className="gantt-axis">
                      {[1, 183, 366, 549, 730].map((day, i, all) => (
                        <span
                          key={day}
                          className="gantt-tick"
                          style={{
                            left: `${((day - 1) / PLANNING_HORIZON) * 100}%`,
                            '--tick-shift': i === 0 ? '0' : i === all.length - 1 ? '-100%' : '-50%',
                          } as React.CSSProperties}
                        >
                          Day {day}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="gantt-body">
                    {[...data.missions].sort((a, b) => a.startDate - b.startDate).map((mission) => (
                      <div key={mission.id} className="gantt-row">
                        <div className="gantt-label">
                          <span className="gantt-name">{mission.name}</span>
                          <span className="gantt-sub">{mission.program} &bull; Day {mission.startDate}&ndash;{mission.endDate}</span>
                        </div>
                        <div className="gantt-track">
                          <div
                            className={`gantt-bar ${mission.status}`}
                            style={{
                              left: `${((mission.startDate - 1) / PLANNING_HORIZON) * 100}%`,
                              width: `${((mission.endDate - mission.startDate + 1) / PLANNING_HORIZON) * 100}%`,
                            }}
                            title={`${mission.name}: Day ${mission.startDate} to Day ${mission.endDate}`}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="gantt-now" style={{ '--now': nowFraction } as React.CSSProperties} aria-hidden="true" />
                  </div>
                  <div className="gantt-legend">
                    {presentStatuses.map((s) => (
                      <span key={s}><i className={`gantt-swatch ${s}`} aria-hidden="true" /> {titleCase(s)}</span>
                    ))}
                    <span><i className="gantt-swatch now" aria-hidden="true" /> Today</span>
                  </div>
                </div>
              )}
            </Section>
          </div>
        )}

        {activeTab === 'reports' && (
          <div role="tabpanel" id="panel-reports" aria-labelledby="tab-reports" className="admin-panel">
            <Section title="Reports and export" note="Export the mission record as plain files, or restore the console from a backup.">
              <div className="admin-actions">
                {reportMsg && <p className="admin-flash" role="status">{reportMsg}</p>}
              </div>
              <div className="reports-grid">
                <Card className="report-card">
                  <CardHeader>
                    <CardTitle className="report-title"><FileSpreadsheet size={16} aria-hidden="true" /> Crew assignments</CardTitle>
                    <CardDescription>Every astronaut with role, status and current mission</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" onClick={() => {
                      const rows = [['Name', 'Role', 'Status', 'Current mission']]
                      for (const c of data.crew) {
                        const mission = data.missions.find((m) => m.crew.some((mc) => mc.crewId === c.id))
                        rows.push([c.name, c.role, c.status, mission?.name || 'Unassigned'])
                      }
                      downloadFile('orb-crew-assignments.csv', toCsv(rows), 'text/csv;charset=utf-8')
                      flash('Crew assignments downloaded')
                    }}><Download size={16} aria-hidden="true" /> Download CSV</Button>
                  </CardContent>
                </Card>
                <Card className="report-card">
                  <CardHeader>
                    <CardTitle className="report-title"><FileSpreadsheet size={16} aria-hidden="true" /> Mission summary</CardTitle>
                    <CardDescription>All missions with program, status, timeline and crew</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" onClick={() => {
                      const rows = [['Mission', 'Program', 'Status', 'Timeline', 'Primary crew']]
                      for (const m of data.missions) {
                        const primary = m.crew.filter((mc) => mc.primary).map((mc) => data.crew.find((c) => c.id === mc.crewId)?.name).join('; ')
                        rows.push([m.name, m.program, m.status, `Day ${m.startDate}-${m.endDate}`, primary])
                      }
                      downloadFile('orb-mission-summary.csv', toCsv(rows), 'text/csv;charset=utf-8')
                      flash('Mission summary downloaded')
                    }}><Download size={16} aria-hidden="true" /> Download CSV</Button>
                  </CardContent>
                </Card>
                <Card className="report-card">
                  <CardHeader>
                    <CardTitle className="report-title"><Database size={16} aria-hidden="true" /> Full backup</CardTitle>
                    <CardDescription>Every mission and astronaut as one JSON file</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" onClick={() => {
                      downloadFile('orb-mission-control.json', JSON.stringify(data, null, 2), 'application/json')
                      flash('Backup downloaded')
                    }}><Download size={16} aria-hidden="true" /> Download JSON</Button>
                  </CardContent>
                </Card>
                <Card className="report-card">
                  <CardHeader>
                    <CardTitle className="report-title"><Upload size={16} aria-hidden="true" /> Restore</CardTitle>
                    <CardDescription>Replace the console with a previous backup</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <input
                      ref={importInput}
                      type="file"
                      accept=".json,application/json"
                      tabIndex={-1}
                      aria-hidden="true"
                      onChange={handleImport}
                      className="visually-hidden"
                    />
                    <Button variant="outline" size="sm" onClick={() => importInput.current?.click()}><Upload size={16} aria-hidden="true" /> Choose file</Button>
                  </CardContent>
                </Card>
              </div>
            </Section>
          </div>
        )}
      </div>

      {/* Mission dialog */}
      {showMissionModal && (
        <div className="modal-overlay" onClick={() => setShowMissionModal(false)}>
          <div
            className="modal modal-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mission-dialog-title"
            ref={missionDialog}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <Card>
              <CardHeader>
                <div className="modal-head">
                  <CardTitle id="mission-dialog-title">{editingMission ? 'Edit mission' : 'New mission'}</CardTitle>
                  <button type="button" className="modal-close" aria-label="Close dialog" onClick={() => setShowMissionModal(false)}>
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => {
                  e.preventDefault()
                  const missionData = {
                    ...newMissionForm,
                    id: editingMission?.id || generateId(),
                    crew: newMissionForm.crew || [],
                    objectives: newMissionForm.objectives || [],
                  } as Mission
                  if (editingMission) updateMission(missionData)
                  else addMission(missionData)
                }}>
                  <div className="form-grid">
                    <div>
                      <label>Mission name <Input value={newMissionForm.name || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMissionForm({ ...newMissionForm, name: e.target.value })} placeholder="Artemis IV" required /></label>
                    </div>
                    <div>
                      <label>Program
                        <Select
                          value={newMissionForm.program || 'Artemis'}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewMissionForm({ ...newMissionForm, program: e.target.value })}
                          options={['Artemis', 'ISS', 'Mars', 'Gateway', 'Commercial', 'Custom'].map((v) => ({ value: v, label: v }))}
                        />
                      </label>
                    </div>
                    <div>
                      <label>Destination
                        <Select
                          value={newMissionForm.destination || 'Moon'}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewMissionForm({ ...newMissionForm, destination: e.target.value })}
                          options={['Moon', 'ISS', 'Mars', 'Gateway', 'LEO', 'Lunar Orbit'].map((v) => ({ value: v, label: v }))}
                        />
                      </label>
                    </div>
                    <div>
                      <label>Status
                        <Select
                          value={newMissionForm.status || 'planning'}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewMissionForm({ ...newMissionForm, status: e.target.value as Mission['status'] })}
                          options={MISSION_STATUSES.map((v) => ({ value: v, label: titleCase(v) }))}
                        />
                      </label>
                    </div>
                    <div>
                      <label>Start day <Input type="number" min={1} max={PLANNING_HORIZON} value={newMissionForm.startDate ?? currentDay + 30} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMissionForm({ ...newMissionForm, startDate: parseInt(e.target.value) })} /></label>
                    </div>
                    <div>
                      <label>End day <Input type="number" min={1} max={PLANNING_HORIZON} value={newMissionForm.endDate ?? currentDay + 60} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMissionForm({ ...newMissionForm, endDate: parseInt(e.target.value) })} /></label>
                    </div>
                    <div className="full-width">
                      <label>Description <textarea value={newMissionForm.description || ''} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewMissionForm({ ...newMissionForm, description: e.target.value })} rows={3} placeholder="Mission description and context..." /></label>
                    </div>
                    <div className="full-width">
                      <label>Objectives (one per line) <textarea value={(newMissionForm.objectives || []).join('\n')} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewMissionForm({ ...newMissionForm, objectives: e.target.value.split('\n').filter((o) => o.trim()) })} rows={4} placeholder={'Objective 1\nObjective 2'} /></label>
                    </div>
                    <div className="full-width">
                      <label>Crew assignments
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
                                options={MISSION_ROLES.map((v) => ({ value: v, label: titleCase(v) }))}
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
                          <div>
                            <Button type="button" size="sm" variant="outline" onClick={() => setNewMissionForm({ ...newMissionForm, crew: [...(newMissionForm.crew || []), { crewId: availableCrew[0]?.id || data.crew[0]?.id || '', role: 'mission_specialist', primary: false }] })}>+ Add crew member</Button>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                  <div className="modal-actions">
                    <Button type="button" variant="outline" onClick={() => setShowMissionModal(false)}>Cancel</Button>
                    <Button type="submit">{editingMission ? 'Update mission' : 'Create mission'}</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Astronaut dialog */}
      {showCrewModal && (
        <div className="modal-overlay" onClick={() => setShowCrewModal(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="crew-dialog-title"
            ref={crewDialog}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <Card>
              <CardHeader>
                <div className="modal-head">
                  <CardTitle id="crew-dialog-title">{editingCrew ? 'Edit astronaut' : 'Add astronaut'}</CardTitle>
                  <button type="button" className="modal-close" aria-label="Close dialog" onClick={() => setShowCrewModal(false)}>
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => {
                  e.preventDefault()
                  const crewData = {
                    ...newCrewForm,
                    id: newCrewForm.id || generateId(),
                    specialties: newCrewForm.specialtiesStr?.split(',').map((s) => s.trim()).filter(Boolean) || [],
                  } as CrewMember
                  if (editingCrew) updateCrew(crewData)
                  else addCrew(crewData)
                }}>
                  <div className="form-grid">
                    <div>
                      <label>Corps ID <Input value={newCrewForm.id || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCrewForm({ ...newCrewForm, id: e.target.value })} placeholder="unique-id" required /></label>
                    </div>
                    <div>
                      <label>Name <Input value={newCrewForm.name || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCrewForm({ ...newCrewForm, name: e.target.value })} placeholder="Full name" required /></label>
                    </div>
                    <div className="full-width">
                      <label>Role <Input value={newCrewForm.role || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCrewForm({ ...newCrewForm, role: e.target.value })} placeholder="Commander, Pilot, Medical Officer, etc." required /></label>
                    </div>
                    <div className="full-width">
                      <label>Specialties (comma-separated) <Input value={newCrewForm.specialtiesStr || ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCrewForm({ ...newCrewForm, specialtiesStr: e.target.value })} placeholder="EVA, Robotics, Geology, etc." /></label>
                    </div>
                    <div>
                      <label>Status
                        <Select
                          value={newCrewForm.status || 'available'}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewCrewForm({ ...newCrewForm, status: e.target.value as CrewMember['status'] })}
                          options={CREW_STATUSES.map((v) => ({ value: v, label: titleCase(v) }))}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="modal-actions">
                    <Button type="button" variant="outline" onClick={() => setShowCrewModal(false)}>Cancel</Button>
                    <Button type="submit">{editingCrew ? 'Update astronaut' : 'Add astronaut'}</Button>
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
