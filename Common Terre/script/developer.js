import { fetchAPI } from './api.js';
import { isDeveloperMode } from './developerMode.js';
import { initializeDeveloperMode } from './developerMode.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Developer Mode
    await initializeDeveloperMode();
    await loadActorList();

    loadDevelopers();

    // Check if the user is a developer
    if (!isDeveloperMode) {
        alert('You are not authorized to access this page.');
        window.location.href = '/index.html'; // Redirect to the homepage or another page
        return;
    }
    loadHoplrLink();

    const configForm = document.getElementById('config-form');
    configForm.addEventListener('submit', saveHoplrLink);
    loadLockCalendarStatus();
    // Initialize the map and load actors
});

async function loadActors(map) {
    try {
        const actors = await fetchAPI('actors', 'GET');
        console.log('Actors loaded:', actors); // Debug the actor data

        if (!Array.isArray(actors) || actors.length === 0) {
            throw new Error('No actors found.');
        }

        const actorList = document.getElementById('actors');
        actorList.innerHTML = ''; // Clear the list

        actors.forEach(actor => {
            // Add the dataUrl field to point to the actor's data.json file
            actor.dataUrl = `http://127.0.0.1:8000/static/actors/actor_${actor.id}/data.json`;

            const listItem = document.createElement('li');
            listItem.textContent = actor.name;

            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.addEventListener('click', () => openEditActorModal(actor));
            listItem.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.addEventListener('click', () => deleteActor(actor.id));
            listItem.appendChild(deleteButton);

            actorList.appendChild(listItem);
        });

        await placeIconsOnMap(map, actors);
    } catch (error) {
        console.error('Error loading actors:', error);

        // Only show the alert if no actors were loaded
        const actorList = document.getElementById('actors');
        if (!actorList || actorList.children.length === 0) {
            alert('Failed to load actors.');
        }
    }
}

async function addActor(event) {
    event.preventDefault(); // Prevent the form from refreshing the page

    const name = document.getElementById('actor-name').value;

    if (!name.trim()) {
        alert('Actor name is required.');
        return;
    }

    try {
        // Send a POST request to the backend to add the actor
        const response = await fetch('http://127.0.0.1:8000/actors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        if (response.ok) {
            alert('Actor added successfully!');
            document.getElementById('add-actor-form').reset(); // Clear the form
            await loadActorList(); // Reload the actor list
        } else {
            throw new Error('Failed to add actor.');
        }
    } catch (error) {
        console.error('Error adding actor:', error);
        alert('Failed to add actor.');
    }
}

document.getElementById('add-actor-form').addEventListener('submit', addActor);

async function deleteActor(actorId) {
    try {
        await fetchAPI(`actors/${actorId}`, 'DELETE');
        alert('Actor deleted successfully!');
        loadActors(); // Refresh the actor list
    } catch (error) {
        console.error('Error deleting actor:', error);
        alert('Failed to delete actor.');
    }
}

async function updateActor(actor) {
    try {
        // Retrieve the actor ID from the modal's dataset
        const modal = document.getElementById('edit-actor-modal');
        const actorId = modal.dataset.actorId;

        if (!actorId) {
            console.error('Actor ID is missing');
            alert('Failed to update actor: Missing actor ID.');
            return;
        }

        // Collect updated values from the modal
        actor.name = document.getElementById('edit-actor-name').value;
        actor.description = document.getElementById('edit-actor-description').value;
        actor.order = document.getElementById('edit-actor-order').value;
        actor.x_position = parseInt(document.getElementById('edit-actor-x-position').value, 10);
        actor.y_position = parseInt(document.getElementById('edit-actor-y-position').value, 10);

        const response = await fetchAPI(`actors/${actorId}`, 'PUT', actor);
        alert('Actor updated successfully!');
        await loadActorList(); // Reload the actor list
    } catch (error) {
        console.error('Error updating actor:', error);
        alert('Failed to update actor.');
    }
}

