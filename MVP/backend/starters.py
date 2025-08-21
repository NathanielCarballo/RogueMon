"""
starters.py - Starter Pokemon definitions (future-facing)

Intent:
- Centralize starter Pokemon metadata across generations.
- MVP currently only consumes a small subset via `battle_engine.py`.
- This file is structured as a Flask Blueprint for future expansion.

Notes:
- For MVP, data is hardcoded and partially incomplete.
- Post-MVP, expand to return richer payloads: pokedexId, name, type(s), sprite URL,
    normalized move data, etc.
"""

from flask import Blueprint, jsonify

starters_bp = Blueprint("starters", __name__)

# ================================
# Starer Pokemon Data
# ================================

# All starters (key, pokedexid) Expandable later
ALL_STARTERS = [
    #Gen 1
    ("bulbasaur", 1), ("charmander", 4), ("squirtle", 7),
    #Gen 2
    ("chikorita", 152), ("cyndaquil"), ("totodile"),
    #Gen 3

    #Gen 4
    #Gen 5
    #Gen 6
    #Gen 7
    #Gen 8
    #Gen 9
]

# TODO(mvp-exit):
# - Normalize starter data into full dict objects:
#   { "pokedexId": int, "name": str, "types": [str], "spriteUrl": str, "moves": [] }
# - Wire this endpoint into frontend starter selection screen.