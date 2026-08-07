/* Custom video player in the site's style.
   Upgrades a <video> element with custom controls (no native controls):
   - center PLAY button, bottom control bar (PAUSE/PLAY, timeline, time,
     volume slider, LOOP, FULL fullscreen)
   - click anywhere on video to toggle play/pause
   - drag-to-seek on the timeline, arrow keys jump +-5s, space toggles,
     M mutes, F fullscreen
   - loading motion shown while the video buffers (including initial load)
   - auto-pause when out of viewport, resume when scrolled back
   Sound is ON by default: it attempts unmuted autoplay, and only falls back
   to muted autoplay when the browser blocks it (then unmutes on first
   user interaction anywhere on the page). */
(function () {
    'use strict';

    var PREFIX = 'lvp';
    var DEBUG_VIDEO = /(?:\?|&)debug=video(?:&|$)/.test(window.location.search) || /debug-video/.test(window.location.hash) || window.localStorage.getItem('lvpDebug') === '1';
    var debugHud = null;
    var debugZone = null;
    var PLAY_ZONE_TOP_RATIO = 0.18;
    var PLAY_ZONE_BOTTOM_RATIO = 0.82;

    function getViewportHeight() {
        return window.innerHeight || document.documentElement.clientHeight || 0;
    }

    function getPlayZoneBounds() {
        var vh = getViewportHeight();
        return {
            top: Math.round(vh * PLAY_ZONE_TOP_RATIO),
            bottom: Math.round(vh * PLAY_ZONE_BOTTOM_RATIO),
            height: Math.round(vh * (PLAY_ZONE_BOTTOM_RATIO - PLAY_ZONE_TOP_RATIO)),
            vh: vh
        };
    }

    function visibleVerticalRatio(rect) {
        var vh = getViewportHeight();
        if (!rect || rect.height <= 0 || vh <= 0) return 0;
        var visible = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
        return visible / rect.height;
    }

    function isInPlayZone(rect) {
        var zone = getPlayZoneBounds();
        if (!rect || rect.height <= 0 || zone.vh <= 0) return false;
        var center = rect.top + (rect.height / 2);
        return visibleVerticalRatio(rect) >= 0.35 && center >= zone.top && center <= zone.bottom;
    }

    function ensureDebugHud() {
        if (!DEBUG_VIDEO || debugHud) return debugHud;
        debugHud = document.createElement('div');
        debugHud.style.cssText = 'position:fixed;top:12px;right:12px;z-index:999999;max-width:min(420px,calc(100vw - 24px));padding:10px 12px;background:rgba(0,0,0,0.82);color:#d7ffd9;font:12px/1.35 monospace;border:1px solid rgba(120,255,140,0.35);box-shadow:0 12px 40px rgba(0,0,0,0.35);pointer-events:none;white-space:pre-wrap;';
        document.body.appendChild(debugHud);

        var topBand = document.createElement('div');
        topBand.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999998;background:rgba(255,90,90,0.12);border-bottom:1px dashed rgba(255,120,120,0.6);pointer-events:none;';
        document.body.appendChild(topBand);

        var bottomBand = document.createElement('div');
        bottomBand.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:999998;background:rgba(255,90,90,0.12);border-top:1px dashed rgba(255,120,120,0.6);pointer-events:none;';
        document.body.appendChild(bottomBand);

        var activeBand = document.createElement('div');
        activeBand.style.cssText = 'position:fixed;left:0;right:0;z-index:999997;background:rgba(80,255,160,0.06);border-top:1px solid rgba(80,255,160,0.35);border-bottom:1px solid rgba(80,255,160,0.35);pointer-events:none;';
        document.body.appendChild(activeBand);

        var centerLine = document.createElement('div');
        centerLine.style.cssText = 'position:fixed;left:0;right:0;height:0;z-index:999999;border-top:1px dashed rgba(255,255,255,0.45);pointer-events:none;';
        document.body.appendChild(centerLine);

        debugZone = { topBand: topBand, bottomBand: bottomBand, activeBand: activeBand, centerLine: centerLine };
        updateDebugZone();
        window.addEventListener('resize', updateDebugZone);
        return debugHud;
    }

    function updateDebugZone() {
        if (!DEBUG_VIDEO || !debugZone) return;
        var zone = getPlayZoneBounds();
        debugZone.topBand.style.height = zone.top + 'px';
        debugZone.bottomBand.style.height = Math.max(0, zone.vh - zone.bottom) + 'px';
        debugZone.activeBand.style.top = zone.top + 'px';
        debugZone.activeBand.style.height = zone.height + 'px';
        debugZone.centerLine.style.top = Math.round(zone.vh / 2) + 'px';
    }

    function updateDebugHud(lines) {
        if (!DEBUG_VIDEO) return;
        var hud = ensureDebugHud();
        if (!hud) return;
        hud.textContent = lines.join('\n');
    }

    /* All upgraded players on the page. Whenever one starts playing, the
       others are paused so only a single video is audible at a time. */
    var players = [];

    function pauseAllOthers(wrap) {
        for (var i = 0; i < players.length; i += 1) {
            var p = players[i];
            if (p.wrap === wrap || !p.video) continue;
            if (!p.video.paused) {
                p.video.pause();
            }
        }
        if (typeof window.CustomEvent === 'function' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('lvp:play'));
        }
    }

    function fmtTime(sec) {
        if (!isFinite(sec) || sec < 0) sec = 0;
        var m = Math.floor(sec / 60);
        var s = Math.floor(sec % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function isMostlyInView(node) {
        if (!node || !node.getBoundingClientRect) return true;
        return isInPlayZone(node.getBoundingClientRect());
    }

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function upgrade(video, options) {
        options = options || {};
        if (!video || video._lvp) return video;
        var parent = video.parentNode;
        if (!parent) return video;

        video._lvp = true;
        video.controls = false;
        video.removeAttribute('controls');
        video.classList.add(PREFIX + '-video');

        var wrap = el('div', PREFIX);
        wrap.style.position = 'absolute';
        wrap.style.top = '0';
        wrap.style.left = '0';
        wrap.style.width = '100%';
        wrap.style.height = '100%';
        wrap.tabIndex = 0;

        var center = el('div', PREFIX + '-center');
        var loading = el('div', PREFIX + '-loading');
        for (var si = 0; si < 4; si += 1) {
            loading.appendChild(el('span', PREFIX + '-loading-square'));
        }
        var loadingText = el('span', PREFIX + '-loading-text', '');
        var playBtn = el('button', PREFIX + '-playbtn', 'PLAY');
        playBtn.type = 'button';
        center.appendChild(playBtn);

        var bar = el('div', PREFIX + '-bar');

        var togglePlay = el('button', PREFIX + '-btn', 'PAUSE');
        togglePlay.type = 'button';
        var progress = el('div', PREFIX + '-progress');
        progress.tabIndex = 0;
        var bufferFill = el('div', PREFIX + '-progress-buffer');
        var fill = el('div', PREFIX + '-progress-fill');
        progress.appendChild(bufferFill);
        progress.appendChild(fill);
        var timeEl = el('span', PREFIX + '-time', '0:00 / 0:00');
        var volume = el('div', PREFIX + '-volume');
        var volSlider = el('input', PREFIX + '-vol');
        volSlider.type = 'range';
        volSlider.min = '0';
        volSlider.max = '1';
        volSlider.step = '0.05';
        volSlider.value = '1';
        volSlider.setAttribute('aria-label', 'Volume');
        volume.appendChild(volSlider);
        var loopBtn = el('button', PREFIX + '-btn', 'LOOP');
        loopBtn.type = 'button';
        var fullBtn = el('button', PREFIX + '-btn', 'FULL');
        fullBtn.type = 'button';

        bar.appendChild(togglePlay);
        bar.appendChild(progress);
        bar.appendChild(timeEl);
        bar.appendChild(volume);
        bar.appendChild(loopBtn);
        bar.appendChild(fullBtn);

        parent.replaceChild(wrap, video);
        wrap.appendChild(video);
        wrap.appendChild(center);
        wrap.appendChild(loading);
        wrap.appendChild(loadingText);
        wrap.appendChild(bar);
        players.push({ wrap: wrap, video: video });

        /* Track whether the user intended the video to be playing,
           so we can resume after viewport re-entry or buffer stall. */
        var intendedPlay = false;
                var resumeOnReentry = false;
                var observer = null;

        function setPlayUI() {
            togglePlay.textContent = video.paused ? 'PLAY' : 'PAUSE';
            playBtn.textContent = video.paused ? 'PLAY' : 'PAUSE';
            center.classList.toggle(PREFIX + '-hidden', !video.paused);
        }

        function setVolumeUI() {
            var muted = video.muted || video.volume === 0;
            volSlider.value = String(muted ? 0 : video.volume);
            volume.classList.toggle(PREFIX + '-muted', muted);
        }

        function setLoopUI() {
            loopBtn.classList.toggle(PREFIX + '-active', video.loop);
        }

        function setLoading(show) {
            loading.classList.toggle(PREFIX + '-show', !!show);
            if (!show) {
                loadingText.textContent = '';
                return;
            }
            if (!(video.duration > 0)) {
                loadingText.textContent = 'Loading...';
            }
        }

        function syncLoadingState() {
            var shouldShow = video.readyState < 2 || !(video.duration > 0);
            setLoading(shouldShow);
            if (shouldShow) {
                updateLoadProgress();
            }
        }

        function updateLoadProgress() {
            var b = video.buffered;
            var dur = video.duration || 0;
            if (b.length && dur > 0) {
                var loaded = b.end(b.length - 1);
                var pct = Math.round((loaded / dur) * 100);
                if (pct < 100) {
                    loadingText.textContent = pct + '%';
                } else {
                    loadingText.textContent = '';
                }
            }
        }

        function updateProgress() {
            var dur = video.duration || 0;
            var cur = video.currentTime || 0;
            timeEl.textContent = fmtTime(cur) + ' / ' + fmtTime(dur);
            if (dur > 0) {
                fill.style.width = ((cur / dur) * 100) + '%';
            }
        }

        /* White "downloaded so far" bar behind the playback fill. With the
           streaming Service Worker the browser range-requests around the
           playhead, so buffered ranges may not start at 0 - draw the range
           holding the playhead rather than assuming it begins at the start. */
        function updateBuffer() {
            var b = video.buffered;
            var dur = video.duration || 0;
            if (!b.length || !(dur > 0)) {
                bufferFill.style.width = '0%';
                return;
            }
            var cur = video.currentTime || 0;
            var start = b.start(0);
            var end = b.end(b.length - 1);
            for (var i = 0; i < b.length; i += 1) {
                if (cur >= b.start(i) - 0.5 && cur <= b.end(i) + 0.5) {
                    start = b.start(i);
                    end = b.end(i);
                    break;
                }
            }
            bufferFill.style.left = ((start / dur) * 100) + '%';
            bufferFill.style.width = (((end - start) / dur) * 100) + '%';
        }

        function togglePlayback() {
            if (video.paused) {
                intendedPlay = true;
                resumeOnReentry = true;
                video.play().catch(function () {});
            } else {
                intendedPlay = false;
                resumeOnReentry = false;
                video.pause();
            }
        }

        function startAutoplayAttempt() {
            if (options.muted) {
                intendedPlay = true;
                resumeOnReentry = true;
                video.muted = true;
                video.play().catch(function () {});
                return;
            }
            startWithSound();
            resumeOnReentry = true;
        }

        function seekTo(clientX) {
            var rect = progress.getBoundingClientRect();
            if (!rect.width) return;
            var ratio = (clientX - rect.left) / rect.width;
            if (ratio < 0) ratio = 0;
            if (ratio > 1) ratio = 1;
            if (video.duration > 0) {
                video.currentTime = ratio * video.duration;
                updateProgress();
            }
        }

        function seekBy(delta) {
            if (!(video.duration > 0)) return;
            var t = (video.currentTime || 0) + delta;
            if (t < 0) t = 0;
            if (t > video.duration) t = video.duration;
            video.currentTime = t;
            updateProgress();
        }

        function setFullscreen() {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(function () {});
            } else if (wrap.requestFullscreen) {
                wrap.requestFullscreen().catch(function () {});
            }
        }

        /* --- Control bar interactions --- */
        togglePlay.addEventListener('click', function (ev) {
            ev.stopPropagation();
            togglePlayback();
        });
        playBtn.addEventListener('click', function (ev) {
            ev.stopPropagation();
            togglePlayback();
        });

        volSlider.addEventListener('input', function () {
            var v = parseFloat(volSlider.value) || 0;
            video.muted = v <= 0;
            video.volume = v;
            setVolumeUI();
        });

        loopBtn.addEventListener('click', function () {
            video.loop = !video.loop;
            setLoopUI();
        });
        fullBtn.addEventListener('click', function (ev) {
            ev.stopPropagation();
            setFullscreen();
        });

        /* --- Drag-to-seek --- */
        var dragging = false;
        progress.addEventListener('pointerdown', function (ev) {
            if (ev.button !== undefined && ev.button !== 0) return;
            ev.preventDefault();
            ev.stopPropagation();
            dragging = true;
            try { progress.setPointerCapture(ev.pointerId); } catch (e) {}
            seekTo(ev.clientX);
        });
        progress.addEventListener('pointermove', function (ev) {
            if (dragging) seekTo(ev.clientX);
        });
        function endDrag() { dragging = false; }
        progress.addEventListener('pointerup', endDrag);
        progress.addEventListener('pointercancel', endDrag);

        progress.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                seekTo(progress.getBoundingClientRect().left + progress.offsetWidth / 2);
            } else if (ev.key === 'ArrowRight') {
                ev.preventDefault();
                seekBy(5);
            } else if (ev.key === 'ArrowLeft') {
                ev.preventDefault();
                seekBy(-5);
            }
        });

        /* --- Video events --- */
        video.addEventListener('play', function () {
            pauseAllOthers(wrap);
            wrap.classList.add(PREFIX + '-playing');
            intendedPlay = true;
            resumeOnReentry = true;
            setPlayUI();
            setLoading(false);
        });
        video.addEventListener('pause', function () {
            wrap.classList.remove(PREFIX + '-playing');
            setPlayUI();
        });
        video.addEventListener('ended', function () {
            intendedPlay = false;
        });
        video.addEventListener('volumechange', function () {
            setVolumeUI();
        });
        video.addEventListener('waiting', function () {
            syncLoadingState();
        });
        video.addEventListener('playing', function () {
            setLoading(false);
        });
        video.addEventListener('timeupdate', updateProgress);
        video.addEventListener('progress', function () {
            updateBuffer();
            updateLoadProgress();
        });
        video.addEventListener('loadedmetadata', function () {
            updateProgress();
            setPlayUI();
            setVolumeUI();
            setLoopUI();
            syncLoadingState();
        });
        video.addEventListener('durationchange', function () {
            updateProgress();
            syncLoadingState();
        });
        video.addEventListener('canplay', function () {
            syncLoadingState();
        });
        video.addEventListener('loadstart', function () {
            syncLoadingState();
        });
        video.addEventListener('stalled', syncLoadingState);
        video.addEventListener('suspend', syncLoadingState);
        video.addEventListener('loadeddata', syncLoadingState);

        /* --- Click anywhere on video/wrap to toggle play/pause ---
           Only triggers when clicking directly on the video or wrap,
           NOT on the control bar, play button, or other controls. */
        wrap.addEventListener('click', function (ev) {
            if (ev.target.closest && ev.target.closest('.' + PREFIX + '-bar')) return;
            if (ev.target.closest && ev.target.closest('.' + PREFIX + '-btn, .' + PREFIX + '-vol, .' + PREFIX + '-progress')) return;
            togglePlayback();
        });
        video.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            togglePlayback();
        });

        /* Double-click on video/wrap toggles fullscreen */
        wrap.addEventListener('dblclick', function (ev) {
            if (ev.target === wrap || ev.target === video) {
                setFullscreen();
            }
        });

        /* --- Keyboard shortcuts --- */
        wrap.addEventListener('keydown', function (ev) {
            if (ev.key === ' ') {
                ev.preventDefault();
                togglePlayback();
            } else if (ev.key === 'm' || ev.key === 'M') {
                video.muted = !video.muted;
                setVolumeUI();
            } else if (ev.key === 'f' || ev.key === 'F') {
                setFullscreen();
            } else if (ev.key === 'ArrowRight') {
                ev.preventDefault();
                seekBy(5);
            } else if (ev.key === 'ArrowLeft') {
                ev.preventDefault();
                seekBy(-5);
            }
        });

        /* --- Auto-pause when out of viewport, resume on scroll back --- */
        if (typeof IntersectionObserver !== 'undefined') {
            observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.target !== wrap) return;

                    var debugInfo = {
                        timestamp: new Date().toISOString(),
                        ratio: entry.intersectionRatio.toFixed(3),
                        isIntersecting: entry.isIntersecting,
                        intendedPlay: intendedPlay,
                        resumeOnReentry: resumeOnReentry,
                        videoPaused: video.paused,
                        rect: { top: entry.boundingClientRect.top, bottom: entry.boundingClientRect.bottom, height: entry.boundingClientRect.height },
                        visibleRatio: visibleVerticalRatio(entry.boundingClientRect).toFixed(3),
                        inPlayZone: isInPlayZone(entry.boundingClientRect),
                        centerY: Math.round(entry.boundingClientRect.top + (entry.boundingClientRect.height / 2)),
                        zone: getPlayZoneBounds(),
                        vh: window.innerHeight || 0
                    };
                    if (DEBUG_VIDEO) {
                        console.log('[LucaVideoPlayer DEBUG]', debugInfo);
                        wrap.style.outline = debugInfo.inPlayZone ? '2px solid rgba(0,255,140,0.9)' : '2px solid rgba(255,120,120,0.9)';
                        if (wrap._debugOverlay) {
                            wrap._debugOverlay.textContent = 'zone ' + (debugInfo.inPlayZone ? 'PLAY' : 'WAIT') + ' | vis ' + debugInfo.visibleRatio + ' | center ' + debugInfo.centerY + ' | top ' + Math.round(debugInfo.rect.top) + ' | bottom ' + Math.round(debugInfo.rect.bottom);
                        }
                        updateDebugHud([
                            'video debug active',
                            'play zone: ' + debugInfo.zone.top + 'px - ' + debugInfo.zone.bottom + 'px',
                            'intersection ratio: ' + debugInfo.ratio,
                            'visible ratio: ' + debugInfo.visibleRatio,
                            'in play zone: ' + debugInfo.inPlayZone,
                            'intersecting: ' + debugInfo.isIntersecting,
                            'intendedPlay: ' + debugInfo.intendedPlay,
                            'resumeOnReentry: ' + debugInfo.resumeOnReentry,
                            'paused: ' + debugInfo.videoPaused,
                            'centerY: ' + debugInfo.centerY,
                            'top/bottom: ' + Math.round(debugInfo.rect.top) + ' / ' + Math.round(debugInfo.rect.bottom),
                            'viewport h: ' + debugInfo.vh
                        ]);
                    }

                    if (!entry.isIntersecting || !debugInfo.inPlayZone) {
                        /* Leaving viewport: pause if playing, and remember intent */
                        if (!video.paused) {
                            resumeOnReentry = true;
                            video.pause();
                        }
                        if (intendedPlay) resumeOnReentry = true;
                    } else {
                        /* Re-entering viewport: resume only when this one intended to play */
                        if (resumeOnReentry && intendedPlay && video.paused) {
                            if (options.muted) {
                                video.muted = true;
                                video.play().catch(function () {});
                            } else {
                                startWithSound();
                            }
                        }
                    }
                });
            }, { threshold: [0, 0.1, 0.2, 0.35, 0.5, 0.75], rootMargin: '0px' });
            observer.observe(wrap);
            video._lvpObserver = observer;

            if (DEBUG_VIDEO) {
                wrap._debugOverlay = el('div', PREFIX + '-debug');
                wrap._debugOverlay.style.cssText = 'position:absolute;bottom:40px;left:8px;right:8px;background:rgba(0,0,0,0.8);color:#0f0;font-family:monospace;font-size:10px;padding:4px;z-index:999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;';
                wrap.appendChild(wrap._debugOverlay);
                ensureDebugHud();
            }
        }

        /* --- Autoplay with sound strategy --- */
        function startWithSound() {
            intendedPlay = true;
            video.muted = false;
            var p = video.play();
            if (p && p.catch) {
                p.catch(function (err) {
                    if (err && err.name === 'NotAllowedError') {
                        video.muted = true;
                        video.play().catch(function () {});
                        setVolumeUI();
                        var unlock = function () {
                            video.muted = false;
                            setVolumeUI();
                            document.removeEventListener('pointerdown', unlock);
                            document.removeEventListener('keydown', unlock);
                        };
                        document.addEventListener('pointerdown', unlock);
                        document.addEventListener('keydown', unlock);
                    }
                });
            }
        }

        if (video.hasAttribute('autoplay') || options.autoplay || options.muted) {
            intendedPlay = true;
            resumeOnReentry = true;
            if (isMostlyInView(wrap)) {
                startAutoplayAttempt();
            }
        }

        syncLoadingState();
        setPlayUI();
        setVolumeUI();
        setLoopUI();
        updateProgress();

        return wrap;
    }

    window.LucaVideoPlayer = { upgrade: upgrade };
})();
