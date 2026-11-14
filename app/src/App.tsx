import { HashRouter, Route, Routes } from 'react-router-dom'
import { Shell } from './components/Shell'
import { Body } from './screens/Body'
import { Command } from './screens/Command'
import { Consult } from './screens/Consult'
import { EVA } from './screens/EVA'
import { Radiation } from './screens/Radiation'
import { ScenariosScreen } from './screens/Scenarios'
import { ShipEarth } from './screens/ShipEarth'
import { SleepMind } from './screens/SleepMind'
import { Sources } from './screens/Sources'
import { Today } from './screens/Today'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Shell />}>
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
