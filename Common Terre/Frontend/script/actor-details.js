document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const actorId = urlParams.get('id');

    if (!actorId) {
        alert('No actor ID provided!');
        return;
    }

    try {
        // Fetch actor data
        const response = await fetch(`http://127.0.0.1:8000/static/actors/actor_${actorId}/data.json`);
        const actor = await response.json();

        // Populate the page
        document.getElementById('actor-name').textContent = actor.name;

        const detailsContainer = document.getElementById('actor-details');
        const sections = actor.order.split(', '); // Split the order into sections

        sections.forEach(section => {
            const sectionDiv = document.createElement('div');
            sectionDiv.classList.add('actor-section');

            if (section === 'IMAGE') {
                sectionDiv.textContent = 'Image placeholder (to be implemented)';
            } else if (section === 'DESCRIPTION') {
                sectionDiv.textContent = actor.description;
            } else if (section === 'EMPTY_SPACE') {
                sectionDiv.textContent = 'Empty space';
            }

            detailsContainer.appendChild(sectionDiv);
        });

        // Add audio controls if audio exists
        if (actor.audio) {
            const audioContainer = document.createElement('div');
            audioContainer.classList.add('audio-container');

            const audio = document.createElement('audio');
            audio.src = actor.audio;
            audio.controls = true;

            audioContainer.appendChild(audio);
            detailsContainer.appendChild(audioContainer);
        }
    } catch (error) {
        console.error('Error loading actor details:', error);
        alert('Failed to load actor details.');
    }
});