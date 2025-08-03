# We'll define 3 main classes: Move, Pokemon, and Battle.
# This version is written for terminal-based simulation-no UI, just logic.

from dataclasses import dataclass
import random

# Step 1: Define the Move class
# Each move has a name, type, power, and accuracy, and category (Physical or Status)
@dataclass
class Move:
    name: str
    type: str
    power: int
    accuracy: int # 100 = always hits,  85 = 85% chance
    category: str #'Physical" or 'Status'

# Step 2: Define the Pokemon class
# Contains basic stats and a list of moves
@dataclass
class Pokemon:
    name: str
    type: str
    level: int
    max_hp: int
    current_hp: int
    attack: int
    defense: int
    moves: list

    def is_fainted(self):
        return self.current_hp <= 0
        
    def take_damage(self,damage):
        self.current_hp -= damage
        self.current_hp = max(self.current_hp, 0) # Ensure HP doesn't go below 0

# Step 3: Define the Battle class
# Orchestrates the battle turn by turn
class Battle:
    def __init__(self, player_pokemon:Pokemon, enemy_pokemon:Pokemon):
        self.player = player_pokemon
        self.enemy = enemy_pokemon
        self.turn = 1

    def calculate_damage(self, attacker: Pokemon, defender: Pokemon, move: Move):
        if move.category == "Status":
            return 0 # We're not implementing status effects in MVP
        
        # Basic Pokemon-style damage formula (simplified)
        level_factor = (2 * attacker.level) / 5 + 2
        base_damage = ((level_factor * move.power *(attacker.attack / defender.defense)) / 50) + 2

        # Type effectiveness not implemented yet
        # Random factor
        damage = base_damage * random.uniform(0.85, 1.0)
        return int(damage)
    
    def take_turn(self, player_move: Move):
        print(f"\n-- Turn {self.turn} --")

        # 1. Player's turn
        if random.randint(1,100) <= player_move.accuracy:
            damage = self.calculate_damage(self.player, self.enemy, player_move)
            self.enemy.take_damage(damage)
            print(f"{self.player.name} used {player_move.name} and dealt {damage} damage!")
        else:
            print(f"{self.player.name}'s {player_move.name} missed!")
        
        if self.enemy.is_fainted():
            print(f"{self.enemy.name} fainted! You win.")
            return "player"
        
        # 2. Enemy's turn (AI)
        enemy_move = random.choice(self.enemy.moves)
        if random.randint(1,100) <= enemy_move.accuracy:
            damage = self.calculate_damage(self.enemy, self.player, enemy_move)
            self.player.take_damage(damage)
            print(f"{self.enemy.name} used {enemy_move.name} and dealt {damage} damage!")
        else:
            print(f"{self.enemy.name}'s {enemy_move.name} missed!")

        if self.player.is_fainted():
            print(f"{self.player.name} fainted! You lose.")
            return "enemy"
        
        self.turn += 1
        return "continue"
    
# Now we simulate a test battle between Squirtle and Charmander

# Define Moves
tackle = Move(name="Tackle", type="Normal", power=40, accuracy=100, category="Physical")
growl = Move(name="Growl", type="Normal", power=0, accuracy=100, category="Status")

# Define Pokemon
squirtle = Pokemon(
    name="Squirtle",
    type="Water",
    level=5,
    max_hp=44,
    current_hp=44,
    attack=48,
    defense=65,
    moves=[tackle, growl]
)

charmander = Pokemon(
    name="Charmander",
    type="Fire",
    level=5,
    max_hp=39,
    current_hp=39,
    attack=52,
    defense=43,
    moves=[tackle, growl]
)

# Start the battle
battle = Battle(player_pokemon = squirtle, enemy_pokemon = charmander)

# Simulate turn loop
while True:
    print(f"\n{battle.player.name} HP: {battle.player.current_hp}/{battle.player.max_hp}")
    print(f"{battle.enemy.name} HP: {battle.enemy.current_hp}/{battle.enemy.max_hp}")

    print(f"\nChoose a move:")
    for i, move in enumerate(battle.player.moves):
        print(f"{i+1}. {move.name}")
    choice = input("Enter move number: ")
    try:
        move_index = int(choice) - 1
        if move_index < 0 or move_index >= len(battle.player.moves):
            print("Invalid choice.")
            continue
        result = battle.take_turn(battle.player.moves[move_index])
        if result != "continue":
            break
    except ValueError:
        print("Please enter a number.")
        continue