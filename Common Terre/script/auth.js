import { fetchMonthData } from './calendar.js';
import { isDeveloperMode } from './developerMode.js';

let loggedInUser = null;

// Function to check and log the login state every second
setInterval(() => {
    const isLoggedIn = !!getLoggedInUser(); // Check if a user is logged in
    updateAuthUI();
}, 1000);

// Define the callback function
function handleCredentialResponse(response) {
    console.log('Google Sign-In response:', response);

    if (!response || !response.credential) {
        console.error('Invalid Google Sign-In response:', response);
        return;
    }

    try {
        const data = jwt_decode(response.credential); // Decode the JWT token
        console.log('Decoded User Info:', data);

        // Store the logged-in user's email and name
        loggedInUser = {
            email: data.email,
            name: data.name,
        }

        // Save the user's email and name in localStorage
        localStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));

        // Update the UI to reflect the logged-in state
        updateAuthUI();
    } catch (error) {
        console.error('Error decoding JWT:', error);
        alert('Failed to log in. Please try again.');
    }
}

window.handleCredentialResponse = handleCredentialResponse;

// Register the callback globally
export function initializeAuth() {
    console.log('Initializing Google Sign-In...');

    google.accounts.id.initialize({
        client_id: '647953299647-2agji0t4frtj0oe848l6adphj6haibts.apps.googleusercontent.com',
        callback: handleCredentialResponse, // no need for window. anymore
    });

    google.accounts.id.renderButton(
        document.getElementById("auth-panel"),
        {
            theme: "outline",
            size: "large",
            text: "sign_in_with",
            shape: "rectangular",
            logo_alignment: "left"
        }
    );

    google.accounts.id.prompt();

}


export function getLoggedInUser() {
    if (!loggedInUser) {
        const storedUser = localStorage.getItem('loggedInUser');
        if (storedUser) {
            try {
                loggedInUser = JSON.parse(storedUser); // Attempt to parse the stored JSON
            } catch (error) {
                console.error('Error parsing stored user data:', error);
                localStorage.removeItem('loggedInUser'); // Remove invalid data from localStorage
            }
        }
    }
    return loggedInUser;
}


export function updateAuthUI() {
    const logoutButton = document.getElementById('logout-btn');
    const developerButton = document.getElementById('developer-btn');
    const inputPanel = document.getElementById('input-panel'); // Add this for the form

    if (loggedInUser) {
        // User is logged in
        if(logoutButton){
            logoutButton.style.display = 'block'; // Show the logout button
        }
        if(isDeveloperMode){
            if(developerButton){
                developerButton.style.display = 'block';
            }
        }
    } else {
        // User is not logged in
        if(logoutButton){
            logoutButton.style.display = 'none'; // Hide the logout button
        }
        if(inputPanel){
            inputPanel.style.display = 'none'; // Hide the form
        }
        if(developerButton){
            developerButton.style.display = 'none';
        }

    }
}

export function logout() {
    loggedInUser = null;
    localStorage.removeItem('loggedInUser');
    console.log('User logged out.');
    updateAuthUI();
}