async function openEditActorModal(actor) {
    if (!actor.dataUrl) {
        alert('Failed to load actor details: Missing data URL');
        return;
    }

    try {
        // Fetch full actor details
        const response = await fetch(actor.dataUrl);
        const fullActorData = await response.json();

        // Populate the modal fields with full actor details
        document.getElementById('edit-actor-name').value = fullActorData.name || '';
        document.getElementById('edit-actor-description').value = fullActorData.description || '';
        document.getElementById('edit-actor-order').value = fullActorData.order || 'IMAGE, DESCRIPTION, EMPTY_SPACE';
        document.getElementById('edit-actor-x-position').value = fullActorData.x_position || 50;
        document.getElementById('edit-actor-y-position').value = fullActorData.y_position || 50;
        document.getElementById('x-position-value').textContent = `${fullActorData.x_position || 50}%`;
        document.getElementById('y-position-value').textContent = `${fullActorData.y_position || 50}%`;

        // Populate the category dropdowns
        const categoryDropdowns = [
            document.getElementById('edit-actor-category-1'),
            document.getElementById('edit-actor-category-2'),
            document.getElementById('edit-actor-category-3')
        ];
        const categories = fullActorData.categories || [];
        categoryDropdowns.forEach((dropdown, index) => {
            dropdown.value = categories[index] || ''; // Set the selected value
        });

        // Store the fullActorData and actorId in the modal's dataset
        const modal = document.getElementById('edit-actor-modal');
        modal.dataset.fullActorData = JSON.stringify(fullActorData);
        modal.dataset.actorId = fullActorData.id; // Set the actor ID

        // Find the actor's icon on the map and store it in the modal's dataset
        const mapIcon = document.querySelector(`.map-icon[title="${fullActorData.name}"]`);
        if (mapIcon) {
            modal.dataset.mapIconId = fullActorData.id;
            console.log(`Map icon found for actor ID: ${fullActorData.name}`); // Debugging
        } else {
            console.error(`Map icon for actor ID ${fullActorData.name} not found.`); // Debugging
        }

        // Show the modal
        modal.style.display = 'block';

        // Add event listener for saving changes
        const form = document.getElementById('edit-actor-form');
        form.onsubmit = async (event) => {
            event.preventDefault();
            await updateActor(fullActorData);
            modal.style.display = 'none'; // Close the modal after saving
        };

        // Add event listener for canceling
        document.getElementById('cancel-edit-actor').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    } catch (error) {
        console.error('Error loading actor details:', error);
        alert('Failed to load actor details.');
    }
}

document.getElementById('edit-actor-x-position').addEventListener('input', (event) => {
    const xPosition = event.target.value;
    document.getElementById('x-position-value').textContent = `${xPosition}%`;

    // Retrieve the fullActorData from the modal's dataset
    const modal = document.getElementById('edit-actor-modal');
    const fullActorData = JSON.parse(modal.dataset.fullActorData);
    const mapIcon = document.querySelector(`.map-icon[title="${fullActorData.name}"]`);
    const mapImage = document.getElementById('map-image');

    if (mapIcon && mapImage) {
        const mapWidth = mapImage.getBoundingClientRect().width;
        const left = (xPosition / 100) * mapWidth; // Convert percentage to pixels
        mapIcon.style.left = `${left}px`;
        console.log(`Updated map icon X position to: ${left}px`); // Debugging
    } else {
        console.error('Map icon or map image not found for live update.');
    }
});

document.getElementById('edit-actor-y-position').addEventListener('input', (event) => {
    const yPosition = event.target.value;
    document.getElementById('y-position-value').textContent = `${yPosition}%`;

    // Retrieve the fullActorData from the modal's dataset
    const modal = document.getElementById('edit-actor-modal');
    const fullActorData = JSON.parse(modal.dataset.fullActorData);
    const mapIcon = document.querySelector(`.map-icon[title="${fullActorData.name}"]`);
    const mapImage = document.getElementById('map-image');

    if (mapIcon && mapImage) {
        const mapHeight = mapImage.getBoundingClientRect().height;
        const top = (yPosition / 100) * mapHeight; // Convert percentage to pixels
        mapIcon.style.top = `${top}px`;
        console.log(`Updated map icon Y position to: ${top}px`); // Debugging
    } else {
        console.error('Map icon or map image not found for live update.');
    }
});


