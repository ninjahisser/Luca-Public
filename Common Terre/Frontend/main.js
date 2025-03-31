let currentYear, currentMonth;
let loggedInUser = null; // Store the logged-in user's email
let isDeveloperMode = false; // Track Developer Mode state

// Function to handle Google login response
function handleCredentialResponse(response) {
    try {
        const data = jwt_decode(response.credential);
        console.log('User Info:', data);

        // Store the logged-in user's email and name
        loggedInUser = data.email;
        const loggedInUserName = data.name;

        // Save the user's email and name in localStorage
        localStorage.setItem('loggedInUser', loggedInUser);
        localStorage.setItem('loggedInUserName', loggedInUserName);

        // Update the UI
        document.getElementById('auth-panel').style.display = 'none';
        document.getElementById('input-panel').style.display = 'block';
        document.getElementById('logout-btn').style.display = 'block';
        document.getElementById('poster-name').value = loggedInUserName; // Show the real name

        // Fetch the current month's data
        const { year, month } = getCurrentYearAndMonth();
        currentYear = year;
        currentMonth = month;
        fetchMonthData(currentYear, currentMonth);
    } catch (error) {
        console.error("Error decoding JWT:", error);
        alert("Failed to log in. Please try again.");
    }
}

// Make the function globally accessible
window.handleCredentialResponse = handleCredentialResponse;

// Function to fetch calendar items for a specific month and year
async function fetchMonthData(year, month) {
    try {
        const response = await fetch(`http://127.0.0.1:8000/calendar/${year}/${month}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Fetched calendar items:', data); // Debugging log

            // Handle the case where no items are returned
            if (Array.isArray(data) && data.length === 0) {
                console.log('No calendar items found for this month.');
            }

            displayCalendarGrid(year, month, data);
        } else {
            const error = await response.json();
            alert('Failed to fetch calendar items: ' + JSON.stringify(error));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while fetching calendar items.');
    }
}

// Function to display the calendar grid
function displayCalendarGrid(year, month, items) {
    const calendarGrid = document.getElementById('calendar-grid');
    const currentMonthLabel = document.getElementById('current-month');
    calendarGrid.innerHTML = ''; // Clear existing grid

    // Update the month/year label
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    currentMonthLabel.textContent = `${monthNames[month - 1]} ${year}`;

    const firstDay = new Date(year, month - 1, 1).getDay(); // Day of the week (0-6)
    const daysInMonth = new Date(year, month, 0).getDate(); // Total days in the month

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
        dayCell.innerHTML = `<div class="date">${day}</div>`;

        // Add an "Add" button for adding events
        const addButton = document.createElement('button');
        addButton.className = 'add-btn';
        addButton.textContent = '+';
        addButton.addEventListener('click', () => openAddEventModal(day));
        dayCell.appendChild(addButton);

        // Add calendar items for this day
        const dayItems = items.filter(item => new Date(item.date).getDate() === day);
        dayItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'calendar-item';
            itemDiv.innerHTML = `
                <strong>${item.title}</strong>
                <p>${item.time}</p>
            `;
            itemDiv.setAttribute('data-tooltip', `Author: ${item.poster_name}\nDescription: ${item.description}`);

            // Add a "Delete" button for all events if Developer Mode is enabled
            if (isDeveloperMode || localStorage.getItem('loggedInUserName') === item.poster_name) {
                const deleteButton = document.createElement('button');
                deleteButton.className = 'delete-btn';
                deleteButton.textContent = 'Delete';
                deleteButton.addEventListener('click', async () => {
                    await deleteCalendarItem(item.id);
                });
                itemDiv.appendChild(deleteButton);
            }

            dayCell.appendChild(itemDiv);
        });

        calendarGrid.appendChild(dayCell);
    }
}

// Function to open the add event modal
function openAddEventModal(day) {
    const date = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    console.log(`Opening modal for date: ${date}`); // Debugging log
    document.getElementById('date-picker').value = date;
    document.getElementById('input-panel').scrollIntoView({ behavior: 'smooth' });
}

// Function to delete a calendar item
async function deleteCalendarItem(itemId) {
    if (!loggedInUser) {
        alert("You must be logged in to delete calendar items.");
        return;
    }

    try {
        const response = await fetch(`http://127.0.0.1:8000/calendar/${itemId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Email': loggedInUser, // Pass the user's email in the headers
            },
        });

        if (response.ok) {
            alert('Calendar item deleted successfully.');
            fetchMonthData(currentYear, currentMonth); // Refresh the calendar
        } else {
            const error = await response.json();
            alert('Failed to delete calendar item: ' + error.detail);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while deleting the calendar item.');
    }
}

