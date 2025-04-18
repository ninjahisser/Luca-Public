

function setMapContainerSize(mapContainer, mapImage) {
    const mapRect = mapImage.getBoundingClientRect();
    console.log(`Map image dimensions: width=${mapRect.width}, height=${mapRect.height}`);
    mapContainer.style.position = 'absolute';
    mapContainer.style.top = `${mapRect.top}px`;
    mapContainer.style.left = `${mapRect.left}px`;
    mapContainer.style.width = `${mapRect.width}px`;
    mapContainer.style.height = `${mapRect.height}px`;
    mapContainer.style.pointerEvents = 'none'; // Allow clicks to pass through to icons
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