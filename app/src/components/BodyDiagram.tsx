import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Brain, Bone, Droplet, Activity, Wind } from 'lucide-react'

/** Body diagram with clickable regions. Each region links to the relevant screen. */
export function BodyDiagram({ className = '', compact = false }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [focused, setFocused] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Body regions with their metadata
  const regions = [
    {
      id: 'heart',
      label: 'Cardiovascular',
      screen: '/body',
      icon: Heart,
      status: 'vitals',
      coords: { x: 50, y: 32, r: 14 },
      color: 'var(--urgent)',
      description: 'Heart rate, rhythm, blood pressure',
    },
    {
      id: 'brain',
      label: 'Cognitive & Mood',
      screen: '/sleep',
      icon: Brain,
      status: 'sleep',
      coords: { x: 50, y: 16, r: 12 },
      color: 'var(--primary)',
      description: 'Sleep, reaction time, mood',
    },
    {
      id: 'lungs',
      label: 'Respiratory',
      screen: '/body',
      icon: Wind,
      status: 'vitals',
      coords: { x: 50, y: 40, r: 16 },
      color: 'var(--live)',
      description: 'SpO2, cabin CO2, breathing',
    },
    {
      id: 'bones',
      label: 'Musculoskeletal',
      screen: '/body',
      icon: Bone,
      status: 'exercise',
      coords: { x: 50, y: 58, r: 20 },
      color: 'var(--watch)',
      description: 'Bone density, muscle strength, exercise',
    },
    {
      id: 'radiation',
      label: 'Radiation',
      screen: '/radiation',
      icon: Activity,
      status: 'radiation',
      coords: { x: 50, y: 72, r: 14 },
      color: 'var(--nasa-orange)',
      description: 'Career dose, SPE alerts, shelter status',
    },
    {
      id: 'hydration',
      label: 'Nutrition & Hydration',
      screen: '/body',
      icon: Droplet,
      status: 'nutrition',
      coords: { x: 50, y: 86, r: 12 },
      color: 'var(--nasa-cyan)',
      description: 'Glucose, hydration, calorie balance',
    },
  ]

  const handleKeyDown = (e: React.KeyboardEvent, regionId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setFocused(regionId)
    }
  }

  const handleFocus = (regionId: string) => setFocused(regionId)
  const handleBlur = () => setFocused(null)

  return (
    <div
      ref={containerRef}
      className={`body-diagram ${className} ${compact ? 'compact' : ''}`}
      role="img"
      aria-label="Astronaut body diagram showing health systems"
    >
      {/* SVG Body Outline */}
      <svg viewBox="0 0 100 110" className="body-svg" aria-hidden="true">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Body silhouette */}
        <path
          d="
            M50 10
            C35 10, 25 22, 25 35
            C25 45, 30 55, 30 65
            C30 75, 35 85, 40 92
            L50 105
            L60 92
            C65 85, 70 75, 70 65
            C70 55, 75 45, 75 35
            C75 22, 65 10, 50 10
            Z
          "
          className="body-silhouette"
          fill="var(--surface)"
          stroke="var(--rule)"
          strokeWidth="1.5"
        />

        {/* Subtle organ hints */}
        <ellipse cx="50" cy="32" rx="12" ry="10" fill="var(--urgent)" opacity="0.06" />
        <ellipse cx="50" cy="16" rx="10" ry="8" fill="var(--primary)" opacity="0.06" />
        <path d="M38 40 Q50 35 62 40 Q60 50 38 50 Z" fill="var(--live)" opacity="0.06" />
        <ellipse cx="50" cy="58" rx="18" ry="14" fill="var(--watch)" opacity="0.04" />
        <ellipse cx="50" cy="72" rx="12" ry="10" fill="var(--nasa-orange)" opacity="0.04" />
      </svg>

      {/* Interactive hotspots */}
      {regions.map((region) => (
        <button
          key={region.id}
          className={`body-hotspot ${hovered === region.id ? 'hovered' : ''} ${focused === region.id ? 'focused' : ''}`}
          style={{
            left: `${region.coords.x - region.coords.r}%`,
            top: `${region.coords.y - region.coords.r}%`,
            width: `${region.coords.r * 2}%`,
            height: `${region.coords.r * 2}%`,
            '--hotspot-color': region.color,
          } as React.CSSProperties}
          onMouseEnter={() => setHovered(region.id)}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => handleFocus(region.id)}
          onBlur={handleBlur}
          onKeyDown={(e) => handleKeyDown(e, region.id)}
          onClick={() => window.location.href = region.screen}
          aria-label={`${region.label}: ${region.description}. Click to view.`}
          tabIndex={0}
        >
          <span className="hotspot-ring" aria-hidden="true" />
          <span className="hotspot-dot" aria-hidden="true" />
        </button>
      ))}

      {/* Tooltip / Detail panel */}
      {hovered && (() => {
        const region = regions.find(r => r.id === hovered)
        if (!region) return null
        const Icon = region.icon
        return (
          <div className="body-tooltip" role="tooltip" aria-live="polite">
            <div className="tooltip-header" style={{ '--tooltip-color': region.color } as React.CSSProperties}>
              <Icon className="tooltip-icon" size={18} aria-hidden="true" />
              <span>{region.label}</span>
            </div>
            <p className="tooltip-desc">{region.description}</p>
            <Link to={region.screen || '/'} className="tooltip-link">
              View details
            </Link>
          </div>
        )
      })()}
    </div>
  )
}

