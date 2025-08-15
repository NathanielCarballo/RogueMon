from flask import Flask, request, jsonify
import random, uuid

app = Flask(__name__)

#======================================
# Data Definitions
#======================================

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
    "pikachu": {
        "name": "Pikachu",
        "type": "Electric",
        "level": 5,
        "max_hp": 35,
        "current_hp": 35,
        "attack": 55,
        "defense": 40,
        "special_attack": 50,
        "special_defense": 50,
        "speed": 90,
        "moves": ["tackle", "growl"]
    }
}

BATTLES = {} # Store active battles

#======================================
# Classes
#======================================
class Pokemon:
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
        self.attack_modifier = 1.0

    def apply_damage(self, damage):
        self.current_hp = max(self.current_hp - damage, 0)

    def apply_stat_change(self,move_name):
        if move_name == "Growl":
            self.attack_modifier *= 0.75  # simple MVP debuff

    def is_fainted(self):
        return self.current_hp <= 0
        
class Battle:
    def __init__(self, player_data, enemy_data):
        self.player = Pokemon(player_data)
        self.enemy = Pokemon(enemy_data)
        self.log = []
        self.resolving = False

    def calculate_damage(self, attacker, defender, move):
        if move["power"] == 0:
            return 0
        attack_stat = attacker.attack * attacker.attack_modifier
        defense_stat = defender.defense
        base_damage = (((2 * attacker.level / 5 * 2) * move["power"] * (attack_stat / max(1,defense_stat))) / 50) + 2
        return int(base_damage)
    
    def take_turn(self, player_move_name, enemy_move_name):
        player_move = MOVE_DATA[player_move_name]
        enemy_move = MOVE_DATA[enemy_move_name]

        # simple speed tie-breaker: player first on tie
        first, second = (self.player, self.enemy) if self.player.speed >= self.enemy.speed else (self.enemy, self.player)
        first_move = player_move if first is self.player else enemy_move
        second_move = enemy_move if first is self.player else player_move

        for actor, target, move in [(first, second, first_move), (second, first, second_move)]:
            if actor.is_fainted() or target.is_fainted():
                continue

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
        if self.enemy.is_fainted():
            return "win"
        elif self.player.is_fainted():
            return "lose"
        return "ongoing"
    
    def serialize(self):
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
# Routes
#======================================

@app.route("/api/starters", methods=["GET"])
def get_starters():
    starters = []
    for key, poke in STARTER_POKEMON.items():
        starters.append({
            "name": poke["name"],
            "type": poke["type"],
            "moves": [MOVE_DATA[m] for m in poke ["moves"]],
            "spriteUrl": f"/assets/sprites/{poke['name'].lower()}.png"
        })
    return jsonify(starters)

@app.route("/api/battle/start", methods=["POST"])
def start_battle():
    data = request.get_json(force=True)
    player_name = data["player"]
    enemy_name = data["enemy"]

    battle = Battle(STARTER_POKEMON[player_name], STARTER_POKEMON[enemy_name])
    battle_id = str(uuid.uuid4())
    BATTLES[battle_id] = battle

    payload = battle.serialize()
    payload["battle_id"] = battle_id
    payload["turn_log"] = []    # <----- no delta on start
    return jsonify(payload), 200

@app.route("/api/battle/turn", methods=["POST"])
def battle_turn():
    data = request.get_json(force=True)
    battle_id = data.get("battle_id")
    player_move = data["move"]      # e.g. "tackle" or "growl"

    if battle_id not in BATTLES:
        return jsonify({"error": "Battle not found"}), 404

    battle = BATTLES[battle_id]

    if battle.resolving:
        return jsonify({"error":"Turn in progress"}), 409
    
    # If battle already ended, just return state
    if battle.get_result() != "ongoing":
        payload = battle.serialize()
        payload["battle_id"] = battle_id
        payload["turn_log"] = []
        return jsonify(payload), 200
    
    battle.resolving = True
    try:
        before_len = len(battle.log)
        enemy_move = random.choice(battle.enemy.moves)
        battle.take_turn(player_move, enemy_move)

        turn_log = battle.log[before_len:]

        deduped = []
        for line in turn_log:
            if not deduped or deduped[-1] != line:
                deduped.append(line)
        turn_log = deduped

        payload = battle.serialize()
        payload["battle_id"] = battle_id
        payload["turn_log"] = turn_log

        if payload["status"] != "ongoing":
            BATTLES.pop(battle_id, None)

        return jsonify(payload), 200
    finally:
        if battle_id in BATTLES:
            BATTLES[battle_id].resolving = False

@app.route("/api/health", methods=["GET"])
def health():
    return {"status": "ok"}, 200


#========================================
# Entry Point
#========================================

if __name__ == "__main__":
    app.run(debug=True)