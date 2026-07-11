const previewElementCache = new Map();
const warmedPreviewSources = new Set();
let currentPreviewSrc = "";

function getPreloadHost() {
    let host = document.getElementById('assignment_preview_preload_host');
    if (host) {
        return host;
    }

    host = document.createElement('div');
    host.id = 'assignment_preview_preload_host';
    host.setAttribute('aria-hidden', 'true');
    host.style.position = 'fixed';
    host.style.width = '1px';
    host.style.height = '1px';
    host.style.overflow = 'hidden';
    host.style.opacity = '0';
    host.style.pointerEvents = 'none';
    host.style.bottom = '0';
    host.style.right = '0';
    document.body.appendChild(host);
    return host;
}

function buildPreviewElement(src, onReady) {
    let mediaElement;

    if (src.endsWith('.mp4')) {
        mediaElement = document.createElement('video');
        mediaElement.src = src;
        mediaElement.autoplay = true;
        mediaElement.loop = true;
        mediaElement.muted = true;
        mediaElement.playsInline = true;
        mediaElement.controls = false;
        mediaElement.preload = 'auto';
        mediaElement.addEventListener('loadeddata', onReady, { once: true });
    } else if (src.includes('vimeo.com') || src.includes('youtube.com') || src.includes('youtu.be')) {
        mediaElement = document.createElement('iframe');
        mediaElement.src = src;
        mediaElement.width = '100%';
        mediaElement.height = '100%';
        mediaElement.frameBorder = '0';
        mediaElement.allow = 'autoplay; fullscreen; picture-in-picture';
        mediaElement.allowFullscreen = true;
        mediaElement.loading = 'eager';
        // Iframes do not expose reliable ready state for all providers; remove loader quickly.
        window.setTimeout(onReady, 120);
    } else {
        mediaElement = new Image();
        mediaElement.src = src;
        mediaElement.decoding = 'async';
        mediaElement.loading = 'eager';
        mediaElement.addEventListener('load', onReady, { once: true });
    }

    mediaElement.style.display = 'block';
    mediaElement.style.width = '100%';
    mediaElement.style.maxHeight = '60vh';
    mediaElement.style.objectFit = 'contain';

    return mediaElement;
}

function getPreviewElement(src, onReady) {
    if (previewElementCache.has(src)) {
        const cached = previewElementCache.get(src);
        window.setTimeout(onReady, 0);
        return cached.cloneNode(true);
    }

    const element = buildPreviewElement(src, function () {
        element.classList.add('loaded');
        previewElementCache.set(src, element.cloneNode(true));
        onReady();
    });

    return element;
}

function preconnectDomains() {
    const domains = [
        'https://player.vimeo.com',
        'https://www.youtube.com',
        'https://github.com',
        'https://raw.githubusercontent.com'
    ];

    domains.forEach(function (domain) {
        if (document.head.querySelector('link[rel="preconnect"][href="' + domain + '"]')) {
            return;
        }
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = domain;
        document.head.appendChild(link);
    });
}

function warmPreviewSource(src) {
    if (!src || warmedPreviewSources.has(src)) {
        return;
    }

    warmedPreviewSources.add(src);

    if (src.endsWith('.mp4')) {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        video.src = src;
        getPreloadHost().appendChild(video);
        return;
    }

    if (src.includes('vimeo.com') || src.includes('youtube.com') || src.includes('youtu.be')) {
        preconnectDomains();
        return;
    }

    const image = new Image();
    image.decoding = 'async';
    image.loading = 'eager';
    image.src = src;
}

function warmPreviewCache() {
    const previewItems = Array.from(document.querySelectorAll('#assignment_list li[data-preview]'));
    const maxWarmCount = 3;
    let queueIndex = 0;

    function warmNext() {
        if (queueIndex >= previewItems.length || queueIndex >= maxWarmCount) {
            return;
        }

        const src = previewItems[queueIndex].getAttribute('data-preview');
        queueIndex += 1;
        warmPreviewSource(src);

        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(warmNext, { timeout: 900 });
        } else {
            window.setTimeout(warmNext, 180);
        }
    }

    warmNext();
}

function previewItem(item) {
    const preview = document.getElementById('assignment_preview');
    const title = item.querySelector('.assignment-title')?.textContent || 'Geen titel';
    const description = item.querySelector('.assignment-desc')?.textContent || '';
    const src = item.getAttribute('data-preview');
    const isFavorite = item.classList.contains('favorites');

    if (!src || src === currentPreviewSrc) {
        return;
    }
    currentPreviewSrc = src;

    preview.innerHTML = `
        <div id="preview_title" class="${isFavorite ? 'favorite' : ''}">${title}</div>
        ${description ? `<div id="preview_description" class="${isFavorite ? 'favorite' : ''}">${description}</div>` : ''}
        <div class="loader"></div>
    `;

    const element = getPreviewElement(src, function () {
        if (src !== currentPreviewSrc) {
            return;
        }
        element.classList.add('loaded');
        preview.querySelector('.loader')?.remove();
    });

    preview.appendChild(element);
}

document.querySelectorAll('#assignment_list li[data-preview]').forEach(function (item) {
    item.addEventListener('mouseenter', function () {
        warmPreviewSource(this.getAttribute('data-preview'));
        previewItem(this);
    });
});

preconnectDomains();
if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warmPreviewCache, { timeout: 1200 });
} else {
    window.setTimeout(warmPreviewCache, 500);
}

const firstItem = document.querySelector('#assignment_list li[data-preview]');
if (firstItem) {
    previewItem(firstItem);
}
