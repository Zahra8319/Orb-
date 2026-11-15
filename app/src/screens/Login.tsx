import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Orbit } from 'lucide-react'

import { LoginForm } from '@/components/login-form'
import { ShootingStars, type HoleCamera } from '@/components/ShootingStars'
import { BlackHoleHeroSection } from '@/components/ui/blackhole-hero-section'
import { MobileHeroSlideshow } from '@/components/MobileHeroSlideshow'
import { useSession } from '@/store/session'

/** True while the viewport is narrow. Drives the layout swap below. */
function useNarrow(query = '(max-width: 767px)') {
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const sync = () => setNarrow(m.matches)
    sync()
    m.addEventListener('change', sync)
    return () => m.removeEventListener('change', sync)
  }, [query])
  return narrow
}

/**
 * Sign-in: black hole on desktop, lightweight image slideshow on mobile.
 *
 * Desktop: form left under veil, hole right.
 * Mobile: form top, pre-rendered image slideshow below (60fps, no ray-tracing).
 */
export function Login() {
  const narrow = useNarrow()
  const signedIn = useSession((s) => s.crewId)
  const signIn = useSession((s) => s.signIn)
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'

  useEffect(() => {
    document.documentElement.dataset.theme = 'sleep'
    document.title = 'Sign in · Orb+'
    return () => {
      document.title = 'Orb+'
    }
  }, [])

  if (signedIn) return <Navigate to={from} replace />

  // Mobile slideshow frames (pre-rendered, lightweight)
  const mobileFrames = [
    '/hero/sm/f-001.webp',
    '/hero/sm/f-015.webp',
    '/hero/sm/f-030.webp',
    '/hero/sm/f-045.webp',
    '/hero/sm/f-060.webp',
  ]

  // Desktop black hole camera
  const camera: HoleCamera = {
    focus: [0.7, 0.48],
    fov: 42,
    distance: 24,
  }

  return (
    <div className="orb-ui orb-night fixed inset-0 overflow-y-auto bg-black font-sans text-foreground">
      {/* Desktop: Black hole hero */}
      {!narrow && (
        <>
          <BlackHoleHeroSection
            className="fixed! inset-0"
            focus={camera.focus}
            scrim="left"
            scrimStrength={0.92}
            distance={camera.distance}
            elevation={-5.5}
            fov={camera.fov}
            glow={1}
            steps={300}
            resolution={0.7}
            starBrightness={0.8}
            spinSpeed={0.09}
          />
          <ShootingStars className="z-[1]" every={0.7} hole={camera} />
        </>
      )}

      {/* Mobile: Image slideshow (lightweight, 60fps) */}
      {narrow && (
        <MobileHeroSlideshow
          images={mobileFrames}
          interval={7000}
          pauseOnHover={true}
          className="fixed inset-0 -z-10"
        />
      )}

      <main className="relative z-10 flex min-h-svh flex-col items-center justify-start gap-4 p-4 pt-10 pb-20 [text-shadow:0_1px_12px_rgb(0_0_0/0.9)] md:items-start md:justify-center md:p-8 lg:pl-16">
        <div className="flex w-full max-w-sm flex-col gap-4">
          <a
            href="/"
            className="flex items-center gap-2 self-center text-base font-semibold tracking-tight text-white no-underline md:self-start"
            style={{ fontStretch: '118%' }}
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-nasa-blue text-white ring-1 ring-white/25">
              <Orbit className="size-4" aria-hidden="true" />
            </span>
            Orb<span className="wordmark-plus">+</span>
          </a>
          <LoginForm
            onSignIn={(crewId) => {
              signIn(crewId)
              navigate(from, { replace: true })
            }}
          />
        </div>
      </main>
    </div>
  )
}