console.log("Calendar script loaded.");

import { getLoggedInUser } from './auth.js';
import { fetchAPI } from './api.js';
import { getCurrentYearAndMonth } from './utils.js';
import { isDeveloperMode } from './developerMode.js';

let currentYear, currentMonth;

export function initializeCalendar() {
    const { year, month } = getCurrentYearAndMonth();
    currentYear = year;
    currentMonth = month;

    fetchMonthData(currentYear, currentMonth);

    document.getElementById('prev-month-btn').addEventListener('click', () => {
        currentMonth -= 1;
        if (currentMonth < 1) {
            currentMonth = 12;
            currentYear -= 1;
        }
        fetchMonthData(currentYear, currentMonth);
    });

    document.getElementById('next-month-btn').addEventListener('click', () => {
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
        alert('Failed to fetch calendar data.');
    }
}

async function deleteCalendarItem(itemId) {
    try {
        const response = await fetch(`http://127.0.0.1:8000/calendar/${itemId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Email': getLoggedInUser(),
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

function displayCalendarGrid(year, month, items) {
    const calendarGrid = document.getElementById('calendar-grid');
    const currentMonthLabel = document.getElementById('current-month');
    calendarGrid.innerHTML = '';

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    currentMonthLabel.textContent = `${monthNames[month - 1]} ${year}`;

    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-cell empty';
        calendarGrid.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-cell';
        dayCell.innerHTML = `<div class="date">${day}</div>`;

        const addButton = document.createElement('button');
        addButton.className = 'add-btn';
        addButton.textContent = '+';
        addButton.addEventListener('click', () => openAddEventModal(day));
        dayCell.appendChild(addButton);

        const dayItems = items.filter(item => new Date(item.date).getDate() === day);
        dayItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'calendar-item';
            itemDiv.innerHTML = `
                <strong>${item.title}</strong>
                <p>${item.time}</p>
            `;
            itemDiv.setAttribute('data-tooltip', `Author: ${item.poster_name}\nDescription: ${item.description}`);

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

function openAddEventModal(day) {
    const date = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    document.getElementById('date-picker').value = date;
    document.getElementById('input-panel').scrollIntoView({ behavior: 'smooth' });
}
if(document.getElementById('add-btn')){
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

            const eventTitle = document.createElement('h3');
            eventTitle.textContent = event.title;

            const eventDate = document.createElement('p');
            eventDate.innerHTML = `<em>${new Date(event.date).toLocaleDateString('nl-NL')}</em>`;

            eventDiv.appendChild(eventTitle);
            eventDiv.appendChild(eventDate);
            eventList.appendChild(eventDiv);
        });
    } catch (error) {
        console.error('Error loading events:', error);
        eventList.innerHTML = '<p>Fout bij het laden van evenementen.</p>';
    }
});