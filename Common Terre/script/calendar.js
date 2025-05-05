console.log("Calendar script loaded.");

import { getLoggedInUser, initializeAuth, logout } from './auth.js';
import { fetchAPI } from './api.js';
import { getCurrentYearAndMonth } from './utils.js';
import { isDeveloperMode } from './developerMode.js';
import { initializeDeveloperMode } from './developerMode.js';

let currentYear, currentMonth;

export function initializeCalendar() {
    const { year, month } = getCurrentYearAndMonth();
    currentYear = year;
    currentMonth = month;

    fetchMonthData(currentYear, currentMonth);

    document.getElementById('prev-month').addEventListener('click', () => {
        currentMonth -= 1;
        if (currentMonth < 1) {
            currentMonth = 12;
            currentYear -= 1;
        }
        fetchMonthData(currentYear, currentMonth);
    });

    document.getElementById('next-month').addEventListener('click', () => {
        currentMonth += 1;
        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear += 1;
        }
        fetchMonthData(currentYear, currentMonth);
    });
}

export async function fetchMonthData(year, month) {
    try {
        const data = await fetchAPI(`calendar/${year}/${month}`, 'GET');
        displayCalendarGrid(year, month, data);
    } catch (error) {
        console.error('Error fetching calendar data:', error);
    }
}