document.getElementById('edit-actor-x-position').addEventListener('input', (event) => {
    document.getElementById('x-position-value').textContent = `${event.target.value}%`;
});

document.getElementById('edit-actor-y-position').addEventListener('input', (event) => {
    document.getElementById('y-position-value').textContent = `${event.target.value}%`;
});

export function closeEditActorModal() {
    const modal = document.getElementById('edit-actor-modal');
    modal.style.display = 'none';
    modal.dataset.actorId = '';
}

document.getElementById('edit-actor-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const actorId = document.getElementById('edit-actor-modal').dataset.actorId;
    if (!actorId) {
        console.error('Actor ID is missing');
        return;
    }

    const name = document.getElementById('edit-actor-name').value;
    const description = document.getElementById('edit-actor-description').value;
    const order = document.getElementById('edit-actor-order').value;
    const categories = [
        document.getElementById('edit-actor-category-1').value,
        document.getElementById('edit-actor-category-2').value,
        document.getElementById('edit-actor-category-3').value,
    ];
    const xPosition = parseFloat(document.getElementById('edit-actor-x-position').value);
    const yPosition = parseFloat(document.getElementById('edit-actor-y-position').value);
    const audioFile = document.getElementById('edit-actor-audio-file').files[0];
    const imageFiles = document.getElementById('edit-actor-images').files;
    const iconFile = document.getElementById('edit-actor-icon').files[0];

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('order', order);
    formData.append('categories', JSON.stringify(categories));
    formData.append('x_position', xPosition);
    formData.append('y_position', yPosition);
    if (audioFile) {
        formData.append('audio', audioFile);
    }
    for (const image of imageFiles) {
        formData.append('images', image);
    }
    if (iconFile) {
        formData.append('icon', iconFile);
    }

    try {
        const response = await fetchAPI(`actors/${actorId}`, 'PUT', formData, true);
        alert('Actor updated successfully!');
        closeEditActorModal();
        loadActors();
    } catch (error) {
        console.error('Error updating actor:', error);
        alert('Failed to update actor.');
    }
});

document.getElementById('edit-actor-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const actorId = document.getElementById('edit-actor-modal').dataset.actorId;
    const name = document.getElementById('edit-actor-name').value;
    const description = document.getElementById('edit-actor-description').value;
    const order = document.getElementById('edit-actor-order').value;
    const hasAudio = document.getElementById('edit-actor-audio').checked;
    const audioFile = hasAudio ? document.getElementById('edit-actor-audio-file').files[0] : null;
    const categories = [
        document.getElementById('edit-actor-category-1').value,
        document.getElementById('edit-actor-category-2').value,
        document.getElementById('edit-actor-category-3').value,
    ];
    const xPosition = parseFloat(document.getElementById('edit-actor-x-position').value);
    const yPosition = parseFloat(document.getElementById('edit-actor-y-position').value);

    if (new Set(categories).size !== 3) {
        alert('Please select 3 unique categories.');
        return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('order', order);
    formData.append('categories', JSON.stringify(categories));
    formData.append('x_position', xPosition);
    formData.append('y_position', yPosition);
    if (hasAudio && audioFile) {
        formData.append('audio', audioFile);
    }

    try {
        const response = await fetchAPI(`actors/${actorId}`, 'PUT', formData, true);

        if (response) {
            console.log('Response:', response);
        }
        closeEditActorModal();
        loadActors();
    } catch (error) {
        console.error('Error updating actor:', error);
        if (error.response) {
            console.error('Error details:', await error.response.text());
        }
        alert('Failed to update actor.');
    }
});

document.getElementById('edit-actor-audio').addEventListener('change', (event) => {
    const audioFileInput = document.getElementById('edit-actor-audio-file');
    audioFileInput.style.display = event.target.checked ? 'block' : 'none';
});

document.getElementById('edit-actor-audio').addEventListener('change', (event) => {
    const audioFileInput = document.getElementById('edit-actor-audio-file');
    audioFileInput.style.display = event.target.checked ? 'block' : 'none';
});

