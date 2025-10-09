document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded event fired.');

    const urlParams = new URLSearchParams(window.location.search);
    const actorId = urlParams.get('id');
    console.log('Actor ID from URL:', actorId);

    if (!actorId) {
        alert('No actor ID provided!');
        console.error('No actor ID provided in the URL.');
        return;
    }

    try {
        // Fetch actor data
        const actorDataUrl = `http://127.0.0.1:8000/static/actors/actor_${actorId}/data.json`;
        console.log('Fetching actor data from:', actorDataUrl);

        const response = await fetch(actorDataUrl);
        console.log('Fetch response:', response);

        if (!response.ok) {
            throw new Error(`Failed to fetch actor details. HTTP status: ${response.status}`);
        }

        const actor = await response.json();
        console.log('Actor data fetched successfully:', actor);

        // Populate the page
        const actorNameElement = document.getElementById('actor-name');
        if (!actorNameElement) {
            console.error('Actor name element not found in the DOM.');
            return;
        }
        actorNameElement.textContent = actor.name;
        console.log('Actor name set to:', actor.name);

        const detailsContainer = document.getElementById('actor-details');
        if (!detailsContainer) {
            console.error('Actor details container not found in the DOM.');
            return;
        }

        const sections = actor.order ? actor.order.split(', ') : ['DESCRIPTION'];
        console.log('Actor sections to render:', sections);

        sections.forEach(section => {
            console.log('Rendering section:', section);
        
            const sectionDiv = document.createElement('div');
            sectionDiv.classList.add('actor-item'); // Apply grid layout styling
        
            if (section === 'IMAGE') {
                if (actor.images && Array.isArray(actor.images)) {
                    const imagesHtml = actor.images.map(imgPath => {
                        const fixedPath = imgPath.replace(/\\/g, '/'); // Replace backslashes
                        const fullUrl = `http://127.0.0.1:8000/static/${fixedPath}`;
                        return `<img src="${fullUrl}" alt="${actor.name}" class="actor-image">`;
                    }).join('');
                    sectionDiv.innerHTML = `<div class="actor-images">${imagesHtml}</div>`;
                } else {
                }
            } else if (section === 'DESCRIPTION') {
                sectionDiv.innerHTML = `<p>${actor.description || 'No description available.'}</p>`;
            } else if (section === 'EMPTY_SPACE') {
                sectionDiv.innerHTML = `<p>&nbsp;</p>`; // Optional: blank space
            }
        
            detailsContainer.appendChild(sectionDiv);
            console.log('Section added to details container:', section);
        });

        // Add audio controls if audio exists and is valid
// Add audio controls if audio exists and is valid
if (actor.audio && actor.audio.trim() !== '') {
    console.log('Actor has a valid audio file:', actor.audio);

    const audioContainer = document.createElement('div');
    audioContainer.classList.add('audio-container');

    const audio = document.createElement('audio');

    // Ensure the audio URL has the correct base URL
    if (!actor.audio.startsWith('http://') && !actor.audio.startsWith('https://')) {
        const baseUrl = 'http://127.0.0.1:8000/static'; // Correct base URL for the FastAPI server
        audio.src = `${baseUrl}/${actor.audio.replace(/\\/g, '/')}`; // Replace backslashes with forward slashes
    } else {
        audio.src = actor.audio; // Use the URL directly if it's already complete
    }

    audio.controls = true;

    audioContainer.appendChild(audio);
    detailsContainer.appendChild(audioContainer);
    console.log('Audio controls added to details container.');
} else {
    console.log(`No valid audio file for actor: ${actor.name}`);
}
    } catch (error) {
        console.error('Error loading actor details:', error);
        alert('Failed to load actor details.');
    }
});