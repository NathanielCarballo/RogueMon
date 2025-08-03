# RogueMon Backend

This directory contains the full game logic for RogueMon.


## Structure

- `roguecore/` -- Modular engine logic (battle, Pokemon, data models)
- `MVP/` -- Reference MVP battle engine (used for design decisions)
- `main.py` -- Entry point (Flask or CLI in future)

## MVP Notice

The contents of `MVP/` are kept for historical reference and **should not be imported** into the main application. it serves as a prototype and architecture guide.

## Planned Modules

- `models.py` -- Move, Pokemon, etc.
- `engine.py` -- Battle turn logic
- `data.py` -- Predefined Pokemon and move templates.