import { Routes, Route, Navigate } from 'react-router-dom'
import WelcomeScreen from "./screens/WelcomeScreen"
import MainMenu from "./screens/MainMenu"
import StarterSelect from "./screens/StarterSelect"
import BattleScreen from "./screens/BattleScreen"
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<WelcomeScreen />} />
      <Route path="/main-menu" element={<MainMenu />} />
      <Route path="/starter-select" element={<StarterSelect />} />
      <Route path="/battle" element={<BattleScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
