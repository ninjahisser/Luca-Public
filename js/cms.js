(function () {
    "use strict";

    function convertToYouTubeEmbed(urlStr, isPreview) {
        if (!urlStr) return urlStr;
        var trimmed = urlStr.trim();
        if (trimmed.indexOf("youtube.com") !== -1 || trimmed.indexOf("youtu.be") !== -1 || trimmed.indexOf("youtube-nocookie.com") !== -1) {
            try {
                var shortsMatch = trimmed.match(/(?:\/shorts\/|vi\/)([a-zA-Z0-9_-]{11})/);
                var videoId = "";
                var isShort = false;
                if (shortsMatch && shortsMatch[1]) {
                    videoId = shortsMatch[1];
                    isShort = true;
                } else if (trimmed.indexOf("youtu.be/") !== -1) {
                    var parts = trimmed.split("youtu.be/");
                    if (parts[1]) {
                        videoId = parts[1].split(/[?#]/)[0];
                    }
                } else {
                    var urlObj = new URL(trimmed);
                    if (urlObj.searchParams.has("v")) {
                        videoId = urlObj.searchParams.get("v");
                    } else {
                        var embedParts = urlObj.pathname.split("/embed/");
                        if (embedParts[1]) {
                            videoId = embedParts[1].split(/[?#]/)[0];
                        }
                    }
                }

                if (videoId) {
                    if (trimmed.indexOf("short=1") !== -1 || trimmed.indexOf("/shorts/") !== -1) {
                        isShort = true;
                    }

                    var params = new URLSearchParams();

                    var qIdx = trimmed.indexOf("?");
                    if (qIdx !== -1) {
                        var origParams = new URLSearchParams(trimmed.substring(qIdx));
                        origParams.delete("v");
                        origParams.forEach(function (val, key) {
                            params.set(key, val);
                        });
                    }

                    if (isPreview) {
                        params.set("autoplay", "1");
                        params.set("mute", "1");
                        params.set("loop", "1");
                        params.set("playlist", videoId);
                    }

                    var queryStr = params.toString();
                    var embedHost = isShort ? "www.youtube.com" : "www.youtube-nocookie.com";
                    return "https://" + embedHost + "/embed/" + videoId + (queryStr ? "?" + queryStr : "");
                }
            } catch (e) {
                console.error("Error converting YouTube URL:", e);
            }
        }
        return trimmed;
    }

    function isYouTubeUrl(src) {
        if (!src) return false;
        try {
            var url = new URL(src, window.location.href);
            var host = (url.hostname || "").toLowerCase();
            return host.indexOf("youtube.com") !== -1 || host.indexOf("youtube-nocookie.com") !== -1 || host.indexOf("youtu.be") !== -1;
        } catch (e) {
            return false;
        }
    }

    var YT_EMBED_PARAMS = ["autoplay", "mute", "loop", "playlist", "controls"];

    function parseYouTubeParams(src) {
        var result = { ytAutoplay: false, ytMute: false, ytLoop: false, ytControls: true };
        if (!isYouTubeUrl(src)) return result;
        try {
            var url = new URL(src);
            result.ytAutoplay = url.searchParams.get("autoplay") === "1";
            result.ytMute = url.searchParams.get("mute") === "1";
            result.ytLoop = url.searchParams.get("loop") === "1";
            result.ytControls = url.searchParams.get("controls") !== "0";
        } catch (e) { /* ignore */ }
        return result;
    }

    function stripYouTubeParams(src) {
        if (!src || !isYouTubeUrl(src)) return src || "";
        var parts = src.split('?');
        if (parts.length < 2) return src;
        var queryParts = parts[1].split('&').filter(function(p) {
            return YT_EMBED_PARAMS.indexOf(p.split('=')[0]) === -1;
        });
        return queryParts.length > 0 ? parts[0] + '?' + queryParts.join('&') : parts[0];
    }

    function extractYouTubeVideoId(src) {
        if (!src) return "";
        var m;
        m = src.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
        if (m) return m[1];
        m = src.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
        if (m) return m[1];
        m = src.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (m) return m[1];
        m = src.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        if (m) return m[1];
        return "";
    }

    function buildIframeSrc(cmp) {
        var base = cmp.src || "";
        if (!base || !isYouTubeUrl(base)) return base;
        var vid = extractYouTubeVideoId(base);
        if (vid) {
            var embedHost = "www.youtube.com";
            base = "https://" + embedHost + "/embed/" + vid;
        }
        var parts = base.split('?');
        var urlBase = parts[0];
        var queryParts = parts.length > 1 ? parts[1].split('&').filter(Boolean) : [];
        queryParts = queryParts.filter(function(p) {
            return YT_EMBED_PARAMS.indexOf(p.split('=')[0]) === -1;
        });
        if (cmp.ytAutoplay) queryParts.push('autoplay=1');
        if (cmp.ytMute) queryParts.push('mute=1');
        if (cmp.ytLoop) {
            queryParts.push('loop=1');
            if (vid) queryParts.push('playlist=' + vid);
        }
        if (cmp.ytControls === false) queryParts.push('controls=0');
        return queryParts.length > 0 ? urlBase + '?' + queryParts.join('&') : urlBase;
    }

    var state = {
        mode: "fs",
        apiBase: "",
        apiRoot: "",
        dirHandle: null,
        indexText: "",
        indexDoc: null,
        works: [],
        selectedWork: null,
        selectedComponentIndex: -1,
        hoveredComponentIndex: -1,
        draggingComponentIndex: -1,
        draggingWorkIndex: -1,
        previewMobile: false,
        previewMuted: false,
        previewView: "index",
        previewScroll: { x: 0, y: 0 },
        indexPalette: { mainColor: "#1e00ff", secondaryColor: "#6f5cff", backgroundColor: "#000000" },
        saveInProgress: false,
        autoSaveDirtySince: 0,
        dirty: false,
        fileStore: new Map()
    };

    var el = {
        connectFolderBtn: document.getElementById("connectFolderBtn"),
        saveAllBtn: document.getElementById("saveAllBtn"),
        newWorkBtn: document.getElementById("newWorkBtn"),
        showWorksBtn: document.getElementById("showWorksBtn"),
        toolsBtn: document.getElementById("toolsBtn"),
        worksPanel: document.getElementById("worksPanel"),
        componentsPanel: document.getElementById("componentsPanel"),
        toolsPanel: document.getElementById("toolsPanel"),
        toolVideoUrl: document.getElementById("toolVideoUrl"),
        toolWorkName: document.getElementById("toolWorkName"),
        toolDownloadBtn: document.getElementById("toolDownloadBtn"),
        autoDownloadBtn: document.getElementById("autoDownloadBtn"),
        toolStatus: document.getElementById("toolStatus"),
        toolOutput: document.getElementById("toolOutput"),
        fotoThumbsBtn: document.getElementById("fotoThumbsBtn"),
        fotoThumbsStatus: document.getElementById("fotoThumbsStatus"),
        fotoThumbsOutput: document.getElementById("fotoThumbsOutput"),
        compressIndexBtn: document.getElementById("compressIndexBtn"),
        compressIndexStatus: document.getElementById("compressIndexStatus"),
        compressIndexOutput: document.getElementById("compressIndexOutput"),
        workSearch: document.getElementById("workSearch"),
        workList: document.getElementById("workList"),
        componentList: document.getElementById("componentList"),
        componentProps: document.getElementById("componentProps"),
        componentPropsEmpty: document.getElementById("componentPropsEmpty"),
        articleTitle: document.getElementById("articleTitle"),
        articleCategory: document.getElementById("articleCategory"),
        articleDesc: document.getElementById("articleDesc"),
        articleTools: document.getElementById("articleTools"),
        articlePreview: document.getElementById("articlePreview"),
        articlePreviewPicker: document.getElementById("articlePreviewPicker"),
        articlePreviewStart: document.getElementById("articlePreviewStart"),
        articleMainColor: document.getElementById("articleMainColor"),
        articleMainColorText: document.getElementById("articleMainColorText"),
        articleSecondaryColor: document.getElementById("articleSecondaryColor"),
        articleSecondaryColorText: document.getElementById("articleSecondaryColorText"),
        articleBackgroundColor: document.getElementById("articleBackgroundColor"),
        articleBackgroundColorText: document.getElementById("articleBackgroundColorText"),
        articleFavorite: document.getElementById("articleFavorite"),
        articleHighlight: document.getElementById("articleHighlight"),
        articleVisible: document.getElementById("articleVisible"),
        indexMainColor: document.getElementById("indexMainColor"),
        indexMainColorText: document.getElementById("indexMainColorText"),
        indexSecondaryColor: document.getElementById("indexSecondaryColor"),
        indexSecondaryColorText: document.getElementById("indexSecondaryColorText"),
        indexBackgroundColor: document.getElementById("indexBackgroundColor"),
        indexBackgroundColorText: document.getElementById("indexBackgroundColorText"),
        moveUpBtn: document.getElementById("moveUpBtn"),
        moveDownBtn: document.getElementById("moveDownBtn"),
        deleteComponentBtn: document.getElementById("deleteComponentBtn"),
        cmsEditorPanel: document.getElementById("cmsEditorPanel"),
        cmsPropsPanel: document.getElementById("cmsPropsPanel"),
        cmsEmptyState: document.getElementById("cmsEmptyState"),
        previewBody: document.getElementById("previewBody"),
        previewFullscreenBtn: document.getElementById("previewFullscreenBtn"),
        previewMobileBtn: document.getElementById("previewMobileBtn"),
        previewMuteBtn: document.getElementById("previewMuteBtn"),
        previewViewBtn: document.getElementById("previewViewBtn"),
        workPreview: document.getElementById("workPreview"),
        previewPath: document.getElementById("previewPath"),
        serverImagePicker: document.getElementById("serverImagePicker"),
        pickerCloseBtn: document.getElementById("pickerCloseBtn"),
        pickerSearch: document.getElementById("pickerSearch"),
        pickerGrid: document.getElementById("pickerGrid"),
        status: document.getElementById("cmsStatus"),
        target: document.getElementById("cmsTarget")
    };

    var canonicalToolOptions = [
        "Figma",
        "XD",
        "HTML",
        "CSS",
        "JavaScript",
        "Creative Cloud",
        "Photoshop",
        "Illustrator",
        "After Effects",
        "Premiere Pro",
        "Lightroom",
        "Audition",
        "Animate",
        "Blender",
        "Unreal Engine",
        "Cascadeur",
        "Aseprite",
        "ComfyUI",
        "GitHub",
        "VS Code",
        "Visual Studio",
        "C++",
        "Python",
        "Steamworks",
        "3D print slicers",
        "Bambu Lab",
        "p5.js",
        "Lottie Files"
    ];

    function setLeftMode(mode) {
        var showComponents = mode === "components";
        var showTools = mode === "tools";
        el.worksPanel.classList.toggle("is-hidden", showComponents || showTools);
        el.componentsPanel.classList.toggle("is-hidden", !showComponents);
        el.toolsPanel.classList.toggle("is-hidden", !showTools);
        el.showWorksBtn.classList.toggle("is-hidden", !showComponents && !showTools);
    }

    function capturePreviewScroll() {
        try {
            if (!el.workPreview.contentWindow) {
                return;
            }
            state.previewScroll.x = el.workPreview.contentWindow.scrollX || 0;
            state.previewScroll.y = el.workPreview.contentWindow.scrollY || 0;
        } catch (error) {
            state.previewScroll.x = 0;
            state.previewScroll.y = 0;
        }
    }

    function applyPreviewSelectionState() {
        try {
            var doc = el.workPreview.contentDocument;
            if (!doc) {
                return;
            }

            var nodes = doc.querySelectorAll("[data-cms-component-index]");
            nodes.forEach(function (node) {
                var idx = Number(node.getAttribute("data-cms-component-index"));
                node.classList.toggle("is-selected", idx === state.selectedComponentIndex);
                node.classList.toggle("is-hovered", idx === state.hoveredComponentIndex);
            });
        } catch (error) {
            // no-op for cross-origin embeds inside preview
        }
    }

    function setStatus(message, tone) {
        el.status.textContent = message;
        el.status.className = "cms-status" + (tone ? " is-" + tone : "");
    }

    function setSaveButtonState(label, disabled) {
        el.saveAllBtn.textContent = label;
        el.saveAllBtn.disabled = !!disabled;
        el.saveAllBtn.classList.toggle("is-busy", !!disabled);
    }

    function setLocalTarget(message) {
        if (el.target) {
            el.target.textContent = message;
        }
    }

    function getLocalWriteDescription() {
        if (state.mode === "api" && state.apiRoot) {
            return "Local server root: " + state.apiRoot;
        }

        if (state.mode === "fs" && state.dirHandle) {
            return "Local folder: " + state.dirHandle.name;
        }

        if (state.mode === "fs") {
            return "Connect a local folder to write files";
        }

        return "No local write target";
    }

    function slugify(value) {
        return (value || "")
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-");
    }

    function escapeHtml(value) {
        return (value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function basename(path) {
        return (path || "").replace(/\\/g, "/").split("/").pop();
    }

    function dirname(path) {
        var normalized = (path || "").replace(/\\/g, "/");
        var idx = normalized.lastIndexOf("/");
        return idx === -1 ? "" : normalized.slice(0, idx);
    }

    function buildPreviewBaseHref(workHref) {
        var dir = normalizePath(dirname(workHref));
        return dir ? "/" + dir + "/" : "/";
    }

    function normalizePath(value) {
        return (value || "").replace(/\\/g, "/").replace(/^\/+/, "");
    }

    function relativePathFromWork(workHref, targetPath) {
        var fromDir = normalizePath(dirname(workHref));
        var to = normalizePath(targetPath);

        if (!fromDir) {
            return to;
        }

        var fromParts = fromDir.split("/").filter(Boolean);
        var toParts = to.split("/").filter(Boolean);
        var i = 0;
        while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
            i += 1;
        }

        var up = new Array(fromParts.length - i).fill("..");
        var down = toParts.slice(i);
        return up.concat(down).join("/") || "./";
    }

    function previewText(value, maxLength) {
        var cleaned = (value || "").replace(/\s+/g, " ").trim();
        if (!cleaned) {
            return "...";
        }
        if (cleaned.length <= maxLength) {
            return cleaned;
        }
        return cleaned.slice(0, maxLength - 1) + "...";
    }

    function resolveRelativePath(basePath, targetPath) {
        var baseParts = normalizePath(basePath).split("/").filter(Boolean);
        if (baseParts.length) {
            baseParts.pop();
        }

        normalizePath(targetPath).split("/").forEach(function (part) {
            if (!part || part === ".") {
                return;
            }
            if (part === "..") {
                baseParts.pop();
                return;
            }
            baseParts.push(part);
        });

        return baseParts.join("/");
    }

    function getWorkStyleHref(doc, workHref) {
        if (!doc) {
            return "";
        }

        var links = Array.from(doc.querySelectorAll('link[rel="stylesheet"][href]'));
        for (var i = links.length - 1; i >= 0; i -= 1) {
            var href = links[i].getAttribute("href") || "";
            if (!href || /^https?:\/\//i.test(href)) {
                continue;
            }
            if (href.indexOf("style/css.css") !== -1) {
                continue;
            }
            if (!/\.css(?:\?.*)?$/i.test(href)) {
                continue;
            }
            return resolveRelativePath(workHref, href);
        }

        return "";
    }

    function parseCssVar(cssText, name) {
        var regex = new RegExp("(--" + name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") + "\\s*:\\s*)([^;]+)(;)", "i");
        var match = regex.exec(cssText || "");
        return match ? match[2].replace(/!important/gi, "").trim() : "";
    }

    function normalizeColorValue(value) {
        if (!value) {
            return "";
        }
        var tester = document.createElement("span");
        tester.style.color = "";
        tester.style.color = value.trim();
        if (!tester.style.color) {
            return "";
        }
        document.body.appendChild(tester);
        var computed = window.getComputedStyle(tester).color;
        tester.remove();
        var rgbMatch = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(computed || "");
        if (!rgbMatch) {
            return "";
        }
        var toHex = function (part) {
            var hex = Number(part).toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        };
        return "#" + toHex(rgbMatch[1]) + toHex(rgbMatch[2]) + toHex(rgbMatch[3]);
    }

    function buildIndexPaletteCss(palette) {
        if (!palette) {
            return "";
        }
        return ":root{--main-color:" + palette.mainColor + " !important;--secondary-color:" + palette.secondaryColor + " !important;--background-color:" + palette.backgroundColor + " !important;}";
    }

    function applyIndexPaletteToDoc(doc) {
        if (!doc || !doc.head) {
            return;
        }
        var style = doc.getElementById("cms-index-inline-vars");
        if (!style) {
            style = doc.createElement("style");
            style.id = "cms-index-inline-vars";
            doc.head.appendChild(style);
        }
        style.textContent = buildIndexPaletteCss(state.indexPalette);
    }

    function parseIndexPaletteFromDoc() {
        if (!state.indexDoc) {
            return;
        }
        var style = state.indexDoc.getElementById("cms-index-inline-vars");
        if (!style) {
            return;
        }
        var cssText = style.textContent || "";
        var main = normalizeColorValue(parseCssVar(cssText, "main-color"));
        var secondary = normalizeColorValue(parseCssVar(cssText, "secondary-color"));
        var background = normalizeColorValue(parseCssVar(cssText, "background-color"));
        if (main) state.indexPalette.mainColor = main;
        if (secondary) state.indexPalette.secondaryColor = secondary;
        if (background) state.indexPalette.backgroundColor = background;
    }

    function renderIndexPaletteControls() {
        if (!el.indexMainColor) {
            return;
        }
        el.indexMainColor.value = state.indexPalette.mainColor;
        el.indexMainColorText.value = state.indexPalette.mainColor;
        el.indexSecondaryColor.value = state.indexPalette.secondaryColor;
        el.indexSecondaryColorText.value = state.indexPalette.secondaryColor;
        el.indexBackgroundColor.value = state.indexPalette.backgroundColor;
        el.indexBackgroundColorText.value = state.indexPalette.backgroundColor;
    }

    function splitToolsList(value) {
        return (value || "")
            .split(/[\n,]+/)
            .map(function (item) {
                return item.trim();
            })
            .filter(Boolean);
    }

    function renderToolSelector(selectedTools) {
        if (!el.articleTools) {
            return;
        }

        var selectedSet = new Set((selectedTools || []).map(function (tool) {
            return (tool || "").toLowerCase();
        }));

        el.articleTools.innerHTML = canonicalToolOptions.map(function (tool, index) {
            var isSelected = selectedSet.has(tool.toLowerCase());
            var id = "articleTool_" + index;
            var iconUrl = getToolIconUrl(tool);
            return (
                '<label class="work-tool-option" for="' + id + '">' +
                    '<input type="checkbox" id="' + id + '" value="' + escapeHtml(tool) + '"' + (isSelected ? ' checked' : '') + '>' +
                    '<img class="work-tool-icon" src="' + escapeHtml(iconUrl) + '" alt="">' +
                    '<span>' + escapeHtml(tool) + '</span>' +
                '</label>'
            );
        }).join('');
    }

    function getSelectedToolValues() {
        if (!el.articleTools) {
            return [];
        }

        return Array.from(el.articleTools.querySelectorAll('input[type="checkbox"]:checked')).map(function (checkbox) {
            return checkbox.value;
        });
    }

    function getToolIconUrl(toolName) {
        var catalog = {
            "Adobe Creative Cloud": "https://api.iconify.design/simple-icons:adobecreativecloud.svg",
            "Creative Cloud": "https://api.iconify.design/simple-icons:adobecreativecloud.svg",
            Photoshop: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/photoshop/photoshop-original.svg",
            Illustrator: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/illustrator/illustrator-original.svg",
            XD: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/xd/xd-original.svg",
            "After Effects": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/aftereffects/aftereffects-original.svg",
            "Premiere Pro": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/premierepro/premierepro-original.svg",
            Lightroom: "https://www.adobe.com/content/dam/shared/images/product-icons/svg/lightroom.svg",
            Audition: "https://www.adobe.com/content/dam/shared/images/product-icons/svg/audition.svg",
            Animate: "https://www.adobe.com/content/dam/shared/images/product-icons/svg/animate.svg",
            Blender: "https://cdn.simpleicons.org/blender/F5792A",
            "Unreal Engine": "https://api.iconify.design/simple-icons:unrealengine.svg",
            Cascadeur: "https://api.iconify.design/mdi:human-handsup.svg?color=%23007ACC",
            Aseprite: "https://api.iconify.design/simple-icons:aseprite.svg",
            ComfyUI: "https://comfy.org/icons/logo.svg",
            GitHub: "https://cdn.simpleicons.org/github/181717",
            "VS Code": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vscode/vscode-original.svg",
            "Visual Studio": "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/visualstudio/visualstudio-plain.svg",
            "C++": "https://cdn.simpleicons.org/cplusplus/00599C",
            Python: "https://cdn.simpleicons.org/python/3776AB",
            Steamworks: "https://cdn.simpleicons.org/steam/000000",
            Figma: "https://cdn.simpleicons.org/figma/F24E1E",
            HTML: "https://cdn.simpleicons.org/html5/E34F26",
            CSS: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg",
            JavaScript: "https://cdn.simpleicons.org/javascript/F7DF1E",
            "3D print slicers": "https://api.iconify.design/mdi:printer-3d.svg?color=%23F9A41D",
            "Bambu Lab": "https://api.iconify.design/simple-icons:bambulab.svg",
            "p5.js": "https://api.iconify.design/simple-icons:p5dotjs.svg",
            "Lottie Files": "https://api.iconify.design/simple-icons:lottiefiles.svg"
        };

        return catalog[toolName] || "https://api.iconify.design/mdi:tag-outline.svg";
    }

    function toolUrlForName(name) {
        var catalog = {
            "Adobe Creative Cloud": "https://www.adobe.com/creativecloud.html",
            "Creative Cloud": "https://www.adobe.com/creativecloud.html",
            Photoshop: "https://www.adobe.com/products/photoshop.html",
            Illustrator: "https://www.adobe.com/products/illustrator.html",
            XD: "https://www.adobe.com/products/xd.html",
            "After Effects": "https://www.adobe.com/products/aftereffects.html",
            "Premiere Pro": "https://www.adobe.com/products/premiere.html",
            Lightroom: "https://www.adobe.com/products/photoshop-lightroom.html",
            Audition: "https://www.adobe.com/products/audition.html",
            Animate: "https://www.adobe.com/products/animate.html",
            Blender: "https://www.blender.org/",
            "Unreal Engine": "https://www.unrealengine.com/",
            Cascadeur: "https://cascadeur.com/",
            Aseprite: "https://www.aseprite.org/",
            ComfyUI: "https://github.com/comfyanonymous/ComfyUI",
            GitHub: "https://github.com/",
            "VS Code": "https://code.visualstudio.com/",
            "Visual Studio": "https://visualstudio.microsoft.com/",
            "C++": "https://isocpp.org/",
            Python: "https://www.python.org/",
            Steamworks: "https://partner.steamgames.com/doc/home",
            Figma: "https://www.figma.com/",
            HTML: "https://developer.mozilla.org/en-US/docs/Web/HTML",
            CSS: "https://developer.mozilla.org/en-US/docs/Web/CSS",
            JavaScript: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
            "3D print slicers": "https://www.prusa3d.com/page/prusaslicer_424/",
            "Bambu Lab": "https://bambulab.com/",
            "p5.js": "https://p5js.org/",
            "Lottie Files": "https://lottiefiles.com/"
        };

        return catalog[name] || "";
    }

    function parseToolsFromDoc(doc) {
        var toolsNode = doc ? doc.getElementById("work_tools") : null;
        if (!toolsNode) {
            return [];
        }

        var items = Array.from(toolsNode.querySelectorAll("a, li, span, .work-tool")).map(function (node) {
            return (node.textContent || "").trim();
        }).filter(Boolean);

        if (!items.length) {
            items = splitToolsList(toolsNode.textContent || "");
        }

        return items;
    }

    function renderToolsBlock(doc, work) {
        var showcase = doc.querySelector("#showcase_large");
        if (!showcase) {
            return null;
        }

        var existing = doc.getElementById("work_tools");
        if (!work.tools || !work.tools.length) {
            if (existing) {
                existing.remove();
            }
            return null;
        }

        var node = existing || doc.createElement("div");
        node.id = "work_tools";
        node.className = "work-tools";
        node.innerHTML = "";

        work.tools.forEach(function (toolName) {
            var link = doc.createElement("a");
            var url = toolUrlForName(toolName);
            link.className = "work-tool";
            link.textContent = toolName;
            if (url) {
                link.href = url;
                link.target = "_blank";
                link.rel = "noreferrer noopener";
            }
            node.appendChild(link);
        });

        var title = showcase.querySelector("h2");
        if (title) {
            showcase.insertBefore(node, title.nextSibling);
        } else {
            showcase.insertBefore(node, showcase.firstChild);
        }

        return node;
    }

    function applyPaletteToCss(cssText, palette) {
        var nextText = cssText || "";

        function replaceVar(name, value) {
            var regex = new RegExp("(--" + name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") + "\\s*:\\s*)([^;]+)(;)", "i");
            if (regex.test(nextText)) {
                nextText = nextText.replace(regex, "$1" + value + " !important$3");
                return;
            }

            if (/:root\s*\{/.test(nextText)) {
                nextText = nextText.replace(/:root\s*\{/, ":root {\n    --" + name + ": " + value + " !important;");
                return;
            }

            nextText = ":root {\n    --" + name + ": " + value + " !important;\n}\n\n" + nextText;
        }

        if (palette.mainColor) {
            replaceVar("main-color", palette.mainColor);
        }
        if (palette.secondaryColor) {
            replaceVar("secondary-color", palette.secondaryColor);
        }
        if (palette.backgroundColor) {
            replaceVar("background-color", palette.backgroundColor);
        }

        return nextText;
    }

    function buildPaletteOverrideCss(work) {
        if (!work || !work.palette) {
            return "";
        }

        var rules = [];
        if (work.palette.mainColor) {
            rules.push("--main-color: " + work.palette.mainColor + " !important;");
        }
        if (work.palette.secondaryColor) {
            rules.push("--secondary-color: " + work.palette.secondaryColor + " !important;");
        }
        if (work.palette.backgroundColor) {
            rules.push("--background-color: " + work.palette.backgroundColor + " !important;");
        }
        return rules.length ? ":root{" + rules.join("") + "}" : "";
    }

    function getInlinePaletteCss(doc) {
        var style = doc ? doc.getElementById("cms-palette-inline") : null;
        return style ? style.textContent || "" : "";
    }

    function extractComputedPalette(doc) {
        if (!doc || !doc.documentElement) {
            return null;
        }

        var rootStyle = window.getComputedStyle(doc.documentElement);
        var bodyStyle = doc.body ? window.getComputedStyle(doc.body) : null;
        var mainColor = normalizeColorValue(rootStyle.getPropertyValue("--main-color"));
        var secondaryColor = normalizeColorValue(rootStyle.getPropertyValue("--secondary-color"));
        var backgroundColor = normalizeColorValue(rootStyle.getPropertyValue("--background-color")) || (bodyStyle ? normalizeColorValue(bodyStyle.backgroundColor) : "");

        if (!mainColor && !secondaryColor && !backgroundColor) {
            return null;
        }

        return {
            mainColor: mainColor,
            secondaryColor: secondaryColor,
            backgroundColor: backgroundColor
        };
    }

    function syncSelectedWorkPaletteFromPreview() {
        var work = state.selectedWork;
        var doc = el.workPreview.contentDocument;
        if (!work || !doc) {
            return;
        }

        var computed = extractComputedPalette(doc);
        if (!computed) {
            return;
        }

        var nextPalette = work.palette || { mainColor: "", secondaryColor: "", backgroundColor: "" };
        var changed = false;

        ["mainColor", "secondaryColor", "backgroundColor"].forEach(function (key) {
            if (computed[key] && nextPalette[key] !== computed[key]) {
                nextPalette[key] = computed[key];
                changed = true;
            }
        });

        if (changed) {
            work.palette = nextPalette;
            renderArticleProps();
        }
    }

    function patchPreviewPalette() {
        if (state.previewView !== "article") {
            return;
        }
        try {
            var doc = el.workPreview.contentDocument;
            var work = state.selectedWork;
            if (!doc || !work) {
                return;
            }
            var style = doc.getElementById("cms-palette-override");
            if (!style) {
                style = doc.createElement("style");
                style.id = "cms-palette-override";
                doc.head.appendChild(style);
            }
            style.textContent = buildPaletteOverrideCss(work);
        } catch (error) {
            // ignore
        }
    }

    function plainTextToHtml(value) {
        return escapeHtml(value || "").replace(/\r?\n/g, "<br>");
    }

    function sourceLabel(src) {
        if (!src) {
            return "(no source)";
        }
        var cleaned = src.trim();
        if (cleaned.indexOf("vimeo.com") !== -1) {
            return "vimeo";
        }
        if (cleaned.indexOf("youtube.com") !== -1 || cleaned.indexOf("youtu.be") !== -1) {
            return "youtube";
        }
        return basename(cleaned);
    }

    function mediaLabel(cmp) {
        var title = (cmp && cmp.title) ? cmp.title.trim() : "";
        if (title) {
            return title;
        }
        return sourceLabel(cmp && cmp.src);
    }

    function isThirdPartyVideoEmbed(src) {
        if (!src) {
            return false;
        }

        try {
            var url = new URL(src, window.location.href);
            var host = (url.hostname || "").toLowerCase();
            return (
                host.indexOf("youtube.com") !== -1 ||
                host.indexOf("youtube-nocookie.com") !== -1 ||
                host.indexOf("youtu.be") !== -1 ||
                host.indexOf("vimeo.com") !== -1
            );
        } catch (error) {
            return false;
        }
    }

    function buildPreviewEmbedPlaceholder(doc, src, title) {
        var wrap = doc.createElement("div");
        wrap.className = "cms-preview-embed-placeholder";

        var heading = doc.createElement("strong");
        heading.textContent = title || "Embedded video";

        var note = doc.createElement("p");
        note.textContent = "Video is shown as a lightweight preview in CMS. Open the source in a new tab.";

        var link = doc.createElement("a");
        link.className = "def_button";
        link.href = src || "#";
        link.target = "_blank";
        link.rel = "noreferrer noopener";
        link.textContent = "Open video";

        wrap.appendChild(heading);
        wrap.appendChild(note);
        wrap.appendChild(link);
        return wrap;
    }

    function replaceThirdPartyEmbedsForPreview(doc) {
        if (!doc) {
            return;
        }
    }

    function buildApiUrl(path) {
        var base = state.apiBase || "";
        return base ? base + path : path;
    }

    var VIDEO_METADATA_SRC_RE = /videos\/uploads\/[^/]+\/metadata\.json/i;

    // Uploaded/processed videos store `metadata.json` as the component src (so the
    // live site can pick the best chunked/preview file at runtime via work_video.js).
    // That path isn't itself playable, so for any editor preview we resolve it to an
    // actual video file async and swap it in once the server responds.
    function resolveVideoMetadataSrc(video, videoSrc) {
        if (!video || !videoSrc || !VIDEO_METADATA_SRC_RE.test(videoSrc)) {
            return;
        }
        fetch(buildApiUrl("/" + videoSrc.replace(/^\//, "")))
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (meta) {
                if (!meta || !meta.work_name) return;
                var base = "videos/uploads/" + meta.work_name + "/";
                var preview = meta.index_preview || meta.preview_mp4 || meta.preview;
                var resolved = preview ? base + preview
                    : (meta.chunks && meta.chunks.length ? base + meta.chunks[0].path : "");
                if (resolved && video.isConnected) {
                    video.src = buildApiUrl("/" + resolved);
                    video.load();
                }
            })
            .catch(function () {});
    }

    async function detectApiBase() {
        var candidates = ["", "http://127.0.0.1:8000", "http://localhost:8000"];
        for (var i = 0; i < candidates.length; i += 1) {
            var base = candidates[i];
            try {
                var response = await fetch((base || "") + "/cms-api/status", { cache: "no-store" });
                if (!response.ok) {
                    continue;
                }
                var data = await response.json();
                if (data && data.ok) {
                    return {
                        base: base,
                        root: data.root || ""
                    };
                }
            } catch (error) {
                // try next candidate
            }
        }
        return null;
    }

    async function detectMode() {
        var apiInfo = await detectApiBase();
        if (apiInfo !== null) {
            state.apiBase = apiInfo.base;
            state.apiRoot = apiInfo.root || "";
            state.mode = "api";
            el.connectFolderBtn.textContent = "Reload Files";
            el.saveAllBtn.textContent = "Save Local Files";
            el.connectFolderBtn.classList.remove("is-hidden");
            setLocalTarget(getLocalWriteDescription());
            setStatus("API mode actief: deze CMS schrijft direct naar je lokale projectbestanden.", "info");
            return;
        }

        if (typeof window.showDirectoryPicker === "function") {
            state.mode = "fs";
            el.connectFolderBtn.textContent = "Connect Local Folder";
            el.saveAllBtn.textContent = "Save Local Files";
            el.connectFolderBtn.classList.remove("is-hidden");
            setLocalTarget(getLocalWriteDescription());
            setStatus("Koppel je projectmap om direct naar lokale bestanden te schrijven.", "info");
            return;
        }

        state.mode = "fallback";
        el.connectFolderBtn.classList.add("is-hidden");
        el.saveAllBtn.textContent = "Save Local Files";
        setLocalTarget(getLocalWriteDescription());
        setStatus("Deze browser kan geen lokale files schrijven. Gebruik de lokale CMS-server of een browser met folder access.", "error");
    }

    async function apiGetText(url) {
        var response = await fetch(buildApiUrl(url), { cache: "no-store" });
        if (!response.ok) {
            throw new Error("API GET mislukt: " + response.status);
        }
        return await response.text();
    }

    async function apiPostJson(url, payload) {
        var response = await fetch(buildApiUrl(url), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            var text = await response.text();
            throw new Error(text || ("API POST mislukt: " + response.status));
        }
        return await response.json();
    }

    async function verifyApiSave(selectedWork) {
        if (!selectedWork) {
            return { ok: true, details: "No selected work to verify." };
        }

        var expectedTitle = selectedWork.title || "";
        var indexHtml = await apiGetText("/cms-api/index");
        var workHtml = await apiGetText("/cms-api/work?path=" + encodeURIComponent(selectedWork.href));

        var indexOk = expectedTitle ? indexHtml.indexOf(expectedTitle) !== -1 : true;
        var workOk = expectedTitle ? workHtml.indexOf(expectedTitle) !== -1 : true;

        return {
            ok: indexOk && workOk,
            details: "Verification: index=" + (indexOk ? "ok" : "missing") + ", work=" + (workOk ? "ok" : "missing")
        };
    }

    async function tryFetchSiteFile(path) {
        try {
            var response = await fetch(path, { cache: "no-store" });
            if (!response.ok) {
                return "";
            }
            return await response.text();
        } catch (error) {
            return "";
        }
    }

    function getNodeByPath(root, path) {
        var node = root;
        if (!node || !path) {
            return null;
        }

        for (var i = 0; i < path.length; i += 1) {
            if (!node.children || !node.children[path[i]]) {
                return null;
            }
            node = node.children[path[i]];
        }

        return node || null;
    }

    function makePath(currentPath, index) {
        var next = currentPath.slice();
        next.push(index);
        return next;
    }

    function findComponentNode(work, idx, docOverride) {
        var cmp = work && work.components && work.components[idx];
        var path = cmp && cmp.sourcePath;
        if (!work || !cmp || !path) {
            return null;
        }

        return getNodeByPath((docOverride || work.doc).querySelector("#assignment_desc"), path);
    }

    function setComponentAttributes(node, cmp) {
        if (!node || !cmp) {
            return;
        }

        if (cmp.type === "heading") {
            if (node.tagName && node.tagName.toLowerCase() !== "h" + (cmp.level || 3)) {
                var heading = node.ownerDocument.createElement("h" + (cmp.level || 3));
                heading.innerHTML = cmp.html || escapeHtml(cmp.text || "");
                node.replaceWith(heading);
                node = heading;
            }
            node.innerHTML = cmp.html || escapeHtml(cmp.text || "");
            return;
        }

        if (cmp.type === "paragraph") {
            if (node.tagName && node.tagName.toLowerCase() !== "p") {
                var paragraph = node.ownerDocument.createElement("p");
                paragraph.innerHTML = cmp.html || escapeHtml(cmp.text || "");
                node.replaceWith(paragraph);
                node = paragraph;
            }
            node.className = cmp.className || "";
            node.innerHTML = cmp.html || escapeHtml(cmp.text || "");
            return;
        }

        if (cmp.type === "link") {
            if (node.tagName && node.tagName.toLowerCase() !== "a") {
                return;
            }
            if (cmp.href) node.setAttribute("href", cmp.href);
            if (cmp.target) node.setAttribute("target", cmp.target);
            if (cmp.rel) node.setAttribute("rel", cmp.rel);
            if (cmp.className) node.setAttribute("class", cmp.className);
            node.innerHTML = cmp.html || escapeHtml(cmp.text || cmp.href || "");
            return;
        }

        if (cmp.type === "image") {
            var fig = node.tagName && node.tagName.toLowerCase() === "figure" ? node : node.closest("figure");
            if (fig) {
                fig.className = "image-" + (cmp.imageSize || "full");
                var img = fig.querySelector("img");
                if (img) {
                    img.setAttribute("src", cmp.src || "");
                    if (cmp.alt) img.setAttribute("alt", cmp.alt);
                }
            }
            return;
        }

        if (cmp.type === "iframe") {
            var iframe = node.tagName && node.tagName.toLowerCase() === "iframe" ? node : node.querySelector("iframe");
            if (!iframe) {
                return;
            }
            iframe.setAttribute("src", buildIframeSrc(cmp) || "");
            iframe.setAttribute("frameborder", "0");
            iframe.setAttribute("allow", cmp.allow || iframe.getAttribute("allow") || "autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share");
            iframe.setAttribute("referrerpolicy", cmp.referrerpolicy || iframe.getAttribute("referrerpolicy") || "strict-origin-when-cross-origin");
            if (cmp.title) {
                iframe.setAttribute("title", cmp.title);
            }
            return;
        }

        if (cmp.type === "video") {
            var video = node.tagName && node.tagName.toLowerCase() === "video" ? node : node.querySelector("video");
            if (!video) {
                return;
            }
            video.setAttribute("src", cmp.src || "");
            resolveVideoMetadataSrc(video, cmp.src || "");
            video.setAttribute("playsinline", "");
            if (cmp.controls === false) {
                video.removeAttribute("controls");
            } else {
                video.setAttribute("controls", "");
            }
            if (cmp.ytAutoplay) {
                video.setAttribute("autoplay", "");
                video.setAttribute("muted", "");
            } else {
                video.removeAttribute("autoplay");
                video.removeAttribute("muted");
            }
            if (cmp.ytMute) video.setAttribute("muted", "");
            if (cmp.ytLoop) { video.setAttribute("loop", ""); } else { video.removeAttribute("loop"); }
            if (cmp.isShort) {
                video.style.aspectRatio = "9/16";
                video.style.maxWidth = "320px";
                video.style.margin = "0 auto";
                video.style.display = "block";
                video.style.maxHeight = "none";
            } else {
                video.style.aspectRatio = "";
                video.style.maxWidth = "";
                video.style.margin = "";
                video.style.display = "";
                video.style.maxHeight = "520px";
            }
            return;
        }

        if (cmp.type === "list") {
            if (!node || !node.tagName) {
                return;
            }
            var tagName = cmp.ordered ? "ol" : "ul";
            if (node.tagName.toLowerCase() !== tagName) {
                var replacement = node.ownerDocument.createElement(tagName);
                (cmp.items || []).forEach(function (item) {
                    var li = node.ownerDocument.createElement("li");
                    li.textContent = item;
                    replacement.appendChild(li);
                });
                node.replaceWith(replacement);
                return;
            }
            node.innerHTML = "";
            (cmp.items || []).forEach(function (item) {
                var li = node.ownerDocument.createElement("li");
                li.textContent = item;
                node.appendChild(li);
            });
            return;
        }

        if (cmp.type === "button") {
            if (node.tagName && node.tagName.toLowerCase() !== "a") {
                return;
            }
            var btnHref = normalizeButtonHref(cmp.href);
            if (btnHref !== "#") node.setAttribute("href", btnHref);
            else node.removeAttribute("href");
            if (cmp.target) {
                node.setAttribute("target", cmp.target);
                node.setAttribute("rel", "noopener noreferrer");
            } else {
                node.removeAttribute("target");
                node.removeAttribute("rel");
            }
            if (cmp.className) node.setAttribute("class", cmp.className);
            else node.removeAttribute("class");
            node.innerHTML = escapeHtml(cmp.text || "Button");
        }
    }

    function parseIndex() {
        var parser = new DOMParser();
        state.indexDoc = parser.parseFromString(state.indexText, "text/html");

        var cards = state.indexDoc.querySelectorAll("#assignment_list .work-card");
        state.works = Array.from(cards).map(function (card) {
            var href = card.getAttribute("href");
            var title = (card.querySelector(".work-card-title") || {}).textContent || href;
            var cleanTitle = title.replace(/^★\s*/, "").trim();
            var category = (card.querySelector(".work-card-cat") || {}).textContent || "";
            var desc = (card.querySelector(".work-card-desc") || {}).textContent || "";
            var preview = card.getAttribute("data-preview") || "";
            var previewStart = parseFloat(card.getAttribute("data-preview-start")) || 0;
            var favorite = card.getAttribute("data-favorite") === "true" || card.classList.contains("is-favorite") || !!card.querySelector(".work-card-star") || /^★/.test(title.trim());
            var visible = card.getAttribute("data-visible") !== "false";
            var highlight = card.getAttribute("data-highlight") === "2x2" || card.classList.contains("work-card--highlight");

            return {
                href: href,
                title: cleanTitle,
                category: category,
                description: desc,
                preview: preview,
                previewStartTime: previewStart,
                favorite: favorite,
                highlight: highlight,
                visible: visible,
                tools: [],
                htmlText: "",
                styleHref: "",
                styleText: "",
                palette: { mainColor: "", secondaryColor: "", backgroundColor: "" },
                doc: null,
                components: []
            };
        });

        parseIndexPaletteFromDoc();
        renderIndexPaletteControls();
    }

    function renderWorkList() {
        var q = (el.workSearch.value || "").toLowerCase();
        el.workList.innerHTML = "";

        state.works.forEach(function (work, idx) {
            if (q && work.title.toLowerCase().indexOf(q) === -1 && work.href.toLowerCase().indexOf(q) === -1) {
                return;
            }

            var li = document.createElement("li");
            li.className = "work-item" + (state.selectedWork === work ? " active" : "");
            li.draggable = true;
            var flags = (work.favorite ? "★ " : "") + (work.highlight ? "▣ " : "");
            li.innerHTML = "<div>" + flags + escapeHtml(work.title) + "</div>";
            li.addEventListener("dragstart", function (event) {
                state.draggingWorkIndex = idx;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(idx));
                li.classList.add("is-dragging");
            });
            li.addEventListener("dragend", function () {
                state.draggingWorkIndex = -1;
                li.classList.remove("is-dragging");
                renderWorkList();
            });
            li.addEventListener("dragover", function (event) {
                if (state.draggingWorkIndex === -1 || state.draggingWorkIndex === idx) {
                    return;
                }
                event.preventDefault();
                li.classList.add("drop-target");
            });
            li.addEventListener("dragleave", function () {
                li.classList.remove("drop-target");
            });
            li.addEventListener("drop", function (event) {
                event.preventDefault();
                li.classList.remove("drop-target");
                var fromIdx = state.draggingWorkIndex;
                if (fromIdx === -1 || fromIdx === idx) {
                    return;
                }
                var moved = state.works.splice(fromIdx, 1)[0];
                state.works.splice(idx, 0, moved);
                state.draggingWorkIndex = -1;
                state.dirty = true;
                renderWorkList();
            });
            li.addEventListener("click", function () {
                selectWork(idx);
            });
            el.workList.appendChild(li);
        });
    }

    async function readFileFromHandle(fileHandle) {
        var file = await fileHandle.getFile();
        return await file.text();
    }

    async function getFileHandleFromPath(dirHandle, relativePath, create) {
        var normalized = normalizePath(relativePath);
        var parts = normalized.split("/").filter(Boolean);
        var currentDir = dirHandle;

        for (var i = 0; i < parts.length - 1; i += 1) {
            currentDir = await currentDir.getDirectoryHandle(parts[i], { create: !!create });
        }

        return await currentDir.getFileHandle(parts[parts.length - 1], { create: !!create });
    }

    async function writeTextFile(fileHandle, text) {
        var writable = await fileHandle.createWritable();
        await writable.write(text);
        await writable.close();
    }

    async function loadWorkDoc(work) {
        if (work.doc) {
            return;
        }

        var inMemory = state.fileStore.get(work.href) || state.fileStore.get(basename(work.href)) || "";
        var html = "";

        if (inMemory) {
            html = inMemory;
        } else if (state.mode === "api") {
            html = await apiGetText("/cms-api/work?path=" + encodeURIComponent(work.href));
        } else if (state.mode === "fs" && state.dirHandle) {
            var handle = await getFileHandleFromPath(state.dirHandle, work.href, false);
            html = await readFileFromHandle(handle);
        } else {
            html = await tryFetchSiteFile("../" + work.href);
            if (!html) {
                setStatus("File not imported: " + work.href + ". Import additional HTML files.");
                return;
            }
        }

        work.htmlText = html;
        var parser = new DOMParser();
        work.doc = parser.parseFromString(html, "text/html");
        work.styleHref = getWorkStyleHref(work.doc, work.href);
        work.tools = parseToolsFromDoc(work.doc);
        var inlinePaletteCss = getInlinePaletteCss(work.doc);

        if (work.styleHref) {
            if (state.mode === "fs" && state.dirHandle) {
                var styleHandle = await getFileHandleFromPath(state.dirHandle, work.styleHref, false);
                work.styleText = await readFileFromHandle(styleHandle);
            } else {
                work.styleText = await tryFetchSiteFile("/" + normalizePath(work.styleHref));
            }
        }

        var paletteSource = inlinePaletteCss || work.styleText || "";
        if (paletteSource) {
            work.palette = {
                mainColor: normalizeColorValue(parseCssVar(paletteSource, "main-color")) || "#000000",
                secondaryColor: normalizeColorValue(parseCssVar(paletteSource, "secondary-color")) || normalizeColorValue(parseCssVar(paletteSource, "main-color")) || "#6f5cff",
                backgroundColor: normalizeColorValue(parseCssVar(paletteSource, "background-color")) || "#ffffff"
            };
        } else {
            work.palette = {
                mainColor: "#000000",
                secondaryColor: "#6f5cff",
                backgroundColor: "#ffffff"
            };
        }

        parseComponents(work);
    }

    function parseComponents(work) {
        var desc = work.doc.querySelector("#assignment_desc");
        work.components = [];

        if (!desc) {
            return;
        }

        function pushComponent(component) {
            work.components.push(component);
        }

        function walk(node, path) {
            if (!node || !node.children) {
                return;
            }

            Array.from(node.children).forEach(function (child) {
                var tag = child.tagName.toLowerCase();
                var childPath = makePath(path, Array.prototype.indexOf.call(node.children, child));

                if (/^h[1-6]$/.test(tag)) {
                    pushComponent({
                        type: "heading",
                        html: child.innerHTML || child.textContent || "",
                        text: child.textContent || "",
                        level: Number(tag.slice(1)) || 3,
                        sourcePath: childPath
                    });
                    return;
                }

                if (tag === "p") {
                    pushComponent({
                        type: "paragraph",
                        html: child.innerHTML || child.textContent || "",
                        text: child.textContent || "",
                        className: child.getAttribute("class") || "",
                        sourcePath: childPath
                    });
                    return;
                }

                if (tag === "a") {
                    var aClass = child.getAttribute("class") || "";
                    if (/def_button/.test(aClass)) {
                        pushComponent({
                            type: "button",
                            href: child.getAttribute("href") || "",
                            target: child.getAttribute("target") || "",
                            className: aClass,
                            text: child.textContent || "",
                            sourcePath: childPath
                        });
                    } else {
                        pushComponent({
                            type: "link",
                            href: child.getAttribute("href") || "",
                            target: child.getAttribute("target") || "",
                            rel: child.getAttribute("rel") || "",
                            className: aClass,
                            html: child.innerHTML || child.textContent || "",
                            text: child.textContent || "",
                            sourcePath: childPath
                        });
                    }
                    return;
                }

                if (tag === "img") {
                    var parentFigure = child.parentElement;
                    var figClass = parentFigure && parentFigure.tagName === "FIGURE" ? parentFigure.getAttribute("class") || "" : "";
                    var imageSize = "full";
                    if (figClass.indexOf("image-half") !== -1) imageSize = "half";
                    else if (figClass.indexOf("image-third") !== -1) imageSize = "third";
                    pushComponent({
                        type: "image",
                        src: child.getAttribute("src") || "",
                        alt: child.getAttribute("alt") || "",
                        imageSize: imageSize,
                        sourcePath: childPath
                    });
                    return;
                }

                if (tag === "iframe") {
                    var iframeSrc = child.getAttribute("src") || "";
                    var iframeStyle = child.getAttribute("style") || "";
                    var ytParsed = parseYouTubeParams(iframeSrc);
                    var cleanSrc = isYouTubeUrl(iframeSrc) ? stripYouTubeParams(iframeSrc) : iframeSrc;
                    pushComponent({
                        type: "iframe",
                        src: cleanSrc,
                        title: child.getAttribute("title") || "",
                        allow: child.getAttribute("allow") || "",
                        referrerpolicy: child.getAttribute("referrerpolicy") || "",
                        isShort: iframeSrc.indexOf("/shorts/") !== -1 || /aspect-ratio\s*:\s*9\s*\/\s*16/i.test(iframeStyle),
                        ytAutoplay: ytParsed.ytAutoplay,
                        ytMute: ytParsed.ytMute,
                        ytLoop: ytParsed.ytLoop,
                        ytControls: ytParsed.ytControls,
                        sourcePath: childPath
                    });
                    return;
                }

                if (tag === "video") {
                    var source = child.querySelector("source");
                    var videoSrc = (source && source.getAttribute("src")) || child.getAttribute("src") || "";
                    var videoStyle = child.getAttribute("style") || "";
                    pushComponent({
                        type: "video",
                        src: videoSrc,
                        controls: child.hasAttribute("controls"),
                        isShort: /aspect-ratio\s*:\s*9\s*\/\s*16/i.test(videoStyle),
                        ytAutoplay: child.hasAttribute("autoplay"),
                        ytMute: child.hasAttribute("muted"),
                        ytLoop: child.hasAttribute("loop"),
                        sourcePath: childPath
                    });
                    return;
                }

                if (tag === "ul" || tag === "ol") {
                    var items = Array.from(child.querySelectorAll("li")).map(function (li) {
                        return li.textContent || "";
                    });
                    pushComponent({ type: "list", items: items, ordered: tag === "ol", sourcePath: childPath });
                    return;
                }

                if (tag === "figure") {
                    walk(child, childPath);
                    return;
                }

                if (tag === "section" || tag === "div") {
                    walk(child, childPath);
                    return;
                }

                if (child.childElementCount === 0 && child.textContent && child.textContent.trim()) {
                    pushComponent({ type: "paragraph", html: child.innerHTML || child.textContent.trim(), text: child.textContent.trim(), sourcePath: childPath });
                }

                walk(child, childPath);
            });
        }

        walk(desc, []);
    }

    function componentLabel(cmp) {
        if (cmp.type === "heading") return { type: "<h" + (cmp.level || 3) + ">", text: previewText(cmp.text, 40) };
        if (cmp.type === "paragraph") return { type: "<p>", text: previewText(cmp.text, 48) };
        if (cmp.type === "link") return { type: "<a>", text: previewText(cmp.text || cmp.href, 48) };
        if (cmp.type === "image") return { type: "<img>", text: previewText(sourceLabel(cmp.src), 48) };
        if (cmp.type === "iframe") return { type: "<iframe>", text: previewText(mediaLabel(cmp), 48) };
        if (cmp.type === "video") return { type: "<video>", text: previewText(mediaLabel(cmp), 48) };
        if (cmp.type === "palette") return { type: "<palette>", text: (cmp.colors || []).slice(0, 3).join(" ") || "3 colors" };
        if (cmp.type === "list") return { type: "<ul>", text: String((cmp.items || []).length) + " items" };
        if (cmp.type === "button") return { type: "<button>", text: previewText(cmp.text || cmp.href, 48) };
        return { type: "<node>", text: cmp.type };
    }

    function renderArticleProps() {
        var work = state.selectedWork;
        if (!work) {
            return;
        }
        el.articleTitle.value = work.title;
        el.articleCategory.value = work.category;
        el.articleDesc.value = work.description;
        renderToolSelector(work.tools || []);
        el.articlePreview.value = work.preview;
        el.articlePreviewStart.value = work.previewStartTime || 0;
        el.articleMainColor.value = work.palette && work.palette.mainColor ? work.palette.mainColor : "#000000";
        el.articleMainColorText.value = work.palette && work.palette.mainColor ? work.palette.mainColor : "#000000";
        el.articleSecondaryColor.value = work.palette && work.palette.secondaryColor ? work.palette.secondaryColor : "#6f5cff";
        el.articleSecondaryColorText.value = work.palette && work.palette.secondaryColor ? work.palette.secondaryColor : "#6f5cff";
        el.articleBackgroundColor.value = work.palette && work.palette.backgroundColor ? work.palette.backgroundColor : "#ffffff";
        el.articleBackgroundColorText.value = work.palette && work.palette.backgroundColor ? work.palette.backgroundColor : "#ffffff";
        el.articleFavorite.checked = !!work.favorite;
        el.articleHighlight.checked = !!work.highlight;
        el.articleVisible.checked = work.visible !== false;
        el.previewPath.textContent = work.href;
    }

    function applyPreviewMediaSelection(serverPath) {
        if (!state.selectedWork || !serverPath) {
            return;
        }

        state.selectedWork.preview = serverPath;
        el.articlePreview.value = serverPath;
        state.dirty = true;
        renderWorkList();
        renderArticleProps();
    }

    function renderComponentList() {
        var work = state.selectedWork;
        el.componentList.innerHTML = "";
        if (!work) {
            return;
        }

        work.components.forEach(function (cmp, idx) {
            var li = document.createElement("li");
            var className = "component-item";
            if (idx === state.selectedComponentIndex) {
                className += " active";
            }
            if (idx === state.hoveredComponentIndex) {
                className += " is-hovered";
            }
            li.className = className;
            li.draggable = true;
            li.dataset.index = String(idx);
            var label = componentLabel(cmp);
            li.innerHTML =
                "<span class='cmp-type'>" + escapeHtml(label.type) + "</span>" +
                "<span class='cmp-text'>" + escapeHtml(label.text) + "</span>";
            li.addEventListener("dragstart", function (event) {
                state.draggingComponentIndex = idx;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(idx));
                li.classList.add("is-dragging");
            });
            li.addEventListener("dragend", function () {
                state.draggingComponentIndex = -1;
                li.classList.remove("is-dragging");
                renderComponentList();
            });
            li.addEventListener("dragover", function (event) {
                if (state.draggingComponentIndex === -1 || state.draggingComponentIndex === idx) {
                    return;
                }
                event.preventDefault();
                li.classList.add("drop-target");
            });
            li.addEventListener("dragleave", function () {
                li.classList.remove("drop-target");
            });
            li.addEventListener("drop", function (event) {
                event.preventDefault();
                li.classList.remove("drop-target");

                var fromIndex = state.draggingComponentIndex;
                var toIndex = idx;
                if (fromIndex === -1 || fromIndex === toIndex) {
                    return;
                }

                var work = state.selectedWork;
                if (!work) {
                    return;
                }

                var moved = work.components.splice(fromIndex, 1)[0];
                work.components.splice(toIndex, 0, moved);
                state.selectedComponentIndex = toIndex;
                state.draggingComponentIndex = -1;
                state.dirty = true;
                renderComponentList();
                renderComponentProps();
                patchPreviewStructure();
            });
            li.addEventListener("mouseenter", function () {
                state.hoveredComponentIndex = idx;
                applyPreviewSelectionState();
            });
            li.addEventListener("mouseleave", function () {
                state.hoveredComponentIndex = -1;
                applyPreviewSelectionState();
            });
            li.addEventListener("click", function () {
                state.selectedComponentIndex = idx;
                state.hoveredComponentIndex = idx;
                renderComponentList();
                renderComponentProps();
                applyPreviewSelectionState();
                patchPreviewComponent(idx);
            });
            el.componentList.appendChild(li);
        });
    }

    function refreshComponentListItem(index) {
        var work = state.selectedWork;
        if (!work || index < 0 || index >= work.components.length) {
            return;
        }

        var item = el.componentList.querySelector('li[data-index="' + String(index) + '"]');
        if (!item) {
            return;
        }

        var label = componentLabel(work.components[index]);
        var typeNode = item.querySelector('.cmp-type');
        var textNode = item.querySelector('.cmp-text');
        if (typeNode) {
            typeNode.textContent = label.type;
        }
        if (textNode) {
            textNode.textContent = label.text;
        }
    }

    function addInput(labelText, value, onInput) {
        var label = document.createElement("label");
        label.textContent = labelText;
        var input = document.createElement("input");
        input.type = "text";
        input.value = value;
        input.addEventListener("input", function () {
            onInput(input.value);
            state.dirty = true;
        });
        label.appendChild(input);
        el.componentProps.appendChild(label);
    }

    function addTextarea(labelText, value, onInput) {
        var label = document.createElement("label");
        label.textContent = labelText;
        var textarea = document.createElement("textarea");
        textarea.rows = 6;
        textarea.value = value;
        textarea.addEventListener("input", function () {
            onInput(textarea.value);
            state.dirty = true;
        });
        label.appendChild(textarea);
        el.componentProps.appendChild(label);
    }

    function htmlToPlainText(html) {
        var tmp = document.createElement("div");
        tmp.innerHTML = html || "";
        return (tmp.textContent || "").trim();
    }

    function normalizeLinkUrl(value) {
        var raw = (value || "").trim();
        if (!raw) {
            return "";
        }
        if (/^(https?:|mailto:|tel:|#|\/)/i.test(raw)) {
            return raw;
        }
        return "https://" + raw;
    }

    function addRichTextEditor(labelText, value, onChange) {
        var wrap = document.createElement("div");
        wrap.className = "richtext-field";

        var label = document.createElement("label");
        label.className = "richtext-label";
        label.textContent = labelText;
        wrap.appendChild(label);

        var toolbar = document.createElement("div");
        toolbar.className = "richtext-toolbar";
        wrap.appendChild(toolbar);

        var hints = document.createElement("div");
        hints.className = "richtext-hints";
        hints.textContent = "Shortcuts: Ctrl+B bold, Ctrl+I italic, Ctrl+U underline";
        wrap.appendChild(hints);

        var linkPanel = document.createElement("div");
        linkPanel.className = "richtext-link-panel";

        var linkUrlInput = document.createElement("input");
        linkUrlInput.type = "text";
        linkUrlInput.placeholder = "https://example.com";

        var linkTargetSelect = document.createElement("select");
        [
            { value: "", label: "Target: default" },
            { value: "_blank", label: "Target: new tab" },
            { value: "_self", label: "Target: same tab" }
        ].forEach(function (option) {
            var node = document.createElement("option");
            node.value = option.value;
            node.textContent = option.label;
            linkTargetSelect.appendChild(node);
        });

        var linkRelInput = document.createElement("input");
        linkRelInput.type = "text";
        linkRelInput.placeholder = "rel (optional)";

        var externalPresetBtn = document.createElement("button");
        externalPresetBtn.type = "button";
        externalPresetBtn.className = "def_button_small richtext-link-preset";
        externalPresetBtn.textContent = "External";
        externalPresetBtn.setAttribute("title", "Open in new tab with safe rel");

        var internalPresetBtn = document.createElement("button");
        internalPresetBtn.type = "button";
        internalPresetBtn.className = "def_button_small richtext-link-preset";
        internalPresetBtn.textContent = "Internal";
        internalPresetBtn.setAttribute("title", "Open in same tab");

        var applyLinkBtn = document.createElement("button");
        applyLinkBtn.type = "button";
        applyLinkBtn.className = "def_button_small";
        applyLinkBtn.textContent = "Apply";

        var cancelLinkBtn = document.createElement("button");
        cancelLinkBtn.type = "button";
        cancelLinkBtn.className = "def_button_small";
        cancelLinkBtn.textContent = "Cancel";

        linkPanel.appendChild(linkUrlInput);
        linkPanel.appendChild(linkTargetSelect);
        linkPanel.appendChild(linkRelInput);
        linkPanel.appendChild(externalPresetBtn);
        linkPanel.appendChild(internalPresetBtn);
        linkPanel.appendChild(applyLinkBtn);
        linkPanel.appendChild(cancelLinkBtn);
        wrap.appendChild(linkPanel);

        var editor = document.createElement("div");
        editor.className = "richtext-editor";
        editor.contentEditable = "true";
        editor.spellcheck = true;
        editor.innerHTML = value || "";

        var lastRange = null;

        function commit() {
            onChange(editor.innerHTML);
            state.dirty = true;
        }

        function saveSelection() {
            var sel = window.getSelection ? window.getSelection() : null;
            if (!sel || !sel.rangeCount) {
                return;
            }
            var range = sel.getRangeAt(0);
            if (!editor.contains(range.commonAncestorContainer)) {
                return;
            }
            lastRange = range.cloneRange();
        }

        function restoreSelection() {
            if (!lastRange || !window.getSelection) {
                return;
            }
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(lastRange);
        }

        function getSelectionAnchor() {
            var sel = window.getSelection ? window.getSelection() : null;
            if (!sel || !sel.rangeCount) {
                return null;
            }
            var node = sel.focusNode;
            if (!node) {
                return null;
            }
            if (node.nodeType === Node.TEXT_NODE) {
                node = node.parentElement;
            }
            while (node && node !== editor) {
                if (node.tagName && node.tagName.toLowerCase() === "a") {
                    return node;
                }
                node = node.parentElement;
            }
            return null;
        }

        function clearStylePropertyOnSelection(propertyName) {
            restoreSelection();
            var sel = window.getSelection ? window.getSelection() : null;
            if (!sel || !sel.rangeCount) {
                return;
            }
            var range = sel.getRangeAt(0);
            Array.from(editor.querySelectorAll("[style]")).forEach(function (node) {
                if (!range.intersectsNode(node)) {
                    return;
                }
                node.style[propertyName] = "";
                if (!(node.getAttribute("style") || "").trim()) {
                    node.removeAttribute("style");
                }
            });
            Array.from(editor.querySelectorAll("font")).forEach(function (node) {
                if (!range.intersectsNode(node)) {
                    return;
                }
                if (propertyName === "color") {
                    node.removeAttribute("color");
                }
            });
            commit();
        }

        function openLinkPanel() {
            restoreSelection();
            var activeAnchor = getSelectionAnchor();
            linkUrlInput.value = activeAnchor ? (activeAnchor.getAttribute("href") || "") : "";
            linkTargetSelect.value = activeAnchor ? (activeAnchor.getAttribute("target") || "") : "";
            linkRelInput.value = activeAnchor ? (activeAnchor.getAttribute("rel") || "") : "";
            linkPanel.classList.add("is-open");
            window.setTimeout(function () {
                linkUrlInput.focus();
            }, 0);
        }

        function closeLinkPanel() {
            linkPanel.classList.remove("is-open");
            editor.focus();
        }

        function applyLinkPreset(mode) {
            if (mode === "external") {
                linkTargetSelect.value = "_blank";
                if (!(linkRelInput.value || "").trim()) {
                    linkRelInput.value = "noopener noreferrer";
                }
                return;
            }

            if (mode === "internal") {
                linkTargetSelect.value = "_self";
                linkRelInput.value = "";
            }
        }

        function runCommand(cmd, cmdValue) {
            editor.focus();
            restoreSelection();
            try {
                if (typeof cmdValue === "undefined") {
                    document.execCommand(cmd, false);
                } else {
                    document.execCommand(cmd, false, cmdValue);
                }
            } catch (error) {
                // ignore unsupported command in this browser
            }
            saveSelection();
            commit();
        }

        function addToolButton(text, title, onClick) {
            var button = document.createElement("button");
            button.type = "button";
            button.className = "def_button_small richtext-tool";
            button.textContent = text;
            button.setAttribute("title", title);
            button.addEventListener("mousedown", function (event) {
                event.preventDefault();
                saveSelection();
            });
            button.addEventListener("click", onClick);
            toolbar.appendChild(button);
            return button;
        }

        function addToolSelect(title, options, onChange) {
            var select = document.createElement("select");
            select.className = "richtext-tool-select";
            select.setAttribute("title", title);
            options.forEach(function (option) {
                var node = document.createElement("option");
                node.value = option.value;
                node.textContent = option.label;
                select.appendChild(node);
            });
            select.addEventListener("mousedown", function (event) {
                event.preventDefault();
                saveSelection();
            });
            select.addEventListener("change", function () {
                onChange(select.value);
                select.selectedIndex = 0;
            });
            toolbar.appendChild(select);
            return select;
        }

        function addToolColor(title, onChange) {
            var input = document.createElement("input");
            input.type = "color";
            input.className = "richtext-tool-color";
            input.setAttribute("title", title);
            input.value = "#000000";
            input.addEventListener("mousedown", function (event) {
                event.preventDefault();
                saveSelection();
            });
            input.addEventListener("input", function () {
                onChange(input.value);
            });
            toolbar.appendChild(input);
            return input;
        }

        function addSeparator() {
            var sep = document.createElement("span");
            sep.className = "richtext-separator";
            sep.setAttribute("aria-hidden", "true");
            toolbar.appendChild(sep);
        }

        addToolButton("B", "Bold", function () {
            runCommand("bold");
        });
        addToolButton("I", "Italic", function () {
            runCommand("italic");
        });
        addToolButton("U", "Underline", function () {
            runCommand("underline");
        });
        addToolButton("S", "Strikethrough", function () {
            runCommand("strikeThrough");
        });
        addToolButton("Sub", "Subscript", function () {
            runCommand("subscript");
        });
        addToolButton("Sup", "Superscript", function () {
            runCommand("superscript");
        });

        addSeparator();
        addToolButton("UL", "Bulleted list", function () {
            runCommand("insertUnorderedList");
        });
        addToolButton("OL", "Numbered list", function () {
            runCommand("insertOrderedList");
        });
        addToolButton("\"", "Block quote", function () {
            runCommand("formatBlock", "blockquote");
        });
        addToolButton("Code", "Code block", function () {
            runCommand("formatBlock", "pre");
        });

        addSeparator();
        addToolButton("L", "Align left", function () {
            runCommand("justifyLeft");
        });
        addToolButton("C", "Align center", function () {
            runCommand("justifyCenter");
        });
        addToolButton("R", "Align right", function () {
            runCommand("justifyRight");
        });

        addSeparator();
        addToolSelect("Text block", [
            { value: "", label: "Text" },
            { value: "p", label: "P" },
            { value: "h2", label: "H2" },
            { value: "h3", label: "H3" },
            { value: "h4", label: "H4" },
            { value: "blockquote", label: "Quote" },
            { value: "pre", label: "Code" }
        ], function (value) {
            if (!value) {
                return;
            }
            runCommand("formatBlock", value);
        });

        addToolColor("Text color", function (value) {
            runCommand("foreColor", value);
        });
        addToolColor("Highlight", function (value) {
            runCommand("hiliteColor", value);
        });
        addToolButton("NoClr", "Remove text color", function () {
            runCommand("foreColor", "inherit");
            clearStylePropertyOnSelection("color");
        });
        addToolButton("NoHL", "Remove highlight", function () {
            runCommand("hiliteColor", "transparent");
            clearStylePropertyOnSelection("backgroundColor");
        });

        addSeparator();
        addToolButton("Link", "Insert link", function () {
            openLinkPanel();
        });
        addToolButton("Unlink", "Remove link", function () {
            runCommand("unlink");
        });
        addToolButton("Clear", "Remove formatting", function () {
            runCommand("removeFormat");
        });
        addToolButton("Undo", "Undo", function () {
            runCommand("undo");
        });
        addToolButton("Redo", "Redo", function () {
            runCommand("redo");
        });

        applyLinkBtn.addEventListener("click", function () {
            var normalized = normalizeLinkUrl(linkUrlInput.value);
            if (!normalized) {
                closeLinkPanel();
                return;
            }

            runCommand("createLink", normalized);

            var activeAnchor = getSelectionAnchor();
            if (activeAnchor) {
                if (linkTargetSelect.value) {
                    activeAnchor.setAttribute("target", linkTargetSelect.value);
                } else {
                    activeAnchor.removeAttribute("target");
                }

                var relValue = (linkRelInput.value || "").trim();
                if (relValue) {
                    activeAnchor.setAttribute("rel", relValue);
                } else {
                    activeAnchor.removeAttribute("rel");
                }
            }

            closeLinkPanel();
            commit();
        });

        cancelLinkBtn.addEventListener("click", closeLinkPanel);
        externalPresetBtn.addEventListener("click", function () {
            applyLinkPreset("external");
        });
        internalPresetBtn.addEventListener("click", function () {
            applyLinkPreset("internal");
        });

        linkUrlInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                applyLinkBtn.click();
            }
            if (event.key === "Escape") {
                event.preventDefault();
                closeLinkPanel();
            }
        });

        editor.addEventListener("mouseup", saveSelection);
        editor.addEventListener("keyup", saveSelection);
        editor.addEventListener("input", commit);
        editor.addEventListener("blur", commit);

        wrap.appendChild(editor);
        el.componentProps.appendChild(wrap);
    }

    function addSelect(labelText, value, options, onChange) {
        var label = document.createElement("label");
        label.textContent = labelText;
        var select = document.createElement("select");

        options.forEach(function (option) {
            var optionNode = document.createElement("option");
            optionNode.value = option.value;
            optionNode.textContent = option.label;
            select.appendChild(optionNode);
        });

        select.value = value;
        select.addEventListener("change", function () {
            onChange(select.value);
            state.dirty = true;
        });

        label.appendChild(select);
        el.componentProps.appendChild(label);
    }

    function fileToDataUrl(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
                resolve(reader.result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function loadServerImages() {
        async function tryApi(url) {
            try {
                var response = await fetch(url, { cache: "no-store" });
                if (!response.ok) {
                    return [];
                }
                var data = await response.json();
                return data && Array.isArray(data.images) ? data.images : [];
            } catch (error) {
                return [];
            }
        }

        function collectFromHtml(html, basePath) {
            var parser = new DOMParser();
            var doc = parser.parseFromString(html, "text/html");
            var images = [];
            doc.querySelectorAll("img[src], source[src], video[src], iframe[src]").forEach(function (node) {
                var src = node.getAttribute("src") || "";
                if (!src) {
                    return;
                }
                if (/^https?:\/\//i.test(src) || src.startsWith("data:")) {
                    return;
                }
                var resolved = new URL(src, basePath).pathname.replace(/^\//, "");
                var ext = basename(resolved).split(".").pop().toLowerCase();
                if (["png", "jpg", "jpeg", "webp", "gif", "svg", "avif", "bmp", "tif", "tiff", "mp4", "webm", "ogg", "mov", "avi"].indexOf(ext) !== -1) {
                    images.push({ path: resolved, name: basename(resolved) });
                }
            });
            return images;
        }

        function uniqueImages(list) {
            var seen = new Set();
            return list.filter(function (item) {
                if (!item || !item.path || seen.has(item.path)) {
                    return false;
                }
                seen.add(item.path);
                return true;
            }).sort(function (a, b) {
                return a.path.localeCompare(b.path);
            });
        }

        var images = [];
        images = images.concat(await tryApi("/cms-api/images"));
        images = images.concat(await tryApi("http://127.0.0.1:8000/cms-api/images"));

        if (images.length) {
            return uniqueImages(images);
        }

        try {
            var indexHtml = state.indexText || await apiGetText("/index.html");
            images = images.concat(collectFromHtml(indexHtml, window.location.origin + "/"));

            for (var i = 0; i < state.works.length; i += 1) {
                var work = state.works[i];
                if (!work || !work.href) continue;
                var workHtml = await tryFetchSiteFile("../" + work.href) || await tryFetchSiteFile("/" + work.href);
                if (workHtml) {
                    images = images.concat(collectFromHtml(workHtml, window.location.origin + "/"));
                }
            }
        } catch (error) {
            // fall through to unique return
        }

        return uniqueImages(images);
    }

    function closeImagePicker() {
        el.serverImagePicker.classList.add("is-hidden");
        el.pickerGrid.innerHTML = "";
        el.pickerSearch.value = "";
        state.imagePickerOnSelect = null;
    }

    function refreshImagePicker() {
        if (el.serverImagePicker.classList.contains("is-hidden")) {
            return;
        }

        if (typeof state.imagePickerOnSelect === "function") {
            openImagePicker(state.imagePickerOnSelect);
        }
    }

    async function openImagePicker(onSelect) {
        el.serverImagePicker.classList.remove("is-hidden");
        el.pickerGrid.innerHTML = "<div class='muted'>Loading images...</div>";
        el.pickerSearch.value = "";

        var items = await loadServerImages();
        if (!items.length) {
            el.pickerGrid.innerHTML = "<div class='muted'>No images found on the server.</div>";
            setStatus("No server images available. Check the local server or images folder.");
            return;
        }

        var renderToken = 0;

        function render(filtered) {
            renderToken += 1;
            var token = renderToken;
            el.pickerGrid.innerHTML = "";
            if (!filtered.length) {
                el.pickerGrid.innerHTML = "<div class='muted'>No matching images.</div>";
                return;
            }

            var index = 0;
            var batchSize = 24;

            function appendBatch() {
                if (token !== renderToken) {
                    return;
                }

                var fragment = document.createDocumentFragment();
                var end = Math.min(index + batchSize, filtered.length);

                for (; index < end; index += 1) {
                    (function (entry) {
                        var button = document.createElement("button");
                        button.type = "button";
                        button.className = "picker-item";
                        button.draggable = true;
                        var ext = entry.path.split(".").pop().toLowerCase();
                        var isVideo = ["mp4", "webm", "ogg", "mov", "avi"].indexOf(ext) !== -1;
                        var directUrl = "../" + encodeURI(entry.path) + (entry.mtime ? "?v=" + encodeURIComponent(entry.mtime) : "");
                        var thumbUrl = state.mode === "api"
                            ? buildApiUrl("/cms-api/thumb?path=" + encodeURIComponent(entry.path) + (entry.mtime ? "&v=" + encodeURIComponent(entry.mtime) : ""))
                            : "";

                        if (isVideo) {
                            var thumbWrap = document.createElement("span");
                            thumbWrap.className = "picker-video-thumb";

                            var playBadge = document.createElement("span");
                            playBadge.className = "picker-play-badge";
                            playBadge.textContent = "\u25B6";

                            if (thumbUrl) {
                                var videoThumb = document.createElement("img");
                                videoThumb.src = thumbUrl;
                                videoThumb.alt = entry.name || "video";
                                videoThumb.loading = "lazy";
                                videoThumb.decoding = "async";
                                videoThumb.addEventListener("error", function () {
                                    videoThumb.remove();
                                    thumbWrap.classList.add("is-icon-only");
                                }, { once: true });
                                thumbWrap.appendChild(videoThumb);
                            } else {
                                thumbWrap.classList.add("is-icon-only");
                            }
                            thumbWrap.appendChild(playBadge);
                            button.appendChild(thumbWrap);
                        } else {
                            var image = document.createElement("img");
                            image.src = thumbUrl || directUrl;
                            image.alt = entry.name || "image";
                            image.loading = "lazy";
                            image.decoding = "async";
                            if (thumbUrl) {
                                image.addEventListener("error", function () {
                                    image.src = directUrl;
                                }, { once: true });
                            }
                            button.appendChild(image);
                        }

                        var fileRow = document.createElement("div");
                        fileRow.className = "picker-file";

                        var icon = document.createElement("span");
                        icon.className = "file-icon";

                        var name = document.createElement("span");
                        name.className = "file-name";
                        name.textContent = entry.name || basename(entry.path);

                        fileRow.appendChild(icon);
                        fileRow.appendChild(name);

                        button.appendChild(fileRow);
                        button.addEventListener("click", function () {
                            onSelect(entry.path);
                            closeImagePicker();
                        });
                        button.addEventListener("dragstart", function (event) {
                            event.dataTransfer.effectAllowed = "copy";
                            event.dataTransfer.setData("text/plain", entry.path);
                            button.classList.add("is-dragging");
                        });
                        button.addEventListener("dragend", function () {
                            button.classList.remove("is-dragging");
                        });

                        fragment.appendChild(button);
                    }(filtered[index]));
                }

                el.pickerGrid.appendChild(fragment);

                if (index < filtered.length) {
                    window.requestAnimationFrame(appendBatch);
                }
            }

            window.requestAnimationFrame(appendBatch);
        }

        state.imagePickerOnSelect = onSelect;
        render(items);
        el.pickerSearch.oninput = function pickerFilter() {
            var q = (el.pickerSearch.value || "").toLowerCase().trim();
            if (!q) {
                render(items);
                return;
            }
            var filtered = items.filter(function (entry) {
                return entry.path.toLowerCase().indexOf(q) !== -1 || entry.name.toLowerCase().indexOf(q) !== -1;
            });
            render(filtered);
        };
        setStatus("Choose an image from the server.");
    }

    async function handleImageUpload(event, component) {
        try {
            var file = event.target.files && event.target.files[0];
            if (!file) {
                return;
            }

            setStatus("Uploading image...", "info");

            if (state.mode === "fs") {
                var imagesDir = await state.dirHandle.getDirectoryHandle("images", { create: true });
                var uploadsDir = await imagesDir.getDirectoryHandle("uploads", { create: true });
                var ext = file.name.indexOf(".") !== -1 ? file.name.split(".").pop() : "png";
                var safeName = Date.now() + "-" + slugify(file.name.replace(/\.[^/.]+$/, "")) + "." + ext;
                var targetHandle = await uploadsDir.getFileHandle(safeName, { create: true });
                var writable = await targetHandle.createWritable();
                await writable.write(await file.arrayBuffer());
                await writable.close();
                component.src = "images/uploads/" + safeName;
                setStatus("Afbeelding geupload: " + component.src);
                refreshImagePicker();
            } else if (state.mode === "api") {
                var formData = new FormData();
                formData.append("file", file, file.name);

                var response = await fetch(buildApiUrl("/cms-api/upload"), {
                    method: "POST",
                    body: formData
                });

                if (!response.ok) {
                    var errorText = await response.text();
                    throw new Error(errorText || ("Upload failed: " + response.status));
                }

                var result = await response.json();
                if (!result || !result.path) {
                    throw new Error("Upload succeeded, but no file path was returned.");
                }

                component.src = result.path;
                setStatus("Afbeelding geupload: " + component.src);
                refreshImagePicker();
            } else {
                setStatus("Upload werkt alleen met een lokale write target. Start de CMS-server of koppel een map.", "error");
                return;
            }

            state.dirty = true;
            var imageIdx = state.selectedWork ? state.selectedWork.components.indexOf(component) : -1;
            if (imageIdx !== -1) {
                patchPreviewComponent(imageIdx);
            }
            renderComponentList();
        } catch (error) {
            setStatus("Upload mislukt: " + error.message);
        }
    }

    async function handleVideoUpload(event, component, setVideoUploadStatus, setUploadProgress, appendVideoUploadLine, btnEl) {
        try {
            var file = event.target.files && event.target.files[0];
            if (!file) {
                return;
            }

            if (!state.selectedWork) {
                throw new Error("Select eerst een work.");
            }

            if (state.mode !== "api") {
                throw new Error("Video-upload met compressie werkt via de lokale CMS-server. Start cms_server.py.");
            }

            var workSlug = slugify(basename(state.selectedWork.href).replace(/\.html?$/i, "")) || "video";
            if (btnEl) {
                btnEl.disabled = true;
                btnEl.textContent = "⬆️ Uploaden... 0%";
            }
            if (setVideoUploadStatus) {
                setVideoUploadStatus(file.name + " (" + (file.size / 1024 / 1024).toFixed(1) + " MB) uploaden...", "progress");
            }
            if (appendVideoUploadLine) {
                appendVideoUploadLine("Bestand: " + file.name + " (" + (file.size / 1024 / 1024).toFixed(1) + " MB)");
                appendVideoUploadLine("Work folder: videos/uploads/" + workSlug + "/");
            }
            setStatus("Video uploaden naar server...", "info");

            var seenLines = 0;
            var metadata = await startVideoUpload(file, workSlug,
                // onProgress — server-side processing steps
                function (line) {
                    if (appendVideoUploadLine && typeof line === "string") {
                        appendVideoUploadLine(line);
                    }
                    seenLines += 1;
                    if (setVideoUploadStatus) {
                        setVideoUploadStatus("Server verwerkt... (" + seenLines + " stap" + (seenLines !== 1 ? "pen" : "") + ")", "progress");
                    }
                },
                // onUploadProgress — browser → server transfer %
                function (loaded, total, pct) {
                    if (setUploadProgress) setUploadProgress(loaded, total, pct);
                    if (setVideoUploadStatus && pct < 100) {
                        setVideoUploadStatus(
                            "Uploaden: " + pct + "% — " +
                            (loaded / 1024 / 1024).toFixed(1) + " / " +
                            (total / 1024 / 1024).toFixed(1) + " MB",
                            "progress"
                        );
                    }
                    if (pct >= 100 && setVideoUploadStatus) {
                        setVideoUploadStatus("Upload klaar, server comprimeert en splitst...", "progress");
                        if (appendVideoUploadLine) appendVideoUploadLine("Upload 100% — server verwerkt nu...");
                    }
                }
            );

            if (!metadata || !metadata.preview_path) {
                throw new Error("Upload gelukt, maar geen metadata pad teruggekregen.");
            }

            component.src = metadata.preview_path;
            if (appendVideoUploadLine) {
                if (metadata.index_preview) {
                    appendVideoUploadLine("Index preview: " + metadata.index_preview);
                }
                appendVideoUploadLine("✅ Klaar! Metadata pad: " + metadata.preview_path);
            }
            setStatus("Video verwerkt: " + component.src, "success");
            if (setVideoUploadStatus) {
                setVideoUploadStatus("✅ Klaar: " + component.src, "success");
            }
            state.dirty = true;
            patchPreviewStructure();
            renderComponentList();
            renderComponentProps();
        } catch (error) {
            setStatus("Video upload mislukt: " + error.message, "error");
            if (setVideoUploadStatus) {
                setVideoUploadStatus("❌ Mislukt: " + error.message, "error");
            }
        } finally {
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.textContent = "📁 Video kiezen & uploaden";
            }
        }
    }

    function renderComponentProps() {
        var work = state.selectedWork;
        var idx = state.selectedComponentIndex;
        el.componentProps.innerHTML = "";

        if (!work || idx < 0 || idx >= work.components.length) {
            el.componentPropsEmpty.style.display = "block";
            return;
        }

        el.componentPropsEmpty.style.display = "none";
        var cmp = work.components[idx];
        var paragraphStyles = [
            { value: "", label: "Default" },
            { value: "editorial-note", label: "Editorial note" },
            { value: "editorial-offset-left", label: "Editorial offset left" },
            { value: "editorial-offset-right", label: "Editorial offset right" },
            { value: "song-offset-left", label: "Song offset left" },
            { value: "song-offset-right", label: "Song offset right" },
            { value: "song-note", label: "Song note" },
            { value: "impact-highlight", label: "Impact highlight" }
        ];

        if (cmp.type === "heading" || cmp.type === "paragraph") {
            if (cmp.type === "paragraph") {
                addSelect("Text style", cmp.className || "", paragraphStyles, function (value) {
                    cmp.className = value;
                    patchPreviewComponent(idx);
                    patchPreviewStructure();
                });
            }

            addRichTextEditor("Inhoud", cmp.html || plainTextToHtml(cmp.text || ""), function (value) {
                cmp.html = value;
                cmp.text = htmlToPlainText(value);
                patchPreviewComponent(idx);
            });
            return;
        }

        if (cmp.type === "link") {
            addInput("Link URL", cmp.href || "", function (value) {
                cmp.href = value;
                patchPreviewComponent(idx);
            });
            addInput("Target", cmp.target || "", function (value) {
                cmp.target = value;
                patchPreviewComponent(idx);
            });
            addInput("Rel", cmp.rel || "", function (value) {
                cmp.rel = value;
                patchPreviewComponent(idx);
            });
            addRichTextEditor("Link tekst", cmp.html || escapeHtml(cmp.text || cmp.href || ""), function (value) {
                cmp.html = value;
                cmp.text = htmlToPlainText(value);
                patchPreviewComponent(idx);
            });
            return;
        }

        if (cmp.type === "image") {
            var srcRow = document.createElement("div");
            srcRow.className = "src-row";
            var srcLabel = document.createElement("label");
            srcLabel.textContent = "Bron (src)";
            var srcInput = document.createElement("input");
            srcInput.type = "text";
            srcInput.value = cmp.src || "";
            srcInput.addEventListener("input", function () {
                cmp.src = srcInput.value;
                state.dirty = true;
                patchPreviewComponent(idx);
            });
            srcLabel.appendChild(srcInput);
            srcRow.appendChild(srcLabel);

            var serverBrowse = document.createElement("button");
            serverBrowse.type = "button";
            serverBrowse.className = "def_button_small";
            serverBrowse.textContent = "Folder";
            serverBrowse.addEventListener("click", function () {
                openImagePicker(function (serverPath) {
                    var rel = relativePathFromWork(state.selectedWork ? state.selectedWork.href : "", serverPath);
                    cmp.src = rel;
                    srcInput.value = rel;
                    state.dirty = true;
                    patchPreviewComponent(idx);
                    renderComponentList();
                });
            });
            srcRow.appendChild(serverBrowse);
            el.componentProps.appendChild(srcRow);

            addInput("Alt", cmp.alt || "", function (value) {
                cmp.alt = value;
                patchPreviewComponent(idx);
            });

            var uploadWrap = document.createElement("div");
            uploadWrap.innerHTML = "<label>Upload nieuw beeld<input id='imageUploadInput' type='file' accept='image/*'></label>";
            el.componentProps.appendChild(uploadWrap);
            uploadWrap.querySelector("#imageUploadInput").addEventListener("change", function (event) {
                handleImageUpload(event, cmp);
            });

            var sizeLabel = document.createElement("label");
            sizeLabel.className = "checkline";
            sizeLabel.appendChild(document.createTextNode("Grootte: "));
            var sizeSelect = document.createElement("select");
            sizeSelect.style.marginLeft = "6px";
            var sizes = [
                { value: "full", label: "Volledig" },
                { value: "half", label: "1/2" },
                { value: "third", label: "1/3" }
            ];
            sizes.forEach(function (s) {
                var opt = document.createElement("option");
                opt.value = s.value;
                opt.textContent = s.label;
                if (cmp.imageSize === s.value) opt.selected = true;
                sizeSelect.appendChild(opt);
            });
            sizeSelect.addEventListener("change", function () {
                cmp.imageSize = sizeSelect.value;
                state.dirty = true;
                patchPreviewStructure();
            });
            sizeLabel.appendChild(sizeSelect);
            el.componentProps.appendChild(sizeLabel);
            return;
        }

        if (cmp.type === "iframe") {
            addInput("Embed URL", cmp.src || "", function (value) {
                var wasYt = isYouTubeUrl(cmp.src);
                cmp.src = value;
                if (value && value.indexOf("/shorts/") !== -1) {
                    cmp.isShort = true;
                }
                var isYt = isYouTubeUrl(value);
                if (isYt && !wasYt) {
                    var parsed = parseYouTubeParams(value);
                    cmp.ytAutoplay = parsed.ytAutoplay;
                    cmp.ytMute = parsed.ytMute;
                    cmp.ytLoop = parsed.ytLoop;
                    cmp.ytControls = parsed.ytControls;
                }
                patchPreviewStructure();
                if (isYt !== wasYt) renderComponentProps();
            });

            if (isYouTubeUrl(cmp.src)) {
                var ytSection = document.createElement("div");
                ytSection.className = "yt-options-section";
                var ytLabel = document.createElement("strong");
                ytLabel.textContent = "\u25B6 YouTube opties";
                ytLabel.className = "yt-options-heading";
                ytSection.appendChild(ytLabel);

                var ytOptions = [
                    { key: "ytAutoplay", label: "Autoplay", defaultVal: false },
                    { key: "ytMute", label: "Mute", defaultVal: false },
                    { key: "ytLoop", label: "Loop", defaultVal: false },
                    { key: "ytControls", label: "Player controls", defaultVal: true }
                ];

                ytOptions.forEach(function (opt) {
                    var line = document.createElement("label");
                    line.className = "checkline";
                    var cb = document.createElement("input");
                    cb.type = "checkbox";
                    cb.checked = cmp[opt.key] !== undefined ? !!cmp[opt.key] : opt.defaultVal;
                    cb.addEventListener("change", function () {
                        cmp[opt.key] = cb.checked;
                        state.dirty = true;
                        patchPreviewStructure();
                    });
                    line.appendChild(cb);
                    line.appendChild(document.createTextNode(opt.label));
                    ytSection.appendChild(line);
                });

                var shortLine = document.createElement("label");
                shortLine.className = "checkline";
                var shortCb = document.createElement("input");
                shortCb.type = "checkbox";
                shortCb.checked = !!cmp.isShort;
                shortCb.addEventListener("change", function () {
                    cmp.isShort = shortCb.checked;
                    state.dirty = true;
                    patchPreviewStructure();
                });
                shortLine.appendChild(shortCb);
                shortLine.appendChild(document.createTextNode("Short (verticaal 9:16)"));
                ytSection.appendChild(shortLine);

                el.componentProps.appendChild(ytSection);
            }
            return;
        }

        if (cmp.type === "video") {
            addInput("Video URL", cmp.src || "", function (value) {
                cmp.src = value;
                patchPreviewStructure();
            });

            var uploadWrap = document.createElement("div");
            uploadWrap.className = "video-upload-box";
            uploadWrap.innerHTML = [
                "<div class='upload-btn-row'>",
                "  <input id='videoUploadInput' type='file' accept='video/*' style='display:none'>",
                "  <button id='videoUploadBtn' class='def_button_small' type='button'>📁 Video kiezen &amp; uploaden</button>",
                "</div>",
                "<div id='videoUploadStatus' class='upload-status-msg'>",
                "  Kies een video om te comprimeren en op te splitsen op de server.",
                "</div>",
                "<div id='videoUploadProgressWrap' class='upload-progress-wrap' style='display:none'>",
                "  <div id='videoUploadProgressBar' class='upload-progress-bar'><div id='videoUploadProgressFill' class='upload-progress-bar-fill'></div></div>",
                "  <span id='videoUploadProgressPct' class='upload-progress-pct'>0%</span>",
                "</div>",
                "<pre id='videoUploadOutput' class='tool-output' style='display:none'></pre>"
            ].join("\n");
            el.componentProps.appendChild(uploadWrap);
            var videoUploadInput = uploadWrap.querySelector("#videoUploadInput");
            var videoUploadBtn = uploadWrap.querySelector("#videoUploadBtn");
            var videoUploadStatus = uploadWrap.querySelector("#videoUploadStatus");
            var videoUploadProgressWrap = uploadWrap.querySelector("#videoUploadProgressWrap");
            var videoUploadProgressBar = uploadWrap.querySelector("#videoUploadProgressBar");
            var videoUploadProgressFill = uploadWrap.querySelector("#videoUploadProgressFill");
            var videoUploadProgressPct = uploadWrap.querySelector("#videoUploadProgressPct");
            var videoUploadOutput = uploadWrap.querySelector("#videoUploadOutput");

            videoUploadBtn.addEventListener("click", function () {
                videoUploadInput.value = "";
                videoUploadInput.click();
            });

            function setVideoUploadStatus(message, kind) {
                if (videoUploadStatus) {
                    videoUploadStatus.textContent = message;
                    videoUploadStatus.className = "upload-status-msg" + (kind ? " is-" + kind : "");
                }
                if ((kind === "success" || kind === "error") && videoUploadProgressWrap) {
                    videoUploadProgressWrap.style.display = "none";
                }
                if (kind === "progress" && videoUploadOutput) {
                    videoUploadOutput.style.display = "block";
                }
            }

            function setVideoUploadProgress(loaded, total, pct) {
                if (!videoUploadProgressWrap) return;
                videoUploadProgressWrap.style.display = "flex";
                if (videoUploadProgressFill) {
                    videoUploadProgressFill.style.width = pct + "%";
                }
                if (videoUploadProgressBar) {
                    videoUploadProgressBar.classList.toggle("is-done", pct >= 100);
                }
                if (videoUploadProgressPct) {
                    videoUploadProgressPct.textContent = pct + "%";
                    videoUploadProgressPct.style.color = pct >= 100 ? "#159947" : "#df7f1d";
                }
                if (videoUploadBtn) {
                    videoUploadBtn.textContent = pct < 100
                        ? "\u2B06\uFE0F Uploaden... " + pct + "%"
                        : "\u23F3 Server verwerkt...";
                }
            }

            function appendVideoUploadLine(line) {
                if (!videoUploadOutput) {
                    return;
                }
                videoUploadOutput.style.display = "block";
                videoUploadOutput.textContent += line + "\n";
                videoUploadOutput.scrollTop = videoUploadOutput.scrollHeight;
            }

            videoUploadInput.addEventListener("change", function (event) {
                handleVideoUpload(event, cmp, setVideoUploadStatus, setVideoUploadProgress, appendVideoUploadLine, videoUploadBtn);
            });

            var videoControls = document.createElement("label");
            videoControls.className = "checkline";
            var checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = !!cmp.controls;
            checkbox.addEventListener("change", function () {
                cmp.controls = checkbox.checked;
                state.dirty = true;
                patchPreviewStructure();
            });
            videoControls.appendChild(checkbox);
            videoControls.appendChild(document.createTextNode("Controls"));
            el.componentProps.appendChild(videoControls);

            var shortCheck = document.createElement("label");
            shortCheck.className = "checkline";
            var shortCb = document.createElement("input");
            shortCb.type = "checkbox";
            shortCb.checked = !!cmp.isShort;
            shortCb.addEventListener("change", function () {
                cmp.isShort = shortCb.checked;
                state.dirty = true;
                patchPreviewStructure();
            });
            shortCheck.appendChild(shortCb);
            shortCheck.appendChild(document.createTextNode("Short (9:16 portrait)"));
            el.componentProps.appendChild(shortCheck);

            var videoSection = document.createElement("div");
            videoSection.className = "yt-options-section";
            var videoLabel = document.createElement("strong");
            videoLabel.textContent = "\u25B6 Video opties";
            videoLabel.className = "yt-options-heading";
            videoSection.appendChild(videoLabel);

            var vidOptions = [
                { key: "ytAutoplay", label: "Autoplay", defaultVal: false },
                { key: "ytMute", label: "Mute", defaultVal: false },
                { key: "ytLoop", label: "Loop", defaultVal: false }
            ];

            vidOptions.forEach(function (opt) {
                var optWrap = document.createElement("label");
                optWrap.className = "checkline";
                var optCb = document.createElement("input");
                optCb.type = "checkbox";
                optCb.checked = cmp[opt.key] === true;
                optCb.addEventListener("change", function () {
                    cmp[opt.key] = optCb.checked;
                    state.dirty = true;
                    patchPreviewStructure();
                });
                optWrap.appendChild(optCb);
                optWrap.appendChild(document.createTextNode(opt.label));
                videoSection.appendChild(optWrap);
            });

            el.componentProps.appendChild(videoSection);
            return;
        }

        if (cmp.type === "palette") {
            addTextarea("Colors (1 per line, hex)", (cmp.colors || []).join("\n"), function (value) {
                cmp.colors = value.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
                if (!cmp.colors.length) {
                    cmp.colors = ["#111111", "#f5f5f5", "#d97706"];
                }
                patchPreviewComponent(idx);
            });
            return;
        }

        if (cmp.type === "list") {
            addTextarea("Items (1 per lijn)", (cmp.items || []).join("\n"), function (value) {
                cmp.items = value.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
                patchPreviewComponent(idx);
            });
            return;
        }

        if (cmp.type === "button") {
            addInput("Button text", cmp.text || "", function (value) {
                cmp.text = value;
                cmp.html = escapeHtml(value);
                patchPreviewComponent(idx);
            });
            addInput("Link URL", cmp.href || "", function (value) {
                cmp.href = value;
                patchPreviewComponent(idx);
            });
            addInput("Target", cmp.target || "", function (value) {
                cmp.target = value;
                patchPreviewComponent(idx);
            });
            addSelect("Style", cmp.className || "", [
                { value: "def_button", label: "Default" },
                { value: "def_button_small", label: "Small" },
                { value: "def_button_large", label: "Large" }
            ], function (value) {
                cmp.className = value;
                patchPreviewComponent(idx);
            });
            return;
        }
    }

    function componentToNode(doc, cmp, idx, withCmsMeta) {
        function markNode(node) {
            if (withCmsMeta === false) {
                return node;
            }
            if (!node || !node.setAttribute) {
                return node;
            }
            node.setAttribute("data-cms-component-index", String(idx));
            node.classList.add("cms-preview-component");
            if (idx === state.selectedComponentIndex) {
                node.classList.add("is-selected");
            }
            if (idx === state.hoveredComponentIndex) {
                node.classList.add("is-hovered");
            }
            return node;
        }

        if (cmp.type === "heading") {
            var level = cmp.level || 3;
            var heading = doc.createElement("h" + level);
            heading.innerHTML = cmp.html || escapeHtml(cmp.text || "");
            return markNode(heading);
        }

        if (cmp.type === "paragraph") {
            var p = doc.createElement("p");
            if (cmp.className) {
                p.className = cmp.className;
            }
            p.innerHTML = cmp.html || escapeHtml(cmp.text || "");
            return markNode(p);
        }

        if (cmp.type === "link") {
            var link = doc.createElement("a");
            if (cmp.href) link.setAttribute("href", cmp.href);
            if (cmp.target) link.setAttribute("target", cmp.target);
            if (cmp.rel) link.setAttribute("rel", cmp.rel);
            if (cmp.className) link.setAttribute("class", cmp.className);
            link.innerHTML = cmp.html || escapeHtml(cmp.text || cmp.href || "");
            return markNode(link);
        }

        if (cmp.type === "image") {
            var figure = doc.createElement("figure");
            figure.className = "image-" + (cmp.imageSize || "full");
            var img = doc.createElement("img");
            img.setAttribute("src", cmp.src || "");
            if (cmp.alt) {
                img.setAttribute("alt", cmp.alt);
            }
            figure.appendChild(img);
            return markNode(figure);
        }

        if (cmp.type === "iframe") {
            if (cmp.wrapperStyle) {
                var wrap = doc.createElement("div");
                wrap.setAttribute("style", cmp.wrapperStyle);
                wrap.classList.add("cms-embed-wrap");
                var wrappedIframe = doc.createElement("iframe");
                wrappedIframe.setAttribute("src", buildIframeSrc(cmp) || "");
                wrappedIframe.setAttribute("frameborder", "0");
                if (cmp.allow) wrappedIframe.setAttribute("allow", cmp.allow);
                if (cmp.referrerpolicy) wrappedIframe.setAttribute("referrerpolicy", cmp.referrerpolicy);
                if (cmp.title) wrappedIframe.setAttribute("title", cmp.title);
                if (cmp.iframeStyle) {
                    wrappedIframe.setAttribute("style", cmp.iframeStyle);
                } else {
                    wrappedIframe.style.width = "100%";
                    wrappedIframe.style.minHeight = "420px";
                }
                wrap.appendChild(wrappedIframe);
                if (withCmsMeta !== false) {
                    wrappedIframe.style.pointerEvents = "none";
                    var overlay = doc.createElement("button");
                    overlay.type = "button";
                    overlay.className = "cms-embed-overlay";
                    overlay.setAttribute("aria-label", "Select embed component");
                    overlay.addEventListener("click", function (event) {
                        event.preventDefault();
                        event.stopPropagation();
                        state.selectedComponentIndex = idx;
                        state.hoveredComponentIndex = idx;
                        renderComponentList();
                        renderComponentProps();
                        applyPreviewSelectionState();
                    });
                    wrap.appendChild(overlay);
                }
                return markNode(wrap);
            }

            var isShort = cmp.isShort || (cmp.src && (cmp.src.indexOf("/shorts/") !== -1));
            var vid = extractYouTubeVideoId(cmp.src || "");

            if (isShort && vid) {
                var ytDiv = doc.createElement("div");
                ytDiv.id = "yt-player-" + idx;
                ytDiv.className = "yt-short-embed";
                ytDiv.dataset.videoid = vid;
                ytDiv.dataset.autoplay = cmp.ytAutoplay ? "1" : "0";
                ytDiv.dataset.mute = cmp.ytMute ? "1" : "0";
                ytDiv.dataset.loop = cmp.ytLoop ? "1" : "0";
                ytDiv.dataset.controls = cmp.ytControls !== false ? "1" : "0";
                ytDiv.style.width = "100%";
                ytDiv.style.aspectRatio = "9/16";
                ytDiv.style.maxWidth = "320px";
                ytDiv.style.margin = "0 auto";
                ytDiv.style.display = "block";
                ytDiv.style.background = "#000";

                if (withCmsMeta !== false) {
                    ytDiv.style.pointerEvents = "none";
                }

                if (!doc.querySelector("#cms-yt-shorts-init")) {
                    var initScript = doc.createElement("script");
                    initScript.id = "cms-yt-shorts-init";
                    initScript.textContent = [
                        "(function(){",
                        "function i(){document.querySelectorAll('.yt-short-embed:not([data-yt-init])').forEach(function(e){",
                        "var id=e.id,vid=e.dataset.videoid;if(!vid||!id)return;",
                        "e.dataset.ytInit='1';",
                        "var o={videoId:vid,height:'200',width:'113',playerVars:{",
                        "autoplay:e.dataset.autoplay==='1'?1:0,",
                        "mute:e.dataset.mute==='1'?1:0,",
                        "loop:e.dataset.loop==='1'?1:0,",
                        "playlist:vid,",
                        "controls:e.dataset.controls==='0'?0:1,",
                        "playsinline:1,rel:0",
                        "}};",
                        "if(typeof YT!=='undefined'&&YT.Player){try{new YT.Player(id,o)}catch(ex){}}",
                        "});",
                        "}",
                        "if(typeof YT!=='undefined'&&YT.Player){i()}",
                        "window.__initYTShorts=i;",
                        "if(typeof YT==='undefined'){",
                        "window.onYouTubeIframeAPIReady=i;",
                        "var t=document.createElement('script');t.src='https://www.youtube.com/iframe_api';t.async=true;",
                        "var f=document.getElementsByTagName('script')[0];f.parentNode.insertBefore(t,f)",
                        "}",
                        "})();"
                    ].join("");
                    doc.body.appendChild(initScript);
                }

                var ytWrap = doc.createElement("div");
                ytWrap.className = "cms-embed-wrap";
                ytWrap.appendChild(ytDiv);

                if (withCmsMeta !== false) {
                    var ytOverlay = doc.createElement("button");
                    ytOverlay.type = "button";
                    ytOverlay.className = "cms-embed-overlay";
                    ytOverlay.setAttribute("aria-label", "Select embed component");
                    ytOverlay.addEventListener("click", function (event) {
                        event.preventDefault();
                        event.stopPropagation();
                        state.selectedComponentIndex = idx;
                        state.hoveredComponentIndex = idx;
                        renderComponentList();
                        renderComponentProps();
                        applyPreviewSelectionState();
                    });
                    ytWrap.appendChild(ytOverlay);
                }
                return markNode(ytWrap);
            }

            var iframe = doc.createElement("iframe");
            iframe.setAttribute("src", buildIframeSrc(cmp) || "");
            iframe.setAttribute("frameborder", "0");
            iframe.setAttribute("allow", cmp.allow || "autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share");
            iframe.setAttribute("referrerpolicy", cmp.referrerpolicy || "strict-origin-when-cross-origin");
            if (cmp.title) {
                iframe.setAttribute("title", cmp.title);
            }
            iframe.style.width = "100%";
            if (isShort) {
                iframe.style.aspectRatio = "9/16";
                iframe.style.maxWidth = "320px";
                iframe.style.margin = "0 auto";
                iframe.style.display = "block";
            } else {
                iframe.style.minHeight = "420px";
            }
            if (withCmsMeta !== false) {
                iframe.style.pointerEvents = "none";
            }
            var iframeWrap = doc.createElement("div");
            iframeWrap.className = "cms-embed-wrap";
            iframeWrap.appendChild(iframe);
            if (withCmsMeta !== false) {
                var iframeOverlay = doc.createElement("button");
                iframeOverlay.type = "button";
                iframeOverlay.className = "cms-embed-overlay";
                iframeOverlay.setAttribute("aria-label", "Select embed component");
                iframeOverlay.addEventListener("click", function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    state.selectedComponentIndex = idx;
                    state.hoveredComponentIndex = idx;
                    renderComponentList();
                    renderComponentProps();
                    applyPreviewSelectionState();
                });
                iframeWrap.appendChild(iframeOverlay);
            }
            return markNode(iframeWrap);
        }

        if (cmp.type === "video") {
            var video = doc.createElement("video");
            var videoSrc = cmp.src || "";
            video.setAttribute("src", videoSrc);
            video.setAttribute("playsinline", "");
            video.style.width = "100%";
            if (cmp.isShort) {
                video.style.aspectRatio = "9/16";
                video.style.maxWidth = "320px";
                video.style.margin = "0 auto";
                video.style.display = "block";
            } else {
                video.style.maxHeight = "520px";
            }
            if (cmp.controls !== false) {
                video.setAttribute("controls", "");
            }
            if (cmp.ytAutoplay) {
                video.setAttribute("autoplay", "");
                video.setAttribute("muted", "");
            }
            if (cmp.ytMute) video.setAttribute("muted", "");
            if (cmp.ytLoop) video.setAttribute("loop", "");

            resolveVideoMetadataSrc(video, videoSrc);

            var videoWrap = doc.createElement("div");
            videoWrap.className = "cms-embed-wrap";
            videoWrap.appendChild(video);
            if (withCmsMeta !== false) {
                video.style.pointerEvents = "none";
                var videoOverlay = doc.createElement("button");
                videoOverlay.type = "button";
                videoOverlay.className = "cms-embed-overlay";
                videoOverlay.setAttribute("aria-label", "Select video component");
                videoOverlay.addEventListener("click", function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    state.selectedComponentIndex = idx;
                    state.hoveredComponentIndex = idx;
                    renderComponentList();
                    renderComponentProps();
                    applyPreviewSelectionState();
                });
                videoWrap.appendChild(videoOverlay);
            }
            return markNode(videoWrap);
        }

        if (cmp.type === "palette") {
            var palette = doc.createElement("div");
            palette.className = "cms-palette-component";
            palette.style.display = "grid";
            palette.style.gridTemplateColumns = "repeat(auto-fit, minmax(80px, 1fr))";
            palette.style.gap = "8px";
            (cmp.colors || []).forEach(function (color) {
                var sw = doc.createElement("span");
                sw.setAttribute("data-color", color);
                sw.style.background = color;
                sw.style.height = "52px";
                sw.style.border = "1px solid rgba(0,0,0,.12)";
                sw.title = color;
                palette.appendChild(sw);
            });
            return markNode(palette);
        }

        if (cmp.type === "list") {
            var listTag = cmp.ordered ? "ol" : "ul";
            var ul = doc.createElement(listTag);
            (cmp.items || []).forEach(function (item) {
                var li = doc.createElement("li");
                li.textContent = item;
                ul.appendChild(li);
            });
            return markNode(ul);
        }

        function normalizeButtonHref(href) {
            if (!href || href === "#") return "#";
            if (/^(https?:|mailto:|tel:|#|\/)/.test(href)) return href;
            if (href.indexOf("://") !== -1) return href;
            return "https://" + href;
        }

        if (cmp.type === "button") {
            var btn = doc.createElement("a");
            btn.setAttribute("href", normalizeButtonHref(cmp.href));
            if (cmp.target) {
                btn.setAttribute("target", cmp.target);
                btn.setAttribute("rel", "noopener noreferrer");
            }
            if (cmp.className) btn.setAttribute("class", cmp.className);
            btn.innerHTML = escapeHtml(cmp.text || "Button");
            return markNode(btn);
        }

        return doc.createTextNode("");
    }

    function decoratePreviewDoc(doc, work) {
        var desc = doc.querySelector("#assignment_desc");
        if (!desc) {
            return;
        }

        work.components.forEach(function (cmp, idx) {
            var node = getNodeByPath(desc, cmp.sourcePath);
            if (!node) {
                return;
            }

            node.setAttribute("data-cms-component-index", String(idx));
            node.classList.add("cms-preview-component");

            if (cmp.type === "iframe" || cmp.type === "video") {
                var wrap = node.parentElement && node.parentElement !== desc ? node.parentElement : node;
                wrap.classList.add("cms-embed-wrap");
                wrap.setAttribute("data-cms-component-index", String(idx));
                var target = node.tagName && node.tagName.toLowerCase() === "iframe" ? node : wrap.querySelector("iframe,video");
                if (target) {
                    target.style.pointerEvents = "none";
                }
                if (!wrap.querySelector(".cms-embed-overlay")) {
                    var overlay = doc.createElement("button");
                    overlay.type = "button";
                    overlay.className = "cms-embed-overlay";
                    overlay.setAttribute("aria-label", "Select component");
                    wrap.appendChild(overlay);
                }
            }
        });
    }

    function patchPreviewTitle() {
        try {
            var doc = el.workPreview.contentDocument;
            if (!doc || !state.selectedWork) {
                return;
            }
            var title = doc.querySelector("#showcase_large h2");
            if (title) {
                title.textContent = state.selectedWork.title;
            }
        } catch (error) {
            // ignore
        }
    }

    function findComponentNodeByIndex(doc, idx) {
        if (!doc) return null;
        return doc.querySelector('[data-cms-component-index="' + idx + '"]');
    }

    function patchPreviewComponent(index) {
        if (state.previewView !== "article") {
            return;
        }
        try {
            var doc = el.workPreview.contentDocument;
            var work = state.selectedWork;
            if (!doc || !work || index < 0 || index >= work.components.length) {
                return;
            }

            var cmp = work.components[index];
            var liveNode = findComponentNode(work, index, doc) || findComponentNodeByIndex(doc, index);
            var sourceNode = findComponentNode(work, index, work.doc) || findComponentNodeByIndex(work.doc, index);

            if (liveNode) setComponentAttributes(liveNode, cmp);
            if (sourceNode) setComponentAttributes(sourceNode, cmp);
            if (!liveNode && !sourceNode) {
                return;
            }

            applyPreviewSelectionState();
            refreshComponentListItem(index);
        } catch (error) {
            // ignore
        }
    }

    function patchPreviewStructure() {
        if (state.previewView !== "article") {
            return;
        }
        try {
            var doc = el.workPreview.contentDocument;
            var win = el.workPreview.contentWindow;
            var work = state.selectedWork;
            if (!doc || !win || !work || !work.doc) {
                renderPreviewFromState();
                return;
            }

            var scrollX = win.scrollX || 0;
            var scrollY = win.scrollY || 0;
            var desc = doc.querySelector("#assignment_desc");
            if (!desc) {
                renderPreviewFromState();
                return;
            }

            desc.innerHTML = "";
            work.components.forEach(function (cmp, idx) {
                desc.appendChild(componentToNode(doc, cmp, idx, true));
            });

            renderToolsBlock(doc, work);

            applyPreviewSelectionState();
            if (win.__initYTShorts) {
                win.__initYTShorts();
            }
            win.scrollTo(scrollX, scrollY);
        } catch (error) {
            renderPreviewFromState();
        }
    }

    function renderPreviewFromState() {
        if (state.previewView === "index" && state.indexDoc) {
            renderIndexPreview();
            return;
        }
        renderArticlePreview();
    }

    function renderIndexPreview() {
        if (!state.indexDoc) {
            renderArticlePreview();
            return;
        }
        if (el.previewPath) {
            el.previewPath.textContent = "index.html";
        }
        var work = state.selectedWork;

        capturePreviewScroll();
        syncIndexDoc();

        var doc = state.indexDoc.cloneNode(true);
        applyIndexPaletteToDoc(doc);
        var head = doc.querySelector("head");
        if (head) {
            var base = doc.createElement("base");
            base.setAttribute("href", buildPreviewBaseHref("index.html"));
            head.insertBefore(base, head.firstChild);
        }

        var cards = doc.querySelectorAll("#assignment_list .work-card");
        var selectedCard = null;
        cards.forEach(function (card) {
            if (work && card.getAttribute("href") === work.href) {
                selectedCard = card;
            }
        });
        if (selectedCard) {
            selectedCard.classList.add("is-cms-selected");
        }

        applyPreviewMuteToDoc(doc, state.previewMuted);

        var bridgeStyle = doc.createElement("style");
        bridgeStyle.id = "cms-index-override";
        bridgeStyle.textContent =
            ".work-card.is-cms-selected{outline:3px solid rgba(255,140,0,.95);outline-offset:3px;}";
        doc.head.appendChild(bridgeStyle);

        var bridgeScript = doc.createElement("script");
        bridgeScript.textContent =
            "(function(){" +
            "document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a'):null;if(a){e.preventDefault();e.stopPropagation();}},true);" +
            "})();";
        doc.body.appendChild(bridgeScript);

        el.workPreview.addEventListener("load", function () {
            try {
                if (el.workPreview.contentWindow) {
                    el.workPreview.contentWindow.scrollTo(state.previewScroll.x || 0, state.previewScroll.y || 0);
                }
            } catch (error) {
                // ignore restore issues
            }

            if (state.previewMobile) {
                el.workPreview.classList.add("is-mobile-preview");
            } else {
                el.workPreview.classList.remove("is-mobile-preview");
            }

            if (el.previewMuteBtn) {
                el.previewMuteBtn.textContent = state.previewMuted ? "Unmute" : "Mute";
                el.previewMuteBtn.classList.toggle("is-active", !!state.previewMuted);
            }
        }, { once: true });

        el.workPreview.srcdoc = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
    }

    function patchIndexPreviewCard() {
        if (state.previewView !== "index") {
            return;
        }
        var work = state.selectedWork;
        if (!work) {
            return;
        }
        try {
            var doc = el.workPreview.contentDocument;
            if (!doc) {
                return;
            }
            var cards = doc.querySelectorAll("#assignment_list .work-card");
            var card = null;
            cards.forEach(function (candidate) {
                if (candidate.getAttribute("href") === work.href) {
                    card = candidate;
                }
            });
            if (!card) {
                return;
            }
            var cat = card.querySelector(".work-card-cat");
            var title = card.querySelector(".work-card-title");
            var desc = card.querySelector(".work-card-desc");
            var star = card.querySelector(".work-card-star");
            if (cat) cat.textContent = work.category || "";
            if (title) title.textContent = work.title || "";
            if (desc) desc.textContent = work.description || "";
            card.setAttribute("data-preview", work.preview || "");
            card.setAttribute("data-preview-start", String(work.previewStartTime || 0));
            card.setAttribute("data-visible", work.visible !== false ? "true" : "false");
            card.setAttribute("data-favorite", work.favorite ? "true" : "false");
            card.setAttribute("data-highlight", work.highlight ? "2x2" : "1x1");
            card.classList.toggle("hidden-work", work.visible === false);
            card.classList.toggle("is-favorite", !!work.favorite);
            card.classList.toggle("work-card--highlight", !!work.highlight);
            if (work.favorite) {
                if (!star) {
                    star = doc.createElement("span");
                    star.className = "work-card-star";
                    star.setAttribute("aria-hidden", "true");
                    star.textContent = "★";
                    card.insertBefore(star, card.firstChild);
                }
            } else if (star) {
                star.remove();
            }
            var bgUrl = previewBgUrl(work.preview);
            if (bgUrl) {
                card.setAttribute("style", '--preview-bg: url("' + bgUrl.replace(/"/g, '\\"') + '");');
            } else {
                card.removeAttribute("style");
            }
        } catch (error) {
            // ignore
        }
    }

    function setPreviewView(view) {
        state.previewView = view === "article" ? "article" : "index";
        if (el.previewViewBtn) {
            el.previewViewBtn.textContent = state.previewView === "index" ? "Index" : "Article";
            el.previewViewBtn.classList.toggle("is-active", state.previewView === "index");
        }
        renderPreviewFromState();
    }

    function renderArticlePreview() {
        var work = state.selectedWork;
        if (!work || !work.doc) {
            el.workPreview.srcdoc = "";
            return;
        }

        capturePreviewScroll();

        var doc = work.doc.cloneNode(true);
        doc.body.classList.add("work-page");
        var previewBaseHref = buildPreviewBaseHref(work.href);
        var head = doc.querySelector("head");
        if (head) {
            var existingBase = head.querySelector("base");
            if (existingBase) {
                existingBase.setAttribute("href", previewBaseHref);
            } else {
                var base = doc.createElement("base");
                base.setAttribute("href", previewBaseHref);
                head.insertBefore(base, head.firstChild);
            }
        }

        var title = doc.querySelector("#showcase_large h2");
        if (title) {
            title.textContent = work.title;
        }

        renderToolsBlock(doc, work);
        replaceThirdPartyEmbedsForPreview(doc);
        applyPreviewMuteToDoc(doc, state.previewMuted);

        var previewBackButton = doc.querySelector("#back_button");
        if (previewBackButton) {
            previewBackButton.remove();
        }

        var previewBackgroundConfig = doc.getElementById("cms-work-background");
        if (previewBackgroundConfig) {
            previewBackgroundConfig.remove();
        }

        decoratePreviewDoc(doc, work);

        var bridgeStyle = doc.createElement("style");
        bridgeStyle.id = "cms-palette-override";
        bridgeStyle.textContent =
            buildPaletteOverrideCss(work) +
            ".cms-preview-component{outline:1px solid transparent;outline-offset:2px;cursor:pointer;transition:outline-color .12s ease,background-color .12s ease;}" +
            ".cms-preview-component.is-hovered{outline-color:rgba(70,150,255,.9);}" +
            ".cms-preview-component.is-selected{outline-color:rgba(255,140,0,.95);}" +
            ".cms-preview-embed-placeholder{display:grid;gap:8px;padding:14px;border:1px dashed rgba(120,120,120,.45);background:rgba(0,0,0,.03);}" +
            ".cms-preview-embed-placeholder strong{font-size:.9rem;}" +
            ".cms-preview-embed-placeholder p{margin:0;font-size:.86rem;opacity:.84;}";
        doc.head.appendChild(bridgeStyle);

        var bridgeScript = doc.createElement("script");
        bridgeScript.textContent =
            "(function(){" +
            "function getCmp(el){return el && el.closest ? el.closest('[data-cms-component-index]') : null;}" +
            "document.addEventListener('mouseover',function(e){var n=getCmp(e.target);var idx=n?n.getAttribute('data-cms-component-index'):'-1';parent.postMessage({type:'cms-preview-hover',index:idx},'*');});" +
            "document.addEventListener('mouseout',function(e){if(!getCmp(e.target)){return;}parent.postMessage({type:'cms-preview-hover',index:'-1'},'*');});" +
            "document.addEventListener('click',function(e){var n=getCmp(e.target);if(!n){return;}e.preventDefault();e.stopPropagation();parent.postMessage({type:'cms-preview-select',index:n.getAttribute('data-cms-component-index')},'*');},true);" +
            "function getInsertIdx(y){var desc=document.querySelector('#assignment_desc');if(!desc)return 0;var all=desc.querySelectorAll('[data-cms-component-index]');for(var i=0;i<all.length;i++){var r=all[i].getBoundingClientRect();if(y<r.top+r.height/2)return i;}return all.length;}" +
            "document.addEventListener('dragover',function(e){e.preventDefault();e.dataTransfer.dropEffect='copy';});" +
            "document.addEventListener('drop',function(e){e.preventDefault();var add=e.dataTransfer.getData('text/x-cms-add');if(add){var raw=e.dataTransfer.getData('application/json');var defs=raw?JSON.parse(raw):{type:add};parent.postMessage({type:'cms-preview-drop',addType:add,defaults:defs,index:getInsertIdx(e.clientY)},'*');return;}var p=e.dataTransfer.getData('text/plain');if(!p)return;parent.postMessage({type:'cms-preview-drop',path:p,index:getInsertIdx(e.clientY)},'*');});" +
            "})();";
        doc.body.appendChild(bridgeScript);

        el.workPreview.addEventListener("load", function () {
            try {
                if (el.workPreview.contentWindow) {
                    el.workPreview.contentWindow.scrollTo(state.previewScroll.x || 0, state.previewScroll.y || 0);
                }
            } catch (error) {
                // ignore restore issues
            }

            if (state.previewMobile) {
                el.workPreview.classList.add("is-mobile-preview");
            } else {
                el.workPreview.classList.remove("is-mobile-preview");
            }

            syncSelectedWorkPaletteFromPreview();

            applyPreviewSelectionState();
            if (el.previewMuteBtn) {
                el.previewMuteBtn.textContent = state.previewMuted ? "Unmute" : "Mute";
                el.previewMuteBtn.classList.toggle("is-active", !!state.previewMuted);
            }
        }, { once: true });

        el.workPreview.srcdoc = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
    }

    function applyPreviewMuteToDoc(doc, muted) {
        if (!doc) {
            return;
        }

        doc.querySelectorAll("video").forEach(function (video) {
            video.muted = !!muted;
            if (muted) {
                video.setAttribute("muted", "");
            } else {
                video.removeAttribute("muted");
            }
        });

        doc.querySelectorAll("iframe").forEach(function (iframe) {
            var src = iframe.getAttribute("src") || "";
            if (!src) {
                return;
            }

            var url;
            try {
                url = new URL(src, window.location.href);
            } catch (error) {
                return;
            }

            var host = (url.hostname || "").toLowerCase();
            if (host.indexOf("youtube.com") !== -1 || host.indexOf("youtube-nocookie.com") !== -1 || host.indexOf("youtu.be") !== -1) {
                // Keep CMS preview stable: no autoplay while editing.
                url.searchParams.set("autoplay", "0");
                url.searchParams.set("playsinline", "1");
                url.searchParams.set("rel", "0");
                if (muted) {
                    url.searchParams.set("mute", "1");
                } else {
                    url.searchParams.delete("mute");
                }
            }

            if (host.indexOf("vimeo.com") !== -1) {
                // Keep CMS preview stable: no autoplay while editing.
                url.searchParams.set("autoplay", "0");
                if (muted) {
                    url.searchParams.set("muted", "1");
                } else {
                    url.searchParams.delete("muted");
                }
            }

            iframe.setAttribute("src", url.toString());
        });
    }

    function setPreviewMuted(muted) {
        state.previewMuted = !!muted;
        if (el.previewMuteBtn) {
            el.previewMuteBtn.textContent = muted ? "Unmute" : "Mute";
            el.previewMuteBtn.classList.toggle("is-active", !!muted);
        }
        renderPreviewFromState();
    }

    function refreshPreviewAndLists() {
        renderComponentList();
        renderComponentProps();
        renderPreviewFromState();
    }

    async function selectWork(index) {
        state.selectedComponentIndex = -1;
        state.hoveredComponentIndex = -1;
        state.selectedWork = state.works[index];
        try {
            await loadWorkDoc(state.selectedWork);
        } catch (error) {
            setStatus("Could not load work: " + state.selectedWork.href + " (" + error.message + ")");
        }

        if (state.selectedWork && state.selectedWork.doc) {
            setLeftMode("components");
            setPreviewView("article");
        }

        renderWorkList();
        renderArticleProps();
        refreshPreviewAndLists();
    }

    function bindArticleProps() {
        function applyPaletteInput(kind, rawValue) {
            if (!state.selectedWork) return;
            var normalized = normalizeColorValue(rawValue);
            if (!normalized) {
                return;
            }
            state.selectedWork.palette = state.selectedWork.palette || {};
            state.selectedWork.palette[kind] = normalized;
            if (kind === "mainColor") {
                el.articleMainColor.value = normalized;
                el.articleMainColorText.value = normalized;
            } else if (kind === "secondaryColor") {
                el.articleSecondaryColor.value = normalized;
                el.articleSecondaryColorText.value = normalized;
            } else if (kind === "backgroundColor") {
                el.articleBackgroundColor.value = normalized;
                el.articleBackgroundColorText.value = normalized;
            }
            if (state.selectedWork.styleHref) {
                state.selectedWork.styleText = applyPaletteToCss(state.selectedWork.styleText, state.selectedWork.palette);
            }
            patchPreviewPalette();
            state.dirty = true;
        }

        el.articleTitle.addEventListener("input", function () {
            if (!state.selectedWork) return;
            state.selectedWork.title = el.articleTitle.value;
            patchPreviewTitle();
            patchIndexPreviewCard();
            renderWorkList();
            state.dirty = true;
        });

        el.articleCategory.addEventListener("input", function () {
            if (!state.selectedWork) return;
            state.selectedWork.category = el.articleCategory.value;
            patchIndexPreviewCard();
            state.dirty = true;
        });

        el.articleDesc.addEventListener("input", function () {
            if (!state.selectedWork) return;
            state.selectedWork.description = el.articleDesc.value;
            patchIndexPreviewCard();
            state.dirty = true;
        });

        el.articleTools.addEventListener("change", function (event) {
            if (!state.selectedWork) return;
            if (!event.target || event.target.type !== "checkbox") return;
            state.selectedWork.tools = getSelectedToolValues();
            patchPreviewStructure();
            state.dirty = true;
        });

        var previewUrlDebounce = null;
        el.articlePreview.addEventListener("input", function () {
            if (!state.selectedWork) return;
            state.selectedWork.preview = el.articlePreview.value;
            patchIndexPreviewCard();
            state.dirty = true;
            clearTimeout(previewUrlDebounce);
            previewUrlDebounce = setTimeout(renderPreviewFromState, 600);
        });

        var previewStartDebounce = null;
        el.articlePreviewStart.addEventListener("input", function () {
            if (!state.selectedWork) return;
            state.selectedWork.previewStartTime = parseFloat(el.articlePreviewStart.value) || 0;
            patchIndexPreviewCard();
            state.dirty = true;
            clearTimeout(previewStartDebounce);
            previewStartDebounce = setTimeout(renderPreviewFromState, 400);
        });

        if (el.articlePreviewPicker) {
            el.articlePreviewPicker.addEventListener("click", function () {
                if (!state.selectedWork) {
                    return;
                }

                openImagePicker(function (serverPath) {
                    state.selectedWork.preview = serverPath;
                    el.articlePreview.value = serverPath;
                    patchIndexPreviewCard();
                    renderWorkList();
                    state.dirty = true;
                    renderPreviewFromState();
                });
            });
        }

        el.articleMainColor.addEventListener("input", function () {
            applyPaletteInput("mainColor", el.articleMainColor.value);
        });

        el.articleMainColorText.addEventListener("input", function () {
            applyPaletteInput("mainColor", el.articleMainColorText.value);
        });

        el.articleSecondaryColor.addEventListener("input", function () {
            applyPaletteInput("secondaryColor", el.articleSecondaryColor.value);
        });

        el.articleSecondaryColorText.addEventListener("input", function () {
            applyPaletteInput("secondaryColor", el.articleSecondaryColorText.value);
        });

        el.articleBackgroundColor.addEventListener("input", function () {
            applyPaletteInput("backgroundColor", el.articleBackgroundColor.value);
        });

        el.articleBackgroundColorText.addEventListener("input", function () {
            applyPaletteInput("backgroundColor", el.articleBackgroundColorText.value);
        });

        el.articleFavorite.addEventListener("change", function () {
            if (!state.selectedWork) return;
            state.selectedWork.favorite = el.articleFavorite.checked;
            patchIndexPreviewCard();
            renderWorkList();
            state.dirty = true;
        });

        if (el.articleHighlight) {
            el.articleHighlight.addEventListener("change", function () {
                if (!state.selectedWork) return;
                state.selectedWork.highlight = el.articleHighlight.checked;
                patchIndexPreviewCard();
                renderWorkList();
                state.dirty = true;
            });
        }

        el.articleVisible.addEventListener("change", function () {
            if (!state.selectedWork) return;
            state.selectedWork.visible = el.articleVisible.checked;
            patchIndexPreviewCard();
            state.dirty = true;
        });

        function applyIndexPaletteInput(kind, rawValue) {
            var normalized = normalizeColorValue(rawValue);
            if (!normalized) {
                return;
            }
            state.indexPalette[kind] = normalized;
            renderIndexPaletteControls();
            state.dirty = true;
            if (state.previewView === "index") {
                renderIndexPreview();
            }
        }

        if (el.indexMainColor) {
            el.indexMainColor.addEventListener("input", function () {
                applyIndexPaletteInput("mainColor", el.indexMainColor.value);
            });
            el.indexMainColorText.addEventListener("input", function () {
                applyIndexPaletteInput("mainColor", el.indexMainColorText.value);
            });
            el.indexSecondaryColor.addEventListener("input", function () {
                applyIndexPaletteInput("secondaryColor", el.indexSecondaryColor.value);
            });
            el.indexSecondaryColorText.addEventListener("input", function () {
                applyIndexPaletteInput("secondaryColor", el.indexSecondaryColorText.value);
            });
            el.indexBackgroundColor.addEventListener("input", function () {
                applyIndexPaletteInput("backgroundColor", el.indexBackgroundColor.value);
            });
            el.indexBackgroundColorText.addEventListener("input", function () {
                applyIndexPaletteInput("backgroundColor", el.indexBackgroundColorText.value);
            });
        }
    }

    function bindComponentActions() {
        document.querySelectorAll("[data-add]").forEach(function (button) {
            var addType = button.getAttribute("data-add");
            button.draggable = true;
            button.addEventListener("dragstart", function (event) {
                var defaults = { type: addType };
                if (addType === "heading") { defaults.text = "Nieuwe titel"; defaults.level = 3; }
                if (addType === "paragraph") defaults.text = "Nieuwe paragraaf";
                if (addType === "image") { defaults.src = "images/placeholder.jpg"; defaults.alt = ""; }
                if (addType === "iframe") defaults.src = "https://player.vimeo.com/video/000000000";
                if (addType === "video") { defaults.src = ""; defaults.controls = true; }
                if (addType === "palette") defaults.colors = ["#111111", "#f5f5f5", "#d97706"];
                if (addType === "list") defaults.items = ["Nieuw item"];
                if (addType === "button") { defaults.text = "Button"; defaults.href = "#"; defaults.target = "_blank"; defaults.className = "def_button"; }
                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData("text/x-cms-add", addType);
                event.dataTransfer.setData("application/json", JSON.stringify(defaults));
            });
            button.addEventListener("click", function () {
                if (!state.selectedWork || !state.selectedWork.doc) {
                    return;
                }

                var type = addType;

                if (type === "image") {
                    var pickEl = document.getElementById("imageUploadPick");
                    if (!pickEl) return;
                    pickEl.value = "";
                    pickEl.onchange = async function (event) {
                        var file = event.target.files && event.target.files[0];
                        if (!file) return;
                        var cmp = { type: "image", src: "", alt: "" };
                        state.selectedWork.components.push(cmp);
                        state.selectedComponentIndex = state.selectedWork.components.length - 1;
                        state.dirty = true;
                        try {
                            setStatus("Uploading image...", "info");
                            if (state.mode === "fs") {
                                var imagesDir = await state.dirHandle.getDirectoryHandle("images", { create: true });
                                var uploadsDir = await imagesDir.getDirectoryHandle("uploads", { create: true });
                                var ext = file.name.indexOf(".") !== -1 ? file.name.split(".").pop() : "png";
                                var safeName = Date.now() + "-" + slugify(file.name.replace(/\.[^/.]+$/, "")) + "." + ext;
                                var targetHandle = await uploadsDir.getFileHandle(safeName, { create: true });
                                var writable = await targetHandle.createWritable();
                                await writable.write(await file.arrayBuffer());
                                await writable.close();
                                cmp.src = "images/uploads/" + safeName;
                            } else if (state.mode === "api") {
                                var formData = new FormData();
                                formData.append("file", file, file.name);
                                var response = await fetch(buildApiUrl("/cms-api/upload"), { method: "POST", body: formData });
                                if (!response.ok) throw new Error("Upload failed: " + response.status);
                                var result = await response.json();
                                if (!result || !result.path) throw new Error("No file path returned.");
                                cmp.src = result.path;
                            } else {
                                setStatus("Upload werkt alleen met een lokale write target.", "error");
                                return;
                            }
                            setStatus("Afbeelding geupload: " + cmp.src);
                        } catch (err) {
                            setStatus("Upload mislukt: " + err.message);
                        }
                        renderComponentList();
                        renderComponentProps();
                        patchPreviewStructure();
                    };
                    pickEl.click();
                    return;
                }

                var cmp = { type: type };
                if (type === "heading") { cmp.text = "Nieuwe titel"; cmp.level = 3; }
                if (type === "paragraph") cmp.text = "Nieuwe paragraaf";
                if (type === "iframe") cmp.src = "https://player.vimeo.com/video/000000000";
                if (type === "video") { cmp.src = ""; cmp.controls = true; }
                if (type === "palette") cmp.colors = ["#111111", "#f5f5f5", "#d97706"];
                if (type === "list") cmp.items = ["Nieuw item"];
                if (type === "button") { cmp.text = "Button"; cmp.href = "#"; cmp.target = "_blank"; cmp.className = "def_button"; }

                state.selectedWork.components.push(cmp);
                state.selectedComponentIndex = state.selectedWork.components.length - 1;
                state.dirty = true;
                renderComponentList();
                renderComponentProps();
                patchPreviewStructure();
            });
        });

        el.moveUpBtn.addEventListener("click", function () {
            var work = state.selectedWork;
            var idx = state.selectedComponentIndex;
            if (!work || !work.doc || idx <= 0) return;
            var tmp = work.components[idx - 1];
            work.components[idx - 1] = work.components[idx];
            work.components[idx] = tmp;
            state.selectedComponentIndex = idx - 1;
            state.dirty = true;
            renderComponentList();
            renderComponentProps();
            patchPreviewStructure();
        });

        el.moveDownBtn.addEventListener("click", function () {
            var work = state.selectedWork;
            var idx = state.selectedComponentIndex;
            if (!work || !work.doc || idx < 0 || idx >= work.components.length - 1) return;
            var tmp = work.components[idx + 1];
            work.components[idx + 1] = work.components[idx];
            work.components[idx] = tmp;
            state.selectedComponentIndex = idx + 1;
            state.dirty = true;
            renderComponentList();
            renderComponentProps();
            patchPreviewStructure();
        });

        el.deleteComponentBtn.addEventListener("click", function () {
            var work = state.selectedWork;
            var idx = state.selectedComponentIndex;
            if (!work || !work.doc || idx < 0) return;
            work.components.splice(idx, 1);
            state.selectedComponentIndex = Math.min(idx, work.components.length - 1);
            state.dirty = true;
            renderComponentList();
            renderComponentProps();
            patchPreviewStructure();
        });
    }

    function previewBgUrl(url) {
        if (!url) return "";
        var vimeoMatch = url.match(/(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/);
        if (vimeoMatch) return "https://vumbnail.com/" + vimeoMatch[1] + ".jpg";
        var youtubeMatch = url.match(/(?:youtube\.com|youtu\.be)\/(?:embed\/|watch\?v=)?([\w-]+)/);
        if (youtubeMatch) return "https://img.youtube.com/vi/" + youtubeMatch[1] + "/maxresdefault.jpg";
        if (/\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url)) {
            if (/^https?:\/\//i.test(url)) return url;
            return "/" + url.replace(/^\/+/, "");
        }
        return "";
    }

    function syncIndexDoc() {
        var list = state.indexDoc.getElementById("assignment_list");
        if (!list) return;

        applyIndexPaletteToDoc(state.indexDoc);

        list.innerHTML = "";

        var fragment = state.indexDoc.createDocumentFragment();

        state.works.forEach(function (work) {
            var card = state.indexDoc.createElement("a");
            card.className = "work-card";
            card.setAttribute("href", work.href);
            card.setAttribute("data-preview", work.preview || "");
            card.setAttribute("data-preview-start", String(work.previewStartTime || 0));
            card.setAttribute("data-visible", work.visible !== false ? "true" : "false");
            card.setAttribute("data-favorite", work.favorite ? "true" : "false");
            card.setAttribute("data-highlight", work.highlight ? "2x2" : "1x1");

            if (work.visible === false) {
                card.classList.add("hidden-work");
            }
            if (work.favorite) {
                card.classList.add("is-favorite");
            }
            if (work.highlight) {
                card.classList.add("work-card--highlight");
            }

            var bgUrl = previewBgUrl(work.preview);
            if (bgUrl) {
                card.setAttribute("style", '--preview-bg: url("' + bgUrl.replace(/"/g, '\\"') + '");');
            }

            var cat = state.indexDoc.createElement("span");
            cat.className = "work-card-cat";
            cat.textContent = work.category || "";

            var title = state.indexDoc.createElement("span");
            title.className = "work-card-title";
            title.textContent = work.title || "";

            var desc = state.indexDoc.createElement("span");
            desc.className = "work-card-desc";
            desc.textContent = work.description || "";

            card.appendChild(cat);
            if (work.favorite) {
                var star = state.indexDoc.createElement("span");
                star.className = "work-card-star";
                star.setAttribute("aria-hidden", "true");
                star.textContent = "★";
                card.appendChild(star);
            }
            card.appendChild(title);
            card.appendChild(desc);
            fragment.appendChild(card);
        });

        list.appendChild(fragment);
    }

    function syncWorkDoc(work) {
        var doc = work.doc;
        if (!doc) {
            return;
        }

        var h2 = doc.querySelector("#showcase_large h2");
        if (h2) {
            h2.textContent = work.title || h2.textContent;
        }

        renderToolsBlock(doc, work);

        var desc = doc.querySelector("#assignment_desc");
        if (desc) {
            desc.innerHTML = "";
            work.components.forEach(function (cmp, idx) {
                desc.appendChild(componentToNode(doc, cmp, idx, false));
            });
        }

        renderToolsBlock(doc, work);

        var paletteCss = buildPaletteOverrideCss(work);
        var paletteStyle = doc.getElementById("cms-palette-inline");
        if (paletteCss) {
            if (!paletteStyle) {
                paletteStyle = doc.createElement("style");
                paletteStyle.id = "cms-palette-inline";
                doc.head.appendChild(paletteStyle);
            }
            paletteStyle.textContent = paletteCss;
        } else if (paletteStyle) {
            paletteStyle.remove();
        }

        var backgroundConfigNode = doc.getElementById("cms-work-background");
        if (backgroundConfigNode) {
            backgroundConfigNode.remove();
        }

        ensureVideoRuntimeScripts(doc, work);
    }

    // A <video>/<iframe> component pointing at metadata.json only becomes
    // playable on the live page once js/work_video.js (and its player) run.
    // New work pages don't have those tags until a video component needs
    // them, so make sure they're present whenever one does.
    function ensureVideoRuntimeScripts(doc, work) {
        var hasVideo = (work.components || []).some(function (cmp) {
            return cmp.type === "video";
        });
        if (!hasVideo || !doc.body) {
            return;
        }

        [relativePathFromWork(work.href, "js/video_player.js"), relativePathFromWork(work.href, "js/work_video.js")].forEach(function (src) {
            var existing = Array.from(doc.querySelectorAll("script[src]")).some(function (script) {
                return basename(script.getAttribute("src") || "") === basename(src);
            });
            if (!existing) {
                var script = doc.createElement("script");
                script.setAttribute("src", src);
                doc.body.appendChild(script);
            }
        });
    }

    function downloadText(filename, text) {
        var blob = new Blob([text], { type: "text/html;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    async function saveAll(options) {
        options = options || {};
        var isAuto = !!options.auto;

        if (state.saveInProgress) {
            return;
        }

        if ((state.mode === "fallback" || state.mode === "api") && !state.indexDoc) {
            setStatus("Importeer eerst index.html en werkbestanden.");
            return;
        }

        if (state.mode === "fallback") {
            setStatus("Geen lokale write target beschikbaar. Start cms_server.py of gebruik Connect Local Folder in een ondersteunde browser.", "error");
            return;
        }

        if (state.mode === "fs" && !state.dirHandle) {
            setStatus("Koppel eerst een map.");
            return;
        }

        try {
            state.saveInProgress = true;
            setSaveButtonState(isAuto ? "Auto-saving..." : "Saving...", true);
            setStatus(isAuto ? "Auto-saving files..." : "Saving files...", "progress");
            syncIndexDoc();
            var indexOutput = "<!DOCTYPE html>\n" + state.indexDoc.documentElement.outerHTML;

            if (state.mode === "api") {
                var workPayload = [];
                for (var k = 0; k < state.works.length; k += 1) {
                    var apiWork = state.works[k];
                    if (!apiWork.doc) {
                        continue;
                    }
                    syncWorkDoc(apiWork);
                    workPayload.push({
                        path: apiWork.href,
                        html: "<!DOCTYPE html>\n" + apiWork.doc.documentElement.outerHTML
                    });
                }

                var apiResult = await apiPostJson("/cms-api/save", {
                    indexHtml: indexOutput,
                    works: workPayload,
                    files: []
                });

                var verification = await verifyApiSave(state.selectedWork);

                setLocalTarget(getLocalWriteDescription());
                if (verification.ok) {
                    setStatus((isAuto ? "Auto-save: " : "") + "Lokale files opgeslagen in " + state.apiRoot + " - index.html + " + String(apiResult.savedWorks || 0) + " work files. " + verification.details, "success");
                } else {
                    setStatus("Save completed, maar verificatie faalde. " + verification.details, "error");
                }
            } else if (state.mode === "fs") {
                var indexHandle = await getFileHandleFromPath(state.dirHandle, "index.html", false);
                await writeTextFile(indexHandle, indexOutput);

                var savedWorks = 0;
                for (var i = 0; i < state.works.length; i += 1) {
                    var work = state.works[i];
                    if (!work.doc) {
                        continue;
                    }
                    syncWorkDoc(work);
                    var fileHandle = await getFileHandleFromPath(state.dirHandle, work.href, false);
                    await writeTextFile(fileHandle, "<!DOCTYPE html>\n" + work.doc.documentElement.outerHTML);
                    savedWorks += 1;
                }

                setLocalTarget(getLocalWriteDescription());
                setStatus((isAuto ? "Auto-save: " : "") + "Lokale files opgeslagen in de gekoppelde map - index.html + " + String(savedWorks) + " work files.", "success");
            }

            state.dirty = false;
            state.autoSaveDirtySince = 0;
        } catch (error) {
            setStatus("Save failed: " + error.message, "error");
        } finally {
            state.saveInProgress = false;
            setSaveButtonState("Save Files", false);
        }
    }

    function bindAutoSave() {
        window.setInterval(function () {
            if (!state.dirty || state.saveInProgress) {
                if (!state.dirty) {
                    state.autoSaveDirtySince = 0;
                }
                return;
            }

            if (state.mode === "fallback") {
                return;
            }

            if (state.mode === "fs" && !state.dirHandle) {
                return;
            }

            if (state.mode === "api" && !state.indexDoc) {
                return;
            }

            if (!state.autoSaveDirtySince) {
                state.autoSaveDirtySince = Date.now();
                return;
            }

            if (Date.now() - state.autoSaveDirtySince < 2500) {
                return;
            }

            saveAll({ auto: true });
        }, 1200);
    }

    function addIndexEntry(name, filename) {
        var list = state.indexDoc.getElementById("assignment_list");
        if (!list) {
            return;
        }

        var card = state.indexDoc.createElement("a");
        card.className = "work-card";
        card.setAttribute("href", filename);
        card.setAttribute("data-preview", "");
        card.setAttribute("data-preview-start", "0");
        card.setAttribute("data-visible", "true");
        card.setAttribute("data-favorite", "false");
        card.setAttribute("data-highlight", "1x1");

        var cat = state.indexDoc.createElement("span");
        cat.className = "work-card-cat";
        cat.textContent = "Nieuwe categorie";

        var title = state.indexDoc.createElement("span");
        title.className = "work-card-title";
        title.textContent = name;

        var desc = state.indexDoc.createElement("span");
        desc.className = "work-card-desc";
        desc.textContent = "Nieuw werk.";

        card.appendChild(cat);
        card.appendChild(title);
        card.appendChild(desc);
        list.appendChild(card);
    }

    function buildWorkTemplate(name) {
        return (
            "<!DOCTYPE html>\n" +
            "<html lang=\"en\">\n" +
            "<head>\n" +
            "  <meta charset=\"UTF-8\">\n" +
            "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
            "  <title>Seth Van den Bossche Portfolio</title>\n" +
            "  <link rel=\"stylesheet\" href=\"style/css.css\">\n" +
            "</head>\n" +
            "<body>\n" +
            "  <div id=\"left_side\">\n" +
            "    <div><a class=\"def_button\" id=\"back_button\" href=\"index.html\">⟵ Terug</a></div>\n" +
            "    <div id=\"showcase_large\"><h2>" + escapeHtml(name) + "</h2><div id=\"work_tools\" class=\"work-tools\"></div></div>\n" +
            "    <div id=\"assignment_desc\">\n" +
            "      <h3>Intro</h3>\n" +
            "      <p>Nieuw werk.</p>\n" +
            "    </div>\n" +
            "  </div>\n" +
            "  <script src=\"js/i18n.js\"></script>\n" +
            "</body>\n" +
            "</html>\n"
        );
    }

    async function addNewWork() {
        if (!state.indexDoc) {
            setStatus("Laad eerst index.html via Connect Folder of de lokale server.");
            return;
        }

        var name = window.prompt("Naam van nieuw werk:");
        if (!name) return;

        var slug = slugify(name);
        if (!slug) {
            setStatus("Ongeldige naam.");
            return;
        }

        var filename = slug + ".html";
        if (state.works.some(function (w) { return basename(w.href) === filename; })) {
            setStatus("Bestand bestaat al: " + filename);
            return;
        }

        var template = buildWorkTemplate(name);

        try {
            if (state.mode === "fs") {
                var fileHandle = await getFileHandleFromPath(state.dirHandle, filename, true);
                await writeTextFile(fileHandle, template);
            } else if (state.mode === "api") {
                state.fileStore.set(filename, template);
            } else {
                setStatus("Nieuw werk aanmaken vereist een lokale write target. Start de CMS-server of koppel een map.", "error");
                return;
            }

            addIndexEntry(name, filename);
            state.indexText = "<!DOCTYPE html>\n" + state.indexDoc.documentElement.outerHTML;
            parseIndex();
            renderWorkList();

            state.dirty = true;
            if (state.mode === "fs") {
                setStatus("Nieuw werk aangemaakt: " + filename + " (Save Changes om index te bewaren).");
            } else if (state.mode === "api") {
                setStatus("Nieuw werk klaar: " + filename + ". Gebruik Save Local Files om het naar je project te schrijven.");
            }
        } catch (error) {
            setStatus("Nieuw werk aanmaken mislukt: " + error.message);
        }
    }

    async function connectFolderFs() {
        try {
            state.dirHandle = await window.showDirectoryPicker();
            var indexHandle = await getFileHandleFromPath(state.dirHandle, "index.html", false);
            state.indexText = await readFileFromHandle(indexHandle);
            parseIndex();
            renderWorkList();
            renderPreviewFromState();
            setLocalTarget(getLocalWriteDescription());
            setStatus("Lokale map gekoppeld. Selecteer een werk links.");
        } catch (error) {
            setStatus("Map koppelen geannuleerd of mislukt.");
        }
    }

    async function loadIndexFromApi() {
        try {
            state.indexText = await apiGetText("/cms-api/index");
            parseIndex();
            renderWorkList();
            renderPreviewFromState();
            setLocalTarget(getLocalWriteDescription());
            setStatus("Bestanden automatisch geladen via lokale CMS API.");
        } catch (error) {
            setStatus("API laden mislukt: " + error.message);
        }
    }

    async function preloadIndexFromSite() {
        if (state.indexText) {
            return;
        }

        var indexText = await tryFetchSiteFile("../index.html");
        if (!indexText) {
            return;
        }

        state.indexText = indexText;
        parseIndex();
        renderWorkList();
        renderPreviewFromState();

        if (state.mode === "fs" && !state.dirHandle) {
            setLocalTarget(getLocalWriteDescription());
            setStatus("Works geladen. Koppel nu een lokale map zodat Save Local Files echte projectbestanden wijzigt.");
        } else if (state.mode === "fallback") {
            setLocalTarget(getLocalWriteDescription());
            setStatus("Works geladen in read-only mode. Start de lokale CMS-server om echte bestanden te wijzigen.", "error");
        }
    }

    async function connectSource() {
        if (state.mode === "api") {
            await loadIndexFromApi();
            return;
        }

        if (state.mode === "fs") {
            await connectFolderFs();
            return;
        }

        await preloadIndexFromSite();
    }

    function bindTopActions() {
        el.connectFolderBtn.addEventListener("click", connectSource);
        el.saveAllBtn.addEventListener("click", saveAll);
        el.newWorkBtn.addEventListener("click", addNewWork);
        el.workSearch.addEventListener("input", renderWorkList);

        el.showWorksBtn.addEventListener("click", function () {
            setLeftMode("works");
        });

        el.toolsBtn.addEventListener("click", function () {
            setLeftMode("tools");
        });

        el.pickerCloseBtn.addEventListener("click", closeImagePicker);
        el.serverImagePicker.addEventListener("click", function (event) {
            if (event.target === el.serverImagePicker) {
                closeImagePicker();
            }
        });
    }

    function bindPreviewBridge() {
        window.addEventListener("message", function (event) {
            var data = event && event.data;
            if (!data || typeof data !== "object") {
                return;
            }

            if (data.type === "cms-preview-hover") {
                var hoverIdx = Number(data.index);
                if (!state.selectedWork) {
                    return;
                }
                if (Number.isNaN(hoverIdx)) {
                    hoverIdx = -1;
                }
                if (hoverIdx === state.hoveredComponentIndex) {
                    return;
                }
                state.hoveredComponentIndex = hoverIdx;
                applyPreviewSelectionState();
                return;
            }

            if (data.type === "cms-preview-select") {
                var selectedIdx = Number(data.index);
                if (!state.selectedWork || Number.isNaN(selectedIdx)) {
                    return;
                }
                state.selectedComponentIndex = selectedIdx;
                state.hoveredComponentIndex = selectedIdx;
                setLeftMode("components");
                renderComponentList();
                renderComponentProps();
                applyPreviewSelectionState();
                patchPreviewComponent(selectedIdx);
                return;
            }

            if (data.type === "cms-preview-drop") {
                if (!state.selectedWork) {
                    return;
                }
                var dropIndex = Number(data.index);
                if (Number.isNaN(dropIndex) || dropIndex < 0) {
                    dropIndex = state.selectedWork.components.length;
                }
                if (data.addType) {
                    var newCmp = JSON.parse(JSON.stringify(data.defaults || { type: data.addType }));
                    state.selectedWork.components.splice(dropIndex, 0, newCmp);
                    state.selectedComponentIndex = dropIndex;
                    state.dirty = true;
                    setLeftMode("components");
                    renderComponentList();
                    renderComponentProps();
                    patchPreviewStructure();
                    return;
                }
                if (!data.path) {
                    return;
                }
                var relPath = relativePathFromWork(state.selectedWork.href, data.path);
                var ext = data.path.split(".").pop().toLowerCase();
                var isVideo = ["mp4", "webm", "ogg", "mov", "avi"].indexOf(ext) !== -1;
                var newCmp = isVideo
                    ? { type: "video", src: relPath, controls: true }
                    : { type: "image", src: relPath, alt: "", imageSize: "full" };
                state.selectedWork.components.splice(dropIndex, 0, newCmp);
                state.selectedComponentIndex = dropIndex;
                state.dirty = true;
                setLeftMode("components");
                renderComponentList();
                renderComponentProps();
                patchPreviewStructure();
            }
        });
    }

    function bindPreviewControls() {
        el.previewMobileBtn.addEventListener("click", function () {
            state.previewMobile = !state.previewMobile;
            el.previewMobileBtn.classList.toggle("is-active", state.previewMobile);
            el.workPreview.classList.toggle("is-mobile-preview", state.previewMobile);
        });

        if (el.previewMuteBtn) {
            el.previewMuteBtn.addEventListener("click", function () {
                setPreviewMuted(!state.previewMuted);
            });
        }

        if (el.previewViewBtn) {
            el.previewViewBtn.addEventListener("click", function () {
                if (state.previewView === "index" && !state.selectedWork) {
                    setStatus("Selecteer eerst een work om article preview te openen.");
                    return;
                }
                setPreviewView(state.previewView === "index" ? "article" : "index");
            });
        }

        el.previewFullscreenBtn.addEventListener("click", function () {
            var wrap = el.previewBody ? el.previewBody.parentElement : null;
            if (!wrap) {
                return;
            }

            if (document.fullscreenElement) {
                document.exitFullscreen();
                return;
            }

            if (wrap.requestFullscreen) {
                wrap.requestFullscreen();
            }
        });
    }

    function setToolStatus(message, kind) {
        if (!el.toolStatus) {
            return;
        }
        el.toolStatus.textContent = message;
        el.toolStatus.classList.toggle("is-success", kind === "success");
        el.toolStatus.classList.toggle("is-error", kind === "error");
        el.toolStatus.classList.toggle("is-progress", kind === "progress");
    }

    function pollToolJob(jobId, onProgress) {
        return new Promise(function (resolve, reject) {
            var attempts = 0;

            function tick() {
                fetch(buildApiUrl("/cms-api/download-video/status?id=" + encodeURIComponent(jobId)))
                    .then(function (response) {
                        return response.json();
                    })
                    .then(function (data) {
                        attempts += 1;
                        if (onProgress && data && data.progress) {
                            onProgress(data.progress);
                        }
                        if (data && data.state === "done") {
                            resolve(data.metadata || {});
                            return;
                        }
                        if (data && data.state === "error") {
                            reject(new Error(data.error || "Download failed"));
                            return;
                        }
                        if (attempts > 7200) {
                            reject(new Error("Timed out waiting for download."));
                            return;
                        }
                        setTimeout(tick, 1000);
                    })
                    .catch(function () {
                        attempts += 1;
                        if (attempts > 60) {
                            reject(new Error("Lost connection while polling the download."));
                            return;
                        }
                        setTimeout(tick, 1000);
                    });
            }

            tick();
        });
    }

    function pollVideoUploadJob(jobId, onProgress) {
        return new Promise(function (resolve, reject) {
            var attempts = 0;
            var seen = 0;

            function tick() {
                fetch(buildApiUrl("/cms-api/upload-video/status?id=" + encodeURIComponent(jobId)))
                    .then(function (response) {
                        return response.json();
                    })
                    .then(function (data) {
                        attempts += 1;
                        if (onProgress && data && data.progress) {
                            for (var i = seen; i < data.progress.length; i += 1) {
                                onProgress(data.progress[i], i);
                            }
                            seen = data.progress.length;
                        }
                        if (data && data.state === "done") {
                            resolve(data.metadata || {});
                            return;
                        }
                        if (data && data.state === "error") {
                            reject(new Error(data.error || "Video upload failed"));
                            return;
                        }
                        if (attempts > 7200) {
                            reject(new Error("Timed out waiting for video upload."));
                            return;
                        }
                        setTimeout(tick, 1000);
                    })
                    .catch(function () {
                        attempts += 1;
                        if (attempts > 60) {
                            reject(new Error("Lost connection while polling the video upload."));
                            return;
                        }
                        setTimeout(tick, 1000);
                    });
            }

            tick();
        });
    }

    function startVideoUpload(file, workName, onProgress, onUploadProgress) {
        return new Promise(function (resolve, reject) {
            var url = buildApiUrl("/cms-api/upload-video?" + new URLSearchParams({
                workName: workName || "",
                fileName: file.name
            }).toString());

            var xhr = new XMLHttpRequest();
            xhr.open("POST", url);
            xhr.setRequestHeader("Content-Type", "application/octet-stream");

            // Upload progress: browser → server
            xhr.upload.addEventListener("progress", function (e) {
                if (e.lengthComputable && onUploadProgress) {
                    onUploadProgress(e.loaded, e.total, Math.round(e.loaded / e.total * 100));
                }
            });

            xhr.upload.addEventListener("load", function () {
                if (onUploadProgress) onUploadProgress(file.size, file.size, 100);
            });

            xhr.addEventListener("load", function () {
                var result;
                try { result = JSON.parse(xhr.responseText); } catch (e) {
                    reject(new Error("Ongeldig antwoord van server"));
                    return;
                }
                if (!result || !result.ok) {
                    reject(new Error((result && result.error) || "Server kon upload niet starten"));
                    return;
                }
                pollVideoUploadJob(result.id, onProgress).then(resolve, reject);
            });

            xhr.addEventListener("error", function () {
                reject(new Error("Netwerkfout tijdens uploaden"));
            });

            xhr.addEventListener("abort", function () {
                reject(new Error("Upload geannuleerd"));
            });

            xhr.send(file);
        });
    }
    function startToolDownload(url, workName, onProgress) {
        return fetch(buildApiUrl("/cms-api/download-video"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: url, workName: workName })
        })
            .then(function (response) {
                return response.json();
            })
            .then(function (result) {
                if (!result || !result.ok) {
                    throw new Error((result && result.error) || "Failed to start download");
                }
                return pollToolJob(result.id, onProgress);
            });
    }

    function isVideoPreview(value) {
        if (!value || typeof value !== "string") {
            return false;
        }
        var v = value.trim();
        if (v.indexOf("videos/uploads/") !== -1) {
            return false;
        }
        if (/\.(jpe?g|png|gif|webp|avif|svg)(\?|#|$)/i.test(v)) {
            return false;
        }
        if (/^https?:\/\//i.test(v)) {
            return /youtube\.com|youtu\.be|vimeo\.com|(\.mp4|\.webm|\.ogg|\.mov|\.avi)(\?|#|$)/i.test(v);
        }
        return /(\.mp4|\.webm|\.ogg|\.mov|\.avi)(\?|#|$)/i.test(v);
    }

    function isRemoteVideoSrc(src) {
        if (!src || typeof src !== "string") return false;
        var v = src.trim();
        if (!v) return false;
        if (v.indexOf("videos/uploads/") !== -1) return false;
        if (v.indexOf("images/uploads/") !== -1) return false;
        if (/^https?:\/\//i.test(v)) {
            return /youtube\.com|youtu\.be|vimeo\.com|youtube-nocookie\.com/i.test(v);
        }
        return false;
    }

    function extractVideoIdFromSrc(src) {
        if (!src) return null;
        var vm = src.match(/vimeo\.com\/video\/(\d+)/);
        if (vm) return { kind: "vimeo", id: vm[1] };
        var yt = src.match(/(?:youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/)|youtu\.be\/|youtube-nocookie\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
        if (yt) return { kind: "youtube", id: yt[1] };
        return null;
    }

    function collectWorkEmbedVideos(work) {
        var results = [];
        if (!work || !work.doc) return results;

        var iframes = work.doc.querySelectorAll("iframe");
        Array.from(iframes).forEach(function (iframe) {
            var src = iframe.getAttribute("src") || "";
            if (isRemoteVideoSrc(src)) {
                var idInfo = extractVideoIdFromSrc(src);
                if (idInfo) {
                    results.push({ src: src, id: idInfo.id, kind: idInfo.kind, element: iframe });
                }
            }
        });

        var videos = work.doc.querySelectorAll("video");
        Array.from(videos).forEach(function (video) {
            var src = video.getAttribute("src") || "";
            var source = video.querySelector("source");
            if (source) src = source.getAttribute("src") || src;
            if (isRemoteVideoSrc(src)) {
                var idInfo = extractVideoIdFromSrc(src);
                if (idInfo) {
                    results.push({ src: src, id: idInfo.id, kind: idInfo.kind, element: video });
                }
            }
        });

        return results;
    }

    function appendToolLine(line) {
        if (!el.toolOutput) {
            return;
        }
        el.toolOutput.textContent = (el.toolOutput.textContent ? el.toolOutput.textContent + "\n" : "") + line;
        el.toolOutput.scrollTop = el.toolOutput.scrollHeight;
    }

    function setFotoThumbsStatus(message, kind) {
        if (!el.fotoThumbsStatus) {
            return;
        }
        el.fotoThumbsStatus.textContent = message;
        el.fotoThumbsStatus.classList.toggle("is-success", kind === "success");
        el.fotoThumbsStatus.classList.toggle("is-error", kind === "error");
        el.fotoThumbsStatus.classList.toggle("is-progress", kind === "progress");
    }

    function appendFotoThumbsLine(line) {
        if (!el.fotoThumbsOutput) {
            return;
        }
        el.fotoThumbsOutput.textContent = (el.fotoThumbsOutput.textContent ? el.fotoThumbsOutput.textContent + "\n" : "") + line;
        el.fotoThumbsOutput.scrollTop = el.fotoThumbsOutput.scrollHeight;
    }

    function setCompressIndexStatus(message, kind) {
        if (!el.compressIndexStatus) {
            return;
        }
        el.compressIndexStatus.textContent = message;
        el.compressIndexStatus.classList.toggle("is-success", kind === "success");
        el.compressIndexStatus.classList.toggle("is-error", kind === "error");
        el.compressIndexStatus.classList.toggle("is-progress", kind === "progress");
    }

    function appendCompressIndexLine(line) {
        if (!el.compressIndexOutput) {
            return;
        }
        el.compressIndexOutput.textContent = (el.compressIndexOutput.textContent ? el.compressIndexOutput.textContent + "\n" : "") + line;
        el.compressIndexOutput.scrollTop = el.compressIndexOutput.scrollHeight;
    }

    function pollCompressIndexJob(jobId) {
        return new Promise(function (resolve, reject) {
            var attempts = 0;
            var seen = 0;

            function tick() {
                fetch(buildApiUrl("/cms-api/index-previews/status?id=" + encodeURIComponent(jobId)))
                    .then(function (response) {
                        return response.json();
                    })
                    .then(function (data) {
                        attempts += 1;
                        if (data && data.progress && data.progress.length > seen) {
                            for (var i = seen; i < data.progress.length; i += 1) {
                                appendCompressIndexLine(data.progress[i]);
                            }
                            seen = data.progress.length;
                        }
                        if (data && data.state === "done") {
                            resolve(data.result || {});
                            return;
                        }
                        if (data && data.state === "error") {
                            reject(new Error(data.error || "Preview generation failed"));
                            return;
                        }
                        if (attempts > 7200) {
                            reject(new Error("Timed out waiting for preview generation."));
                            return;
                        }
                        setTimeout(tick, 1000);
                    })
                    .catch(function () {
                        attempts += 1;
                        if (attempts > 60) {
                            reject(new Error("Lost connection while polling preview generation."));
                            return;
                        }
                        setTimeout(tick, 1000);
                    });
            }

            tick();
        });
    }

    function runCompressIndexPreviews() {
        if (state.mode !== "api") {
            setCompressIndexStatus("Index Preview Compression needs the local CMS server. Start it with: python cms_server.py", "error");
            return;
        }

        if (el.compressIndexBtn) {
            el.compressIndexBtn.disabled = true;
        }
        if (el.compressIndexOutput) {
            el.compressIndexOutput.textContent = "";
        }
        setCompressIndexStatus("Starting...", "progress");

        fetch(buildApiUrl("/cms-api/index-previews"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
        })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                if (!data || !data.id) {
                    throw new Error((data && data.error) || "Could not start job");
                }
                return pollCompressIndexJob(data.id);
            })
            .then(function (result) {
                setCompressIndexStatus(
                    "Done. processed=" + ((result && result.processed) || 0) + ", generated=" + ((result && result.generated) || 0) + ".",
                    "success"
                );
            })
            .catch(function (err) {
                setCompressIndexStatus("Error: " + err.message, "error");
            })
            .then(function () {
                if (el.compressIndexBtn) {
                    el.compressIndexBtn.disabled = false;
                }
            });
    }

    function runFotoThumbs() {
        if (state.mode !== "api") {
            setFotoThumbsStatus("Foto Thumbnails needs the local CMS server. Start it with: python cms_server.py", "error");
            return;
        }

        if (el.fotoThumbsBtn) {
            el.fotoThumbsBtn.disabled = true;
        }
        if (el.fotoThumbsOutput) {
            el.fotoThumbsOutput.textContent = "";
        }
        setFotoThumbsStatus("Starting...", "progress");

        fetch(buildApiUrl("/cms-api/foto-thumbs"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
        })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                if (!data || !data.id) {
                    throw new Error((data && data.error) || "Could not start job");
                }
                return pollFotoThumbsJob(data.id);
            })
            .then(function (result) {
                var generated = (result && result.generated) || 0;
                var updated = result ? result.updated : false;
                setFotoThumbsStatus(
                    "Done. " + generated + " thumbnail(s) processed, HTML updated: " + updated + ".",
                    "success"
                );
            })
            .catch(function (err) {
                setFotoThumbsStatus("Error: " + err.message, "error");
            })
            .then(function () {
                if (el.fotoThumbsBtn) {
                    el.fotoThumbsBtn.disabled = false;
                }
            });
    }

    function pollFotoThumbsJob(jobId) {
        return new Promise(function (resolve, reject) {
            var attempts = 0;
            var seen = 0;

            function tick() {
                fetch(buildApiUrl("/cms-api/foto-thumbs/status?id=" + encodeURIComponent(jobId)))
                    .then(function (response) {
                        return response.json();
                    })
                    .then(function (data) {
                        attempts += 1;
                        if (data && data.progress && data.progress.length > seen) {
                            for (var i = seen; i < data.progress.length; i += 1) {
                                appendFotoThumbsLine(data.progress[i]);
                            }
                            seen = data.progress.length;
                        }
                        if (data && data.state === "done") {
                            resolve(data.result || {});
                            return;
                        }
                        if (data && data.state === "error") {
                            reject(new Error(data.error || "Generation failed"));
                            return;
                        }
                        if (attempts > 7200) {
                            reject(new Error("Timed out waiting for thumbnail generation."));
                            return;
                        }
                        setTimeout(tick, 1000);
                    })
                    .catch(function () {
                        attempts += 1;
                        if (attempts > 60) {
                            reject(new Error("Lost connection while polling thumbnail generation."));
                            return;
                        }
                        setTimeout(tick, 1000);
                    });
            }

            tick();
        });
    }

    function runAutoDownloadAll() {
        if (state.mode !== "api") {
            setToolStatus("Download All needs the local CMS server. Start it with: python cms_server.py", "error");
            return;
        }

        if (el.autoDownloadBtn) {
            el.autoDownloadBtn.disabled = true;
        }
        el.toolOutput.textContent = "";
        setToolStatus("Loading work files...", "progress");

        var allJobs = [];
        var seen = {};

        function addJob(url, workName, label) {
            if (!url || seen[workName]) return;
            if (url.indexOf("videos/uploads/") !== -1) return;
            seen[workName] = true;
            allJobs.push({ url: url, workName: workName, label: label });
        }

        var workLoadPromises = state.works.map(function (work) {
            return loadWorkDoc(work).then(function () {
                var workSlug = slugify(basename(work.href).replace(/\.html?$/i, "")) || "video";
                var label = work.title || workSlug;

                if (isVideoPreview(work.preview)) {
                    addJob(work.preview, workSlug, label + " (preview)");
                }

                var embeds = collectWorkEmbedVideos(work);
                embeds.forEach(function (embed) {
                    var embedSlug = workSlug + "-" + embed.id;
                    addJob(embed.src, embedSlug, label + " (" + embed.kind + " " + embed.id + ")");
                });
            }).catch(function () {});
        });

        Promise.all(workLoadPromises).then(function () {
            if (!allJobs.length) {
                setToolStatus("No remote videos to download.", "success");
                if (el.autoDownloadBtn) el.autoDownloadBtn.disabled = false;
                return;
            }

            setToolStatus("Processing " + allJobs.length + " video(s)...", "progress");

            var done = 0;
            var failed = [];
            var idx = 0;
            var concurrency = 2;

            function worker() {
                if (idx >= allJobs.length) {
                    return Promise.resolve();
                }

                var job = allJobs[idx];
                idx += 1;
                var seenLines = 0;

                appendToolLine("[" + job.label + "] " + job.url);

                var onProgress = function (lines) {
                    if (!lines) return;
                    for (var i = seenLines; i < lines.length; i += 1) {
                        appendToolLine("  " + lines[i]);
                    }
                    seenLines = lines.length;
                };

                return startToolDownload(job.url, job.workName, onProgress)
                    .then(function (metadata) {
                        done += 1;
                        appendToolLine("[" + job.label + "] done -> " + (metadata ? metadata.preview_path : job.workName));
                    })
                    .catch(function (err) {
                        failed.push(job.label + ": " + err.message);
                        appendToolLine("[" + job.label + "] FAILED: " + err.message);
                    })
                    .then(worker);
            }

            var tasks = [];
            for (var i = 0; i < concurrency && i < allJobs.length; i += 1) {
                tasks.push(worker());
            }

            return Promise.all(tasks).then(function () {
                if (el.autoDownloadBtn) {
                    el.autoDownloadBtn.disabled = false;
                }
                renderWorkList();
                renderArticleProps();
                renderPreviewFromState();
                state.dirty = true;
                if (failed.length) {
                    setToolStatus(done + "/" + allJobs.length + " done, " + failed.length + " failed. Click Save Files to apply.", "error");
                } else {
                    setToolStatus(done + "/" + allJobs.length + " videos processed. Click Save Files to apply.", "success");
                }
            });
        });
    }

    function bindToolsActions() {
        if (!el.toolDownloadBtn) {
            return;
        }

        el.toolDownloadBtn.addEventListener("click", function () {
            var url = (el.toolVideoUrl.value || "").trim();
            var workName = (el.toolWorkName.value || "").trim();

            if (!url) {
                setToolStatus("Enter a video URL first.", "error");
                return;
            }

            if (state.mode !== "api") {
                setToolStatus("The video splitter needs the local CMS server. Start it with: python cms_server.py", "error");
                return;
            }

            el.toolDownloadBtn.disabled = true;
            el.toolVideoUrl.disabled = true;
            el.toolWorkName.disabled = true;
            el.toolOutput.textContent = "";
            setToolStatus("Downloading...", "progress");

            var seen = 0;
            startToolDownload(url, workName, function (lines) {
                if (!lines) {
                    return;
                }
                for (var i = seen; i < lines.length; i += 1) {
                    appendToolLine(lines[i]);
                }
                seen = lines.length;
            })
                .then(function (metadata) {
                    setToolStatus("Done. data-preview: " + (metadata.preview_path || "unknown"), "success");
                    if (el.toolWorkName && metadata.work_name) {
                        el.toolWorkName.value = metadata.work_name;
                    }
                })
                .catch(function (err) {
                    setToolStatus("Error: " + err.message, "error");
                })
                .then(function () {
                    el.toolDownloadBtn.disabled = false;
                    el.toolVideoUrl.disabled = false;
                    el.toolWorkName.disabled = false;
                });
        });

        if (el.autoDownloadBtn) {
            el.autoDownloadBtn.addEventListener("click", runAutoDownloadAll);
        }

        if (el.fotoThumbsBtn) {
            el.fotoThumbsBtn.addEventListener("click", runFotoThumbs);
        }

        if (el.compressIndexBtn) {
            el.compressIndexBtn.addEventListener("click", runCompressIndexPreviews);
        }
    }
    function bindCollapsibles() {
        document.querySelectorAll(".collapse-toggle").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var targetId = btn.getAttribute("data-target");
                var target = document.getElementById(targetId);
                if (!target) {
                    return;
                }

                var panel = btn.closest(".collapsible-panel");
                if (!panel) {
                    return;
                }

                var collapsed = panel.classList.toggle("is-collapsed");
                btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
                btn.textContent = collapsed ? "+" : "−";
            });
        });
    }

    function bindBeforeUnload() {
        window.addEventListener("beforeunload", function (event) {
            if (!state.dirty) {
                return;
            }
            event.preventDefault();
            event.returnValue = "";
        });
    }

    async function init() {
        await detectMode();
        bindTopActions();
        bindArticleProps();
        bindComponentActions();
        bindPreviewBridge();
        bindPreviewControls();
        bindToolsActions();
        bindCollapsibles();
        bindBeforeUnload();
        bindAutoSave();

        setLeftMode("works");
        el.cmsEmptyState.classList.add("is-hidden");
        el.cmsEditorPanel.classList.remove("is-hidden");
        el.cmsPropsPanel.classList.remove("is-hidden");
        setPreviewView("index");
        renderIndexPaletteControls();

        if (state.mode === "api") {
            await loadIndexFromApi();
            return;
        }

        await preloadIndexFromSite();
    }

    init();
})();
