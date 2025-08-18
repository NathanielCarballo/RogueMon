from flask import Blueprint, jsonify

starters_bp = Blueprint("starters", __name__)

# All starters (key, pokedex_id) Expandable later
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