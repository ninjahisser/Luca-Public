import { fetchAPI } from './api.js';
import { initializeMap, placeIconsOnMap } from './map-manager.js';

document.addEventListener('DOMContentLoaded', async () => {
    const map = initializeMap(); // Replace with the path to your map image
    await loadActors(map); // Ensure this is awaited
    document.getElementById('add-actor-form').addEventListener('submit', addActor);
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
    event.preventDefault();
    const name = document.getElementById('actor-name').value;

    try {
        await fetchAPI('actors', 'POST', { name });
        alert('Actor added successfully!');
        loadActors(); // Refresh the actor list
    } catch (error) {
        console.error('Error adding actor:', error);
        if (error.response) {
            console.error('Error details:', await error.response.text());
        }
        alert('Failed to add actor.');
    }
}

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

async function openEditActorModal(actor) {
    try {
        if (!actor.dataUrl) {
            console.error(`Actor "${actor.name}" is missing a dataUrl.`);
            alert('Failed to load actor details: Missing data URL.');
            return;
        }

        console.log(`Fetching actor details from: ${actor.dataUrl}`);
        const response = await fetch(actor.dataUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch actor details. HTTP status: ${response.status}`);
        }

        const detailedActor = await response.json();

        // Populate the edit modal with the detailed actor data
        document.getElementById('edit-actor-name').value = detailedActor.name;
        document.getElementById('edit-actor-description').value = detailedActor.description || '';
        document.getElementById('edit-actor-order').value = detailedActor.order || 'IMAGE, DESCRIPTION, EMPTY_SPACE';

        const hasAudio = !!detailedActor.audio; // Check if audio exists
        document.getElementById('edit-actor-audio').checked = hasAudio;
        document.getElementById('edit-actor-audio-file').style.display = hasAudio ? 'block' : 'none';

        const categories = detailedActor.categories || [];
        document.getElementById('edit-actor-category-1').value = categories[0] || '';
        document.getElementById('edit-actor-category-2').value = categories[1] || '';
        document.getElementById('edit-actor-category-3').value = categories[2] || '';

        document.getElementById('edit-actor-x-position').value = detailedActor.x_position || 50;
        document.getElementById('x-position-value').textContent = `${detailedActor.x_position || 50}%`;

        document.getElementById('edit-actor-y-position').value = detailedActor.y_position || 50;
        document.getElementById('y-position-value').textContent = `${detailedActor.y_position || 50}%`;

        const modal = document.getElementById('edit-actor-modal');
        modal.dataset.actorId = detailedActor.id; // Set the actor ID
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error fetching detailed actor data:', error);
        alert('Failed to load actor details.');
    }
}

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
    const hasAudio = document.getElementById('edit-actor-audio').checked;
    const audioFile = hasAudio ? document.getElementById('edit-actor-audio-file').files[0] : null;
    const categories = [
        document.getElementById('edit-actor-category-1').value,
        document.getElementById('edit-actor-category-2').value,
        document.getElementById('edit-actor-category-3').value,
    ];
    const xPosition = parseFloat(document.getElementById('edit-actor-x-position').value);
    const yPosition = parseFloat(document.getElementById('edit-actor-y-position').value);

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
        alert('Actor updated successfully!');
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