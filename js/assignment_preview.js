const previewElementCache = new Map();
const warmedPreviewSources = new Set();
const workToolsCache = new Map();
let currentPreviewSrc = "";
let currentPreviewKey = "";

function normalizeToolName(value) {
    return (value || "").toLowerCase().replace(/[^a-z0-9+]+/g, "").trim();
}

function getToolIconUrl(toolName) {
    const catalog = {
        adobeaftereffects: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/aftereffects/aftereffects-original.svg",
        adobecreativecloud: "https://api.iconify.design/simple-icons:adobecreativecloud.svg",
        creativecloud: "https://api.iconify.design/simple-icons:adobecreativecloud.svg",
        photoshop: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/photoshop/photoshop-original.svg",
        illustrator: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/illustrator/illustrator-original.svg",
        adobexd: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/xd/xd-original.svg",
        xd: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/xd/xd-original.svg",
        aftereffects: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/aftereffects/aftereffects-original.svg",
        premierepro: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/premierepro/premierepro-original.svg",
        lightroom: "https://www.adobe.com/content/dam/shared/images/product-icons/svg/lightroom.svg",
        audition: "https://www.adobe.com/content/dam/shared/images/product-icons/svg/audition.svg",
        animate: "https://www.adobe.com/content/dam/shared/images/product-icons/svg/animate.svg",
        blender: "https://cdn.simpleicons.org/blender/F5792A",
        unrealengine: "https://api.iconify.design/simple-icons:unrealengine.svg",
        cascadeur: "https://api.iconify.design/mdi:human-handsup.svg?color=%23007ACC",
        aseprite: "https://api.iconify.design/simple-icons:aseprite.svg",
        comfyui: "https://comfy.org/icons/logo.svg",
        github: "https://cdn.simpleicons.org/github/181717",
        vscode: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vscode/vscode-original.svg",
        visualstudio: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/visualstudio/visualstudio-plain.svg",
        c: "https://cdn.simpleicons.org/cplusplus/00599C",
        "c++": "https://cdn.simpleicons.org/cplusplus/00599C",
        cpp: "https://cdn.simpleicons.org/cplusplus/00599C",
        python: "https://cdn.simpleicons.org/python/3776AB",
        steamworks: "https://cdn.simpleicons.org/steam/000000",
        figma: "https://cdn.simpleicons.org/figma/F24E1E",
        html: "https://cdn.simpleicons.org/html5/E34F26",
        css: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg",
        javascript: "https://cdn.simpleicons.org/javascript/F7DF1E",
        p5js: "https://api.iconify.design/simple-icons:p5dotjs.svg",
        lottiefiles: "https://api.iconify.design/simple-icons:lottiefiles.svg",
        browserextension: "https://api.iconify.design/mdi:extension.svg",
        ai: "https://api.iconify.design/mdi:robot.svg",
        motiongraphics: "https://api.iconify.design/mdi:animation-play.svg",
        vectoranimation: "https://api.iconify.design/mdi:draw.svg",
        audioreactiveanimation: "https://api.iconify.design/mdi:waveform.svg",
        animation: "https://api.iconify.design/mdi:animation.svg",
        wireframe: "https://api.iconify.design/mdi:vector-polyline.svg",
        redesign: "https://api.iconify.design/mdi:auto-fix.svg",
        webaudioapi: "https://api.iconify.design/mdi:waveform.svg",
        audiocomposition: "https://api.iconify.design/mdi:music-note.svg",
        "3dmodeling": "https://api.iconify.design/mdi:cube-outline.svg",
        "3danimation": "https://api.iconify.design/mdi:cube-scan.svg",
        sounddesign: "https://api.iconify.design/mdi:music-note.svg",
        handtracking: "https://api.iconify.design/mdi:hand-back-left.svg",
        customwebapp: "https://api.iconify.design/mdi:web.svg",
        photography: "https://api.iconify.design/mdi:camera-outline.svg",
        graphicdesign: "https://api.iconify.design/mdi:palette-outline.svg",
        printdesign: "https://api.iconify.design/mdi:printer-3d.svg",
        metahuman: "https://api.iconify.design/mdi:account-outline.svg",
        filmmaking: "https://api.iconify.design/mdi:filmstrip.svg",
        videoediting: "https://api.iconify.design/mdi:movie-edit-outline.svg",
        unrealengine5: "https://api.iconify.design/simple-icons:unrealengine.svg"
    };

    const normalized = normalizeToolName(toolName);
    if (catalog[normalized]) {
        return catalog[normalized];
    }

    if (normalized.indexOf('adobe') === 0) {
        const fallback = normalized.replace(/^adobe/, '');
        if (catalog[fallback]) {
            return catalog[fallback];
        }
    }

    return "https://api.iconify.design/mdi:tag-outline.svg";
}

function buildPreviewToolsMarkup(tools) {
    if (!tools || !tools.length) {
        return '<div id="preview_tools" class="work-tools"></div>';
    }

    return `
        <div id="preview_tools" class="work-tools">
            ${tools.map(function (tool) {
                const iconUrl = getToolIconUrl(tool);
                return `<span class="work-tool" data-tool="${tool}" style="--tool-icon:url('${iconUrl}')">${tool}</span>`;
            }).join('')}
        </div>
    `;
}

function extractToolsFromDocument(doc) {
    const tools = [];
    const nodes = doc ? doc.querySelectorAll('#work_tools .work-tool') : [];
    Array.from(nodes || []).forEach(function (node) {
        const label = (node.textContent || '').trim();
        if (label) {
            tools.push(label);
        }
    });
    return tools.length ? tools : [];
}

async function loadPreviewTools(href, src) {
    const preview = document.getElementById('assignment_preview');
    const toolsContainer = preview ? preview.querySelector('#preview_tools') : null;
    if (!preview || !toolsContainer) {
        return;
    }

    let tools = [];

    if (href) {
        if (workToolsCache.has(href)) {
            tools = workToolsCache.get(href);
        } else {
            try {
                const response = await fetch(href, { cache: 'no-store' });
                if (response.ok) {
                    const html = await response.text();
                    const doc = new DOMParser().parseFromString(html, 'text/html');
                    tools = extractToolsFromDocument(doc);
                    workToolsCache.set(href, tools);
                }
            } catch (error) {
                tools = [];
            }
        }
    }

    if (!tools.length) {
        toolsContainer.remove();
        return;
    }

    if (src !== currentPreviewSrc) {
        return;
    }

    toolsContainer.outerHTML = buildPreviewToolsMarkup(tools);
}

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
    const link = item.closest('a[href]');
    const href = link ? link.getAttribute('href') : null;
    const previewKey = (src || '') + '|' + (href || '');
    const isFavorite = item.classList.contains('favorites');

    if (!src || previewKey === currentPreviewKey) {
        return;
    }
    currentPreviewSrc = src;
    currentPreviewKey = previewKey;

    preview.innerHTML = `
        <div id="preview_title" class="${isFavorite ? 'favorite' : ''}">${title}</div>
        ${description ? `<div id="preview_description" class="${isFavorite ? 'favorite' : ''}">${description}</div>` : ''}
        ${buildPreviewToolsMarkup(null)}
        <div class="loader"></div>
    `;

    if (href) {
        loadPreviewTools(href, src);
    }

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
