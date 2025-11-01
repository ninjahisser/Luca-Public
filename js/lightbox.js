/* lightbox.js — gallery-enabled lightbox with thumbnails
   Behavior:
   - Builds a gallery from all .fotos_grid img elements (uses data-full if present)
   - Click thumbnail or grid image to open at that index
   - Prev/Next buttons and arrow keys navigate images
   - Thumbnails show at bottom and scroll into view
   - Close via close button, backdrop click, or ESC
*/

document.addEventListener('DOMContentLoaded', function () {
    const lb = document.getElementById('lightbox');
    const lbBackdrop = document.getElementById('lb-backdrop');
    const lbImage = document.getElementById('lb-image');
    const lbCaption = document.getElementById('lb-caption');
    const lbClose = document.getElementById('lb-close');
    const lbPrev = document.getElementById('lb-prev');
    const lbNext = document.getElementById('lb-next');
    const lbThumbs = document.getElementById('lb-thumbs');

    // gather images from the page
    const galleryImgs = Array.from(document.querySelectorAll('.fotos_grid img'));
    if (!galleryImgs.length) return; // nothing to do
    // Ensure page images are lazy-loaded for performance
    galleryImgs.forEach(img => { img.loading = 'lazy'; });

    const items = galleryImgs.map(img => ({
        thumb: img.src,
        full: img.dataset.full || img.src,
        alt: img.alt || img.getAttribute('title') || ''
    }));

    let currentIndex = 0;

    // build thumbnails inside modal
    items.forEach((it, idx) => {
        const t = document.createElement('div');
        t.className = 'thumb';
        t.dataset.index = idx;
        const im = document.createElement('img');
        im.src = it.thumb;
        // thumbnail images in the lightbox can be lazy loaded
        im.loading = 'lazy';
        im.alt = it.alt || `Image ${idx+1}`;
        t.appendChild(im);
        t.addEventListener('click', (e) => {
            openAtIndex(idx);
        });
        lbThumbs.appendChild(t);
    });

    function setActiveThumb(idx){
        const previous = lbThumbs.querySelector('.thumb.selected');
        if (previous) previous.classList.remove('selected');
        const sel = lbThumbs.querySelector(`.thumb[data-index='${idx}']`);
        if (sel) {
            sel.classList.add('selected');
            // ensure selected thumbnail is visible
            sel.scrollIntoView({behavior:'smooth', inline: 'center', block: 'nearest'});
        }
    }

    function openAtIndex(idx){
        currentIndex = idx;
        const it = items[idx];
        lbImage.src = it.full;
        lbImage.alt = it.alt;
        lbCaption.textContent = it.alt || '';
        lb.classList.add('open');
        lb.setAttribute('aria-hidden', 'false');
        setActiveThumb(idx);
        // focus the close button so keyboard users can easily close
        lbClose.focus();
        document.addEventListener('keydown', onKeydown);
    }

    function closeLightbox(){
        lb.classList.remove('open');
        lb.setAttribute('aria-hidden', 'true');
        lbImage.src = '';
        lbCaption.textContent = '';
        document.removeEventListener('keydown', onKeydown);
        // try to restore focus to originating thumbnail if possible
        const pageImg = galleryImgs[currentIndex];
        if (pageImg) pageImg.focus?.();
    }

    function prev(){
        const nextIndex = (currentIndex - 1 + items.length) % items.length;
        openAtIndex(nextIndex);
    }
    function next(){
        const nextIndex = (currentIndex + 1) % items.length;
        openAtIndex(nextIndex);
    }

    function onKeydown(e){
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowLeft') prev();
        else if (e.key === 'ArrowRight') next();
    }

    // Attach click handlers to page images to open the gallery
    galleryImgs.forEach((img, idx) => {
        // make thumbnails focusable for accessibility
        img.tabIndex = 0;
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', () => openAtIndex(idx));
        img.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAtIndex(idx); } });
    });

    // prev/next buttons
    lbPrev.addEventListener('click', (e) => { e.stopPropagation(); prev(); });
    lbNext.addEventListener('click', (e) => { e.stopPropagation(); next(); });

    // close button
    lbClose.addEventListener('click', (e) => { e.stopPropagation(); closeLightbox(); });

    // clicking backdrop (outside stage) closes
    lbBackdrop.addEventListener('click', (e) => {
        // if clicked directly on backdrop or outside stage
        if (e.target === lbBackdrop) closeLightbox();
    });

    // prevent clicks on stage from bubbling to backdrop
    const stage = document.querySelector('.lb-stage');
    if (stage) stage.addEventListener('click', (e) => e.stopPropagation());

    // initial thumbnail selection not set until open

});
