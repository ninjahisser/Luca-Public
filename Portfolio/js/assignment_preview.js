function previewItem(item) {
    const preview = document.getElementById('assignment_preview');
    const title = item.querySelector('.assignment-title')?.textContent || 'Geen titel';
    const src = item.getAttribute('data-preview');

    // Toon loader + titel
    preview.innerHTML = `
        <div id="preview_title">${title}</div>
        <div class="loader"></div>
    `;

    let element;

    if (src.endsWith('.mp4')) {
        element = document.createElement('video');
        element.src = src;
        element.autoplay = true;
        element.loop = true;
        element.muted = false;
        element.controls = false;

        element.addEventListener('loadeddata', () => {
            element.classList.add('loaded');
            preview.querySelector('.loader')?.remove();
        });

    } else if (src.includes("vimeo.com") || src.includes("youtube.com") || src.includes("youtu.be")) {
        element = document.createElement('iframe');
        element.src = src;
        element.width = "100%";
        element.height = "100%";
        element.frameBorder = "0";
        element.allow = "autoplay; fullscreen; picture-in-picture";
        element.allowFullscreen = true;

        // direct toevoegen, fade-in met CSS
        setTimeout(() => {
            element.classList.add('loaded');
            preview.querySelector('.loader')?.remove();
        }, 500); // halve seconde delay
    } else {
        element = new Image();
        element.src = src;
        element.onload = () => {
            element.classList.add('loaded');
            preview.querySelector('.loader')?.remove();
        };
    }

    element.style.display = "block";
    element.style.width = "100%";
    element.style.maxHeight = "60vh";
    element.style.objectFit = "contain";
    preview.appendChild(element);
}



document.querySelectorAll('#assignment_list li').forEach(item => {
    item.addEventListener('mouseenter', function() {
        previewItem(this);
    });
});

// Show first by default
const firstItem = document.querySelector('#assignment_list li[data-preview]');
if (firstItem) {
    previewItem(firstItem);
}
