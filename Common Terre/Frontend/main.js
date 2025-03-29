let currentYear, currentMonth;
let loggedInUser = null; // Store the logged-in user's name

// Function to handle Google login response
function handleCredentialResponse(response) {
    const data = jwt_decode(response.credential);
    console.log('User Info:', data);

    // Store the logged-in user's name
    loggedInUser = data.name;

    // Update the UI
    document.getElementById('auth-panel').style.display = 'none';
    document.getElementById('input-panel').style.display = 'block';
    document.getElementById('poster-name').value = loggedInUser;

    // Fetch the current month's data
    const { year, month } = getCurrentYearAndMonth();
    currentYear = year;
    currentMonth = month;
    fetchMonthData(currentYear, currentMonth);
}

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
            displayCalendarGrid(year, month, data);
        } else {
            const error = await response.json();
            alert('Failed to fetch calendar items: ' + error.detail);
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

        // Add a "+" button for adding events
        const addButton = document.createElement('button');
        addButton.className = 'add-btn';
        addButton.textContent = '+';
        addButton.addEventListener('click', () => {
            if (!loggedInUser) {
                alert('You must be logged in to add calendar items.');
                return;
            }
            openAddEventModal(day);
        });
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

            // Add a delete button only for the logged-in user's events
            if (loggedInUser === item.poster_name) {
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
    document.getElementById('date-picker').value = date;
    document.getElementById('input-panel').scrollIntoView({ behavior: 'smooth' });
}

// Function to delete a calendar item
async function deleteCalendarItem(itemId) {
    if (!loggedInUser) {
        alert('You must be logged in to delete calendar items.');
        return;
    }

    try {
        const response = await fetch(`http://127.0.0.1:8000/calendar/${itemId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
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
    const { year, month } = getCurrentYearAndMonth();
    currentYear = year;
    currentMonth = month;
    fetchMonthData(currentYear, currentMonth);
});