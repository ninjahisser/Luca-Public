const previewElementCache = new Map();
const workToolsCache = new Map();
let currentPreviewSrc = "";
let currentPreviewKey = "";

function convertToYouTubeEmbed(urlStr, isPreview) {
    if (!urlStr) return urlStr;
    const trimmed = urlStr.trim();
    if (trimmed.includes("youtube.com") || trimmed.includes("youtu.be") || trimmed.includes("youtube-nocookie.com")) {
        try {
            const shortsMatch = trimmed.match(/(?:\/shorts\/|vi\/)([a-zA-Z0-9_-]{11})/);
            let videoId = "";
            let isShort = false;
            if (shortsMatch && shortsMatch[1]) {
                videoId = shortsMatch[1];
                isShort = true;
            } else if (trimmed.includes("youtu.be/")) {
                const parts = trimmed.split("youtu.be/");
                if (parts[1]) {
                    videoId = parts[1].split(/[?#]/)[0];
                }
            } else {
                const urlObj = new URL(trimmed);
                if (urlObj.searchParams.has("v")) {
                    videoId = urlObj.searchParams.get("v");
                } else {
                    const embedParts = urlObj.pathname.split("/embed/");
                    if (embedParts[1]) {
                        videoId = embedParts[1].split(/[?#]/)[0];
                    }
                }
            }

            if (videoId) {
                if (trimmed.includes("short=1") || trimmed.includes("/shorts/")) {
                    isShort = true;
                }

                const params = new URLSearchParams();

                if (!isPreview) {
                    const qIdx = trimmed.indexOf("?");
                    if (qIdx !== -1) {
                        const origParams = new URLSearchParams(trimmed.substring(qIdx));
                        origParams.delete("v");
                        origParams.forEach((val, key) => {
                            params.set(key, val);
                        });
                    }
                }

                if (isPreview) {
                    params.set("autoplay", "1");
                    params.set("mute", "1");
                    params.set("loop", "1");
                    params.set("playlist", videoId);
                    params.set("controls", "0");
                    params.set("modestbranding", "1");
                    params.set("iv_load_policy", "3");
                    params.set("rel", "0");
                    params.set("disablekb", "1");
                    params.set("fs", "0");
                    params.set("playsinline", "1");
                    params.set("enablejsapi", "1");
                }

                const queryStr = params.toString();
                const embedHost = isShort ? 'www.youtube.com' : 'www.youtube-nocookie.com';
                return `https://${embedHost}/embed/${videoId}${queryStr ? "?" + queryStr : ""}`;
            }
        } catch (e) {
            console.error("Error converting YouTube URL:", e);
        }
    }
    return trimmed;
}

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
        unrealengine5: "https://api.iconify.design/simple-icons:unrealengine.svg",
        programming: "https://api.iconify.design/mdi:code-braces.svg",
        gameplay: "https://api.iconify.design/mdi:gamepad-variant-outline.svg",
        multiplayer: "https://api.iconify.design/mdi:account-group-outline.svg",
        anticheat: "https://api.iconify.design/mdi:shield-account-outline.svg",
        steam: "https://cdn.simpleicons.org/steam/000000",
        acescolorspace: "https://api.iconify.design/mdi:palette-swatch-outline.svg"
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

function isKnownImageExt(src) {
    return /\.(png|jpg|jpeg|webp|gif|svg|avif|bmp|tif|tiff)$/i.test(src);
}

function isKnownVideoExt(src) {
    return /\.(mp4|webm|ogg|mov|avi)$/i.test(src);
}

function isLikelyVideoSrc(src) {
    if (isKnownVideoExt(src)) return true;
    if (src.indexOf('images/uploads/') !== -1 && !isKnownImageExt(src)) return true;
    if (src.indexOf('videos/uploads/') !== -1 && !isKnownImageExt(src)) return true;
    return false;
}

function buildPreviewElement(src, onReady) {
    let mediaElement;

    if (isLikelyVideoSrc(src)) {
        mediaElement = document.createElement('video');
        mediaElement.src = src;
        mediaElement.autoplay = true;
        mediaElement.setAttribute('autoplay', '');
        mediaElement.loop = true;
        mediaElement.setAttribute('loop', '');
        mediaElement.muted = true;
        mediaElement.setAttribute('muted', '');
        mediaElement.playsInline = true;
        mediaElement.controls = false;
        mediaElement.preload = 'auto';
        mediaElement.addEventListener('loadeddata', onReady, { once: true });
    } else if (src.includes('vimeo.com') || src.includes('youtube.com') || src.includes('youtu.be') || src.includes('youtube-nocookie.com')) {
        mediaElement = document.createElement('iframe');
        const isShortUrl = src.includes('/shorts/') || src.includes('short=1');
        const cleanSrc = convertToYouTubeEmbed(src, true);
        mediaElement.src = cleanSrc;
        mediaElement.width = '100%';
        mediaElement.height = '100%';
        mediaElement.frameBorder = '0';
        mediaElement.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        mediaElement.allowFullscreen = true;
        mediaElement.loading = 'eager';
        
        if (isShortUrl) {
            mediaElement.style.aspectRatio = '9/16';
            mediaElement.style.maxWidth = '320px';
            mediaElement.style.margin = '0 auto';
        } else {
            mediaElement.style.aspectRatio = '16/9';
        }
        
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

function preloadVideo(item, src) {
    var el = document.createElement('video');
    el.className = 'preview-video';
    el.src = src;
    el.muted = true;
    el.playsInline = true;
    el.preload = 'auto';
    el.controls = false;
    el.removeAttribute('controls');
    el.addEventListener('loadeddata', function onReady() {
        el.removeEventListener('loadeddata', onReady);
        item.classList.add('preview-video-ready');
    });
    item.appendChild(el);
    item.classList.add('has-preview-video');
}

function markPreviewReady(item) {
    if (!item) return;
    item.classList.add('preview-video-ready');
}

function wirePreviewReadiness(item, video, timeoutMs) {
    if (!item || !video) return;
    var ready = false;
    var timer = window.setTimeout(function () {
        if (!ready) {
            ready = true;
            markPreviewReady(item);
        }
    }, timeoutMs || 1800);

    function finish() {
        if (ready) return;
        ready = true;
        window.clearTimeout(timer);
        markPreviewReady(item);
    }

    video.addEventListener('loadedmetadata', finish, { once: true });
    video.addEventListener('canplay', finish, { once: true });
    video.addEventListener('playing', finish, { once: true });
    video.addEventListener('loadeddata', finish, { once: true });
}

function startPreviewPlayback(video) {
    if (!video || !video.play) return;
    video.preload = 'auto';
    var promise = video.play();
    if (promise && promise.catch) {
        promise.catch(function () {
            video.muted = true;
            video.play().catch(function () {});
        });
    }
}

function loadToolsOverlay(item) {
    var href = item.getAttribute('href');
    if (!href || item.querySelector('.work-card-tools-overlay')) return;
    
    var cacheKey = 'tools:' + href;
    if (workToolsCache.has(cacheKey)) {
        var tools = workToolsCache.get(cacheKey);
        if (tools && tools.length > 0) {
            appendToolsOverlay(item, tools);
        }
        return;
    }
    
    fetch(href, { cache: 'force-cache' }).then(function (r) { return r.text(); }).catch(function () { return ''; }).then(function (html) {
        if (!html) return;
        var tempDoc = new DOMParser().parseFromString(html, 'text/html');
        var toolsRoot = tempDoc.getElementById('work_tools');
        var tools = [];
        if (toolsRoot) {
            Array.from(toolsRoot.querySelectorAll('a, li, span, .work-tool') || []).forEach(function (node) {
                var label = (node.textContent || '').trim();
                if (label && tools.indexOf(label) === -1) tools.push(label);
            });
            if (!tools.length) {
                (toolsRoot.textContent || '').split(/\s*[\n,|/]+\s*/).forEach(function (label) {
                    var trimmed = (label || '').trim();
                    if (trimmed && tools.indexOf(trimmed) === -1) tools.push(trimmed);
                });
            }
        }
        workToolsCache.set(cacheKey, tools);
        if (tools.length > 0) {
            appendToolsOverlay(item, tools);
        }
    }).catch(function () {});
}

function appendToolsOverlay(item, tools) {
    if (!tools || !tools.length || item.querySelector('.work-card-tools-overlay')) return;
    var overlay = document.createElement('div');
    overlay.className = 'work-card-tools-overlay';
    
    tools.slice(0, 5).forEach(function (tool) {
        var iconUrl = getToolIconUrl(tool);
        var icon = document.createElement('img');
        icon.src = iconUrl;
        icon.alt = tool;
        icon.title = tool;
        overlay.appendChild(icon);
    });
    
    item.appendChild(overlay);
    item.classList.add('has-tools-overlay');
}

function setupChunkedVideo(item, metaPath) {
    var basePath = metaPath.substring(0, metaPath.lastIndexOf('/') + 1);
    loadToolsOverlay(item);

    function mountDirectPreview(directSrc) {
        var elX = document.createElement('video');
        elX.className = 'preview-video';
        elX.src = directSrc;
        elX.loop = true;
        elX.setAttribute('loop', '');
        elX.muted = true;
        elX.setAttribute('muted', '');
        elX.playsInline = true;
        elX.preload = 'auto';
        elX.controls = false;
        wirePreviewReadiness(item, elX, 1500);
        var startX = parseFloat(item.getAttribute('data-preview-start'));
        if (startX > 0) {
            elX.addEventListener('loadedmetadata', function onMeta() {
                elX.removeEventListener('loadedmetadata', onMeta);
                elX.currentTime = startX;
            });
        }
        item.appendChild(elX);
        item.classList.add('has-preview-video');
        startPreviewPlayback(elX);
    }

    fetch(metaPath).then(function (r) { return r.json(); }).then(function (meta) {
        function toUrl(path) {
            if (!path) return '';
            if (/^https?:\/\//i.test(path) || path.indexOf('/') === 0) return path;
            return basePath + path;
        }

        var compressed = toUrl(meta.index_preview || meta.indexPreview || meta.preview_mp4 || meta.preview);
        if (compressed) {
            mountDirectPreview(compressed);
            return null;
        }

        if (meta.chunks && meta.chunks.length === 1 && /\.(mp4|webm|ogg|mov|avi)$/i.test(meta.chunks[0].path || '')) {
            mountDirectPreview(toUrl(meta.chunks[0].path));
            return null;
        }

        // No compressed hover preview (e.g. index-preview generation failed
        // during upload - non-fatal by design, see create_index_preview in
        // scripts/download_video.py) and more than one raw chunk: prefer
        // the full-length low-bitrate proxy over downloading every raw
        // source chunk in full. Those chunks are the original quality
        // source, up to ~100MB each with no cap on how many - fetching all
        // of them just to drive a small looping homepage hover preview
        // could mean hundreds of MB to multiple GB per hover.
        var fullPreview = toUrl(meta.full_preview);
        if (fullPreview) {
            mountDirectPreview(fullPreview);
            return null;
        }

        var fetches = meta.chunks.map(function (c) {
            return fetch(basePath + c.path).then(function (r) { return r.arrayBuffer(); });
        });
        return Promise.all(fetches);
    }).then(function (buffers) {
        if (!buffers) {
            return;
        }
        var blob = new Blob(buffers, { type: 'video/mp4' });
        var url = URL.createObjectURL(blob);
        var el = document.createElement('video');
        el.className = 'preview-video';
        el.src = url;
        el.loop = true;
        el.setAttribute('loop', '');
        el.muted = true;
        el.setAttribute('muted', '');
        el.playsInline = true;
        el.preload = 'auto';
        el.controls = false;
        wirePreviewReadiness(item, el, 1500);
        var startTime = parseFloat(item.getAttribute('data-preview-start'));
        if (startTime > 0) {
            el.addEventListener('loadedmetadata', function onMeta() {
                el.removeEventListener('loadedmetadata', onMeta);
                el.currentTime = startTime;
            });
        }
        item.appendChild(el);
        item.classList.add('has-preview-video');
        startPreviewPlayback(el);
    }).catch(function (err) {
        console.error('Chunked video load failed:', metaPath, err);
    });
}

function setupCardVideo(item) {
    var src = item.getAttribute('data-preview');
    loadToolsOverlay(item);
    if (!src) return;
    if (item.querySelector('.preview-video')) return;
    if (src.indexOf('metadata.json') !== -1) {
        setupChunkedVideo(item, src);
        return;
    }
    if (!isLikelyVideoSrc(src) && !src.match(/vimeo\.com|youtube\.com|youtu\.be|youtube-nocookie\.com/)) return;

    var isYt = src.match(/youtube\.com|youtu\.be|youtube-nocookie\.com/);
    if (isYt) item.classList.add('yt-preview');

    var el = getPreviewElement(src, function () {
        if (!item.contains(el)) return;
        el.classList.add('loaded');
    });

    if (el.tagName === 'VIDEO') {
        el.className = 'preview-video';
        el.controls = false;
        el.removeAttribute('controls');
        el.preload = 'auto';
        wirePreviewReadiness(item, el, 1500);
        var startTime = parseFloat(item.getAttribute('data-preview-start'));
        if (startTime > 0) {
            el.addEventListener('loadedmetadata', function onMeta() {
                el.removeEventListener('loadedmetadata', onMeta);
                el.currentTime = startTime;
            });
        }
        item.appendChild(el);
        item.classList.add('has-preview-video');
        startPreviewPlayback(el);
    } else if (el.tagName === 'IFRAME') {
        el.className = 'preview-video';
        el.style.pointerEvents = 'none';
        var srcToSet = el.getAttribute('src');
        var startTime = parseFloat(item.getAttribute('data-preview-start'));
        if (startTime > 0) {
            if (srcToSet.indexOf('vimeo.com') !== -1) {
                srcToSet += '#t=' + startTime;
            } else if (srcToSet.indexOf('youtube.com') !== -1 || srcToSet.indexOf('youtu.be') !== -1 || srcToSet.indexOf('youtube-nocookie.com') !== -1) {
                srcToSet += '&start=' + startTime;
            }
        }
        el.removeAttribute('src');
        el.addEventListener('load', function onFrameLoad() {
            el.removeEventListener('load', onFrameLoad);
            markPreviewReady(item);
            sendIframeCommand(el, 'play');
        });
        item.appendChild(el);
        el.setAttribute('src', srcToSet);
        item.classList.add('has-preview-video');
    }
}

function sendIframeCommand(iframe, cmd) {
    var src = iframe.src || '';
    try {
        if (src.indexOf('vimeo.com') !== -1) {
            iframe.contentWindow.postMessage(JSON.stringify({method: cmd}), '*');
        } else if (src.indexOf('youtube.com') !== -1 || src.indexOf('youtu.be') !== -1 || src.indexOf('youtube-nocookie.com') !== -1) {
            var playerCmd = cmd === 'pause' ? 'pauseVideo' : 'playVideo';
            iframe.contentWindow.postMessage(JSON.stringify({event: 'command', func: playerCmd, args: ''}), '*');
        }
    } catch (e) {}
}

var allCards = Array.from(document.querySelectorAll('#assignment_list .work-card:not(.hidden-work)'));
var activeCard = null;

function activateCard(card) {
    if (!card) return;
    if (card === activeCard) {
        var existing = card.querySelector('.preview-video');
        if (existing && existing.tagName === 'VIDEO') {
            startPreviewPlayback(existing);
        } else if (existing && existing.tagName === 'IFRAME') {
            sendIframeCommand(existing, 'play');
        }
        return;
    }
    if (activeCard) {
        activeCard.removeAttribute('data-active-preview');
    }
    activeCard = card;
    activeCard.setAttribute('data-active-preview', 'true');
    setupCardVideo(card);
    var v = card.querySelector('.preview-video');
    if (v && v.tagName === 'VIDEO') {
        startPreviewPlayback(v);
    }
    else if (v && v.tagName === 'IFRAME') sendIframeCommand(v, 'play');
}

/* card whose vertical center is closest to the viewport center */
function mostCenteredCard() {
    var mid = window.innerHeight / 2;
    var best = null;
    var bestDist = Infinity;
    allCards.forEach(function (card) {
        var r = card.getBoundingClientRect();
        if (r.bottom <= 0 || r.top >= window.innerHeight) return;
        var dist = Math.abs((r.top + r.bottom) / 2 - mid);
        if (dist < bestDist) { bestDist = dist; best = card; }
    });
    return best;
}

function setupAllCards() {
    allCards.forEach(function (card, idx) {
        loadToolsOverlay(card);
        setupCardVideo(card);
    });
    allCards.forEach(function (card) {
        var v = card.querySelector('.preview-video');
        if (v && v.tagName === 'VIDEO') {
            startPreviewPlayback(v);
        } else if (v && v.tagName === 'IFRAME') {
            sendIframeCommand(v, 'play');
        }
    });
    activeCard = allCards[0] || null;
}

function refreshActiveCard() {
    var card = mostCenteredCard();
    if (card) {
        if (activeCard && activeCard !== card) {
            activeCard.removeAttribute('data-active-preview');
        }
        activeCard = card;
        card.setAttribute('data-active-preview', 'true');
        var v = card.querySelector('.preview-video');
        if (v && v.tagName === 'VIDEO') startPreviewPlayback(v);
        else if (v && v.tagName === 'IFRAME') sendIframeCommand(v, 'play');
    }
}

function bindCardWarmupEvents() {
    allCards.forEach(function (card) {
        card.addEventListener('mouseenter', function () {
            loadToolsOverlay(card);
            setupCardVideo(card);
            var v = card.querySelector('.preview-video');
            if (v && v.tagName === 'VIDEO') startPreviewPlayback(v);
        }, { passive: true });

        card.addEventListener('focusin', function () {
            loadToolsOverlay(card);
            setupCardVideo(card);
            var vFocus = card.querySelector('.preview-video');
            if (vFocus && vFocus.tagName === 'VIDEO') startPreviewPlayback(vFocus);
        });
    });
}

var _scrollTicking = false;
window.addEventListener('scroll', function () {
    if (_scrollTicking) return;
    _scrollTicking = true;
    window.requestAnimationFrame(function () {
        refreshActiveCard();
        _scrollTicking = false;
    });
}, { passive: true });

document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
        var card = mostCenteredCard();
        activateCard(card || activeCard || allCards[0] || null);
    }
});

preconnectDomains();
bindCardWarmupEvents();
if ('requestIdleCallback' in window) {
    window.requestIdleCallback(setupAllCards, { timeout: 300 });
} else {
    window.setTimeout(setupAllCards, 50);
}
window.setInterval(refreshActiveCard, 2200);