const categoryOptions = [
    "biodiversiteit",
    "permacultuur",
    "bio-dynamisch",
    "agro-ecologie",
    "regeneratief",
    "duurzaamheid",
    "levende landbouw",
    "zelfvoorzienend",
    "organisch",
    "kunst",
    "schoonheid",
    "zadkracht",
    "co-creatie",
    "materiële verhalen",
    "verbinden",
    "precariteit",
    "de wroeters",
    "solidariteit",
    "gemeenschap",
    "vrijwilligerswerking",
    "activisme",
    "zorg",
    "grondgenoten",
    "gelijkwaardigheid",
    "diversiteit",
    "pluriversum"
];

function populateCategoryDropdowns() {
    const dropdowns = [
        document.getElementById('edit-actor-category-1'),
        document.getElementById('edit-actor-category-2'),
        document.getElementById('edit-actor-category-3')
    ];

    dropdowns.forEach(dropdown => {
        dropdown.innerHTML = '<option value="">Select Category</option>'; // Clear existing options
        categoryOptions.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.textContent = option;
            dropdown.appendChild(opt);
        });
    });
}

// Call this function when the page loads
document.addEventListener('DOMContentLoaded', () => {
    populateCategoryDropdowns();
});

document.getElementById('cancel-edit-actor').addEventListener('click', closeEditActorModal);

async function loadActorList() {
    try {
        const actors = await fetchAPI('actors', 'GET');
        const actorList = document.getElementById('actors');
        actorList.innerHTML = ''; // Clear the list

        actors.forEach(actor => {
            // Add the dataUrl field to point to the actor's data.json file
            actor.dataUrl = `http://127.0.0.1:8000/static/actors/actor_${actor.id}/data.json`;

            const listItem = document.createElement('li');
            listItem.textContent = actor.name;

            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.addEventListener('click', () => openEditActorModal(actor));
            listItem.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.addEventListener('click', () => deleteActor(actor.id));
            listItem.appendChild(deleteButton);

            actorList.appendChild(listItem);
        });
    } catch (error) {
        console.error('Error loading actor list:', error);
    }
}

async function loadHoplrLink() {
    try {
        const response = await fetch('http://127.0.0.1:8000/config/hoplr-link');
        const data = await response.json();

        if (data.hoplr_page_link) {
            document.getElementById('hoplr-link').value = data.hoplr_page_link;
        } else {
            console.error('Hoplr link not configured.');
        }
    } catch (error) {
        console.error('Error loading Hoplr link:', error);
        alert('Failed to load Hoplr link.');
    }
}

async function saveHoplrLink(event) {
    event.preventDefault();

    const hoplrLink = document.getElementById('hoplr-link').value;

    try {
        const response = await fetch('http://127.0.0.1:8000/config/set-hoplr-link', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hoplr_page_link: hoplrLink })
        });

        if (response.ok) {
            alert('Hoplr link updated successfully!');
        } else {
            throw new Error('Failed to update Hoplr link.');
        }
    } catch (error) {
        console.error('Error saving Hoplr link:', error);
        alert('Failed to save Hoplr link.');
    }
}

async function loadDevelopers() {
    try {
        const response = await fetch('http://127.0.0.1:8000/config/developers');
        const data = await response.json();

        const developerList = document.getElementById('developer-list');
        developerList.innerHTML = ''; // Clear the list

        data.developers.forEach(email => {
            const listItem = document.createElement('li');
            listItem.textContent = email;

            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.addEventListener('click', async () => {
                await removeDeveloper(email);
            });

            listItem.appendChild(removeButton);
            developerList.appendChild(listItem);
        });
    } catch (error) {
        console.error('Error loading developers:', error);
        alert('Failed to load developers.');
    }
}

async function addDeveloper(event) {
    event.preventDefault();

    const email = document.getElementById('developer-email').value;

    if (!email.trim()) {
        alert('Developer email is required.');
        return;
    }

    console.log(`Adding developer: ${email}`); // Debugging

    try {
        const response = await fetch('http://127.0.0.1:8000/config/add-developer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }) // Send email as JSON
        });

        if (response.ok) {
            alert('Developer added successfully!');
            document.getElementById('add-developer-form').reset(); // Clear the form
            await loadDevelopers(); // Reload the developer list
        } else {
            const errorData = await response.json();
            console.error('Error response:', errorData); // Debugging
            throw new Error(errorData.detail || 'Failed to add developer.');
        }
    } catch (error) {
        console.error('Error adding developer:', error);
        alert('Failed to add developer.');
    }
}

