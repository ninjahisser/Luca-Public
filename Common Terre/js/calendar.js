// Set your API key and client ID from the Google Cloud Console
const CLIENT_ID = "647953299647-2agji0t4frtj0oe848l6adphj6haibts.apps.googleusercontent.com";
const API_KEY = "GOCSPX" + "-" + "vLfEpvljK2d0" + "-" + "rV8qmACwOjkfURP";
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

let GoogleAuth;

console.log("Initializing calendar");

function loadGapi() {
    const script = document.createElement('script');
    script.src = "https://apis.google.com/js/api.js";
    script.defer = true;
    script.onload = () => {
        console.log("Google API script loaded.");
        loadClient(); // Call your existing loadClient function
    };
    document.head.appendChild(script);
}

// Call the function to load gapi
loadGapi();

// Initialize the API client
function initClient() {
    console.log("Initialzing client");
    gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        scope: SCOPES,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
    }).then(function () {
        GoogleAuth = gapi.auth2.getAuthInstance();

        // Check if the user is signed in
        if (GoogleAuth.isSignedIn.get()) {
            console.log("Loading calendar data");
            loadCalendarData();
        } else {
            console.log("Authorize button initiating")
            document.getElementById('authorize_button').style.display = 'inline';
        }

        // Event listener for sign-in button
        document.getElementById('authorize_button').addEventListener('click', handleAuthClick);
        document.getElementById('signout_button').addEventListener('click', handleSignoutClick);
    });
}

// Handle sign-in
function handleAuthClick() {
    GoogleAuth.signIn();
}

// Handle sign-out
function handleSignoutClick() {
    GoogleAuth.signOut();
    document.getElementById('events_list').innerHTML = '';
}

// Load calendar events
function loadCalendarData() {
    gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin: (new Date()).toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime',
    }).then(function (response) {
        const events = response.result.items;
        if (events.length > 0) {
            const eventList = document.getElementById('events_list');
            eventList.innerHTML = '';
            events.forEach(function (event) {
                const listItem = document.createElement('div');
                listItem.innerHTML = `<strong>${event.summary}</strong><br>${event.start.dateTime || event.start.date} - ${event.end.dateTime || event.end.date}`;
                eventList.appendChild(listItem);
                console.log(listItem.innerHTML);
            });
        } else {
            console.log("error");
            document.getElementById('events_list').innerHTML = 'No upcoming events found.';
        }
    });
}

// Load the Google API client
function loadClient() {
    gapi.load('client:auth2', initClient);
}

loadClient();