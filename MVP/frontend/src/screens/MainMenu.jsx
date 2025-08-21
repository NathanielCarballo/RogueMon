/**
 * MainMenu.jsx - MVP landing screen
 * 
 * Intent:
 * - Serve as the first screen after welcome.
 * - Read the transient player name from localStorage (MVP has no user accounts).
 * - Provide a simple entry point; fuller meno arrives post-MVP.
 * 
 * Contact:
 * - `WelcomeScreen` writes localStorage["playerName"] before navigating here.
 * 
 * Notes:
 * - Keep this screen minimal to reduce cognitive load during MVP reviews.
 * - Post-MVP we'll add navigation to Starter Select, Settings, etc.
 */
import React from "react";

export default function MainMenu() {
    const playerName = localStorage.getItem("playerName"); // single source of truth in MVP

    return (
        <div className="screen-container">
            <h1>Main Menu</h1>
            <p>Welcome, {playerName}!</p>
            {/* TODO(mvp-exit): Add real menu options (New Game -> Starter Select, Settings, Credits). */}
        </div>
    )
} 
