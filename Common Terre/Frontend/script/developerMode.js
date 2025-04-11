import { fetchAPI } from './api.js';
import { getLoggedInUser } from './auth.js';

export let isDeveloperMode = false;

export async function initializeDeveloperMode() {
    const savedDevMode = localStorage.getItem('isDeveloperMode');
    if (savedDevMode === 'true') {
        enableDeveloperMode();
    }

    // Fetch and update the lock status on page load
    await updateLockStatus();

    document.getElementById('dev-mode-btn').addEventListener('click', toggleDeveloperMode);
    document.getElementById('lock-calendar-btn').addEventListener('click', toggleCalendarLock);
}

export function enableDeveloperMode() {
    isDeveloperMode = true;
    localStorage.setItem('isDeveloperMode', 'true');
    document.body.classList.add('developer-mode');
    document.getElementById('dev-mode-btn').textContent = 'Disable Developer Mode';
    document.getElementById('lock-calendar-btn').style.display = 'block';
}

export function disableDeveloperMode() {
    isDeveloperMode = false;
    localStorage.removeItem('isDeveloperMode');
    document.body.classList.remove('developer-mode');
    document.getElementById('dev-mode-btn').textContent = 'Enable Developer Mode';
    document.getElementById('lock-calendar-btn').style.display = 'none';
}

async function toggleDeveloperMode() {
    const loggedInUser = getLoggedInUser();
    if (!loggedInUser) {
        alert('You must be logged in to toggle Developer Mode.');
        return;
    }

    if (isDeveloperMode) {
        disableDeveloperMode();
    } else {
        try {
            await fetchAPI('developers', 'POST', null, { 'X-User-Email': loggedInUser });
            enableDeveloperMode();
        } catch (error) {
            console.error('Error enabling Developer Mode:', error);
            alert('Failed to enable Developer Mode.');
        }
    }
}

async function toggleCalendarLock() {
    if (!isDeveloperMode) {
        alert('You must be in Developer Mode to lock or unlock the calendar.');
        return;
    }

    try {
        const lockStatus = await fetchAPI('calendar/get_lock', 'GET');
        const newLockState = !lockStatus.locked;
        const result = await fetchAPI('calendar/lock', 'POST', { lock: newLockState }, { 'X-User-Email': getLoggedInUser() });
        alert(result.message);
        document.getElementById('lock-calendar-btn').textContent = newLockState ? 'Unlock Calendar' : 'Lock Calendar';
    } catch (error) {
        console.error('Error toggling calendar lock:', error);
        alert('Failed to toggle calendar lock.');
    }
}

async function updateLockStatus() {
    try {
        const lockStatus = await fetchAPI('calendar/get_lock', 'GET');
        const lockButton = document.getElementById('lock-calendar-btn');
        lockButton.textContent = lockStatus.locked ? 'Unlock Calendar' : 'Lock Calendar';
    } catch (error) {
        console.error('Error fetching lock status:', error);
        alert('Failed to fetch calendar lock status.');
    }
}