async function deleteCalendarItem(itemId) {
    const loggedInUser = getLoggedInUser(); // Ensure this returns the user's display name
    console.log(`Attempting to delete calendar item with ID: ${itemId}, User: ${loggedInUser.name}`); // Debugging
    try {
        const response = await fetch(`http://127.0.0.1:8000/calendar/${itemId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Name': loggedInUser.name, // Send the display name
            },
        });

        if (response.ok) {
            alert(`Calendar item with ID ${itemId} deleted successfully.`);
            fetchMonthData(currentYear, currentMonth); // Refresh the calendar
        } else {
            const error = await response.json();
            alert(`Failed to delete calendar item: ${error.detail}`);
        }
    } catch (error) {
        console.error('Error deleting calendar item:', error);
        alert('An error occurred while deleting the calendar item.');
    }
}

// Define the month names
const monthNames = [
    'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
    'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
];

function displayCalendarGrid(year, month, items) {
    const calendarGrid = document.querySelector('.calendar-grid'); // Use querySelector for class
    if (!calendarGrid) {
        console.error('calendarGrid element not found.');
        return;
    }
    console.log(`Displaying calendar for ${year}-${month}`);
    calendarGrid.innerHTML = '';

    const currentMonthLabel = document.getElementById('current-month');
    currentMonthLabel.textContent = `${monthNames[month - 1]} ${year}`; // Use monthNames array

    // Adjust the first day calculation to start with Monday
    const firstDay = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Shift Sunday (0) to Monday (0)
    const daysInMonth = new Date(year, month, 0).getDate();

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-cell empty';
        calendarGrid.appendChild(emptyCell);
    }

    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-cell';
        dayCell.innerHTML = `<div class="calendar_cell_top"><div class="date">${day}</div></div>`;


        // Add the "+" button to the day cell
        const addButton = document.createElement('button');
        addButton.className = 'add-btn';
        addButton.textContent = '+';
        addButton.style.top = '5px';
        addButton.style.right = '5px';
        addButton.style.display = 'hidden';
        addButton.addEventListener('click', () => openAddEventModal(day));

        dayCell.childNodes.forEach((child, index) => {
            if (child.className === 'calendar_cell_top') {
                child.appendChild(addButton);
            }
        });
        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'events-container';
       // Add events for the day
       const dayItems = items.filter(item => new Date(item.date).getDate() === day).sort((a, b) => a.time.localeCompare(b.time)); // Sort by time (HH:mm format);
       dayItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'calendar-event';
        itemDiv.innerHTML = `${item.time}<br>${item.title}`;
        itemDiv.title = `${item.title} - ${item.description} - ${item.poster_name}`; // Tooltip with event description

        // Add click event listener to prompt for deletion
        itemDiv.addEventListener('click', async () => {
            const loggedInUser = getLoggedInUser();
            if (item.poster_name === loggedInUser.name) {
                const confirmDelete = confirm(`Wil je het evenement "${item.title}" verwijderen?`);
                if (confirmDelete) {
                    try {
                        await deleteCalendarItem(item.id); // Call the delete function
                        alert('Evenement succesvol verwijderd.');
                        fetchMonthData(year, month); // Refresh the calendar
                    } catch (error) {
                        console.error('Error deleting event:', error);
                        alert('Er is een fout opgetreden bij het verwijderen van het evenement.');
                    }
                }
            } else {
                alert('Je kunt alleen evenementen verwijderen die door jou zijn gemaakt.');
                alert(item.poster_name);
                alert(loggedInUser.name);
            }
        });

        eventsContainer.appendChild(itemDiv);
    });

       

       dayCell.appendChild(eventsContainer);
       calendarGrid.appendChild(dayCell); // Append the day cell to the calendar grid
    }
}

function openAddEventModal(day) {
    const loggedInUser = getLoggedInUser();

    // If the user is not logged in, show the auth panel
    if (!loggedInUser) {
        const authPanel = document.getElementById('auth-panel');
        authPanel.style.display = 'block';
        return;
    }

    // Set the selected date in the form
    const selectedDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    console.log(`Selected date: ${selectedDate}`); // Debugging log
    document.getElementById('selected-date').textContent = `Datum: ${selectedDate}`;
    document.getElementById('selected-date').dataset.date = selectedDate; // Store the date in a data attribute

    // Show the input panel
    const inputPanel = document.getElementById('input-panel');
    inputPanel.style.display = 'block';
}

if (document.getElementById('add-btn')) {
    document.getElementById('add-btn').addEventListener('click', async () => {
        const loggedInUser = getLoggedInUser();
        if (!loggedInUser) {
            alert('You must be logged in to add calendar items.');
            return;
        }

        const posterName = localStorage.getItem('loggedInUserName');
        const date = document.getElementById('date-picker').value;
        const time = document.getElementById('time-picker').value;
        const title = document.getElementById('title-input').value;
        const description = document.getElementById('description-input').value;

        if (!date || !time || !title || !description) {
            alert('Please fill out all fields.');
            return;
        }

        try {
            const response = await fetch('http://127.0.0.1:8000/calendar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    poster_name: posterName,
                    date: date,
                    time: time,
                    title: title,
                    description: description,
                }),
            });

            if (response.ok) {
                const result = await response.json();
                alert('Calendar item added successfully: ' + JSON.stringify(result));
                fetchMonthData(currentYear, currentMonth); // Refresh the calendar
            } else {
                const error = await response.json();
                alert('Failed to add calendar item: ' + error.detail);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while adding the calendar item.');
        }
    });
}

async function DOM_LoadCalendar() {
    const calendarGrid = document.querySelector('.calendar-grid');
    const currentMonthLabel = document.getElementById('current-month');
    const prevMonthButton = document.getElementById('prev-month');
    const nextMonthButton = document.getElementById('next-month');

    const months = [
        'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
        'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
    ];

    let currentDate = new Date();

    async function fetchEvents(year, month) {
        try {
            const response = await fetch(`http://127.0.0.1:8000/calendar/${year}/${month}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch events. HTTP status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching events:', error);
            return [];
        }
    }

    async function renderCalendar() {
        // Clear the calendar grid
        calendarGrid.innerHTML = '';

        // Set the current month label
        currentMonthLabel.textContent = `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

        // Get the first day of the month and the number of days in the month
        const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
        const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

        // Fetch events for the current month
        const events = await fetchEvents(currentDate.getFullYear(), currentDate.getMonth() + 1);

        // Fill in empty slots for days before the first day of the month
        for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
            const emptySlot = document.createElement('div');
            emptySlot.className = 'calendar-cell empty';
            calendarGrid.appendChild(emptySlot);
        }

        // Add day buttons and populate events
        for (let day = 1; day <= daysInMonth; day++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-cell';
            dayCell.innerHTML = `<div class="date">${day}</div>`;

            // Filter events for the current day
            const dayEvents = events.filter(event => new Date(event.date).getDate() === day);

            // Add events to the day cell
            dayEvents.forEach(event => {
                const eventDiv = document.createElement('div');
                eventDiv.className = 'calendar-event';
                eventDiv.textContent = `${event.time} - ${event.title}`;
                eventDiv.title = event.description; // Tooltip with event description
                dayCell.appendChild(eventDiv);
            });

            calendarGrid.appendChild(dayCell);
        }
    }

    // Handle month navigation
    prevMonthButton.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthButton.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    // Initial render
    renderCalendar();
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Calendar script loaded.');
    const eventList = document.getElementById('event-list');

    if (!eventList) {
        console.error('Event list container not found.');
        return;
    }

    try {
        // Fetch events from the backend
        const response = await fetch('http://127.0.0.1:8000/calendar/events');
        console.log('Fetch response:', response);

        if (!response.ok) {
            throw new Error(`Failed to fetch events. HTTP status: ${response.status}`);
        }

        const events = await response.json();
        console.log('Events fetched successfully:', events);

        if (events.length === 0) {
            console.warn('No upcoming events found.');
            eventList.innerHTML = '<p>Geen aankomende evenementen.</p>';
            return;
        }

        // Sort events by date and get the next 4 events
        const upcomingEvents = events
            .sort((a, b) => new Date(a.date) - new Date(b.date)) // Sort by date
            .slice(0, 4); // Get the next 4 events

        console.log('Upcoming events:', upcomingEvents);

        // Populate the event list
        upcomingEvents.forEach(event => {
            const eventDiv = document.createElement('div');
            eventDiv.classList.add('event');
            eventDiv.style.cursor = 'pointer'; // Make it look clickable

            const eventTitle = document.createElement('h3');
            eventTitle.textContent = event.title;

            const eventDate = document.createElement('p');
            eventDate.innerHTML = `<em>${new Date(event.date).toLocaleDateString('nl-NL')}</em>`;

            eventDiv.appendChild(eventTitle);
            eventDiv.appendChild(eventDate);

            eventDiv.addEventListener('click', () => {
                window.location.href = `/calendar.html`;
            });

            eventList.appendChild(eventDiv);
        });
    } catch (error) {
        console.error('Error loading events:', error);
        eventList.innerHTML = '<a>Geen evenementen binnnekort, klik om naar kalendar te gaan.</a>';
        eventList.addEventListener('click', () => {
            window.location.href = `/calendar.html`;
        });
        eventList.style.cursor = 'pointer'; // Make it look clickable

    }

    // Hide the auth panel by default
    const authPanel = document.getElementById('auth-panel');
    authPanel.style.display = 'none';

    // Add event listener to the logout button
    const logoutButton = document.getElementById('logout-btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            logout();
        });
    }

    const developerButton = document.getElementById('developer-btn');
    if (developerButton) {
        developerButton.addEventListener('click', () => {
            window.location.href = '/developer.html'; // Redirect to /developer.html
        });
    }

    DOM_LoadCalendar();
    initializeAuth();
    initializeCalendar();
    setHoplrLink();
    initializeDeveloperMode();
});

if(document.getElementById('submit-event-btn')){
    document.getElementById('submit-event-btn').addEventListener('click', async () => {
        const eventName = document.getElementById('event-name').value;
        const eventDescription = document.getElementById('event-description').value;
        const eventTime = document.getElementById('event-time').value;
        const selectedDate = document.getElementById('selected-date').dataset.date; // Get the selected date
    
        if (!eventName || !eventDescription || !eventTime || !selectedDate) {
            alert('Vul alle velden in voordat u het evenement plaatst.');
            return;
        }
    
        console.log('Evenement gegevens:', {
            naam: eventName,
            beschrijving: eventDescription,
            tijd: eventTime,
            datum: selectedDate,
        });
    
        try {
            const response = await fetch('http://127.0.0.1:8000/calendar/post', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    poster_name: localStorage.getItem('loggedInUserName'),
                    date: selectedDate,
                    time: eventTime,
                    title: eventName,
                    description: eventDescription,
                }),
            });

            console.log("Raw response object:", response);

            if (response.ok) {
                const result = await response.json();
                alert('Evenement succesvol geplaatst: ' + JSON.stringify(result));
                fetchMonthData(currentYear, currentMonth); // Refresh the calendar
            } else {
                const error = await response.json();
                alert('Fout bij het toevoegen van het evenement: ' + error.detail);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Er is een fout opgetreden bij het toevoegen van het evenement.');
        }
    });
}


async function setHoplrLink() {
    try {
        const response = await fetch('http://127.0.0.1:8000/config/hoplr-link');
        if (!response.ok) {
            alert('Failed to fetch Hoplr link. Please try again later.');
            throw new Error(`Failed to fetch Hoplr link. HTTP status: ${response.status}`);
        }
        const data = await response.json();
        const hoplrLink = data.hoplr_page_link; // Correct key here

        if (hoplrLink) {
            const hoplrButton = document.getElementById('hoplr-btn');
            hoplrButton.href = hoplrLink;
        } else {
            alert('Hoplr link not configured in the backend.');
            console.error('Hoplr link not configured in the backend.');
        }
    } catch (error) {
        console.error('Error fetching Hoplr link:', error);
    }
}

document.getElementById('close-popup')?.addEventListener('click', () => {
    const inputPanel = document.getElementById('input-panel');
    if (inputPanel) {
        inputPanel.style.display = 'none';
    }
});