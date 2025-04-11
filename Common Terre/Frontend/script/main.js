import { initializeAuth } from './auth.js';
import { initializeCalendar } from './calendar.js';
import { initializeDeveloperMode } from './developerMode.js';

// Initialize the app on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
    initializeCalendar();
    initializeDeveloperMode();
});