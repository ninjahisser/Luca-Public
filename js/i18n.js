(function () {
    var STORAGE_KEY = "site_language";
    var DEFAULT_LANGUAGE = "en";
    var COOKIE_KEY = "googtrans";
    var GOOGLE_SCRIPT_ID = "google_translate_script";
    var RELOAD_GUARD_KEY = "site_language_reload_guard";
    var NL_RESTORE_GUARD_KEY = "site_language_nl_restore_guard";
    var switcher;
    var overlay;
    var panelOpen = false;
    var applyRetries = 0;
    var MAX_APPLY_RETRIES = 4;
    var scrollLastY = 0;
    var scrollTicking = false;
    var googleReady = false;

    function playTranslationReveal() {
        document.body.classList.remove("translated-reveal");
        void document.body.offsetWidth;
        document.body.classList.add("translated-reveal");
        window.setTimeout(function () {
            document.body.classList.remove("translated-reveal");
        }, 380);
    }

    var LANGUAGES = [
        { code: "en", label: "English", flag: "🇬🇧" },
        { code: "nl", label: "Nederlands", flag: "🇳🇱" },
        { code: "fr", label: "Francais", flag: "🇫🇷" },
        { code: "de", label: "Deutsch", flag: "🇩🇪" },
        { code: "es", label: "Espanol", flag: "🇪🇸" },
        { code: "it", label: "Italiano", flag: "🇮🇹" },
        { code: "pt", label: "Portugues", flag: "🇵🇹" },
        { code: "pl", label: "Polski", flag: "🇵🇱" },
        { code: "sv", label: "Svenska", flag: "🇸🇪" },
        { code: "no", label: "Norsk", flag: "🇳🇴" },
        { code: "da", label: "Dansk", flag: "🇩🇰" },
        { code: "fi", label: "Suomi", flag: "🇫🇮" },
        { code: "cs", label: "Cestina", flag: "🇨🇿" },
        { code: "sk", label: "Slovencina", flag: "🇸🇰" },
        { code: "sl", label: "Slovenscina", flag: "🇸🇮" },
        { code: "hr", label: "Hrvatski", flag: "🇭🇷" },
        { code: "hu", label: "Magyar", flag: "🇭🇺" },
        { code: "ro", label: "Romana", flag: "🇷🇴" },
        { code: "bg", label: "Bulgarian", flag: "🇧🇬" },
        { code: "el", label: "Greek", flag: "🇬🇷" },
        { code: "ru", label: "Russian", flag: "🇷🇺" },
        { code: "uk", label: "Ukrainian", flag: "🇺🇦" },
        { code: "tr", label: "Turkish", flag: "🇹🇷" },
        { code: "ar", label: "Arabic", flag: "🇸🇦" },
        { code: "he", label: "Hebrew", flag: "🇮🇱" },
        { code: "fa", label: "Persian", flag: "🇮🇷" },
        { code: "hi", label: "Hindi", flag: "🇮🇳" },
        { code: "bn", label: "Bengali", flag: "🇧🇩" },
        { code: "ta", label: "Tamil", flag: "🇮🇳" },
        { code: "te", label: "Telugu", flag: "🇮🇳" },
        { code: "th", label: "Thai", flag: "🇹🇭" },
        { code: "vi", label: "Vietnamese", flag: "🇻🇳" },
        { code: "id", label: "Indonesian", flag: "🇮🇩" },
        { code: "ms", label: "Malay", flag: "🇲🇾" },
        { code: "zh-CN", label: "Chinese (Simplified)", flag: "🇨🇳" },
        { code: "zh-TW", label: "Chinese (Traditional)", flag: "🇹🇼" },
        { code: "ja", label: "Japanese", flag: "🇯🇵" },
        { code: "ko", label: "Korean", flag: "🇰🇷" },
        { code: "af", label: "Afrikaans", flag: "🇿🇦" },
        { code: "sw", label: "Swahili", flag: "🇰🇪" },
        { code: "sr", label: "Serbian", flag: "🇷🇸" },
        { code: "et", label: "Estonian", flag: "🇪🇪" },
        { code: "lv", label: "Latvian", flag: "🇱🇻" },
        { code: "lt", label: "Lithuanian", flag: "🇱🇹" },
        { code: "ca", label: "Catalan", flag: "🇪🇸" },
        { code: "gl", label: "Galician", flag: "🇪🇸" },
        { code: "eu", label: "Basque", flag: "🇪🇸" },
        { code: "is", label: "Icelandic", flag: "🇮🇸" },
        { code: "mt", label: "Maltese", flag: "🇲🇹" },
        { code: "ga", label: "Irish", flag: "🇮🇪" },
        { code: "cy", label: "Welsh", flag: "🇬🇧" }
    ];

    var SUPPORTED_CODES = LANGUAGES.map(function (item) {
        return item.code;
    });

    function getSavedLanguage() {
        var saved = localStorage.getItem(STORAGE_KEY);
        return SUPPORTED_CODES.indexOf(saved) !== -1 ? saved : DEFAULT_LANGUAGE;
    }

    function saveLanguage(language) {
        localStorage.setItem(STORAGE_KEY, language);
    }

    function setTranslateCookie(language) {
        var value = "/auto/" + language;
        document.cookie = COOKIE_KEY + "=" + value + ";path=/;max-age=31536000;samesite=lax";
    }

    function clearTranslatedClasses() {
        document.documentElement.classList.remove("translated-ltr", "translated-rtl", "is-translating");
        if (document.body) {
            document.body.classList.remove("translated-reveal");
        }
    }

    function updateSwitcherState(language) {
        var trigger = document.getElementById("lang-current");
        if (!trigger) {
            return;
        }

        var languageData = findLanguage(language) || findLanguage(DEFAULT_LANGUAGE);
        trigger.classList.add("notranslate");
        trigger.setAttribute("translate", "no");
        trigger.innerHTML = '<span class="flag notranslate" translate="no">' + languageData.flag + '</span><span class="code notranslate" translate="no">' + languageData.code.toUpperCase() + '</span>';
    }

    function findLanguage(language) {
        for (var i = 0; i < LANGUAGES.length; i += 1) {
            if (LANGUAGES[i].code === language) {
                return LANGUAGES[i];
            }
        }
        return null;
    }

    function selectGoogleLanguage(language) {
        var combo = document.querySelector(".goog-te-combo");
        if (!combo) {
            return false;
        }

        if (combo.value !== language) {
            combo.value = language;
            combo.dispatchEvent(new Event("change"));
        }

        return true;
    }

    function applyLanguage(language, allowReloadFallback) {
        if (allowReloadFallback === undefined) {
            allowReloadFallback = true;
        }

        if (SUPPORTED_CODES.indexOf(language) === -1) {
            language = DEFAULT_LANGUAGE;
        }

        var previousLanguage = getSavedLanguage();
        saveLanguage(language);
        setTranslateCookie(language);
        updateSwitcherState(language);
        document.documentElement.lang = language;

        // NL is the source language; switch back immediately without waiting for reload.
        if (language === "nl") {
            if (googleReady || document.querySelector(".goog-te-combo")) {
                selectGoogleLanguage("nl");
            }
            applyRetries = 0;
            sessionStorage.removeItem(RELOAD_GUARD_KEY);
            clearTranslatedClasses();
            stopTranslatingUI();

            if (previousLanguage !== "nl") {
                var nlGuard = sessionStorage.getItem(NL_RESTORE_GUARD_KEY);
                if (nlGuard !== "1") {
                    sessionStorage.setItem(NL_RESTORE_GUARD_KEY, "1");
                    window.setTimeout(function () {
                        window.location.reload();
                    }, 80);
                    return;
                }
            }

            sessionStorage.removeItem(NL_RESTORE_GUARD_KEY);
            return;
        }

        sessionStorage.removeItem(NL_RESTORE_GUARD_KEY);

        if (!googleReady) {
            initGoogleTranslate();
        }

        startTranslatingUI(language);

        if (selectGoogleLanguage(language)) {
            applyRetries = 0;
            sessionStorage.removeItem(RELOAD_GUARD_KEY);
            waitForTranslationFinish(language);
            return;
        }

        var comboExists = !!document.querySelector(".goog-te-combo");
        if (!comboExists && allowReloadFallback) {
            var guard = sessionStorage.getItem(RELOAD_GUARD_KEY);
            if (guard !== language) {
                sessionStorage.setItem(RELOAD_GUARD_KEY, language);
                window.setTimeout(function () {
                    window.location.reload();
                }, 60);
                return;
            }
        }

        if (applyRetries < MAX_APPLY_RETRIES) {
            applyRetries += 1;
            window.setTimeout(function () {
                applyLanguage(language, allowReloadFallback);
            }, 120);
            return;
        }

        if (allowReloadFallback) {
            window.location.reload();
            return;
        }

        stopTranslatingUI();
    }

    function startTranslatingUI(language) {
        if (!overlay) {
            return;
        }

        var label = overlay.querySelector(".translation-status");
        if (label) {
            label.textContent = "Translating to " + language.toUpperCase() + "...";
        }

        document.documentElement.classList.add("is-translating");
        overlay.style.display = "flex";
    }

    function stopTranslatingUI() {
        if (!overlay) {
            return;
        }

        document.documentElement.classList.remove("is-translating");
        overlay.style.display = "none";

        if (getSavedLanguage() !== "nl") {
            playTranslationReveal();
        }
    }

    function waitForTranslationFinish(language) {
        var start = Date.now();
        var maxMs = 5000;
        var minMs = 350;

        var interval = window.setInterval(function () {
            var elapsed = Date.now() - start;
            var combo = document.querySelector(".goog-te-combo");
            var comboReady = !!combo && combo.value === language;
            var translatedClass = document.documentElement.classList.contains("translated-ltr") || document.documentElement.classList.contains("translated-rtl");
            var likelyDone = comboReady && (translatedClass || language === "nl") && elapsed > minMs;

            if (likelyDone || elapsed > maxMs) {
                window.clearInterval(interval);
                stopTranslatingUI();
            }
        }, 90);
    }

    function injectStyle() {
        if (document.getElementById("language_switcher_style")) {
            return;
        }

        var style = document.createElement("style");
        style.id = "language_switcher_style";
        style.textContent =
            "#language_switcher{position:fixed;top:16px;right:16px;z-index:10000}" +
            "#language_switcher button{border:0;background:var(--background-color,#fff);color:var(--main-color,#111);font:800 1.05rem/1.2 var(--default-font,'Geist Mono',monospace);letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:background-color .14s ease,color .14s ease,transform .14s ease,box-shadow .14s ease}" +
            "#lang-current{display:inline-flex;align-items:center;gap:8px;min-width:96px;justify-content:center;padding:10px 14px;box-shadow:none}" +
            "#lang-current:hover,#lang-current.open{background:var(--main-color,#111);color:var(--background-color,#fff);transform:translate(-3px,-3px);box-shadow:3px 3px 0 color-mix(in srgb, var(--main-color,#111) 45%, transparent)}" +
            "#lang-current .flag{font-size:16px;line-height:1}" +
            "#lang-panel{position:absolute;top:calc(100% + 8px);right:0;width:320px;max-height:50vh;background:var(--background-color,#fff);border:2px solid var(--main-color,#111);box-shadow:none;display:none;overflow:hidden}" +
            "#lang-panel.open{display:flex;flex-direction:column}" +
            "#lang-search{width:100%;box-sizing:border-box;border:0;border-bottom:2px solid var(--main-color,#111);padding:10px 12px;font:700 .92rem/1.2 var(--default-font,'Geist Mono',monospace);color:var(--main-color,#111);background:var(--background-color,#fff)}" +
            "#lang-list{overflow:auto;max-height:42vh}" +
            "#lang-list .lang-item{width:100%;text-align:left;display:flex;align-items:center;gap:10px;padding:10px 12px;border-top:1px solid rgba(0,0,0,.15);border-left:0;border-right:0;border-bottom:0;background:var(--background-color,#fff);color:var(--main-color,#111);font:700 .9rem/1.2 var(--default-font,'Geist Mono',monospace)}" +
            "#lang-list .lang-item:hover{background:var(--main-color,#111);color:var(--background-color,#fff)}" +
            "#lang-list .lang-item .flag{font-size:16px;line-height:1}" +
            "#translation_overlay{position:fixed;inset:0;z-index:12000;display:none;align-items:center;justify-content:center;background:rgba(255,255,255,.96)}" +
            "#translation_overlay .translation-box{width:40px;height:40px;border:2px solid var(--main-color,#111);background:var(--background-color,#fff);box-shadow:none;display:flex;align-items:center;justify-content:center}" +
            "#translation_overlay .pulse{width:12px;height:12px;background:var(--main-color,#111);animation:i18nPulse 1s steps(2,end) infinite}" +
            "@keyframes i18nPulse{0%{opacity:.2}50%{opacity:1}100%{opacity:.2}}" +
            "html.is-translating body>*:not(#translation_overlay){opacity:0;pointer-events:none}" +
            "html.is-translating #language_switcher{pointer-events:none}" +
            "#google_translate_element,.skiptranslate,iframe.goog-te-banner-frame,.goog-te-gadget-icon,.goog-logo-link,#goog-gt-tt,.goog-tooltip{display:none!important}" +
            "body .goog-te-gadget-simple{display:none!important}" +
            ".goog-te-spinner-pos{display:none!important}" +
            ".goog-text-highlight{background-color:transparent!important;box-shadow:none!important}" +
            "body{top:0!important}" +
            "@media (max-width:700px){#language_switcher{top:10px;right:10px}#lang-current{min-width:82px;padding:8px 10px}#lang-panel{width:min(86vw,320px)}}";
        document.head.appendChild(style);
    }

    function onScrollForNameBar() {
        if (scrollTicking) {
            return;
        }

        scrollTicking = true;
        window.requestAnimationFrame(function () {
            var currentY = window.scrollY || window.pageYOffset;
            var isWorkPage = document.body.classList.contains("work-page");
            if (isWorkPage) {
                if (currentY > scrollLastY + 8 && currentY > 80) {
                    document.body.classList.add("name-hidden");
                } else if (currentY < scrollLastY - 8 || currentY <= 40) {
                    document.body.classList.remove("name-hidden");
                }
            }
            scrollLastY = currentY;
            scrollTicking = false;
        });
    }

    function isLocalEnvironment() {
        var protocol = window.location.protocol;
        var host = (window.location.hostname || "").toLowerCase();
        return (
            protocol === "file:" ||
            host === "localhost" ||
            host === "127.0.0.1" ||
            host.endsWith(".local")
        );
    }

    function getCmsHref() {
        var i18nScript = document.querySelector('script[src*="i18n.js"]');
        var src = i18nScript ? i18nScript.getAttribute("src") : "js/i18n.js";
        if (!src) {
            return "cms/";
        }
        return src.replace(/js\/i18n\.js(?:\?.*)?$/, "cms/");
    }

    function initCmsButton() {
        var existing = document.getElementById("cms_link_btn");
        if (existing) {
            existing.remove();
        }

        if (!isLocalEnvironment()) {
            return;
        }

        var linksContainer = document.querySelector("#name_links div");
        if (!linksContainer) {
            return;
        }

        var cmsLink = document.createElement("a");
        cmsLink.id = "cms_link_btn";
        cmsLink.className = "def_button";
        cmsLink.href = getCmsHref();
        cmsLink.textContent = "CMS";
        linksContainer.appendChild(cmsLink);
    }

    function highlightImpactfulText(container) {
        if (!container) {
            return;
        }

        var candidates = container.querySelectorAll("p, li");
        var targetPhrases = [
            "het verhaal is volledig waargebeurd.",
            "we behoorden tot de winnaars en kregen een eerste plekje in het artikel!",
            "de les hieruit is dat verleidingen je in gevaar kunnen brengen als je niet oplet."
        ];

        function normalizeText(value) {
            return (value || "")
                .toLowerCase()
                .replace(/\s+/g, " ")
                .replace(/["'`]/g, "")
                .trim();
        }

        Array.from(candidates).forEach(function (element) {
            element.classList.remove("impact-highlight");
        });

        var picked = null;

        Array.from(candidates).forEach(function (element) {
            if (picked) {
                return;
            }

            if (element.classList.contains("impact-highlight")) {
                return;
            }

            var text = normalizeText(element.textContent || "");
            if (!text) {
                return;
            }

            for (var i = 0; i < targetPhrases.length; i += 1) {
                if (text.indexOf(targetPhrases[i]) !== -1) {
                    picked = element;
                    break;
                }
            }
        });

        if (picked) {
            picked.classList.add("impact-highlight");
        }
    }

    function loadCompanionScript(filename, flagName) {
        if (window[flagName]) {
            return;
        }

        var i18nScript = document.querySelector('script[src*="i18n.js"]');
        var scriptPath = "js/" + filename;
        if (i18nScript) {
            scriptPath = i18nScript.getAttribute("src").replace("i18n.js", filename);
        }

        var script = document.createElement("script");
        script.src = scriptPath;
        script.defer = true;
        document.body.appendChild(script);
        window[flagName] = true;
    }

    function normalizeBackButton() {
        var backButton = document.getElementById("back_button");
        if (backButton && backButton.getAttribute("href") === "index.html") {
            backButton.textContent = "⟵ Terug";
        }
    }

    function initWorkPageEnhancements() {
        var hasWorkContent = !!document.getElementById("assignment_desc") || !!document.getElementById("showcase_large");
        if (!hasWorkContent) {
            return;
        }

        document.body.classList.add("work-page");

        var backButton = document.getElementById("back_button");
        if (backButton) {
            backButton.textContent = "⟵ Terug";
        }

        var assignmentDesc = document.getElementById("assignment_desc");
        if (assignmentDesc) {
            Array.from(assignmentDesc.children).forEach(function (element, index) {
                var tag = element.tagName.toLowerCase();
                var isMedia =
                    tag === "iframe" ||
                    tag === "figure" ||
                    tag === "img" ||
                    tag === "video" ||
                    element.classList.contains("video-container") ||
                    element.classList.contains("fotos_grid");

                if (isMedia) {
                    element.classList.add("work-media");
                }
            });

            highlightImpactfulText(assignmentDesc);

            if (assignmentDesc.querySelector("img") && !window.workGalleryLoaded) {
                loadCompanionScript("lightbox.js", "workGalleryLoaded");
            }
        }

        scrollLastY = window.scrollY || 0;
        window.addEventListener("scroll", onScrollForNameBar, { passive: true });
    }

    function buildLanguageItem(languageData) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "lang-item";
        button.setAttribute("aria-label", "Translate to " + languageData.label);
        button.innerHTML = '<span class="flag">' + languageData.flag + '</span><span>' + languageData.label + "</span>";
        button.addEventListener("click", function () {
            applyRetries = 0;
            closePanel();
            applyLanguage(languageData.code);
        });
        return button;
    }

    function renderLanguageList(filterValue) {
        var list = document.getElementById("lang-list");
        if (!list) {
            return;
        }

        var query = (filterValue || "").toLowerCase();
        list.innerHTML = "";

        LANGUAGES.forEach(function (languageData) {
            var matches =
                !query ||
                languageData.label.toLowerCase().indexOf(query) !== -1 ||
                languageData.code.toLowerCase().indexOf(query) !== -1;
            if (matches) {
                list.appendChild(buildLanguageItem(languageData));
            }
        });
    }

    function openPanel() {
        var panel = document.getElementById("lang-panel");
        var trigger = document.getElementById("lang-current");
        var search = document.getElementById("lang-search");
        if (!panel || !trigger) {
            return;
        }

        panel.classList.add("open");
        trigger.classList.add("open");
        panelOpen = true;
        if (search) {
            search.value = "";
            renderLanguageList("");
            search.focus();
        }
    }

    function closePanel() {
        var panel = document.getElementById("lang-panel");
        var trigger = document.getElementById("lang-current");
        if (!panel || !trigger) {
            return;
        }

        panel.classList.remove("open");
        trigger.classList.remove("open");
        panelOpen = false;
    }

    function togglePanel() {
        if (panelOpen) {
            closePanel();
            return;
        }
        openPanel();
    }

    function createOverlay() {
        if (overlay) {
            return;
        }

        overlay = document.createElement("div");
        overlay.id = "translation_overlay";
        overlay.innerHTML = '<div class="translation-box"><span class="pulse" aria-hidden="true"></span></div>';
        document.body.appendChild(overlay);
    }

    function createLanguageSwitcher() {
        if (switcher) {
            return;
        }

        switcher = document.createElement("div");
        switcher.id = "language_switcher";

        var trigger = document.createElement("button");
        trigger.type = "button";
        trigger.id = "lang-current";
        trigger.className = "notranslate";
        trigger.setAttribute("translate", "no");
        trigger.setAttribute("aria-label", "Open language picker");
        trigger.addEventListener("click", function () {
            togglePanel();
        });

        var panel = document.createElement("div");
        panel.id = "lang-panel";

        var search = document.createElement("input");
        search.id = "lang-search";
        search.type = "text";
        search.placeholder = "Search language...";
        search.addEventListener("input", function () {
            renderLanguageList(search.value);
        });

        var list = document.createElement("div");
        list.id = "lang-list";

        panel.appendChild(search);
        panel.appendChild(list);
        switcher.appendChild(trigger);
        switcher.appendChild(panel);

        document.addEventListener("click", function (event) {
            if (!switcher.contains(event.target)) {
                closePanel();
            }
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closePanel();
            }
        });

        document.body.appendChild(switcher);
        renderLanguageList("");
        updateSwitcherState(getSavedLanguage());
    }

    function ensureGoogleElement() {
        if (!document.getElementById("google_translate_element")) {
            var div = document.createElement("div");
            div.id = "google_translate_element";
            div.className = "notranslate";
            div.style.position = "fixed";
            div.style.left = "-99999px";
            div.style.top = "-99999px";
            div.style.width = "1px";
            div.style.height = "1px";
            div.style.opacity = "0";
            div.style.pointerEvents = "none";
            div.style.overflow = "hidden";
            document.body.appendChild(div);
        }
    }

    function initGoogleTranslate() {
        if (window.google && window.google.translate && window.google.translate.TranslateElement) {
            googleReady = true;
            new window.google.translate.TranslateElement(
                {
                    pageLanguage: "nl",
                    includedLanguages: SUPPORTED_CODES.join(","),
                    autoDisplay: false,
                    multilanguagePage: true,
                    layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE
                },
                "google_translate_element"
            );

            var savedLanguage = getSavedLanguage();
            if (savedLanguage !== "nl") {
                applyLanguage(savedLanguage, false);
            } else {
                stopTranslatingUI();
            }
            return;
        }

        if (document.getElementById(GOOGLE_SCRIPT_ID)) {
            return;
        }

        window.googleTranslateElementInit = function () {
            initGoogleTranslate();
        };

        var script = document.createElement("script");
        script.id = GOOGLE_SCRIPT_ID;
        script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
        script.async = true;
        document.head.appendChild(script);
    }

    document.addEventListener("DOMContentLoaded", function () {
        injectStyle();
        createOverlay();
        createLanguageSwitcher();
        initCmsButton();
        normalizeBackButton();
        initWorkPageEnhancements();
        ensureGoogleElement();
        applyRetries = 0;

        var savedLanguage = getSavedLanguage();
        setTranslateCookie(savedLanguage);
        if (savedLanguage !== "nl") {
            initGoogleTranslate();
        } else {
            stopTranslatingUI();
        }
    });
})();
