import React from "react";

export default function MainMenu() {
    const playerName = localStorage.getItem("playerName");

    return (
        <div className="screen-container">
            <h1>Main Menu</h1>
            <p>Welcome, {playerName}!</p>
            {/* future menu buttons go here */}
        </div>
    )
} 
