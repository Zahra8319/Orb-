import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AdminShell } from './components/AdminShell'
import { Shell } from './components/Shell'
import { useSession } from './store/session'
import { CrewDetail } from './screens/admin/CrewDetail'
import { Inbox } from './screens/admin/Inbox'
import { Overview } from './screens/admin/Overview'
import { Ship } from './screens/admin/Ship'
import { Simulation } from './screens/admin/Simulation'
import { Body } from './screens/Body'
import { Login } from './screens/Login'
import { Radiation } from './screens/Radiation'
import { ShipEarth } from './screens/ShipEarth'
import { SleepMind } from './screens/SleepMind'
import { Sources } from './screens/Sources'
import { Today } from './screens/Today'

/** A crew member's own view: for that crew member, or the flight surgeon viewing as them. */
function RequireCrew({ children }: { children: ReactNode }) {
  const role = useSession((s) => s.role)
  const crewId = useSession((s) => s.crewId)
  const location = useLocation()
  if (!role) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!crewId) return <Navigate to="/admin" replace />
  return children
}

/** Mission Control: the flight surgeon only. */
function RequireSurgeon({ children }: { children: ReactNode }) {
  const role = useSession((s) => s.role)
  const location = useLocation()
  if (!role) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (role !== 'flight-surgeon') return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route
          path="admin"
          element={
            <RequireSurgeon>
              <AdminShell />
            </RequireSurgeon>
          }
        >
          <Route index element={<Overview />} />
          <Route path="crew/:id" element={<CrewDetail />} />
          <Route path="ship" element={<Ship />} />
          <Route path="messages" element={<Inbox />} />
          <Route path="simulation" element={<Simulation />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
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
          <Route path="sources" element={<Sources />} />
          <Route path="*" element={<Today />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
