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
        const mapRect = mapImage.getBoundingClientRect();
        mapContainer.style.position = 'absolute';
        mapContainer.style.top = `${mapRect.top}px`;
        mapContainer.style.left = `${mapRect.left}px`;
        mapContainer.style.width = `${mapRect.width}px`;
        mapContainer.style.height = `${mapRect.height}px`;
        mapContainer.style.pointerEvents = 'none'; // Allow clicks to pass through to icons
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

export function placeIconsOnMap(mapData) {
    const mapContainer = document.getElementById('map-icons-container');
    const mapImage = document.getElementById('map-image');

    if (!mapContainer || !mapImage) {
        console.error('Map container or image not found.');
        return;
    }

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
    
        const left = (xPos / 100) * mapWidth;
        const top = (yPos / 100) * mapHeight;
    
        console.log(`Placing icon for ${actor.name} at left=${left}px, top=${top}px`);
    
        const icon = document.createElement('div');
        icon.classList.add('map-icon');
        icon.style.position = 'absolute';
        icon.style.left = `${left}px`;
        icon.style.top = `${top}px`;
    
        icon.title = actor.name;
    
        icon.addEventListener('click', () => {
            alert(`Clicked on: ${actor.name}`);
        });
    
        mapContainer.appendChild(icon);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const fullActorData = await fetchFullActorData();
    console.log('Full actor data:', fullActorData);

    initializeMap();
    placeIconsOnMap(fullActorData);
});