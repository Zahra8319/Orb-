import { HashRouter, Route, Routes } from 'react-router-dom'
import { Shell } from './components/Shell'
import { Body } from './screens/Body'
import { Radiation } from './screens/Radiation'
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
          <Route path="sources" element={<Sources />} />
          <Route path="*" element={<Today />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
