import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Orbit } from 'lucide-react'

import { LoginForm } from '@/components/login-form'
import { BlackHoleHeroSection } from '@/components/ui/blackhole-hero-section'
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
 * Sign-in, shadcn login-03, set over a ray-traced black hole.
 *
 * Wide screens: the form on the left under a veil, the hole to the right.
 * Phones: the form on top, the hole low in the frame, veil from the top, and
 * fewer ray steps because a phone pays for every one.
 * The disc keeps the component's own warm palette: white-hot rim, orange, ember.
 */
export function Login() {
  const narrow = useNarrow()
  const signedIn = useSession((s) => s.crewId)
  const signIn = useSession((s) => s.signIn)
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'

  useEffect(() => {
    document.documentElement.dataset.theme = 'sleep'
    document.title = 'Sign in · Orb'
    return () => {
      document.title = 'Orb'
    }
  }, [])

  if (signedIn) return <Navigate to={from} replace />

  return (
    <div className="orb-ui orb-night fixed inset-0 overflow-y-auto bg-black font-sans text-foreground">
      <BlackHoleHeroSection
        className="fixed! inset-0"
        focus={narrow ? [0.5, 0.9] : [0.7, 0.48]}
        scrim={narrow ? 'top' : 'left'}
        scrimStrength={0.88}
        distance={24}
        elevation={narrow ? -7 : -5.5}
        fov={narrow ? 60 : 42}
        glow={narrow ? 0.85 : 1}
        steps={narrow ? 200 : 300}
        resolution={narrow ? 0.6 : 0.7}
        starBrightness={0.35}
        spinSpeed={0.09}
      />

      <main className="relative z-10 flex min-h-svh flex-col items-center justify-start gap-6 p-6 pt-12 pb-40 [text-shadow:0_1px_12px_rgb(0_0_0/0.9)] md:items-start md:justify-center md:p-10 lg:pl-24">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <a
            href="#/"
            className="flex items-center gap-2 self-center text-lg font-semibold tracking-tight text-white no-underline md:self-start"
            style={{ fontStretch: '118%' }}
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-nasa-blue text-white ring-1 ring-white/25">
              <Orbit className="size-4" aria-hidden="true" />
            </span>
            Orb
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