/** Minimal version for dashboard embedding */
type SystemStatus = 'urgent' | 'act' | 'watch' | 'nominal' | undefined

export function MiniBodyDiagram({ status = {}, className = '' }: { status?: Record<string, SystemStatus>; className?: string }) {
  const regions: string[] = ['heart', 'brain', 'lungs', 'bones', 'radiation', 'hydration']

  return (
    <div className={`mini-body-diagram ${className}`} role="img" aria-label="Body systems status">
      <svg viewBox="0 0 60 70" className="mini-body-svg" aria-hidden="true">
        <path
          d="M30 6 C20 6, 12 16, 12 26 C12 34, 16 42, 16 48 C16 54, 20 60, 24 65 L30 70 L36 65 C40 60, 44 54, 44 48 C44 42, 48 34, 48 26 C48 16, 40 6, 30 6 Z"
          fill="var(--surface)"
          stroke="var(--rule)"
          strokeWidth="1"
        />
        {regions.map((id) => {
          const coords = MINI_COORDS[id]
          const s = status[id]
          return (
            <circle
              key={id}
              cx={coords.x}
              cy={coords.y}
              r={coords.r}
              fill={s === 'urgent' ? 'var(--urgent)' : s === 'act' ? 'var(--watch)' : s === 'watch' ? 'var(--primary)' : 'var(--live)'}
              className="mini-hotspot"
            />
          )
        })}
      </svg>
      <div className="mini-legend" aria-hidden="true">
        {regions.map((id) => {
          const s = status[id]
          return (
            <span key={id} className={`mini-legend-item ${s || ''}`} title={id}>
              <span className="mini-dot" style={{ background: s === 'urgent' ? 'var(--urgent)' : s === 'act' ? 'var(--watch)' : s === 'watch' ? 'var(--primary)' : 'var(--live)' }} />
            </span>
          )
        })}
      </div>
    </div>
  )
}

interface MiniCoords {
  x: number
  y: number
  r: number
}

const MINI_COORDS: Record<string, MiniCoords> = {
  heart: { x: 30, y: 18, r: 4 },
  brain: { x: 30, y: 10, r: 3 },
  lungs: { x: 30, y: 26, r: 5 },
  bones: { x: 30, y: 40, r: 6 },
  radiation: { x: 30, y: 52, r: 4 },
  hydration: { x: 30, y: 62, r: 3 },
}