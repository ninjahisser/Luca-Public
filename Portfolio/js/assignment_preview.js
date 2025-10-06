function previewItem(item) {
    const preview = document.getElementById('assignment_preview');
    const title = item.querySelector('.assignment-title')?.textContent || 'Geen titel';
    const src = item.getAttribute('data-preview');

    if (src) {
        if (src.endsWith('.mp4')) {
            // Local or self-hosted video
            preview.innerHTML = `
                <div id="preview_title">${title}</div>
                <video src="${src}" autoplay loop muted controls></video>
            `;
        } else if (src.includes("vimeo.com") || src.includes("youtube.com") || src.includes("youtu.be")) {
            // Vimeo or YouTube embed
            preview.innerHTML = `
                <div id="preview_title">${title}</div>
                <iframe src="${src}" width="560" height="315" 
                        frameborder="0" allow="autoplay; fullscreen; picture-in-picture" 
                        allowfullscreen></iframe>
            `;
        } else {
            // Images or other
            preview.innerHTML = `
                <div id="preview_title">${title}</div>
                <img src="${src}" alt="preview">
            `;
        }
    } else {
        preview.innerHTML = `<div id="preview_title">${title}</div>`;
    }
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
