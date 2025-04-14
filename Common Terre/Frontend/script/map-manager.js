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
export async function mergeImages(categories) {
    const canvas = document.createElement('canvas');
    canvas.width = 300; // Totale breedte van de samengevoegde afbeelding
    canvas.height = 100; // Hoogte van de afbeelding
    const ctx = canvas.getContext('2d');

    const imageWidth = canvas.width / categories.length; // Breedte van elke afbeelding

    for (let i = 0; i < categories.length; i++) {
        const img = new Image();
        img.src = `res/images/eigenschappen/${categories[i]}.png`; // Pad naar de categorie-afbeeldingen
        await new Promise((resolve) => {
            img.onload = () => {
                ctx.drawImage(img, i * imageWidth, 0, imageWidth, canvas.height);
                resolve();
            };
        });
    }

    return canvas.toDataURL(); // Geef de samengevoegde afbeelding als een data-URL terug
}

// Functie om acteur-iconen op de kaart te plaatsen
export async function placeIconsOnMap(map, actors) {
    map.innerHTML = ''; // Clear existing icons on the map

    console.log(`Map dimensions: width=${map.offsetWidth}px, height=${map.offsetHeight}px`);

    for (const actor of actors) {
        console.log(`Placing actor: ${actor.name}, x: ${actor.x_position}%, y: ${actor.y_position}%`);

        const iconUrl = await mergeImages(actor.categories);

        const icon = document.createElement('img');
        icon.src = iconUrl;
        icon.style.position = 'absolute'; // Position relative to the map container
        icon.style.left = `${actor.x_position}%`; // Use percentage for horizontal positioning
        icon.style.top = `${actor.y_position}%`; // Use percentage for vertical positioning
        icon.style.transform = 'translate(-50%, -50%)'; // Center the icon at the position
        icon.style.width = '50px'; // Adjust icon size
        icon.style.height = '50px';
        icon.style.cursor = 'pointer';
        icon.alt = actor.name;

        // Add hover text with name and categories
        const keywords = actor.categories.join(', ');
        icon.title = `${actor.name}\n${keywords}`; // Use the title attribute for hover text

        // Redirect to the actor's page on click
        icon.addEventListener('click', () => {
            window.location.href = `actor-details.html?id=${actor.id}`;
        });

        map.appendChild(icon);
    }
}