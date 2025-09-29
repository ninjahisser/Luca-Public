function previewItem(item) {
    const preview = document.getElementById('assignment_preview');
    const titleDiv = document.getElementById('preview_title');
    const title = item.querySelector('.assignment-title')?.textContent || 'Geen titel';
    titleDiv.textContent = `Previewing: ${title}`;
    preview.style.background = "red"
    const src = item.getAttribute('data-preview');
    if (src) {
        if (src.endsWith('.mp4')) {
            preview.innerHTML = `<div id="preview_title">${title}</div><video src="${src}" autoplay loop muted></video>`;
        } else {
            preview.innerHTML = `<div id="preview_title">${title}</div><img src="${src}" alt="preview">`;
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

// Preview the first found item by default
const firstItem = document.querySelector('#assignment_list li[data-preview]');
if (firstItem) {
    previewItem(firstItem);
}