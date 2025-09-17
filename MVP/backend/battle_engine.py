"""
battle_engine.py - MVP flask backend for battle simulation

Scope (MVP):
- Start a battle between two starters.
- Resolve a single turn: order by Speed (player wins ties), accuracy check, apply simple
Physical / Status effects, update HP, and accumulate messages.
- Return authoritative state + message logs; frontend only renders.

Non-goals (MVP): abilities, items, EXP/leveling, save/load, complex status stacks.

API contracts:
- POST /api/battle/start -> { battle_id, player{}, enemy{}, status, message_log[] }
- POST /api/battle/turn -> { battle_id, player{}, enemy{}, status, message_log[], turn_log[] }

Notes:
- Keep data structures small and co-located for MVP speed; extract to modules after MVP.
"""

from flask import Blueprint, request, jsonify
import random, uuid

battle_bp = Blueprint("battle", __name__)

#======================================
# Data Definitions
#======================================

# Simplified moves list for MVP - only Tackle and Growl

MOVE_DATA = {
    "tackle": {
        "name": "Tackle",
        "type": "Normal",
        "power": 40,
        "accuracy": 100,
        "category": "Physical"
    },
    "growl": {
        "name": "Growl",
        "type": "Normal",
        "power": 0,
        "accuracy": 100,
        "category": "Status"
    }
}

# Starter Pokemon pool for MVP (subset for Gen 1)
STARTER_POKEMON = {
    "bulbasaur": {
        "name": "Bulbasaur",
        "type": "Grass/Poison",
        "level": 5,
        "max_hp": 45,
        "current_hp": 45,
        "attack": 49,
        "defense": 49,
        "special_attack": 65,
        "special_defense": 65,
        "speed": 45,
        "moves": ["tackle", "growl"]
    },
    "charmander": {
        "name": "Charmander",
        "type": "Fire",
        "level": 5,
        "max_hp": 39,
        "current_hp": 39,
        "attack": 52,
        "defense": 43,
        "special_attack": 60,
        "special_defense": 50,
        "speed": 65,
        "moves": ["tackle", "growl"]
    },
    "squirtle": {
        "name": "Squirtle",
        "type": "Water",
        "level": 5,
        "max_hp": 44,
        "current_hp": 44,
        "attack": 48,
        "defense": 65,
        "special_attack": 50,
        "special_defense": 64,
        "speed": 43,
        "moves": ["tackle", "growl"]
    },
}

POKEDEX = { "bulbasaur": 1, "charmander": 4, "squirtle": 7 }

# Active battles are kept in-memory only for MVP
BATTLES = {} # Store active battles

#======================================
# Domain Model (MVP)
#======================================
class Pokemon:
    """Minimal battle-time snapshot; only the stats needed for MVP combat."""

    def __init__(self,data):
        self.name = data["name"]
        self.type = data["type"]
        self.level = data["level"]
        self.max_hp = data["max_hp"]
        self.current_hp = data["current_hp"]
        self.attack = data["attack"]
        self.defense = data["defense"]
        self.special_attack = data["special_attack"]
        self.special_defense = data["special_defense"]
        self.speed = data["speed"]
        self.moves = data["moves"]
        self.attack_modifier = 1.0  # e.e. Growl lowers this

    def apply_damage(self, damage):
        """Reduce HP by damage amount, not below zero."""
        self.current_hp = max(self.current_hp - damage, 0)

    def apply_stat_change(self,move_name):
        """Handle simple debuffs (MVP: Growl lowers Attack.)"""
        if move_name == "Growl":
            self.attack_modifier *= 0.75  # simple MVP debuff

    def is_fainted(self):
        """Return True if HP is zero or below."""
        return self.current_hp <= 0
        
