"""
starters.py - Flask Blueprint for starter Pokemon

Purpose:
- Provides a simple API endpopint for retrieving available starter Pokemon using LOCAL sprites
  (no external API calls). This keeps starter data isolated from battle logic (battle_engine.py)
  and maintain separation of concerns for the MVP.

MVP Scope:
- Starters: Gen 1 only - Bulbasaur (1), Charmander (4), Squirtle (7).
- Response shape per starter:
    {
        "key": "<name key>",
        "name": "<Display Name>",
        "pokedexId": "<int>",
        "sprites": {"/assets/sprites/front/<id>.gif" }
        }
- Frontend consumer: StarterSelect.jsx
    - Display the FRONT sprite in the selection grid
    - On selection, playerkey is stored.

Local asset layout:
/assets/sprites/front/<pokedex_id>.gif   # e.g., 1.gif for Bulbasaur

Future Work:
- Ecpand to all generations (official starters)
- Optional: enrich payload (types, base stats, moves) from PokeAPI
- Optional: caching/preload for performance and offline play

Usage:
    Register this blueprint in app.py:
      from starters import starters_bp
      app.register_blueprint(starters_bp, url_prefix="/api")

"""
from flask import Blueprint, jsonify

# Blueprint dedicated to starter-selection routes
starters_bp = Blueprint("starters", __name__)

# Base paths for local GIF assets (served by the frontend/static server)
FRONT_BASE = "/assets/sprites/front"

def front_sprite(pid: int) -> dict:
    """
    Build local front-facing sprites path for a given Pokedex ID.
    """
    return f"{FRONT_BASE}/{pid}.gif"

# --- Gen 1 MVP Starters ---
# Format: (key pokedex_id)
ALL_STARTERS = [
    ("bulbasaur", 1),
    ("charmander", 4),
    ("squirtle", 7),
]

@starters_bp.route("/starters", methods=["GET"])
def get_starters():
    """
    Returns Gen 1 starter Pokemon with local sprite paths.
    
    Response shape:
    {
        "starters": [
            {
                "key": "bulbasaur",
                "name": "Bulbasaur",
                "pokedexId": 1,
                "sprite": "/assets/sprites/front/1.gif"
            },
            ...
        ]
    }
    """
    starters = [
        {
            "key": key,
            "name": key.capitalize(),
            "pokedex_id": pid,
            "sprite": front_sprite(pid),
        }
        for key, pid in ALL_STARTERS
    ]
    return jsonify({"starters": starters}), 200