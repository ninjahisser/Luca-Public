// Functie om de kaart te initialiseren
export function initializeMap() {
    const map = document.getElementById('map'); // Select the existing #map div
    if (!map) {
        console.error('Map container (#map) not found in the DOM.');
        return null;
    }

    // Ensure the map has the correct styles
    map.style.position = 'relative';
    map.style.width = '600px'; // Adjust width as needed
    map.style.height = '600px'; // Adjust height as needed
    map.style.backgroundSize = 'contain';
    map.style.backgroundRepeat = 'no-repeat';
    map.style.backgroundPosition = 'center';

    return map; // Return the existing map element
}

// Functie om afbeeldingen samen te voegen op basis van categorieën
export async function mergeImages(categories = []) {
    const firstCategory = categories[0]; // Use only the first category
    if (!firstCategory) {
        console.warn('First category is undefined.');
        return 'path/to/placeholder.png'; // Return a placeholder image URL
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 100; // Set canvas width
    canvas.height = 100; // Set canvas height

    const img = new Image();
    img.src = `res/images/eigenschappen/${firstCategory}.png`; // Path to the first category image
    await new Promise((resolve) => {
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height); // Draw the image to fill the canvas
            resolve();
        };
    });

    return canvas.toDataURL(); // Return the image as a data URL
}

// Functie om acteur-iconen op de kaart te plaatsen
export async function placeIconsOnMap(map, actors) {
    map.innerHTML = ''; // Clear existing icons on the map

    console.log(`Map dimensions: width=${map.offsetWidth}px, height=${map.offsetHeight}px`);

    for (const actor of actors) {
        console.log(`Placing actor: ${actor.name}, x: ${actor.x_position}%, y: ${actor.y_position}%`);

        // Ensure categories is defined and not empty
        const categories = actor.categories || [];
        if (categories.length === 0) {
            console.warn(`Actor "${actor.name}" has no categories.`);
        }

        const iconUrl = await mergeImages(categories);

        const icon = document.createElement('img');
        icon.src = iconUrl || 'path/to/placeholder.png'; // Use a placeholder if no image is generated
        icon.style.position = 'absolute'; // Position relative to the map container
        icon.style.left = `${actor.x_position ?? 50}%`; // Default to 50% if x_position is undefined
        icon.style.top = `${actor.y_position ?? 50}%`; // Default to 50% if y_position is undefined
        icon.style.transform = 'translate(-50%, -50%)'; // Center the icon at the position
        icon.style.width = '50px'; // Adjust icon size
        icon.style.height = '50px';
        icon.style.cursor = 'pointer';
        icon.alt = actor.name;

        // Add hover text with name and categories
        const keywords = categories.join(', ');
        icon.title = `${actor.name}\n${keywords}`; // Use the title attribute for hover text

        // Redirect to the actor's page on click
        icon.addEventListener('click', () => {
            window.location.href = `actor-details.html?id=${actor.id}`;
        });

        map.appendChild(icon);
    }
}