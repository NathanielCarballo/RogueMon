import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import WelcomeScreen from "./screens/WelcomeScreen"
import MainMenu from "./screens/MainMenu"
import BattleScreen from "./screens/BattleScreen"
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WelcomeScreen />} />
        <Route path="/main-menu" element={<MainMenu />} />
        <Route path="/battle" element={<BattleScreen />} />
      </Routes>
    </Router>
  )
}

export default App
