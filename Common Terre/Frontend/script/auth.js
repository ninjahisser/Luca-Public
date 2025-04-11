import { fetchMonthData } from './calendar.js';

let loggedInUser = null;

export function initializeAuth() {
    // Dynamically initialize the Google Sign-In library
    google.accounts.id.initialize({
        client_id: '647953299647-2agji0t4frtj0oe848l6adphj6haibts.apps.googleusercontent.com',
        callback: handleCredentialResponse,
    });

    // Render the Google Sign-In button
    google.accounts.id.renderButton(
        document.querySelector('.g_id_signin'),
        {
            type: 'standard',
            shape: 'rectangular',
            theme: 'outline',
            text: 'sign_in_with',
            size: 'large',
            logo_alignment: 'left',
        }
    );

    // Optionally prompt the user to sign in automatically
    google.accounts.id.prompt();

    const savedUser = localStorage.getItem('loggedInUser');
    const savedUserName = localStorage.getItem('loggedInUserName');

    if (savedUser && savedUserName) {
        loggedInUser = savedUser;
        document.getElementById('auth-panel').style.display = 'none';
        document.getElementById('input-panel').style.display = 'block';
        document.getElementById('logout-btn').style.display = 'block';
        document.getElementById('poster-name').value = savedUserName;
    } else {
        document.getElementById('logout-btn').style.display = 'none';
    }

    document.getElementById('logout-btn').addEventListener('click', logout);
}

function handleCredentialResponse(response) {
    try {
        console.log("Handling credential response");
        const data = jwt_decode(response.credential); // Decode the JWT token
        const loggedInUserMail = data.email;
        const loggedInUserName = data.name;

        // Save user information in localStorage
        localStorage.setItem('loggedInUser', loggedInUserMail);
        localStorage.setItem('loggedInUserName', loggedInUserName);

        // Set the loggedInUser variable
        loggedInUser = loggedInUserMail;

        // Update the UI
        document.getElementById('auth-panel').style.display = 'none';
        document.getElementById('input-panel').style.display = 'block';
        document.getElementById('logout-btn').style.display = 'block';
        document.getElementById('poster-name').value = loggedInUserName;

        // Fetch and display the calendar data for the current month
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // Months are 0-indexed
        console.log(`Fetching calendar data for year: ${currentYear}, month: ${currentMonth}`);
        fetchMonthData(currentYear, currentMonth);
    } catch (error) {
        console.error('Error decoding JWT:', error);
        alert('Failed to log in. Please try again.');
    }
}

function logout() {
    loggedInUser = null;
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('loggedInUserName');
    localStorage.removeItem('isDeveloperMode');

    document.getElementById('auth-panel').style.display = 'block';
    document.getElementById('input-panel').style.display = 'none';
    document.getElementById('logout-btn').style.display = 'none';
    document.body.classList.remove('developer-mode');

    alert('You have been logged out.');
}

export function getLoggedInUser() {
    return loggedInUser;
}