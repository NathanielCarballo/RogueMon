import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';

/**
    * Minimal MVP Battle Screen
    * - Hardcoded matchup: charmander vs squirtle
    * - Calls Flask POST /api/battle
    * - Renders HP, sprites, log, and outcome
 */

const INITIAL_HP = { 
    charmander: 39,
    squirtle: 44,
    bulbasaur: 45,
    pikachu: 35,
};

const SPRITES = (name) => `/assets/sprites/${name}.png`;
const Capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** 
 * Simplified typing effect for an array of lines.
 * Reveals characters one-by-one for the current line; when a line finishes,
 * it moves that line into history and continues with the next.
 */
function MessageBox({ queue, onFinishOne, inputLocked, promptText }) {
    const [displayed, setDisplayed] = useState("");
    const [full, setFull] = useState("");
    const [typing, setTyping] = useState(false);

    // Start typing when the head of the queue changes
    useEffect(() => {
        const next = queue[0] ?? "";
        if(!next) {
            setDisplayed("");
            setFull("")
            setTyping(false);
            return;
        }
        
        setDisplayed("");
        setFull(next);
        setTyping(true);

        let i = 0;
        let timer;
        const step = () => {
            i++;
            setDisplayed(next.slice(0,i));
            if ( i < next.length) {
                timer = setTimeout(step, 18);   // type speed (ms per char)
            } else {
                setTyping(false);
            }
        };
        timer = setTimeout(step, 18);
        return () => clearTimeout(timer);
    }, [queue]);

    const advance = useCallback(() => {
        if (inputLocked) return;
        if (typing) {
            // Finish instantly
            setDisplayed(full);
            setTyping(false);
        } else if (queue.length) {
            onFinishOne(queue[0]);   // remove the head, start next message
        }
    }, [typing, full, queue, onFinishOne, inputLocked]);

    // Keyboard: Space / Enter advances
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === " " || e.key === "Enter") advance();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [advance]);

    return (
        <div
            className={`msg-box ${inputLocked ? "msg-box--disabled" : ""}`}
            onClick={advance}
            role="button"
            aria-label="Advance message"
            tabIndex={0}
        >
            <div className="msg-text">
                {queue.length > 0 ? (displayed || " ") : (promptText || " ")}
            </div>
            {/* Always render the arrow; hide it when not needed */}
            <div className={`msg-next ${(!typing && queue.length > 0) ? "" : "msg-next--hidden"}`}>
                ▶
            </div>
        </div>
    );
}

