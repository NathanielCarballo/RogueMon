/**
 * BattleScreen.jsx - MVP battle UI
 * 
 * Intent:
 * - Renders a single battle between two starters.
 * - Frontend never computes outcomes - it calls Flask (`battle_engine.py`) and renders.
 * - Only the newest message animates; older ones are stored in a static history.
 * 
 * Contracts:
 * - POST /api/battle/start -> { battle_id, player, enemy, status, message_log[] }
 * - POST /api/battle/turn  -> { battle_id, player, enemy, status, message_log[], turn_log[] }
 * 
 * Notes:
 * - Keep UX simple and deterministic for MVP (lock input while message animate).
 * - Exit criteria (mvp-exit): wire real StarterSelect, extract MessageBox, add status/HP UI polish.
 */
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';

/**
 * Minimal MVP Battle Screen (structure overview)
 * - Hardocded matchup: charmander vs squirtle (rpelace via StarterSelect later).
 * - Calls Flask endpoints for battle start/turn; server is the source of truth.
 * - Renders HP, sprites, animated current message, non-animated history, and outcome.
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
 * MessageBox - simple typewriter for a queue of lines.
 * Behavior:
 * - When the queue head changes, start typing that line character-by-character.
 * - Clicking (or pressing Space/Enter):
 *   - If typing: instantly completes the current line.
 *   - If idle and there are queued lines: signals completion of the head line.
 * Guardrails:
 * - Respects `inputLocked` so the user can't fast-forward while a network call is pending.
 * - The parent owns the queue and removes items via `onFinishOne`.
 */
function MessageBox({ queue, onFinishOne, inputLocked, promptText }) {
    const [displayed, setDisplayed] = useState("");
    const [full, setFull] = useState("");
    const [typing, setTyping] = useState(false);

    // Start typing when the head of the queue changes
    useEffect(() => {
        const next = queue[0] ?? "";
        if(!next) {
            // No message: clear local buffers and stop typing.
            setDisplayed("");
            setFull("")
            setTyping(false);
            return;
        }
        
        setDisplayed("");
        setFull(next);
        setTyping(true);

        // Typewriter effect - reveals one character every 18ms.
        let i = 0;
        let timer;
        const step = () => {
            i++;
            setDisplayed(next.slice(0,i));
            if ( i < next.length) {
                timer = setTimeout(step, 18);   // speed (ms per char)
            } else {
                setTyping(false);               // finished this line
            }
        };
        timer = setTimeout(step, 18);
        return () => clearTimeout(timer);
    }, [queue]);

    const advance = useCallback(() => {
        if (inputLocked) return;  // don't advance while network is resolving
        if (typing) {
            // Complete the current line instantly.
            setDisplayed(full);
            setTyping(false);
        } else if (queue.length) {
            // Notify parent that the head line finished; parent will dequeue.
            onFinishOne(queue[0]);
        }
    }, [typing, full, queue, onFinishOne, inputLocked]);

    // Keyboard afforance: Space / Enter mirrors click behavior.
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
                {/* If there are messages, show the animated line; otherwise show the prompt (or a blank space to preserve layout) */}
                {queue.length > 0 ? (displayed || " ") : (promptText || " ")}
            </div>
            {/* Chevron hint - always rendered for layout stability; hidden while typing or when no messages */}
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

    const [busy, setBusy] = useState(false);        // network busy flag (locks input)
    const [queue, setQueue] = useState([]);         // pending messages to animate

    const [history, setHistory] = useState([]);     // array of {turn, message[] }
    const pendingTurnMessages = useRef([]);         // collects lines for the current turn
    const currentTurnRef = useRef(0);               // stamped turn index for history grouping

    const playerSprite = useMemo(() => SPRITES(playerKey), [playerKey]);
    const enemySprite = useMemo(() => SPRITES(enemyKey), [enemyKey]);

    // on mount: create a persistent battle on the server and intialize local state.
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

                // Commit any intial server messages to history; keep the animation queue empty.
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

    /**
     * finsihOneMessage - called by MessageBox when the current line completes.
     * Responsibility:
     * - Dequeue the head line.
     * - Accumulate completed lines for the current turn in `pendingTurnMessages`.
     * - When the queue becomes empty, commit the collected lines to the history
     *   under the currently stamepd turn number (de-duplicated).
     */
    const finishOneMessage = useCallback((msg) => {
        setQueue((qPrev) => {
            const nextQ = qPrev.slice(1);
            const willBeEmpty = nextQ.length === 0;

            // Accumulate this line for the active turn
            pendingTurnMessages.current = [...pendingTurnMessages.current, msg];

            if (willBeEmpty) {
                // If nothing collected, don't append an empty history block.
                if (pendingTurnMessages.current.length === 0) return nextQ;

                const turn = currentTurnRef.current; // <--- commit to the stamped turn
                setHistory((hPrev) => {
                    // If the last history entry is the same turn, merge into it; else append a new entry.
                    if (hPrev.length && hPrev[hPrev.length - 1].turn === turn) {
                        const last = hPrev[hPrev.length - 1];
                        const merged = {
                            ...last,
                            messages:[...last.messages, ...pendingTurnMessages.current]
                            .filter((line, i, arr) => arr.indexOf(line) === i), // de-dup
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

    /**
     * 
     * handleMove - send the selected move to the backend for resolution.
     * Guardrails:
     * - Lock input while busy.
     * - Do not allow new input while there are messages still animating (classic Pokemon UX).
     * - Use only the delta `turn_log` returned from the server to populate the queue.
     */

    const handleMove = async (move) => {
        // Lock input if messages remain or the battle isn't ongoing.
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

            // Stamp the turn we're building; history shows one block per turn.
            const lastTurn = history.length ? history[history.length-1].turn : 0;
            currentTurnRef.current = lastTurn === 0 ? 1 : lastTurn + 1;
            pendingTurnMessages.current = []

            // Nomralize incoming to an array and de-duplicate; append to queue.
            let incoming = data.turn_log;
            if (typeof incoming === "string") incoming = [incoming];
            if (!Array.isArray(incoming)) incoming = [];
            incoming = incoming.filter((line, index, arr) => arr.indexOf(line) === index);
            setQueue((q) => {
                // Edge: avoid duplicating the first line if it equals our last queued line.
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

            {/* Enemy HUD */}
            <div className="pokemon-block">
                <div className="pokemon-name">
                    {enemyName} - {enemyHP} HP
                </div>
                <img className="pokemon-sprite" src={enemySprite} alt={`${enemyKey} sprite`} />
            </div>

            {/* Player HUD */}
            <div className="pokemon-block">
                <div className="pokemon-name">
                    {playerName} - {playerHP} HP
                </div>
                <img className="pokemon-sprite" src={playerSprite} alt={`${playerKey} sprite`} />
            </div>

            {/* Move Buttons - disabled while busy or while messages are animating */}
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

            {/* History: one block per completed turn with an ordered list of lines */}
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