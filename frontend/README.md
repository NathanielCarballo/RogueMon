# RogueMon Frontend

This is the web-based frontend for the RogueMon project, build using [Vite](https://vitejs.dev/) and [React](https://reactjs.org/). It will serve as the UI layer for interacting with the RogueMon battle engine.

---

## Project Structure

- Built with Vite for fast dev + build times.
- Uses 'react-router-dom' for screen-based routing.
- Will communicate with the backend (Flask) via RESTful API.

src/
├── App.jsx # Routing controller
├── main.jsx # React + Router mount point
├── /screens # All major game screens (NameEntry, Menu, Battle, etc.)
└── /assets # Logo, sprites, or UI elements

---

## Getting Started

### 1. Install dependencies

cd frontend
npm install
npm run dev

then visit: http://localhost:XXXX 

---

## 🔁 Development Notes

    Use trunk-based development with feature/* branches

    Keep React logic decoupled from battle engine logic

    Style using CSS modules, Tailwind (optional), or scoped classNames

## 📡 Backend Integration (planned)

The frontend will make HTTP requests to the Flask server running at:

http://localhost:XXXX

## Example planned endpoints:

    POST /start-battle

    POST /take-turn

    GET /pokemons