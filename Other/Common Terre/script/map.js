// filepath: f:\LUCA-2\Luca-Public\Common Terre\Frontend\script\map.js
export function initializeMap() {
    const mapContainer = document.getElementById('map-icons-container');
    const mapImage = document.getElementById('map-image');

    if (!mapContainer || !mapImage) {
        console.error('Map container or image not found.');
        return;
    }

    // Function to update the map container size and position
    function updateMapContainer() {
        const mapImage = document.getElementById('map-image');
        const mapContainer = document.getElementById('map-icons-container');
    
        if (!mapImage || !mapContainer) {
            console.error('Map image or container not found.');
            return;
        }
    
        // Get the bounding rectangle of the map image
        const mapRect = mapImage.getBoundingClientRect();
    
        // Update the map container to match the map image's position and size
        mapContainer.style.position = 'absolute';
        mapContainer.style.top = `${mapRect.top + window.scrollY}px`; // Account for scrolling
        mapContainer.style.left = `${mapRect.left + window.scrollX}px`; // Account for scrolling
        mapContainer.style.width = `${mapRect.width}px`;
        mapContainer.style.height = `${mapRect.height}px`;
        mapContainer.style.pointerEvents = 'none'; // Allow clicks to pass through to icons
    
        console.log(`Updated map container: top=${mapContainer.style.top}, left=${mapContainer.style.left}, width=${mapContainer.style.width}, height=${mapContainer.style.height}`);
    }

    // Initial update
    updateMapContainer();

    // Update on window resize
    window.addEventListener('resize', updateMapContainer);
}

export async function fetchFullActorData() {
    try {
        // Fetch the list of actors
        const response = await fetch('http://127.0.0.1:8000/actors/names');
        const actors = await response.json();

        // Fetch full data for each actor
        const fullActorData = await Promise.all(
            actors.map(async actor => {
                const actorResponse = await fetch(`http://127.0.0.1:8000/static/actors/actor_${actor.id}/data.json`);
                const actorData = await actorResponse.json();
                return { ...actor, ...actorData }; // Merge basic and full actor data
            })
        );

        return fullActorData;
    } catch (error) {
        console.error('Error fetching full actor data:', error);
        return [];
    }
}

let storedMapData = []; // Store map data globally for recalculating positions

export function placeIconsOnMap(mapData) {
    const mapContainer = document.getElementById('map-icons-container');
    const mapImage = document.getElementById('map-image');

    if (!mapContainer || !mapImage) {
        console.error('Map container or image not found.');
        return;
    }

    // Store the map data globally for recalculating positions
    storedMapData = mapData;

    // Clear existing icons
    mapContainer.innerHTML = '';

    // Get the dimensions and position of the map image
    const mapRect = mapImage.getBoundingClientRect();
    const mapWidth = mapRect.width;
    const mapHeight = mapRect.height;

    console.log(`Map dimensions: width=${mapWidth}, height=${mapHeight}`);

    // Place each icon on the map
    mapData.forEach(actor => {
        const xPos = actor.x_position || 0; // Default to 0 if undefined
        const yPos = actor.y_position || 0; // Default to 0 if undefined

        console.log(`Actor: ${actor.name}, x_position: ${xPos}, y_position: ${yPos}`);

        if (isNaN(xPos) || isNaN(yPos)) {
            console.error(`Invalid position for actor: ${actor.name}`);
            return;
        }

        console.log(`Placing icon for ${actor.name} at left=${xPos}px, top=${yPos}px`);

        const icon = document.createElement('div');
        icon.classList.add('map-icon');
        icon.style.position = 'absolute';
        icon.style.left = `${xPos}%`;
        icon.style.top = `${yPos}%`;

        // Use the actor's icon as the background image
        if (actor.icon) {
            // Replace backslashes with forward slashes and construct the correct URL
            const sanitizedIconPath = actor.icon.replace(/\\/g, '/');
            const url = new URL(window.location.origin); // Parse the current origin
            url.port = '8000'; // Set the correct port
            icon.style.backgroundImage = `url(${url.origin}/static/${sanitizedIconPath})`;
            icon.style.backgroundSize = 'cover';
            icon.style.backgroundPosition = 'center';
            icon.style.width = '50px'; // Set a default size for the icon
            icon.style.height = '50px'; // Set a default size for the icon
            icon.style.borderRadius = '50%'; // Make the icon circular
        } else {
            console.warn(`No icon found for actor: ${actor.name}`);
        }

        icon.title = actor.name;

        // Redirect to the actor's page when clicked
        icon.addEventListener('click', () => {
            window.location.href = `/actor-details.html?id=${actor.id}`;
        });

        mapContainer.appendChild(icon);
    });
}

function updateIconPositions() {
    const mapContainer = document.getElementById('map-icons-container');
    const mapImage = document.getElementById('map-image');

    if (!mapContainer || !mapImage) {
        console.error('Map container or image not found.');
        return;
    }

    // Get the updated dimensions and position of the map image
    const mapRect = mapImage.getBoundingClientRect();
    const mapWidth = mapRect.width;
    const mapHeight = mapRect.height;

    console.log(`Updated map dimensions: width=${mapWidth}, height=${mapHeight}`);

    // Update each icon's position
    Array.from(mapContainer.children).forEach((icon, index) => {
        const actor = storedMapData[index];
        const xPos = actor.x_position || 0;
        const yPos = actor.y_position || 0;

        let left = xPos;
        let top = yPos;

        icon.style.left = `${left}%`;
        icon.style.top = `${top}%`;
    });
}

window.addEventListener('resize', updateIconPositions);

document.addEventListener('DOMContentLoaded', async () => {
    const fullActorData = await fetchFullActorData();
    console.log('Full actor data:', fullActorData);

    initializeMap();
    placeIconsOnMap(fullActorData);
});