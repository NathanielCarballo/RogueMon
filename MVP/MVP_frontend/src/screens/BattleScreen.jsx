import React, { useMemo, useState } from 'react';

/**
    * Minimal MVP Battle Screen
    * - Hardcoded matchup: charmander vs squirtle
    * - Calls Flask POST /appi/battle
    * - Renders HP, sprites, log, and outcome
 */

const INITIAL_HP = {
    charmander: 39,
    squirtle: 44,
    bulbasaur: 45,
    pikachu: 35,
};

const SPRITES = (name) => `/assets/sprites/${name}.png`;

export default function BatlleScreen() {
    const [playerKey] = useState("charmander");
    const [opponentKey] = useState("squirtle");

    const [playerHP, setPlayerHP] = useState(INITIAL_HP[playerKey]);
    const [enemyHP, setEnemyHP] = useState(INITIAL_HP[enemyKey]);
    const [status, setStatus] = useState("ongoing");
    const [log, setLog] = useState([]);
    const [submitting, setSubmitting] = useState(false);

    const playerSprite = useMemeo(() => SPRITES(playerKey), [playerKey]);
    const enemySprite = useMemo(() => SPRITES(enemyKey), [enemyKey]);

    const handleMove = async (move) => {
        if (submitting || status !== "ongoing") return;
        setSubmitting(true);

        try {
            const res = await fetch(`/api/battle`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    player: playerKey,
                    enemy: enemyKey,
                    move,
                }),
            });
            
            if (!res.ok) throw new Error (`HTTP ${res.status}`);
            const data = await res.json();

            setPlayerHP(data.player.current_hp);
            setEnemyHP(data.enemy.current_hp);
            setStatus(data.status);
            setLog(data.message_log);
        } catch (error) {
            console.error("Battle error:", err);
            setLog((prev) => [...prev, "Something went wrong contacting the server."]);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="screen-container">
            <h1>Battle!</h1>

            <div className="pokemon-block">
                <div className="pokemon-name">
                    {enemyKey} - {enemyHP} HP
                </div>
                <img className="pokemon-sprite" src={enemySprite} alt={`${enemyKey} sprite`} />
            </div>

            <div className="pokemon-block">
                <div className="pokemon-name">
                    {playerKey} - {playerHP} HP
                </div>
                <img className="pokemon-sprite" src={playerSprite} alt={`${playerKey} sprite`} />
            </div>

            {status === "ongoing" ? (
                <div className="move-buttone">
                    <button disabled={submitting} onClick={() => handleMove("tackle")}>
                        {submitting ? "Resolving..." : "Tackle"}
                    </button>
                    <button disabled={submitting} onClick={() => handleMove("growl")}>
                        {submitting ? "Resolving..." : "Growl"}
                    </button>
                </div>
            ) : (
                <h2 className="battle-result">You {status.toUpperCase()}</h2>
            )}

            <div className="battle-log">
                <h3>Battle Log</h3>
                <ul>
                    {log.map((line, i) => (
                        <li key={i}>{line}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
}