class Battle:
    """"Encapsulates a single player vs enemy battle session."""
    def __init__(self, player_data, enemy_data):
        self.player = Pokemon(player_data)
        self.enemy = Pokemon(enemy_data)
        self.log = []           # battle-wide running message log
        self.resolving = False  # used to prevent double-turn resolution
        self.capture_resolve = False      # <---- allow exactly one capture attempt after WIN

    def calculate_damage(self, attacker, defender, move):
        """Simplified physical damage calculation; ignores typing, crit, STAB."""
        if move["power"] == 0:
            return 0
        attack_stat = attacker.attack * attacker.attack_modifier
        defense_stat = defender.defense
        base_damage = (((2 * attacker.level / 5 * 2) * move["power"] * (attack_stat / max(1,defense_stat))) / 50) + 2
        return int(base_damage)
    
    def take_turn(self, player_move_name, enemy_move_name):
        """
        Resolve one turn of combat:
        - Determine order by Speed (player first on tie).
        - Each actor executres their move if not fainted.
        - Accuracy check, then damage or status effect applied.
        - Messages appended to battle log.
        """
        player_move = MOVE_DATA[player_move_name]
        enemy_move = MOVE_DATA[enemy_move_name]

        # Speed tie-breaker: player goes first if equal
        first, second = (self.player, self.enemy) if self.player.speed >= self.enemy.speed else (self.enemy, self.player)
        first_move = player_move if first is self.player else enemy_move
        second_move = enemy_move if first is self.player else player_move

        for actor, target, move in [(first, second, first_move), (second, first, second_move)]:
            if actor.is_fainted() or target.is_fainted():
                continue

            # Accuracy roll
            if random.randint(1,100) > move["accuracy"]:
                self.log.append(f"{actor.name}'s {move['name']} missed!")
                continue

            if move["category"] == "Physical":
                damage = self.calculate_damage(actor, target, move)
                target.apply_damage(damage)
                self.log.append(f"{actor.name} used {move['name']}! {target.name} took {damage} damage.")
            elif move["category"] == "Status" and move["name"] == "Growl":
                target.apply_stat_change(move["name"])
                self.log.append(f"{actor.name} used Growl! {target.name}'s attack fell.")

    def get_result(self):
        """Return 'win' if enemy fainted, 'lose' if player fainted, else 'ongoing'."""
        if self.enemy.is_fainted():
            return "win"
        elif self.player.is_fainted():
            return "lose"
        return "ongoing"
    
    def serialize(self):
        """Convert battle state into JSON-friendly dict for frontend."""
        return {
            "player": {
                "name": self.player.name,
                "max_hp": self.player.max_hp,
                "current_hp": self.player.current_hp,
                "attack_modifier": self.player.attack_modifier,
            },
            "enemy": {
                "name": self.enemy.name,
                "max_hp": self.enemy.max_hp,
                "current_hp": self.enemy.current_hp,
                "attack_modifier": self.enemy.attack_modifier,
            },
            "status": self.get_result(),
            "message_log": self.log
        }
    
#======================================
# Blueprints (Flask Endpoints)
#======================================
@battle_bp.route("/battle/start", methods=["POST"])
def start_battle():
    """Create a new battle instance and return its initial state."""
    data = request.get_json(force=True)
    player_name = data["player"]
    # server picks a random enemy for MVP
    enemy_name = random.choice(list(STARTER_POKEMON.keys()))

    battle = Battle(STARTER_POKEMON[player_name], STARTER_POKEMON[enemy_name])
    battle_id = str(uuid.uuid4())
    BATTLES[battle_id] = battle

    # build payload
    payload = battle.serialize()
    payload["battle_id"] = battle_id
    payload["turn_log"] = []    # no delta on start
    # include pokedex ids for frontend sprites
    payload["player"]["pokedex_id"] = POKEDEX.get(player_name)
    payload["enemy"]["pokedex_id"] = POKEDEX.get(enemy_name)
    return jsonify(payload), 200

