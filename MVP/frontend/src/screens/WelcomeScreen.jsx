import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function WelcomeScreen() {
    const [name, setName] = useState("");
    const navigate = useNavigate();

    const handleContinue = () => {
        const timmedName = name.trim();
        if (!timmedName) return alert("Please emter your name");
        
        localStorage.setItem("playerName", timmedName);
        navigate("/main-menu");
    };

    return (
        <div className="screen-container">
            <h1>Welcome to RogueMon</h1>
            <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
            />
            <button onClick={handleContinue} className="primary-button">
                Continue
            </button>
        </div>
    );
}
