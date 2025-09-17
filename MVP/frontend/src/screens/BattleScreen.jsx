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
 *      (server picks the enemy; response should include pokedex_id for both)
 * - POST /api/battle/turn  -> { battle_id, player, enemy, status, message_log[], turn_log[] }
 * 
 * Assets:
 * - Local GIFs named by Pokedex ID:
 *   /assets/sprites/front/<id>.gif  (enemy)
 *   /assets/sprites/back/<id>.gif   (player)
 * 
 * Notes:
 * - We read `playerKey` from sessionStorage (set by StarterSelect).
 * - The server returns names + pokedex_id; we build sprite paths from that.
 * - UX: Lock input while messages animate or a request is in flight (classic Pokemon behavior).
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';

// Sprite path helpers (local GIF assets)
const FRONT_BASE = "/assets/sprites/front";
const BACK_BASE = "/assets/sprites/back";
const spriteFront = (pid) => `${FRONT_BASE}/${pid}.gif`;
const spriteBack = (pid) => `${BACK_BASE}/${pid}.gif`;

// Fallback name casting
const Capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Minimal mapping for Gen 1 in case server omits pokedex_id (belt & suspenders)
const POKEDEX = { bulbasaur: 1, charmander: 4, squirtle: 7 };

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
    // Pull the chosen starter from StarterSelect (fallback for safety)
    const savedPlayer = sessionStorage.getItem("playerKey") || "charmander";
    const [playerKey] = useState(savedPlayer);

    const [playerName, setPlayerName] = useState(Capitalize(savedPlayer));
    const [enemyName, setEnemyName] = useState("Enemy");
    
    const [battleId, setBattleId] = useState(null);
    const [playerHP, setPlayerHP] = useState(0);
    const [enemyHP, setEnemyHP] = useState(0);
    const [status, setStatus] = useState("ongoing");

    const [busy, setBusy] = useState(false);        // network busy flag (locks input)
    const [queue, setQueue] = useState([]);         // pending messages to animate

    const [history, setHistory] = useState([]);     // array of {turn, message[] }
    const pendingTurnMessages = useRef([]);         // collects lines for the current turn
    const currentTurnRef = useRef(0);               // stamped turn index for history grouping

    // Pokedex IDs returned by the server; used to build local GIF paths
    const [playerPid, setPlayerPid] = useState(null);
    const [enemyPid, setEnemyPid] = useState(null);

    const [showCapturePrompt, setShowCapturePrompt] = useState(false);
    const [captureMsg, setCaptureMsg] = useState("");

    const postTurnQueueRef = useRef([]);
    const suppressHistoryCommitRef = useRef(false);

    // on mount: create a persistent battle on the server and intialize local state.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setBusy(true);
            try {
                const res = await fetch(`/api/battle/start`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json"},
                    body: JSON.stringify({ player: playerKey}),
                });
                if (!res.ok) throw new Error (`HTTP ${res.status}`);
                const data = await res.json();
                if (cancelled) return;

                setBattleId(data.battle_id);
                setPlayerHP(data.player?.current_hp ?? 0);
                setEnemyHP(data.enemy?.current_hp ?? 0);
                setStatus(data.status);

                if (data.status === "win" || data.status === "lose") {
                    const faintedMsg = data.status === "win" ? `${enemyName} fainted!` : `${playerName} fainted!`;
                    const promptMsg = data.status === "win" ? `Do you want to try to catch ${enemyName}?` : null;
                    postTurnQueueRef.current = promptMsg ? [faintedMsg, promptMsg] : [faintedMsg];
                    suppressHistoryCommitRef.current = true;
                    if (data.status === "win") {
                        setShowCapturePrompt(true);
                    } else {
                        setShowCapturePrompt(false);
                    }
                }

                setPlayerName(data?.player?.name ?? Capitalize(playerKey));
                setEnemyName(data?.enemy?.name ?? "Enemy");

                // Pokedex ids - fallback to local map if omitted (Gen 1 only)
                const maybePlayerPid = data?.player?.pokedex_id ?? POKEDEX[playerKey] ?? null;
                const maybeEnemyPid = data?.enemy?.pokedex_id ?? (data?.enemy?.key && POKEDEX[data.enemy.key]) ?? null;
                setPlayerPid(maybePlayerPid);
                setEnemyPid(maybeEnemyPid);

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
    }, [playerKey]);

    /**
     * finishOneMessage - called by MessageBox when the current line completes.
     * Responsibility:
     * - Dequeue the head line.
     * - Accumulate completed lines for the current turn in `pendingTurnMessages`.
     * - When the queue becomes empty, commit the collected lines to the history
     *   under the currently stamped turn number (de-duplicated).
     */
    const finishOneMessage = useCallback((msg) => {
        setQueue((qPrev) => {
            const nextQ = qPrev.slice(1);
            const willBeEmpty = nextQ.length === 0;

            // Always track the line that just finished
            pendingTurnMessages.current = [...pendingTurnMessages.current, msg];

            if (willBeEmpty) {
                // If *not* suppressing, commit accumulated lines into history
                if (!suppressHistoryCommitRef.current && pendingTurnMessages.current.length) {
                    const turn = currentTurnRef.current;
                    setHistory((hPrev) => {
                        if (hPrev.length && hPrev[hPrev.length - 1].turn === turn) {
                            const last = hPrev[hPrev.length - 1];
                            const merged = {
                                ...last, messages: [...last.messages, ...pendingTurnMessages.current].filter(
                                    (line, i, arr) => arr.indexOf(line) === i
                                ),
                            };
                            pendingTurnMessages.current = [];
                            return [...hPrev.slice(0, -1), merged];
                        }
                        const appended = [
                            ...hPrev,
                            {
                                turn, messages: pendingTurnMessages.current.filter(
                                    (line, i, arr) => arr.indexOf(line) === i
                                ),
                            },
                        ];
                        pendingTurnMessages.current = [];
                        return appended;
                    });
                } else {
                    // Suppressed: drop what was collected (don't write to history)
                    pendingTurnMessages.current = [];
                }

                // If there are post-turn messages pending, enqueue them now and keep history suppressed
                if (postTurnQueueRef.current.length) {
                    const inject = postTurnQueueRef.current.slice();
                    postTurnQueueRef.current = [];
                    
                    // Keep suppression active for these injected messages
                    suppressHistoryCommitRef.current = true;
                    return inject;
                } else {
                    // No post-turn messages left; allow future commits again
                    suppressHistoryCommitRef.current = false;
                }
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

            if (data.status === "win" || data.status === "lose") {
                // Stage post-turn lines to show *after* the turn messages finish animating.
                const faintedMsg = data.status === "win" ? `${enemyName} fainted!` : `${playerName} fainted!`;
                
                // Only ask about capture on win
                const promptMsg = data.status === "win" ? `Do you want to try to catch ${enemyName}?` : null;
                postTurnQueueRef.current = promptMsg ? [faintedMsg, promptMsg] : [faintedMsg];

                // These messages should *not* enter the history:
                suppressHistoryCommitRef.current = true;

                // Render capture buttons once the message box queue empties
                if (data.status === "win") {
                    setShowCapturePrompt(true);
                } else {
                    setShowCapturePrompt(false);
                }
            }

            // Stamp the turn we're building; history shows one block per turn.
            const lastTurn = history.length ? history[history.length-1].turn : 0;
            currentTurnRef.current = lastTurn === 0 ? 1 : lastTurn + 1;
            pendingTurnMessages.current = []

            // Normalize incoming to an array and de-duplicate; append to queue.
            let incoming = data.turn_log;
            if (typeof incoming === "string") incoming = [incoming];
            if (!Array.isArray(incoming)) incoming = [];
            incoming = incoming.filter((line, index, arr) => arr.indexOf(line) === index);
            setQueue((q) => {
                // Edge: avoid duplicating the first line if it equals our last queued line.
                const safe = (q.length && incoming.length && q[q.length-1] === incoming[0]) ? incoming.slice(1) : incoming;
            return [...q, ...safe];
            });
        } catch (error) {
            console.error("Battle turn error:", error);
            setQueue((q) => [...q, "Something went wrong contacting the server."]);
        } finally {
            setBusy(false);
        }
    };

    const handleCapture = async () => {
        if (!battleId) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/battle/capture`, {
                method: "POST",
                headers: { "Content-Type": "application/json"},
                body: JSON.stringify({ battle_id: battleId }),
            });
            const data = await res.json();

            // Pipe result to the MessageBox and keep it out of history
            const line = data.message || (data.success ? "Captured!" : "It broke free!");
            setQueue((q) => [...q, line]);
            suppressHistoryCommitRef.current = true;
            
            // MVP: stash captured into local party
            if (data.success && data.captured) {
                const party = JSON.parse(sessionStorage.getItem("party") || "[]");
                party.push(data.captured);
                sessionStorage.setItem("party", JSON.stringify(party));
            }

            // Hide buttons; Next Battle appears after queue drains
            setShowCapturePrompt(false);
        } catch (e) {
            console.error("Capture error:", e);
            setQueue((q) => [...q, "Something went wrong during capture."]);
            suppressHistoryCommitRef.current = true;
        } finally {
            setBusy(false);
        }
    };

    const handleSkipCapture = () => {
        // Route skip text through MessageBox and keep it out of history
        setQueue((q) => [...q, "You decided not to catch the Pokemon."]);
        suppressHistoryCommitRef.current = true;
        setShowCapturePrompt(false);
    };

    const startNextBattle = async () => {
        // Rest local state & request a fresh battle with the same player
        setHistory([]);
        setQueue([]);
        pendingTurnMessages.current = [];
        currentTurnRef.current = 0;
        setShowCapturePrompt(false);
        setCaptureMsg("");
        setStatus("ongoing");
        setEnemyPid(null);
        setBusy(true);
        try {
            const res = await fetch(`/api/battle/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ player: playerKey }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            setBattleId(data.battle_id);
            setPlayerHP(data.player?.current_hp ?? 0);
            setEnemyHP(data.enemy?.current_hp ?? 0);
            setStatus(data.status);
            setPlayerName(data?.player?.name ?? Capitalize(playerKey));
            setEnemyName(data?.enemy?.name ?? "Enemy");
            setPlayerPid(data?.player?.pokedex_id ?? POKEDEX[playerKey] ?? null);
            setEnemyPid(
                data?.enemy?.pokedex_id ?? (data?.enemy?.key && POKEDEX[data.enemy.key]) ?? null
            );
            const initial = Array.isArray(data.message_log) ? data.message_log : [];
            setHistory(initial.length ? [{ turn: 0, messages: initial }] : []);
            setQueue([]);
        } catch (e) {
            console.error("Start next battle error:", e);
            setQueueu(["Failed to start the next battle."]);
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
                <img className="pokemon-sprite" 
                     src={enemyPid ? spriteFront(enemyPid) : "/assets/sprites/placeholder.gif"}
                     alt={`${enemyName} sprite`}
                />
            </div>

            {/* Player HUD */}
            <div className="pokemon-block">
                <div className="pokemon-name">
                    {playerName} - {playerHP} HP
                </div>
                <img className="pokemon-sprite"
                      src={playerPid ? spriteBack(playerPid) : "/assets/sprites/placeholder.gif"}
                      alt={`${playerName} sprite`} 
                />
            </div>

            {/* Move Buttons - disabled while busy or while messages are animating */}
            {status === "ongoing" ? (
                <>
                    <div className="move-buttons">
                        <button disabled={!canAct} onClick={() => handleMove("tackle")}>{busy ? "Resolving..." : "Tackle"}</button>
                        <button disabled={!canAct} onClick={() => handleMove("growl")}>{busy ? "Resolving..." : "Growl"}</button>
                    </div>
                </>
            ) : (
                <>
                    <h2 className="battle-result">You {status.toUpperCase()}</h2>
                
                    {status == "win" ? (
                        <>
                            {/* Show capture buttons only *after* messages have finished animating */}
                            {showCapturePrompt && queue.length === 0 && (
                                <div className="capture-actions">
                                    <button className="btn" disabled={busy} onClick={handleCapture}>Throw Pokeball</button>
                                    <button className="btn-secondary" disabled={busy} onclick={handleSkipCapture}>Skip</button>
                                </div>
                            )}
                            {!showCapturePrompt && queue.length === 0 && (
                                <div className="post-battle-actions">
                                    <button className="btn" onClick={startNextBattle}>Next Battle</button>
                                </div>
                            )}
                        </>
                ) : (
                    <div className="post-battle-actions">
                        <button className="btn" onClick={() => (window.location.href = "/starter-select")}>Play Again</button>
                    </div>
                )}
             </>
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