@battle_bp.route("/battle/turn", methods=["POST"])
def battle_turn():
    """
    Resolve one turn:
    - Player move chosen by frontend.
    - Enemy move chosen randomly.
    - Returns new battle state + delta log of this turn."""
    data = request.get_json(force=True)
    battle_id = data.get("battle_id")
    player_move = data["move"]      # e.g. "tackle" or "growl"

    if battle_id not in BATTLES:
        return jsonify({"error": "Battle not found"}), 404

    battle = BATTLES[battle_id]

    if battle.resolving:
        return jsonify({"error":"Turn in progress"}), 409
    
    # If battle already ended, just return final state
    if battle.get_result() != "ongoing":
        payload = battle.serialize()
        payload["battle_id"] = battle_id
        payload["turn_log"] = []
        payload["player"]["pokedex_id"] = POKEDEX.get(payload["player"]["name"].lower())
        payload["enemy"]["pokedex_id"] = POKEDEX.get(payload["enemy"]["name"].lower())
        return jsonify(payload), 200
    
    battle.resolving = True
    try:
        before_len = len(battle.log)
        enemy_move = random.choice(battle.enemy.moves)
        battle.take_turn(player_move, enemy_move)

        # Compute delta log for this turn only
        turn_log = battle.log[before_len:]

        # De-duplicate consecutive identical lines
        deduped = []
        for line in turn_log:
            if not deduped or deduped[-1] != line:
                deduped.append(line)
        turn_log = deduped

        payload = battle.serialize()
        payload["battle_id"] = battle_id
        payload["turn_log"] = turn_log

        player_key_lower = payload["player"]["name"].lower()
        enemy_key_lower = payload["enemy"]["name"].lower()
        payload["player"]["pokedex_id"] = POKEDEX.get(player_key_lower)
        payload["enemy"]["pokedex_id"] = POKEDEX.get(enemy_key_lower)

        return jsonify(payload), 200
    finally:
        if battle_id in BATTLES:
            BATTLES[battle_id].resolving = False

@battle_bp.route("/battle/capture", methods=["POST"])
def capture_pokemon():
    """
    Attempt a capture after a WIN.
    Request: { "battle_id": "<id>" }
    Response: 200 { success: bool, message: str, captured?: {...} }
              4xx on invalid state
    """
    data = request.get_json(force=True)
    battle_id = data.get("battle_id")
    if not battle_id or battle_id not in BATTLES:
        return jsonify({"success": False, "message": "Battle not found."}), 404
    
    battle = BATTLES[battle_id]
    # enforce win-only capture
    if battle.get_result() != "win":
        return jsonify({"success": False, "message": "Capture allowed only after a win."}), 400
    if getattr(battle, "capture_resolved", False):
        return jsonify({"success": False, "message": "Capture already resolved."}), 409
    
    enemy = battle.enemy
    max_hp = max(1, int(enemy.max_hp))
    cur_hp = max(0, int(enemy.current_hp))

    # MVP odds: 35% base + up to 55% for missing HP; clamp to 95%
    missing_ratio = 1.0 - (cur_hp / max_hp)
    chance = min(95, 35 + int(max(0.0, min(1.0, missing_ratio)) * 55))

    roll = random.randint(1, 100)
    success = roll <= chance
    
    battle.capture_resolved = True

    if success:
        enemy_key = enemy.name.lower()
        captured = {
            "key": enemy_key,
            "name": enemy.name,
            "pokedex_id": POKEDEX.get(enemy_key),
            # MVP defaults for client party
            "level": getattr(enemy, "level", 5),
            "max_hp": enemy.max_hp,
            "current_hp": enemy.max_hp, # heal on capture
            "moves": list(getattr(enemy, "moves", ["tackle", "growl"])),
        }
        return jsonify({
            "success": True,
            "message": f"Gotcha! {captured['name']} was caught!",
            "captured": captured,
        }), 200
    
    return jsonify({
        "success": False,
        "message": "Oh no! The Pokemon broke free!",
    }), 200

@battle_bp.route("/health", methods=["GET"])
def health():
    """Basic liveness probe for local development."""
    return {"status": "ok"}, 200
