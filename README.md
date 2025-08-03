# RogueMon

A Pokémon roguelike game developed with a modern web-based frontend and a modular Python backend.

## 🧱 Structure

- **`frontend/`** – Vite + React UI (clean, fast SPA)
- **`backend/`**
  - `roguecore/` – Production-grade modular game logic
  - `MVP/` – Early battle engine prototypes (CLI only)
  - `main.py` – Entry point (future Flask API or CLI)

## 💡 Development Workflow

We follow **trunk-based development**:
- All changes start in `feature/*` branches
- Pull requests are reviewed and merged to `main`
- Both backend and frontend share this monorepo

## 🔧 Getting Started

- Frontend: see `frontend/README.md`
- Backend: see `backend/README.md`