// Function to get the current year and month
function getCurrentYearAndMonth() {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 }; // Months are 0-indexed
}

// Fetch the current month's data on page load
document.addEventListener('DOMContentLoaded', () => {
    // Restore the logged-in user's state from localStorage
    const savedUser = localStorage.getItem('loggedInUser');
    const savedUserName = localStorage.getItem('loggedInUserName');
    if (savedUser && savedUserName) {
        loggedInUser = savedUser;

        // Update the UI to reflect the logged-in state
        document.getElementById('auth-panel').style.display = 'none';
        document.getElementById('input-panel').style.display = 'block';
        document.getElementById('logout-btn').style.display = 'block'; // Ensure the logout button is visible
        document.getElementById('poster-name').value = savedUserName; // Show the real name
    } else {
        // If no user is logged in, ensure the logout button is hidden
        document.getElementById('logout-btn').style.display = 'none';
    }

    // Restore the selected month and year from localStorage
    const savedYear = localStorage.getItem('selectedYear');
    const savedMonth = localStorage.getItem('selectedMonth');
    if (savedYear && savedMonth) {
        currentYear = parseInt(savedYear, 10);
        currentMonth = parseInt(savedMonth, 10);
    } else {
        const { year, month } = getCurrentYearAndMonth();
        currentYear = year;
        currentMonth = month;
    }

    // Validate that currentYear and currentMonth are valid numbers
    if (isNaN(currentYear) || isNaN(currentMonth)) {
        const { year, month } = getCurrentYearAndMonth();
        currentYear = year;
        currentMonth = month;
    }

    // Restore Developer Mode state
    const savedDevMode = localStorage.getItem('isDeveloperMode');
    if (savedDevMode === 'true') {
        isDeveloperMode = true;
        document.body.classList.add('developer-mode');
        document.getElementById('dev-mode-btn').textContent = 'Disable Developer Mode';
        document.getElementById('lock-calendar-btn').style.display = 'block'; // Show the lock calendar button
    } else {
        document.getElementById('dev-mode-btn').textContent = 'Enable Developer Mode';
        document.getElementById('lock-calendar-btn').style.display = 'none'; // Hide the lock calendar button
    }

    // Fetch the calendar data for the selected month and year
    fetchMonthData(currentYear, currentMonth);
    checkCalendarLockStatus();
});

// Add event listener for adding calendar items
document.getElementById('add-btn').addEventListener('click', async () => {
    if (!loggedInUser) {
        alert('You must be logged in to add calendar items.');
        return;
    }

    const posterName = localStorage.getItem('loggedInUserName'); // Use the real name
    const date = document.getElementById('date-picker').value;
    const time = document.getElementById('time-picker').value;
    const title = document.getElementById('title-input').value;
    const description = document.getElementById('description-input').value;

    if (!date || !time || !title || !description) {
        alert('Please fill out all fields.');
        return;
    }

    console.log('Submitting calendar item:', { posterName, date, time, title, description }); // Debugging log

    try {
        const response = await fetch('http://127.0.0.1:8000/calendar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                poster_name: posterName, // Use the real name here
                date: date,
                time: time,
                title: title,
                description: description,
            }),
        });

        if (response.ok) {
            const result = await response.json();
            alert('Calendar item added successfully: ' + JSON.stringify(result));

            // Refresh the calendar items for the currently selected month
            fetchMonthData(currentYear, currentMonth);
        } else {
            const error = await response.json();
            alert('Failed to add calendar item: ' + error.detail);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while adding the calendar item.');
    }
});

// Add event listeners for month navigation
document.getElementById('prev-month-btn').addEventListener('click', () => {
    // Decrement the month
    currentMonth -= 1;
    if (currentMonth < 1) {
        currentMonth = 12;
        currentYear -= 1;
    }

    // Fetch and display the updated calendar
    fetchMonthData(currentYear, currentMonth);
});

