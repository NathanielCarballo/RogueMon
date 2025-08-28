from flask import Flask
from starters import starters_bp
from battle_engine import battle_bp

app = Flask(__name__)
app.register_blueprint(starters_bp, url_prefix="/api")
app.register_blueprint(battle_bp, url_prefix="/api")

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)