/**
 * WelcomeScreen.jsc
 * 
 * Intent:
 * - First screen the player sees when launching the game.
 * - Allows the player to enter a name, which is saved in localStorage.
 * - After entering a name, routes the player to the Main Menu.
 * 
 * Key points for contributors:
 * - Player name is persisted via localStorage (no backend required for MVP).
 * - This is part of the MVP flow: Welcome -> Main Menu -> Starter Select -> Battle.
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function WelcomeScreen() {
    // Store the current input value for the player's name.
    const [name, setName] = useState("");

    // React Router hook: lets us programatically change pages.
    const navigate = useNavigate();

    /**
     * Handle the "Continue" button.
     * - Save the player's name into localStorage.
     * - Redirect to the Main Menu.
     */

    const handleContinue = () => {
        const timmedName = name.trim();
        if (!timmedName) return alert("Please emter your name");
        
        localStorage.setItem("playerName", timmedName);
        navigate("/main-menu");  // move to the main menu screen
    };

    return (
        <div className="screen-container">
            <h1>Welcome to RogueMon</h1>

            {/* Text input: player types their name here */ }
            <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
            />

            {/* Button: confirms name and continues */}
            <button onClick={handleContinue} className="primary-button">
                Continue
            </button>
        </div>
    );
}