document.getElementById('next-month-btn').addEventListener('click', () => {
    // Increment the month
    currentMonth += 1;
    if (currentMonth > 12) {
        currentMonth = 1;
        currentYear += 1;
    }

    // Fetch and display the updated calendar
    fetchMonthData(currentYear, currentMonth);
});

// Add event listener for enabling developer mode
document.getElementById('dev-mode-btn').addEventListener('click', async () => {
    if (!loggedInUser) {
        alert("You must be logged in to toggle Developer Mode.");
        return;
    }

    if (isDeveloperMode) {
        // Disable Developer Mode
        isDeveloperMode = false;
        localStorage.removeItem('isDeveloperMode'); // Remove Developer Mode state
        document.body.classList.remove('developer-mode');
        document.getElementById('dev-mode-btn').textContent = 'Enable Developer Mode';
        document.getElementById('lock-calendar-btn').style.display = 'none'; // Hide the lock calendar button

        // Refresh the calendar to hide delete buttons for all events
        fetchMonthData(currentYear, currentMonth);
        alert("Developer Mode has been disabled.");
    } else {
        // Enable Developer Mode
        try {
            const response = await fetch(`http://127.0.0.1:8000/developers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': loggedInUser, // Pass the user's email in the headers
                },
            });

            if (response.ok) {
                const result = await response.json();
                alert(result.message);
                isDeveloperMode = true;
                localStorage.setItem('isDeveloperMode', 'true'); // Save Developer Mode state
                document.body.classList.add('developer-mode');
                document.getElementById('dev-mode-btn').textContent = 'Disable Developer Mode';
                document.getElementById('lock-calendar-btn').style.display = 'block'; // Show the lock calendar button

                // Refresh the calendar to show delete buttons for all events
                fetchMonthData(currentYear, currentMonth);
            } else {
                const error = await response.json();
                alert('Failed to enable Developer Mode: ' + error.detail);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while enabling Developer Mode.');
        }
    }
});

// Function to check if the calendar is locked
async function checkCalendarLockStatus() {
    try {
        // Backend URL for checking the lock status
        const url = 'http://127.0.0.1:8000/calendar/lock';

        // Send the GET request to check the lock status
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Calendar lock status:', result);

            // Update the button text based on the lock state
            const lockButton = document.getElementById('lock-calendar-btn');
            if (result.locked) {
                lockButton.textContent = 'Unlock Calendar';
            } else {
                lockButton.textContent = 'Lock Calendar';
            }
        } else {
            const error = await response.json();
            console.error('Failed to fetch calendar lock status:', error); // Debugging log
            alert('Failed to fetch calendar lock status: ' + error.detail);
        }
    } catch (error) {
        console.error('Error:', error); // Debugging log
        alert('An error occurred while checking the calendar lock status.');
    }
}


// Add event listener for locking/unlocking the calendar
// Add event listener for locking/unlocking the calendar
document.getElementById('lock-calendar-btn').addEventListener('click', async () => {
    try {
        // Determine the current lock state based on the button text
        const lock = !checkCalendarLockStatus();

        // Backend URL for locking/unlocking the calendar
        const url = `http://127.0.0.1:8000/calendar/lock?lock=${lock}`; // Include the lock parameter in the query string

        // Send the POST request to lock/unlock the calendar
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Email': loggedInUser, // Pass the user's email in the headers
            },
        });

        if (response.ok) {
            const result = await response.json();
            alert(result.message);

            // Update the button text based on the lock state
            document.getElementById('lock-calendar-btn').textContent = lock ? 'Unlock Calendar' : 'Lock Calendar';
        } else {
            const error = await response.json();
            console.error('Failed to lock/unlock calendar:', error); // Debugging log
            alert('Failed to lock/unlock the calendar: ' + error.detail[0].msg);
        }
    } catch (error) {
        console.error('Error:', error); // Debugging log
        alert('An error occurred while locking/unlocking the calendar.');
    }
});

// Add event listener for logging out
document.getElementById('logout-btn').addEventListener('click', () => {
    // Clear the logged-in user's email
    loggedInUser = null;
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('loggedInUserName');
    localStorage.removeItem('isDeveloperMode'); // Clear Developer Mode state

    // Reset the UI
    document.getElementById('auth-panel').style.display = 'block';
    document.getElementById('input-panel').style.display = 'none';
    document.getElementById('logout-btn').style.display = 'none';
    document.body.classList.remove('developer-mode');

    alert('You have been logged out.');
});