async function removeDeveloper(email) {
    try {
        const response = await fetch(`http://127.0.0.1:8000/config/developers?email=${encodeURIComponent(email)}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('Developer removed successfully!');
            await loadDevelopers(); // Reload the developer list
        } else {
            throw new Error('Failed to remove developer.');
        }
    } catch (error) {
        console.error('Error removing developer:', error);
        alert('Failed to remove developer.');
    }
}

document.getElementById('add-developer-form').addEventListener('submit', addDeveloper);

document.getElementById('edit-actor-images').addEventListener('change', (event) => {
    const previewContainer = document.getElementById('image-preview');
    previewContainer.innerHTML = ''; // Clear existing previews

    const files = event.target.files;
    for (const file of files) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.style.width = '100px';
        img.style.height = '100px';
        img.style.margin = '5px';
        previewContainer.appendChild(img);
    }
});

document.getElementById('edit-actor-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const actorId = document.getElementById('edit-actor-modal').dataset.actorId;
    if (!actorId) {
        console.error('Actor ID is missing');
        return;
    }

    const name = document.getElementById('edit-actor-name').value;
    const description = document.getElementById('edit-actor-description').value;
    const order = document.getElementById('edit-actor-order').value;
    const categories = [
        document.getElementById('edit-actor-category-1').value,
        document.getElementById('edit-actor-category-2').value,
        document.getElementById('edit-actor-category-3').value,
    ];
    const xPosition = parseFloat(document.getElementById('edit-actor-x-position').value);
    const yPosition = parseFloat(document.getElementById('edit-actor-y-position').value);
    const audioFile = document.getElementById('edit-actor-audio-file').files[0];
    const imageFiles = document.getElementById('edit-actor-images').files;
    const iconFile = document.getElementById('edit-actor-icon').files[0];

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('order', order);
    formData.append('categories', JSON.stringify(categories));
    formData.append('x_position', xPosition);
    formData.append('y_position', yPosition);
    if (audioFile) {
        formData.append('audio', audioFile);
    }
    for (const image of imageFiles) {
        formData.append('images', image);
    }
    if (iconFile) {
        formData.append('icon', iconFile);
    }

    try {
        const response = await fetchAPI(`actors/${actorId}`, 'PUT', formData, true);
        alert('Actor updated successfully!');
        closeEditActorModal();
        loadActors();
    } catch (error) {
        console.error('Error updating actor:', error);
        alert('Failed to update actor.');
    }
});

document.getElementById('edit-actor-icon').addEventListener('change', (event) => {
    const previewContainer = document.getElementById('icon-preview');
    previewContainer.innerHTML = ''; // Clear existing preview

    const file = event.target.files[0];
    if (file) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.style.width = '100px';
        img.style.height = '100px';
        img.style.margin = '5px';
        previewContainer.appendChild(img);
    }
});

async function loadLockCalendarStatus() {
    try {
        const response = await fetch('http://127.0.0.1:8000/config/lock-calendar');
        const data = await response.json();

        const statusElement = document.getElementById('lock-calendar-status');
        statusElement.textContent = `Status: ${data.lock_calendar ? 'Locked' : 'Unlocked'}`;
    } catch (error) {
        console.error('Error loading Lock Calendar status:', error);
        alert('Failed to load Lock Calendar status.');
    }
}

async function toggleLockCalendar() {
    try {
        const response = await fetch('http://127.0.0.1:8000/config/toggle-lock-calendar', {
            method: 'PUT'
        });
        const data = await response.json();

        const statusElement = document.getElementById('lock-calendar-status');
        statusElement.textContent = `Status: ${data.lock_calendar ? 'Locked' : 'Unlocked'}`;
        alert(`Lock Calendar is now ${data.lock_calendar ? 'Locked' : 'Unlocked'}.`);
    } catch (error) {
        console.error('Error toggling Lock Calendar:', error);
        alert('Failed to toggle Lock Calendar.');
    }
}

document.getElementById('toggle-lock-calendar-btn').addEventListener('click', toggleLockCalendar);