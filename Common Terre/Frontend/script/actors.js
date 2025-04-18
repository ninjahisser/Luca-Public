import { initializeMap, placeIconsOnMap } from './map.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log('actors.js loaded and running.');

    const actorList = document.getElementById('actor-list');
    const mapImage = document.getElementById('map-image');

    if (!actorList || !mapImage) {
        console.error('Actor list container or map image not found.');
        return;
    }

    // Initialize the map
    initializeMap();

    try {
        // Fetch actor names from the backend
        console.log('Attempting to fetch actor names...');
        const response = await fetch('http://127.0.0.1:8000/actors/names');
        console.log('Fetch response:', response);

        if (!response.ok) {
            throw new Error(`Failed to fetch actor names. HTTP status: ${response.status}`);
        }

        const actors = await response.json();
        console.log('Actor names fetched successfully:', actors);

        if (actors.length === 0) {
            actorList.innerHTML = '<li>Geen actoren beschikbaar.</li>';
            return;
        }

        // Populate the actor list
        actors.forEach(actor => {
            const listItem = document.createElement('li');
            const actorLink = document.createElement('a');
            actorLink.href = `actor-details.html?id=${actor.id}`;
            actorLink.textContent = actor.name;

            listItem.appendChild(actorLink);
            actorList.appendChild(listItem);
        });

        // Place icons on the map
        placeIconsOnMap(actors);
    } catch (error) {
        console.error('Error loading actor names:', error);
        actorList.innerHTML = '<li>Fout bij het laden van actoren.</li>';
    }
});