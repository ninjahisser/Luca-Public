import { fetchMonthData } from './calendar.js';

let loggedInUser = null;

// Function to check and log the login state every second
setInterval(() => {
    const isLoggedIn = !!getLoggedInUser(); // Check if a user is logged in
    console.log(`Logged in: ${isLoggedIn ? 'Yes' : 'No'}`);
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
    const authPanel = document.getElementById('auth-panel');
    const logoutButton = document.getElementById('logout-btn');
    const inputPanel = document.getElementById('input-panel'); // Add this for the form

    console.log('Logged in user:', loggedInUser); // Log the current user

    if (loggedInUser) {
        // User is logged in
        authPanel.style.display = 'none'; // Hide the auth panel
        logoutButton.style.display = 'block'; // Show the logout button
        console.log('Logout button should now be visible.');
    } else {
        // User is not logged in
        logoutButton.style.display = 'none'; // Hide the logout button
        inputPanel.style.display = 'none'; // Hide the form
        console.log('Logout button should now be hidden.');
    }
}

export function logout() {
    loggedInUser = null;
    localStorage.removeItem('loggedInUser');
    console.log('User logged out.');
    updateAuthUI();
}