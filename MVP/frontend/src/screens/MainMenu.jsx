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
 */
import React from "react";
import { useNavigate } from "react-router-dom";

export default function MainMenu() {
    const playerName = localStorage.getItem("playerName"); // single source of truth in MVP
    const navigate = useNavigate(); 

    return (
        <div className="screen-container">
            <h1>Main Menu</h1>
            <p>Welcome, {playerName}!</p>
            
            <div style={{ marginTop: 12}}>
                <button className="button" onClick={() => navigate("/starter-select")}>
                    New Game
                </button>
            </div>
            {/* TODO(mvp-exit): Add Settings, Credits later. */}
        </div>
    )
}