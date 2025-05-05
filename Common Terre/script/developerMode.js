import { fetchAPI } from './api.js';
import { getLoggedInUser } from './auth.js';

export let isDeveloperMode = false;

export async function initializeDeveloperMode() {
    const loggedInUser = getLoggedInUser();
    if (!loggedInUser) {
        alert('You must be logged in to access Developer Mode.');
        return;
    }

    try {
        const response = await fetch(`http://127.0.0.1:8000/developers/is-developer`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Email': loggedInUser.email, // Pass the user's email
            },
        });
        
        if (!response.ok) {
            throw new Error(`Failed to check developer status. HTTP status: ${response.status}`);
        }

        const data = await response.json();
        if (data.is_developer) {
            enableDeveloperMode();
        } else {
            disableDeveloperMode();
        }
    } catch (error) {
            console.error('Error checking developer status:', error);
        alert('Failed to check developer status.');
    }
}

export function enableDeveloperMode() {
    isDeveloperMode = true;
    //localStorage.setItem('isDeveloperMode', 'true');
    //document.body.classList.add('developer-mode');
    //document.getElementById('dev-mode-btn').textContent = 'Disable Developer Mode';
    //document.getElementById('lock-calendar-btn').style.display = 'block';
}

export function disableDeveloperMode() {
    isDeveloperMode = false;
    //localStorage.removeItem('isDeveloperMode');
    //document.body.classList.remove('developer-mode');
    //document.getElementById('dev-mode-btn').textContent = 'Enable Developer Mode';
    //document.getElementById('lock-calendar-btn').style.display = 'none';
}