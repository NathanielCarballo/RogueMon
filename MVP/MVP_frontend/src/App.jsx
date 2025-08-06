import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import WelcomeScreen from "./screens/WelcomeScreen"
import MainMenu from "./screens/MainMenu"
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WelcomeScreen />} />
        <Route path="/main-menu" element={<MainMenu />} />
      </Routes>
    </Router>
  )
}

export default App
