import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { Shell } from './components/Shell'
import { useSession } from './store/session'
import { Body } from './screens/Body'
import { Radiation } from './screens/Radiation'
import { ShipEarth } from './screens/ShipEarth'
import { SleepMind } from './screens/SleepMind'
import { Today } from './screens/Today'

/* The crew's everyday screens load with the app. The rest (the front page,
   the black-hole sign-in, Mission Control and the specialist screens) load
   when first opened, which keeps the first download small. */
const Admin = lazy(() => import('./screens/Admin').then((m) => ({ default: m.Admin })))
const Command = lazy(() => import('./screens/Command').then((m) => ({ default: m.Command })))
const Consult = lazy(() => import('./screens/Consult').then((m) => ({ default: m.Consult })))
const EVA = lazy(() => import('./screens/EVA').then((m) => ({ default: m.EVA })))
const Games = lazy(() => import('./screens/Games').then((m) => ({ default: m.Games })))
const GamePlay = lazy(() => import('./screens/Games').then((m) => ({ default: m.GamePlay })))
const Landing = lazy(() => import('./screens/Landing').then((m) => ({ default: m.Landing })))
const Login = lazy(() => import('./screens/Login').then((m) => ({ default: m.Login })))
const ScenariosScreen = lazy(() => import('./screens/Scenarios').then((m) => ({ default: m.ScenariosScreen })))
const Sources = lazy(() => import('./screens/Sources').then((m) => ({ default: m.Sources })))

/**
 * Anyone not signed in who opens the app lands on the front page. A deeper link goes
 * to the sign-in screen instead, then back where they were going.
 */
function RequireCrew({ children }: { children: ReactNode }) {
  const crewId = useSession((s) => s.crewId)
  const location = useLocation()
  if (!crewId && location.pathname === '/') return <Navigate to="/welcome" replace />
  if (!crewId) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

/** Links saved before game pages moved under /games/play/. */
function OldGameLink() {
  const { id = '' } = useParams()
  return <Navigate to={`/games/play/${id}`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="welcome" element={<Landing />} />
          <Route path="login" element={<Login />} />
          <Route path="admin" element={<Admin />} />
          <Route
            element={
              <RequireCrew>
                <Shell />
              </RequireCrew>
            }
          >
            <Route index element={<Today />} />
            <Route path="body" element={<Body />} />
            <Route path="sleep" element={<SleepMind />} />
            <Route path="radiation" element={<Radiation />} />
            <Route path="ship" element={<ShipEarth />} />
            <Route path="consult" element={<Consult />} />
            <Route path="eva" element={<EVA />} />
            <Route path="scenarios" element={<ScenariosScreen />} />
            <Route path="games" element={<Games />} />
            {/* Not /games/:id, which would share a URL with the static folders in public/games. */}
            <Route path="games/play/:id" element={<GamePlay />} />
            <Route path="games/:id" element={<OldGameLink />} />
            <Route path="command" element={<Command />} />
            <Route path="sources" element={<Sources />} />
            <Route path="*" element={<Today />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