export default function BattleScreen() {
    // Hardcoded for MVP testing; later pull from starter selection
    const [playerKey] = useState("charmander");
    const [enemyKey] = useState("squirtle");

    const [playerName, setPlayerName] = useState(Capitalize(playerKey));
    const [enemyName, setEnemyName] = useState(Capitalize(enemyKey));
    
    const [battleId, setBattleId] = useState(null);
    const [playerHP, setPlayerHP] = useState(INITIAL_HP[playerKey]);
    const [enemyHP, setEnemyHP] = useState(INITIAL_HP[enemyKey]);
    const [status, setStatus] = useState("ongoing");

    const [busy, setBusy] = useState(false);        // network busy
    const [queue, setQueue] = useState([]);         // pending messages to animate

    const [history, setHistory] = useState([]);     // array of {turn, message[] }
    const pendingTurnMessages = useRef([]);
    const currentTurnRef = useRef(0);

    const playerSprite = useMemo(() => SPRITES(playerKey), [playerKey]);
    const enemySprite = useMemo(() => SPRITES(enemyKey), [enemyKey]);

    // Start a persistent battle on mount
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setBusy(true);
            try {
                const res = await fetch(`/api/battle/start`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json"},
                    body: JSON.stringify({ player: playerKey, enemy: enemyKey }),
                });
                if (!res.ok) throw new Error (`HTTP ${res.status}`);
                const data = await res.json();
                if (cancelled) return;

                setBattleId(data.battle_id);
                setPlayerHP(data.player.current_hp);
                setEnemyHP(data.enemy.current_hp);
                setStatus(data.status);

                setPlayerName(data?.player?.name ?? Capitalize(playerKey));
                setEnemyName(data?.enemy?.name ?? Capitalize(enemyKey));

                // On start: commit any initial messages to history, keep queue empty
                const initial = Array.isArray(data.message_log) ? data.message_log : [];
                if (initial.length > 0) {
                    setHistory([{turn: 0, messages: initial }]);
                } 
                else {
                    setHistory([]);
                }
                setQueue([]);
                pendingTurnMessages.current = [];
                currentTurnRef.current = 0;
            }   catch (error) {
                console.error("Start battle error:", error);
                setHistory([]);
                setQueue(["Failed to start battle."]);
            }   finally {
                if (!cancelled) setBusy(false);
            }
        })();
        return () => { 
            cancelled = true; 
        };
    }, [playerKey, enemyKey]);

    // Remove the head of the queue
    const finishOneMessage = useCallback((msg) => {
        setQueue((qPrev) => {
            const nextQ = qPrev.slice(1);
            const willBeEmpty = nextQ.length === 0;

            // Accumulate this lice for the active turn
            pendingTurnMessages.current = [...pendingTurnMessages.current, msg];

            if (willBeEmpty) {
                // No lines collect? Don't create an empty header
                if (pendingTurnMessages.current.length === 0) return nextQ;

                const turn = currentTurnRef.current; // <--- commit to the stamped turn
                setHistory((hPrev) => {
                    if (hPrev.length && hPrev[hPrev.length - 1].turn === turn) {
                        const last = hPrev[hPrev.length - 1];
                        const merged = {
                            ...last,
                            messages:[...last.messages, ...pendingTurnMessages.current]
                            .filter((line, i, arr) => arr.indexOf(line) === i),
                        };
                        pendingTurnMessages.current = [];
                        return [...hPrev.slice(0, -1), merged];
                    }
                    const appended = [
                        ...hPrev,
                        {
                            turn,
                            messages: pendingTurnMessages.current.filter((line, i, arr) => arr.indexOf(line) === i), 
                        },
                    ];
                    pendingTurnMessages.current = [];
                    return appended;
                });
            }
            return nextQ;
        });
    }, []);

    // Send a turn for this battle_id
    const handleMove = async (move) => {
        // lock input if still messages to finish (Pokemon behavior)
        if (busy || status !== "ongoing" || !battleId || queue.length > 0) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/battle/turn`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ battle_id: battleId, move }),
            });
            if (!res.ok) throw new Error (`HTTP ${res.status}`);
            const data = await res.json();

            setPlayerHP(data.player.current_hp);
            setEnemyHP(data.enemy.current_hp);
            setStatus(data.status);

            // Start a fresh collector and stamp the turn we are building now
            const lastTurn = history.length ? history[history.length-1].turn : 0;
            currentTurnRef.current = lastTurn === 0 ? 1 : lastTurn + 1;
            pendingTurnMessages.current = []

            // Use ONLY the delta for this turn; normalize to array defensively
            let incoming = data.turn_log;
            if (typeof incoming === "string") incoming = [incoming];
            if (!Array.isArray(incoming)) incoming = [];
            incoming = incoming.filter((line, index, arr) => arr.indexOf(line) === index);
            setQueue((q) => {
                const safe = (q.length && incoming.length && q[q.length-1] === incoming[0])
                ? incoming.slice(1)
                : incoming;
            return [...q, ...safe];
            });
        } catch (err) {
            console.err("Battle turn error:", err);
            setQueue((q) => [...q, "Something went wrong contacting the server."]);
        } finally {
            setBusy(false);
        }
    };

    const canAct = !busy && status === "ongoing" && queue.length === 0;

    return (
        <div className="screen-container">
            <h1>Battle!</h1>

            <div className="pokemon-block">
                <div className="pokemon-name">
                    {enemyName} - {enemyHP} HP
                </div>
                <img className="pokemon-sprite" src={enemySprite} alt={`${enemyKey} sprite`} />
            </div>

            <div className="pokemon-block">
                <div className="pokemon-name">
                    {playerName} - {playerHP} HP
                </div>
                <img className="pokemon-sprite" src={playerSprite} alt={`${playerKey} sprite`} />
            </div>

            {status === "ongoing" ? (
                <>
                    <div className="move-buttons">
                        <button disabled={!canAct} onClick={() => handleMove("tackle")}>
                            {busy ? "Resolving..." : "Tackle"}
                        </button>
                        <button disabled={!canAct} onClick={() => handleMove("growl")}>
                            {busy ? "Resolving..." : "Growl"}
                        </button>
                    </div>
                 </>
            ) : (
                <h2 className="battle-result">You {status.toUpperCase()}</h2>
            )}
            {/* Current animated message */}
            <MessageBox 
                queue={queue} 
                onFinishOne={finishOneMessage} 
                inputLocked={busy} 
                promptText={canAct ? `What will ${playerName} do?` : ""}
            />

            {/* History Box (non-animated) */}
            <div className="msg-history">
                {history.map((turnObj, i) => (
                    <div key={`${turnObj.turn}-${i}`} className="msg-history-turn">
                        <div className="msg-history-turn-label">Turn {turnObj.turn}</div>
                        {turnObj.messages?.map((line, index) => (
                            <div key={index} className="msg-history-line">{line}</div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}