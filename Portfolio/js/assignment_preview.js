function previewItem(item) {
    const preview = document.getElementById('assignment_preview');
    const title = item.querySelector('.assignment-title')?.textContent || 'Geen titel';
    const src = item.getAttribute('data-preview');

    // Toon eerst loader
    preview.innerHTML = `
        <div id="preview_title">${title}</div>
        <div class="loader"></div>
    `;

    if (src) {
        if (src.endsWith('.mp4')) {
            const video = document.createElement('video');
            video.src = src;
            video.autoplay = true;
            video.loop = true;
            video.muted = true;
            video.controls = false;

            video.addEventListener('loadeddata', () => {
                preview.innerHTML = `<div id="preview_title">${title}</div>`;
                video.classList.add("loaded");
                preview.appendChild(video);
            });

        } else if (src.includes("vimeo.com") || src.includes("youtube.com") || src.includes("youtu.be")) {
            const iframe = document.createElement('iframe');
            iframe.src = src;
            iframe.width = "560";
            iframe.height = "315";
            iframe.frameBorder = "0";
            iframe.allow = "autoplay; fullscreen; picture-in-picture";
            iframe.allowFullscreen = true;

            iframe.addEventListener('load', () => {
                preview.innerHTML = `<div id="preview_title">${title}</div>`;
                iframe.classList.add("loaded");
                preview.appendChild(iframe);
            });

        } else {
            const img = new Image();
            img.src = src;

            img.onload = () => {
                preview.innerHTML = `<div id="preview_title">${title}</div>`;
                img.classList.add("loaded");
                preview.appendChild(img);
            };
        }
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
