from flask import Flask, request, jsonify
import random

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
                self.attack_modifier *= 0.75

        def is_fainted(self):
            return self.current_hp <= 0
        
class Battle:
    def __init__(self, player_data, enemy_data):
        self.player = Pokemon(player_data)
        self.enemy = Pokemon(enemy_data)
        self.log = []

    def calculate_damage(self, attacker, defender, move):
        if move["power"] == 0:
            return 0
        attack_stat = attacker.attack * attacker.attack_modifier
        defense_stat = defender.defense
        base_damage = (((2 * attacker.level / 5 * 2) * move["power"] * (attack_stat / defense_stat)) / 50) + 2
        return int(base_damage)
    
    def take_turn(self, player_move_name, enemy_move_name):
        player_move = MOVE_DATA[player_move_name]
        enemy_move = MOVE_DATA[enemy_move_name]

        first, second = (self.player, self.enemy) if self.player.speed >= self.enemy.speed else (self.enemy, self.player)
        first_move = player_move if first == self.player else enemy_move
        second_move = enemy_move if first == self.player else player_move

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
                "current_hp": self.player.current_hp,
            },
            "enemy": {
                "name": self.enemy.name,
                "current_hp": self.enemy.current_hp,
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

@app.route("/api/battle", methods=["POST"])
def resolve_battle_turn():
    data = request.get_json()
    player_name = data["player"]
    enemy_name = data["enemy"]
    player_move = data["move"]

    enemy_move = random.choice(STARTER_POKEMON[enemy_name]["moves"])
    battle = Battle(STARTER_POKEMON[player_name]["moves"], STARTER_POKEMON[enemy_move])
    battle.take_turn(player_move, enemy_move)

    return jsonify(battle.serialize())

#========================================
# Entry Point
#========================================

if __name__ == "__main__":
    app.run(debug=True)