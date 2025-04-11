import { fetchAPI } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    loadActors();
    document.getElementById('add-actor-form').addEventListener('submit', addActor);
});

async function loadActors() {
    try {
        const actors = await fetchAPI('actors', 'GET');
        const actorList = document.getElementById('actors');
        actorList.innerHTML = ''; // Clear the list

        actors.forEach(actor => {
            const listItem = document.createElement('li');
            listItem.textContent = `${actor.name} - ${actor.role}`;
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.addEventListener('click', () => deleteActor(actor.id));
            listItem.appendChild(deleteButton);
            actorList.appendChild(listItem);
        });
    } catch (error) {
        console.error('Error loading actors:', error);
        alert('Failed to load actors.');
    }
}

async function addActor(event) {
    event.preventDefault();
    const name = document.getElementById('actor-name').value;
    const role = document.getElementById('actor-role').value;

    try {
        await fetchAPI('actors', 'POST', { name, role });
        alert('Actor added successfully!');
        loadActors(); // Refresh the actor list
    } catch (error) {
        console.error('Error adding actor:', error);
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