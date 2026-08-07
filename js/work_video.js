/* Replace every video embed on a work page (hero + secondary) with the
   optimized chunked videos downloaded by scripts/download_video.py.
   The work name comes from the page filename, e.g. wounds.html ->
   videos/uploads/wounds/metadata.json (hero) and, for secondary embeds,
   videos/uploads/wounds-<videoId>/metadata.json.
   Plays via the site's custom video player (js/video_player.js) when available.
   Falls back to the original embed when no chunked video exists. */
(function () {
    function getWorkName() {
        return (location.pathname.split('/').pop() || '').replace(/\.html?$/i, '');
    }

    function idFromSource(srcUrl) {
        if (!srcUrl) return null;
        var vm = srcUrl.match(/vimeo\.com\/video\/(\d+)/);
        if (vm) return { kind: 'vimeo', id: vm[1] };
        var yt = srcUrl.match(/(?:youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/)|youtu\.be\/|youtube-nocookie\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
        if (yt) return { kind: 'youtube', id: yt[1] };
        var meta = srcUrl.match(/videos\/uploads\/([^/]+)\/metadata\.json(?:[?#].*)?$/i);
        if (meta) return { kind: 'metadata', id: meta[1] };
        var uploadVideo = srcUrl.match(/videos\/uploads\/([^/]+)\/(?:source|preview_360p)\.[a-z0-9]+(?:[?#].*)?$/i);
        if (uploadVideo) return { kind: 'upload', id: uploadVideo[1] };
        var base = (srcUrl.split('?')[0] || '').split('/').pop();
        if (base && /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(base)) return { kind: 'file', id: base };
        return null;
    }

    function fetchJson(url) {
        // no-store: only ever used for metadata.json, which mutates when a
        // video is replaced via the CMS (new chunk/preview filenames, old
        // ones deleted) - a stale cached copy would point at files that no
        // longer exist instead of just showing slightly-old content.
        return fetch(url, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; });
    }

    function mimeForChunk(path) {
        // Chunk filenames look like "source-<ts>.mp4.part003" - strip the
        // ".partNNN" suffix before reading the real extension.
        var base = (path || '').split('?')[0].replace(/\.part\d+$/i, '');
        var ext = (base.split('.').pop() || 'mp4').toLowerCase();
        return ext === 'webm' ? 'video/webm' : ext === 'ogg' ? 'video/ogg' : ext === 'mkv' ? 'video/x-matroska' : 'video/mp4';
    }

    /* The Service Worker (video_stream_sw.js, at the site root so its scope
       covers videos/) presents a work's chunk files as one seekable virtual
       file. With it registered the browser streams that URL natively: it
       range-requests only the bytes around the playhead, buffers ahead on
       its own, and a seek anywhere fetches just that region instead of
       every chunk leading up to it. */
    var STREAM_FILENAME = '__stream__.mp4';
    var streamWorkerPromise = null;

    function ensureStreamWorker() {
        if (streamWorkerPromise) return streamWorkerPromise;

        // register()/.ready can hang forever rather than reject - confirmed
        // e.g. under some SW-blocking policies/extensions, where the
        // returned promise never settles either way. Without an overall
        // timeout that leaves this pending permanently, so the caller's
        // .then() never runs and the <video> is stuck showing its original,
        // unplayable metadata.json src. Race the whole attempt against a
        // hard deadline so a stuck registration always still falls back.
        var timeoutId;
        var deadline = new Promise(function (resolve) {
            timeoutId = setTimeout(function () { resolve(false); }, 2500);
        });

        // Merely reading navigator.serviceWorker can also throw
        // synchronously in some restricted contexts (not just be absent) -
        // guard the whole attempt, not just the async chain, or an uncaught
        // throw here kills the caller before any .catch() ever attaches.
        var attempt;
        try {
            if (!window.isSecureContext || !('serviceWorker' in navigator) || !navigator.serviceWorker) {
                attempt = Promise.resolve(false);
            } else {
                attempt = navigator.serviceWorker
                    .register('video_stream_sw.js', { scope: './' })
                    .then(function () { return navigator.serviceWorker.ready; })
                    .then(function () {
                        // The worker only serves requests from pages it
                        // controls. On a first visit it claims this page
                        // moments after activating, so wait briefly rather
                        // than falling back needlessly.
                        if (navigator.serviceWorker.controller) return true;
                        return new Promise(function (resolve) {
                            var settled = false;
                            function finish(value) {
                                if (settled) return;
                                settled = true;
                                resolve(value);
                            }
                            navigator.serviceWorker.addEventListener('controllerchange', function () {
                                finish(true);
                            });
                            setTimeout(function () {
                                finish(!!navigator.serviceWorker.controller);
                            }, 1500);
                        });
                    })
                    .catch(function () { return false; });
            }
        } catch (e) {
            attempt = Promise.resolve(false);
        }

        streamWorkerPromise = Promise.race([attempt, deadline]).then(function (result) {
            clearTimeout(timeoutId);
            return result;
        });

        return streamWorkerPromise;
    }

    /* Last resort for browsers without Service Worker support on uploads
       that also predate the compressed full-length proxy: fetch every chunk
       and stitch them into one Blob. Correct, but nothing plays until the
       whole file has arrived. */
    function loadAllChunksUrl(meta, basePath, onProgress) {
        var chunks = meta.chunks || [];
        var total = chunks.reduce(function (sum, c) { return sum + (c.size || 0); }, 0);
        var loaded = 0;
        var buffers = [];

        return chunks.reduce(function (chain, chunk) {
            return chain.then(function () {
                return fetch(basePath + chunk.path)
                    .then(function (r) {
                        if (!r.ok) throw new Error('chunk ' + chunk.path + ' ' + r.status);
                        return r.arrayBuffer();
                    })
                    .then(function (buffer) {
                        buffers.push(buffer);
                        loaded += buffer.byteLength;
                        if (onProgress) onProgress(total ? loaded / total : 0);
                    });
            });
        }, Promise.resolve()).then(function () {
            var mime = mimeForChunk(chunks[0] ? chunks[0].path : '');
            return URL.createObjectURL(new Blob(buffers, { type: mime }));
        });
    }

    function resolveMetadataPath(srcUrl, work, heroMeta) {
        if (!srcUrl) return '';
        var directMeta = srcUrl.match(/^(videos\/uploads\/[^/]+\/metadata\.json)(?:[?#].*)?$/i);
        if (directMeta) {
            return directMeta[1];
        }

        var localUpload = srcUrl.match(/^videos\/uploads\/([^/]+)\/(?:source|preview_360p)\.[a-z0-9]+(?:[?#].*)?$/i);
        if (localUpload) {
            return 'videos/uploads/' + localUpload[1] + '/metadata.json';
        }

        var target = idFromSource(srcUrl);
        if (!target) return '';

        if (heroMeta && idFromSource(heroMeta.source_url) && idFromSource(heroMeta.source_url).id === target.id) {
            return 'videos/uploads/' + work + '/metadata.json';
        }

        return 'videos/uploads/' + work + '-' + target.id + '/metadata.json';
    }

    /* Work pages play the full-quality split source (the chunked "existing
       system" that keeps individual files under GitHub's size limit), never
       the compressed index preview — that one is reserved for homepage card
       hover playback (see js/assignment_preview.js). */
    function resolvePreferredUrl(meta) {
        var basePath = 'videos/uploads/' + meta.work_name + '/';
        if (meta.chunks && meta.chunks.length === 1) {
            return { url: basePath + meta.chunks[0].path, kind: 'direct' };
        }
        return { url: '', kind: 'blob' };
    }

    function resolveFallbackPreviewUrl(meta) {
        var basePath = 'videos/uploads/' + meta.work_name + '/';
        var preview = meta.index_preview || meta.indexPreview || meta.preview_mp4 || meta.preview;
        return preview ? basePath + preview : '';
    }

    // Full-length, low-bitrate proxy (see create_full_preview in
    // scripts/download_video.py) - a small single file the browser can seek
    // into instantly via normal HTTP range requests, used as the "jump here
    // now, upgrade once full quality catches up" target for multi-chunk
    // sources. Older uploads made before this feature existed won't have it.
    function resolveFullPreviewUrl(meta) {
        var basePath = 'videos/uploads/' + meta.work_name + '/';
        return meta.full_preview ? basePath + meta.full_preview : '';
    }
    /* The custom player wrapper is absolutely positioned and needs a
       positioned, sized parent. .cms-embed-wrap and bare #showcase_large
       containers are static and collapse once the in-flow embed is removed,
       so give the container a position and a 16:9 aspect ratio. */
    function sizePlayerContainer(wrap, original) {
        var container = wrap.parentNode;
        if (!container) return;
        var cs = window.getComputedStyle(container);
        var needsPosition = cs.position === 'static';
        var needsAspect = !container.clientHeight || container.clientHeight < 50;
        if (needsPosition) container.style.position = 'relative';
        if (needsAspect) {
            container.style.aspectRatio = '16 / 9';
            container.style.overflow = 'hidden';
        }
        if (original && original.style && original.style.maxHeight) {
            wrap.style.maxHeight = original.style.maxHeight;
        }
    }

    function replaceEmbed(el, meta, options) {
        var preferred = resolvePreferredUrl(meta);
        if (preferred.kind === 'blob') {
            return replaceEmbedProgressive(el, meta, options);
        }
        return replaceEmbedDirect(el, meta, options, preferred);
    }

    function replaceEmbedDirect(el, meta, options, preferred) {
        var original = el;
        return Promise.resolve(preferred.url).then(function (sourceUrl) {
            var video = document.createElement('video');

            // Attach the error listener before src is ever set. A failing
            // fetch (e.g. a missing chunk) can resolve fast enough that the
            // 'error' event fires before a listener added after src/DOM
            // insertion/upgrade would be in place, permanently orphaning the
            // player with no fallback ever triggered.
            video.addEventListener('error', function onError() {
                video.removeEventListener('error', onError);
                var fallback = resolveFallbackPreviewUrl(meta);
                if (fallback) {
                    video.src = fallback;
                    video.load();
                    if (options.autoplay) playWithSound(video);
                }
            });

            video.src = sourceUrl;
            video.autoplay = true;
            video.setAttribute('autoplay', '');
            video.loop = true;
            video.setAttribute('loop', '');
            video.playsInline = true;
            video.setAttribute('playsinline', '');
            video.preload = 'auto';
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'contain';

            el.parentNode.replaceChild(video, el);

            var wrap = null;
            if (window.LucaVideoPlayer && window.LucaVideoPlayer.upgrade) {
                wrap = window.LucaVideoPlayer.upgrade(video, options);
            }
            if (wrap) {
                sizePlayerContainer(wrap, original);
            } else {
                video.controls = true;
                if (options.autoplay) playWithSound(video);
            }
            return true;
        });
    }

    /* Multi-chunk source. Preferred path: the Service Worker exposes the
       chunks as one virtual file and the browser streams it natively, so it
       fetches only the parts around the playhead, preloads ahead by itself,
       and seeking anywhere costs one range request instead of downloading
       everything up to that point.

       Without a Service Worker (unsupported browser, insecure context) it
       plays the compressed full-length proxy instead - lower quality, but a
       single small file the browser can seek through natively. Only when
       neither is available does it fall back to fetching every chunk. */
    function replaceEmbedProgressive(el, meta, options) {
        var original = el;
        var basePath = 'videos/uploads/' + meta.work_name + '/';
        var fullPreviewUrl = resolveFullPreviewUrl(meta);

        function mount(sourceUrl, earlyErrorHandler) {
            var video = document.createElement('video');

            // Attach the error listener before src is ever set. A failing
            // fetch (e.g. a missing chunk) can resolve fast enough that the
            // 'error' event fires before a listener added after src/DOM
            // insertion/upgrade would be in place, permanently orphaning the
            // player with no fallback ever triggered.
            if (earlyErrorHandler) {
                video.addEventListener('error', earlyErrorHandler);
            }

            video.src = sourceUrl;
            video.autoplay = true;
            video.setAttribute('autoplay', '');
            video.loop = true;
            video.setAttribute('loop', '');
            video.playsInline = true;
            video.setAttribute('playsinline', '');
            video.preload = 'auto';
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'contain';

            el.parentNode.replaceChild(video, el);

            var wrap = null;
            if (window.LucaVideoPlayer && window.LucaVideoPlayer.upgrade) {
                wrap = window.LucaVideoPlayer.upgrade(video, options);
            }
            if (wrap) {
                sizePlayerContainer(wrap, original);
            } else {
                video.controls = true;
                if (options.autoplay) playWithSound(video);
            }
            return video;
        }

        return ensureStreamWorker().then(function (workerReady) {
            if (workerReady) {
                var video;

                // If the virtual stream fails (worker evicted mid-session, a
                // chunk 404s), drop to the compressed proxy at the same spot
                // rather than leaving a dead player. Uploads made before the
                // full-length proxy existed have no fullPreviewUrl - stitch
                // the chunks into a Blob instead so those still recover.
                video = mount(basePath + STREAM_FILENAME, function onError() {
                    video.removeEventListener('error', onError);
                    var resumeAt = video.currentTime;
                    var wasPlaying = !video.paused;

                    function recoverWith(newSrc) {
                        video.addEventListener('loadedmetadata', function onMeta() {
                            video.removeEventListener('loadedmetadata', onMeta);
                            if (resumeAt > 0) video.currentTime = resumeAt;
                            if (wasPlaying) playWithSound(video);
                        });
                        video.src = newSrc;
                        video.load();
                    }

                    if (fullPreviewUrl) {
                        recoverWith(fullPreviewUrl);
                    } else {
                        loadAllChunksUrl(meta, basePath).then(recoverWith).catch(function () {});
                    }
                });
                return true;
            }

            if (fullPreviewUrl) {
                mount(fullPreviewUrl);
                return true;
            }

            return loadAllChunksUrl(meta, basePath).then(function (blobUrl) {
                mount(blobUrl);
                return true;
            });
        });
    }

    /* Attempt unmuted play; browsers block sound autoplay without a gesture,
       so fall back to muted playback rather than being stuck at volume 0. */
    function playWithSound(video) {
        video.muted = false;
        var p = video.play();
        if (p && p.catch) {
            p.catch(function () {
                video.muted = true;
                video.play().catch(function () {});
            });
        }
    }

    /* Best-effort: when the custom player starts one video, pause any
       remaining <iframe> embeds (Vimeo/YouTube) so only one plays at a time. */
    function pauseRemoteEmbeds() {
        var iframes = document.querySelectorAll('iframe');
        for (var i = 0; i < iframes.length; i += 1) {
            var iframe = iframes[i];
            var src = iframe.getAttribute('src') || '';
            if (!iframe.contentWindow) continue;
            try {
                if (src.indexOf('vimeo.com') !== -1) {
                    iframe.contentWindow.postMessage(JSON.stringify({ method: 'pause' }), '*');
                } else if (src.indexOf('youtube-nocookie.com') !== -1 ||
                           src.indexOf('youtube.com') !== -1 ||
                           src.indexOf('youtu.be') !== -1) {
                    iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                }
            } catch (e) {}
        }
    }
    window.addEventListener('lvp:play', pauseRemoteEmbeds);

    function convertAll() {
        var work = getWorkName();
        var heroMeta = null;
        return fetchJson('videos/uploads/' + work + '/metadata.json').then(function (hero) {
            heroMeta = hero;
            var embeds = Array.prototype.slice.call(document.querySelectorAll('iframe, video'));
            var jobs = [];
            for (var i = 0; i < embeds.length; i++) {
                (function (el) {
                    var options = { autoplay: true };
                    var src = el.getAttribute('src') || '';
                    var metaPath = resolveMetadataPath(src, work, heroMeta);
                    if (!metaPath) return;
                    var metaPromise = fetchJson(metaPath);
                    jobs.push(metaPromise.then(function (meta) {
                        if (!meta) return;
                        return replaceEmbed(el, meta, options);
                    }));
                })(embeds[i]);
            }
            return Promise.all(jobs);
        }).catch(function () {
            // no hero chunked video yet; keep all original embeds
        });
    }

    // Start registering up front: the worker has to be controlling the page
    // before the virtual stream URL resolves, so the sooner it activates the
    // less chance of falling back to the compressed proxy on a first visit.
    ensureStreamWorker();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', convertAll);
    } else {
        convertAll();
    }
})();
