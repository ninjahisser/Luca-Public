console.log('main.js loaded');

// Main initialization
init();

async function init() {
    const clockElement = document.getElementById('clock');
    const currentClockLabel = document.getElementById('current-clock');

    const data = await fetch('manifest.json').then(r => r.json());
    const clocks = Object.keys(data.Clocks || {});
    if (clocks.length === 0) {
        console.warn('No clocks found in manifest');
        return;
    }

    let currentIndex = Math.max(0, clocks.indexOf('BeadsClock'));
    if (currentIndex === -1) currentIndex = 0;

    // time override state (shared across clocks)
    const timeOverride = { enabled: false, hours: 12, minutes: 30, seconds: 0, milliseconds: 0 };

    // simulation clock (for speed multiplier)
    let speed = 1; // 1x..100x
    let simBaseReal = performance.now(); // ms
    let simBaseTime = Date.now(); // epoch ms

    function currentSimNowMs() {
        // if override active, caller should ignore sim time and use override values
        const nowReal = performance.now();
        const elapsed = nowReal - simBaseReal;
        return simBaseTime + elapsed * speed;
    }

    function setSpeed(newSpeed) {
        // re-anchor base so time remains continuous when changing speed
        const nowSim = currentSimNowMs();
        simBaseTime = nowSim;
        simBaseReal = performance.now();
        speed = newSpeed;
    }

    // show a clock by index
    async function showClock(index) {
        const clockName = clocks[index];
        if (currentClockLabel) currentClockLabel.textContent = clockName;
        // clear existing
        clockElement.innerHTML = '';

        const files = data.Clocks[clockName].files || [];

        // add elements (preserve original innerHTML style)
        files.forEach(f => {
            console.log('Loading', f);
            clockElement.innerHTML += `\n<dotlottie-wc class="anim" src="Clocks/${clockName}/${f}" speed="1" mode="forward" loop autoplay></dotlottie-wc>`;
        });

        // helper wait
        async function waitLoaded(el, timeout = 5000) {
            const start = Date.now();
            return new Promise((resolve, reject) => {
                function check() {
                    try { if (el.dotLottie && el.dotLottie.isLoaded) return resolve(el.dotLottie); } catch (e) {}
                    if (Date.now() - start > timeout) return reject(new Error('dotLottie load timeout'));
                    requestAnimationFrame(check);
                }
                check();
            });
        }

        // gather anims
        const animEls = Array.from(clockElement.querySelectorAll('.anim'));
        const anims = animEls.map((el, idx) => {
            const f = files[idx] || '';
            const lower = f.toLowerCase();
            const is24h = lower.includes('24h');
            const is1h = lower.includes('1h') || lower.includes('-1h');
            const is1m = lower.includes('1m') || lower.includes('-1m');
            const is1s = lower.includes('1s') || lower.includes('-1s');
            return { file: f, el, is24h, is1h, is1m, is1s, dot: null };
        });

        // wait for load
        await Promise.all(anims.map(async a => {
            try {
                a.dot = await waitLoaded(a.el, 8000);
                try { a.dot.pause(); } catch (e) {}

                // Some animations may need a short moment after isLoaded before
                // properties like totalFrames/duration are available. Wait until
                // the player reports usable frame information before we try
                // setting frames. This is generic (no clock-specific code).
                async function waitReady(dot, timeout = 5000) {
                    const start = Date.now();
                    return new Promise((resolve) => {
                        let resolved = false;
                        function done(val) { if (!resolved) { resolved = true; resolve(val); } }

                        // If totalFrames or duration become available, we're good
                        function checkProps() {
                            try {
                                const tf = dot.totalFrames;
                                const dur = dot.duration;
                                if ((typeof tf === 'number' && tf > 1) || (typeof dur === 'number' && dur > 0)) {
                                    return done(true);
                                }
                            } catch (e) {}
                            if (Date.now() - start > timeout) return done(false);
                            requestAnimationFrame(checkProps);
                        }

                        // Also listen for the 'frame' event which indicates the player produced a frame
                        const frameHandler = () => { done(true); };
                        try { dot.addEventListener('frame', frameHandler); } catch (e) {}

                        checkProps();

                        // ensure we cleanup the listener when resolved
                        const cleanup = () => { try { dot.removeEventListener && dot.removeEventListener('frame', frameHandler); } catch (e) {} };
                        // wrap resolve to cleanup
                        const origResolve = resolve;
                        resolve = (v) => { cleanup(); origResolve(v); };
                    });
                }

                const ready = await waitReady(a.dot, 5000);
                if (!ready) {
                    // still attempt a small setFrame to nudge the player
                    try { a.dot.setFrame(0); a.dot.pause(); } catch (e) {}
                }
            } catch (err) {
                console.warn('Failed to load', a.file, err);
            }
        }));

        // apply time
        function applyTimeToAnims() {
            let now;
            if (timeOverride.enabled) {
                // when override is enabled, use the explicit override values (speed ignored)
                now = new Date();
                now.setHours(timeOverride.hours);
                now.setMinutes(timeOverride.minutes);
                now.setSeconds(timeOverride.seconds || 0);
                now.setMilliseconds(timeOverride.milliseconds || 0);
            } else {
                // otherwise compute simulated now using speed multiplier
                now = new Date(currentSimNowMs());
            }

            const hours = now.getHours();
            const minutes = now.getMinutes();
            const seconds = now.getSeconds();
            const ms = now.getMilliseconds();

            anims.forEach(a => {
                if (!a.dot) return;
                const total = a.dot.totalFrames || 1;
                let progress = 0;

                if (a.is1s) {
                    // progress within the current second
                    progress = (ms) / 1000;
                } else if (a.is1m) {
                    // progress within current minute
                    progress = (seconds + ms/1000) / 60;
                } else if (a.is1h) {
                    // progress within current hour
                    progress = (minutes + seconds/60 + ms/60000) / 60;
                } else if (a.is24h) {
                    // progress across 24 hours
                    progress = (hours + minutes/60 + seconds/3600 + ms/3600000) / 24;
                } else {
                    // fallback: treat as 24h
                    progress = (hours + minutes/60 + seconds/3600 + ms/3600000) / 24;
                }

                progress = Math.min(1, Math.max(0, progress));
                const frame = Math.max(0, Math.min(total - 1, Math.round(progress * (total - 1))));
                try { a.dot.setFrame(frame); a.dot.pause(); } catch (e) { console.warn('Could not set frame for', a.file, e); }
            });
        }

        // initial apply
        applyTimeToAnims();

        // return control object so outer scope could call applyTimeToAnims if needed
        return { applyTimeToAnims };
    }

    // navigation
    let currentApply = null;
    let rafId = null;
    let isTransitioning = false;

    async function doShowClock(index, direction = 'none') {
        if (isTransitioning) return;
        isTransitioning = true;

        const clockElement = document.getElementById('clock');
        
        // Apply exit animation to current clock
        if (direction !== 'none') {
            const exitClass = direction === 'next' ? 'clock-slide-out-left' : 'clock-slide-out-right';
            clockElement.className = exitClass;
            
            // Wait for exit animation to complete
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Load new clock
        const control = await showClock(index);
        currentApply = control && control.applyTimeToAnims ? control.applyTimeToAnims : null;
        
        // Apply enter animation
        if (direction !== 'none') {
            const enterClass = direction === 'next' ? 'clock-slide-in-right' : 'clock-slide-in-left';
            clockElement.className = enterClass;
            
            // Wait for enter animation to complete
            await new Promise(resolve => setTimeout(resolve, 500));
            clockElement.className = '';
        }

        // Run immediately
        if (currentApply) currentApply();
        
        // Restart rAF loop
        if (rafId) cancelAnimationFrame(rafId);
        const loop = () => { if (currentApply) currentApply(); rafId = requestAnimationFrame(loop); };
        rafId = requestAnimationFrame(loop);
        
        isTransitioning = false;
    }

    function nextClock() { 
        if (isTransitioning) return;
        currentIndex = (currentIndex + 1) % clocks.length; 
        doShowClock(currentIndex, 'next'); 
    }
    
    function prevClock() { 
        if (isTransitioning) return;
        currentIndex = (currentIndex - 1 + clocks.length) % clocks.length; 
        doShowClock(currentIndex, 'prev'); 
    }

    // wire up buttons and keyboard
    const prevBtn = document.getElementById('prev-clock');
    const nextBtn = document.getElementById('next-clock');
    if (prevBtn) prevBtn.addEventListener('click', () => prevClock());
    if (nextBtn) nextBtn.addEventListener('click', () => nextClock());

    window.addEventListener('keydown', (e) => {
        // don't intercept keys when typing in inputs
        const active = document.activeElement;
        const typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
        if (!typing) {
            if (e.key === 'ArrowLeft') { prevClock(); }
            if (e.key === 'ArrowRight') { nextClock(); }
            if (e.code === 'Space' || e.key === ' ') {
                // toggle debug/time-override UI and clock selector together by toggling
                // a class on <body>. This avoids conflicts with stylesheet defaults.
                if (document.body) {
                    document.body.classList.toggle('debug-shown');
                    e.preventDefault();
                }
                // Ensure debug hand UI visibility updates when toggling
                toggleHandDebugVisibility();
            }
        }
    });

    // hook up override UI (shared)
    const overrideEnableEl = document.getElementById('override-enable');
    const overrideHourEl = document.getElementById('override-hour');
    const overrideMinuteEl = document.getElementById('override-minute');
    const overrideSecondEl = document.getElementById('override-second');
    const overrideNowBtn = document.getElementById('override-now');
    const overrideClearBtn = document.getElementById('override-clear');
    const overrideSpeedEl = document.getElementById('override-speed');
    const speedValueEl = document.getElementById('speed-value');

    function readOverrideInputs() {
        if (!overrideHourEl || !overrideMinuteEl || !overrideSecondEl) return;
        const h = parseInt(overrideHourEl.value, 10);
        const m = parseInt(overrideMinuteEl.value, 10);
        const s = parseInt(overrideSecondEl.value, 10) || 0;
        timeOverride.hours = isNaN(h) ? 0 : Math.max(0, Math.min(23, h));
        timeOverride.minutes = isNaN(m) ? 0 : Math.max(0, Math.min(59, m));
        timeOverride.seconds = isNaN(s) ? 0 : Math.max(0, Math.min(59, s));
        timeOverride.milliseconds = 0;
    }

    // speed control
    if (overrideSpeedEl) {
        overrideSpeedEl.addEventListener('input', (e) => {
            const v = parseFloat(e.target.value) || 1;
            setSpeed(v);
            if (speedValueEl) speedValueEl.textContent = v + 'x';
            // apply immediately
            if (currentApply) currentApply();
        });
        // initialize display
        if (speedValueEl) speedValueEl.textContent = String(overrideSpeedEl.value) + 'x';
    }

    if (overrideEnableEl) {
        overrideEnableEl.addEventListener('change', e => {
            timeOverride.enabled = !!e.target.checked;
            if (timeOverride.enabled) readOverrideInputs();
            // just update frames, don't reload DOM
            if (!timeOverride.enabled) {
                // when leaving override mode, re-anchor simulation to current real time
                simBaseTime = Date.now();
                simBaseReal = performance.now();
            }
            if (currentApply) currentApply();
        });
    }
    if (overrideHourEl) overrideHourEl.addEventListener('input', () => { readOverrideInputs(); if (timeOverride.enabled && currentApply) currentApply(); });
    if (overrideMinuteEl) overrideMinuteEl.addEventListener('input', () => { readOverrideInputs(); if (timeOverride.enabled && currentApply) currentApply(); });
    if (overrideSecondEl) overrideSecondEl.addEventListener('input', () => { readOverrideInputs(); if (timeOverride.enabled && currentApply) currentApply(); });
    if (overrideNowBtn) overrideNowBtn.addEventListener('click', () => {
        const now = new Date();
        if (overrideHourEl) overrideHourEl.value = String(now.getHours());
        if (overrideMinuteEl) overrideMinuteEl.value = String(now.getMinutes());
        if (overrideSecondEl) overrideSecondEl.value = String(now.getSeconds());
        if (overrideEnableEl) overrideEnableEl.checked = true;
        readOverrideInputs();
        timeOverride.enabled = true;
        if (currentApply) currentApply();
    });
    if (overrideClearBtn) overrideClearBtn.addEventListener('click', () => {
        if (overrideEnableEl) overrideEnableEl.checked = false;
        timeOverride.enabled = false;
        if (currentApply) currentApply();
    });

    // --- Hand Tracking / Gesture Swipe Setup (handtrack.js) ---
    async function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) return resolve();
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    function ensureDebugHandUI() {
        let container = document.getElementById('hands-debug');
        if (!container) {
            container = document.createElement('div');
            container.id = 'hands-debug';
            container.style.cssText = 'position:fixed;bottom:12px;right:12px;display:flex;flex-direction:column;gap:8px;padding:12px;background:rgba(0,0,0,0.85);color:#fff;font:14px/1.4 system-ui,sans-serif;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
            container.className = 'hands-debug';
            
            const title = document.createElement('div');
            title.textContent = '✋ Hand Tracking';
            title.style.cssText = 'font-weight:600;font-size:16px;margin-bottom:4px;';
            
            const status = document.createElement('div');
            status.id = 'hands-status';
            status.textContent = 'Loading...';
            status.style.cssText = 'font-size:13px;opacity:0.8;margin-bottom:8px;';
            
            const canvas = document.createElement('canvas');
            canvas.id = 'hands-canvas';
            canvas.width = 400;
            canvas.height = 300;
            canvas.style.cssText = 'border-radius:8px;width:400px;height:300px;background:#000;';
            
            container.appendChild(title);
            container.appendChild(status);
            container.appendChild(canvas);
            
            document.body.appendChild(container);
        }
        return container;
    }

    function toggleHandDebugVisibility() {
        const shown = document.body && document.body.classList.contains('debug-shown');
        const el = document.getElementById('hands-debug');
        if (el) el.style.display = shown ? 'flex' : 'none';
    }

    const bodyObserver = new MutationObserver(toggleHandDebugVisibility);
    if (document.body) bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // Swipe detection state
    let swipeHistory = [];
    let lastSwipeTs = 0;
    let SWIPE_WINDOW_MS = 400;
    let SWIPE_MIN_DELTA = 120;
    let SWIPE_COOLDOWN = 1000;
    let SWIPE_THRESHOLD = 4;
    let SCORE_THRESHOLD = 0.79;

    // Load settings from localStorage
    function loadSwipeSettings() {
        try {
            const saved = localStorage.getItem('swipeSettings');
            if (saved) {
                const settings = JSON.parse(saved);
                SWIPE_WINDOW_MS = settings.window ?? 400;
                SWIPE_MIN_DELTA = settings.minDelta ?? 120;
                SWIPE_COOLDOWN = settings.cooldown ?? 1000;
                SWIPE_THRESHOLD = settings.threshold ?? 4;
                SCORE_THRESHOLD = settings.scoreThreshold ?? 0.79;
            }
        } catch (e) {
            console.warn('Failed to load swipe settings:', e);
        }
    }

    function saveSwipeSettings() {
        try {
            localStorage.setItem('swipeSettings', JSON.stringify({
                window: SWIPE_WINDOW_MS,
                minDelta: SWIPE_MIN_DELTA,
                cooldown: SWIPE_COOLDOWN,
                threshold: SWIPE_THRESHOLD,
                scoreThreshold: SCORE_THRESHOLD
            }));
        } catch (e) {
            console.warn('Failed to save swipe settings:', e);
        }
    }

    loadSwipeSettings();

    function detectSwipe(x) {
        const now = performance.now();
        swipeHistory.push({ x, t: now });
        swipeHistory = swipeHistory.filter(p => now - p.t <= SWIPE_WINDOW_MS);
        if (now - lastSwipeTs < SWIPE_COOLDOWN) return;

        if (swipeHistory.length >= SWIPE_THRESHOLD) {
            const first = swipeHistory[0];
            const last = swipeHistory[swipeHistory.length - 1];
            const delta = last.x - first.x;
            if (delta > SWIPE_MIN_DELTA) {
                lastSwipeTs = now;
                prevClock();
                console.log('👉 Swipe right detected');
            } else if (delta < -SWIPE_MIN_DELTA) {
                lastSwipeTs = now;
                nextClock();
                console.log('👈 Swipe left detected');
            }
        }
    }

    async function setupHandTracking() {
        ensureDebugHandUI();
        toggleHandDebugVisibility();

        const statusEl = document.getElementById('hands-status');
        const canvasEl = document.getElementById('hands-canvas');
        const ctx = canvasEl.getContext('2d');

        // Add settings panel after canvas
        const settingsPanel = document.createElement('div');
        settingsPanel.style.cssText = 'background:rgba(255,255,255,0.05);padding:8px;border-radius:6px;font-size:12px;margin-top:8px;';
        
        const settingsTitle = document.createElement('div');
        settingsTitle.textContent = '⚙️ Swipe Settings';
        settingsTitle.style.cssText = 'font-weight:600;margin-bottom:8px;font-size:14px;';
        settingsPanel.appendChild(settingsTitle);
        
        // Helper to create slider
        function createSlider(label, id, min, max, step, value) {
            const group = document.createElement('div');
            group.style.cssText = 'margin-bottom:8px;';
            const labelEl = document.createElement('label');
            labelEl.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:4px;';
            labelEl.innerHTML = `<span>${label}</span><span id="${id}-value">${value}</span>`;
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.id = id;
            slider.min = min;
            slider.max = max;
            slider.step = step;
            slider.value = value;
            slider.style.cssText = 'width:100%;';
            slider.addEventListener('input', (e) => {
                document.getElementById(`${id}-value`).textContent = e.target.value;
            });
            group.appendChild(labelEl);
            group.appendChild(slider);
            return group;
        }
        
        settingsPanel.appendChild(createSlider('Window (ms)', 'swipe-window', 1, 1000, 1, SWIPE_WINDOW_MS));
        settingsPanel.appendChild(createSlider('Min Delta (px)', 'swipe-delta', 1, 300, 1, SWIPE_MIN_DELTA));
        settingsPanel.appendChild(createSlider('Cooldown (ms)', 'swipe-cooldown', 1, 3000, 1, SWIPE_COOLDOWN));
        settingsPanel.appendChild(createSlider('Threshold (pts)', 'swipe-threshold', 1, 10, 1, SWIPE_THRESHOLD));
        
        // Score threshold with note
        const scoreNote = document.createElement('div');
        scoreNote.style.cssText = 'font-size:11px;opacity:0.6;margin-bottom:4px;';
        scoreNote.textContent = '⚠️ Score Threshold requires reload to apply';
        settingsPanel.appendChild(scoreNote);
        settingsPanel.appendChild(createSlider('Score Threshold', 'score-threshold', 0.01, 1.0, 0.01, SCORE_THRESHOLD));
        
        const applyScoreBtn = document.createElement('button');
        applyScoreBtn.textContent = '✓ Apply Score Threshold';
        applyScoreBtn.style.cssText = 'width:100%;padding:6px;background:rgba(0,255,0,0.2);color:#fff;border:1px solid rgba(0,255,0,0.3);border-radius:4px;cursor:pointer;margin-top:4px;margin-bottom:8px;';
        applyScoreBtn.onclick = () => {
            location.reload();
        };
        settingsPanel.appendChild(applyScoreBtn);
        
        const resetBtn = document.createElement('button');
        resetBtn.textContent = '🔄 Reset All Settings';
        resetBtn.style.cssText = 'width:100%;padding:6px;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:4px;cursor:pointer;margin-top:8px;';
        resetBtn.onclick = () => {
            localStorage.removeItem('swipeSettings');
            location.reload();
        };
        settingsPanel.appendChild(resetBtn);
        
        document.getElementById('hands-debug').appendChild(settingsPanel);
        
        // Wire up settings
        document.getElementById('swipe-window').addEventListener('change', (e) => {
            SWIPE_WINDOW_MS = parseInt(e.target.value);
            saveSwipeSettings();
        });
        document.getElementById('swipe-delta').addEventListener('change', (e) => {
            SWIPE_MIN_DELTA = parseInt(e.target.value);
            saveSwipeSettings();
        });
        document.getElementById('swipe-cooldown').addEventListener('change', (e) => {
            SWIPE_COOLDOWN = parseInt(e.target.value);
            saveSwipeSettings();
        });
        document.getElementById('swipe-threshold').addEventListener('change', (e) => {
            SWIPE_THRESHOLD = parseInt(e.target.value);
            saveSwipeSettings();
        });
        document.getElementById('score-threshold').addEventListener('change', (e) => {
            SCORE_THRESHOLD = parseFloat(e.target.value);
            saveSwipeSettings();
        });

        try {
            // Load handtrack.js standalone
            if (statusEl) statusEl.textContent = '⏳ Loading model...';
            await loadScript('https://cdn.jsdelivr.net/npm/handtrackjs@latest/dist/handtrack.min.js');
            
            // Wait for handTrack global
            let attempts = 0;
            while (!window.handTrack && attempts < 100) {
                await new Promise(r => setTimeout(r, 50));
                attempts++;
            }
            
            if (!window.handTrack) {
                throw new Error('handTrack library not loaded');
            }

            const modelParams = {
                flipHorizontal: true,
                maxNumBoxes: 2,
                iouThreshold: 0.5,
                scoreThreshold: SCORE_THRESHOLD,
            };

            if (statusEl) statusEl.textContent = '🧠 Loading AI model...';
            const model = await window.handTrack.load(modelParams);
            if (statusEl) statusEl.textContent = '📹 Starting camera...';

            // Start video
            const video = document.createElement('video');
            video.style.display = 'none';
            document.body.appendChild(video);
            
            await window.handTrack.startVideo(video);
            if (statusEl) statusEl.textContent = '✅ Ready - Show your hand!';

            let isRunning = false;

            function runDetection() {
                if (isRunning) return;
                isRunning = true;

                model.detect(video).then(predictions => {
                    const shown = document.body && document.body.classList.contains('debug-shown');
                    
                    // Always process detections for swipe, even if debug hidden
                    const openHand = predictions.find(p => p.label === 'open');
                    if (openHand) {
                        const [x, y, w, h] = openHand.bbox;
                        const centerX = x + w / 2;
                        detectSwipe(centerX);
                    }
                    
                    // Only draw to canvas when debug is shown
                    if (shown) {
                        // Draw video feed
                        ctx.drawImage(video, 0, 0, canvasEl.width, canvasEl.height);
                        
                        // Draw predictions with nice styling
                        model.renderPredictions(predictions, canvasEl, ctx, video);
                        
                        if (statusEl) {
                            if (predictions.length > 0) {
                                statusEl.textContent = `👋 ${predictions.length} hand(s) detected`;
                            } else {
                                statusEl.textContent = '🖐️ Show your hand to swipe';
                            }
                        }
                        
                        // Draw swipe indicator
                        if (openHand) {
                            const [x, y, w, h] = openHand.bbox;
                            const centerX = x + w / 2;
                            ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
                            ctx.fillRect(centerX - 5, y, 10, h);
                        }
                    }

                    isRunning = false;
                    requestAnimationFrame(runDetection);
                }).catch(err => {
                    console.warn('Detection error:', err);
                    isRunning = false;
                    requestAnimationFrame(runDetection);
                });
            }

            runDetection();

        } catch (e) {
            console.warn('Hand tracking setup failed:', e);
            if (statusEl) statusEl.textContent = '❌ Setup failed: ' + (e.message || 'unknown');
        }
    }

    // Ensure hand tracking and clock both start
    setupHandTracking();
    doShowClock(currentIndex, 'none');
}
