import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Shell } from './components/Shell'
import { useSession } from './store/session'
import { Admin } from './screens/Admin'
import { Body } from './screens/Body'
import { Command } from './screens/Command'
import { Consult } from './screens/Consult'
import { EVA } from './screens/EVA'
import { Login } from './screens/Login'
import { Radiation } from './screens/Radiation'
import { ScenariosScreen } from './screens/Scenarios'
import { ShipEarth } from './screens/ShipEarth'
import { SleepMind } from './screens/SleepMind'
import { Sources } from './screens/Sources'
import { Today } from './screens/Today'

/** Sends anyone not signed in to the sign-in screen, then back where they were going. */
function RequireCrew({ children }: { children: ReactNode }) {
  const crewId = useSession((s) => s.crewId)
  const location = useLocation()
  if (!crewId) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
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
          <Route path="command" element={<Command />} />
          <Route path="sources" element={<Sources />} />
          <Route path="*" element={<Today />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
