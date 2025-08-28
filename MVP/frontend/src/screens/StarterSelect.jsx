/**
 * StarterSelect.jsx (MVP)
 * 
 * Intent:
 * - Displays the starter selection screen (Gen 1 only for MVP).
 * - Fetches starters from Fask endpoint (/api/starters).
 * - Shows front-facing GIF sprites + names in a grid.
 * - On selection: stored `playerKey` in sessionStorage and navigates to /battle.
 * 
 * Notes:
 * - Enemy Pokemon is chosen later during `/api/battle/start` (not here).
 * - Only front sprites are used in selection - back sprites are applied in battle.
 * 
 * TODO / Future: 
 * - Add more metadata to the payload(types, moves preview).
 * - Extend to all gens once assets are in place.
 * - Add transition animation between selection and battle. */

import React, { useEffect, useState, useCallback } from "react"

export default function StarterSelect() {
    // --- Local state for starters, loading, error ---
    const [starters, setStarters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // --- Fetch starters from backend ---
    const loadStarters = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/starters");
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            // API returns { starters: [...] }
            const data = await res.json();
            const list = Array.isArray(data.starters) ? data.starters : (Array.isArray(data) ? data : []);
            setStarters(list);
        } catch(error) {
            console.error("Failed to load starters: ", error);
            setError("Failed to load starters. Check the server and try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStarters();
    }, [loadStarters]);

    // --- Handler when player picks a starter ---
    const pickStarter = (key) => {
        sessionStorage.setItem("playerKey", key);
        window.location.assign("/battle");
    };

    // --- Loading state selection ---
    if (loading) {
        return (
            <div className="screen-container">
                <h1>Choose your starter</h1>
                <div className="starters-grid">
                    {[...Array(3).map((_, i) => (
                        <div key={i} className="starter-card skeleton">
                            <div className="starter-art skeleton-art"/>
                            <div className="starter-name skeleton-text">Loading...</div>
                        </div>
                    ))]}
                </div>
            </div>
        )
    }

    // --- Error state (network/server) ---
    if (error) {
        return (
            <div className="screen-container">
                <h1>Choose your starter</h1>
                <p style={{ marginTop: 12}}>{error}</p>
                <button className="button" onClick={loadStarters} style={{ marginTop: 12}}>
                    Retry
                </button>
            </div>
        );
    }

    // --- Render starter grid ---
    return (
        <div className="screen-container">
            <h1>Choose your starter</h1>

            <div className="starter-grid" role="list">
                {starters.map((s) => (
                    <button
                        key={s.key}
                        role="listitem"
                        className="starter-card"
                        onClick={() => pickStarter(s.key)}
                        aria-label={`Choose ${s.name}`}
                    >
                        <img
                            src={s.sprite ?? s.sprites}
                            alt={s.name}
                            className="starter-art"
                            loading="lazy"
                            onError={(e) => {
                                // Graceful fallback if a local GIF is missing
                                e.currentTarget.src = "/assets/sprites/placeholder.gif";
                            }}
                        />
                    <div className="starter-name">{s.name}</div>
                </button>
                ))}
            </div>

            <div style={{ marginTop: 12 }}>
                <button className="button-secondary" onClick={() => (window.location.href = "/")}>
                    Back
                </button>
            </div>
        </div>
    );
}