(function () {
    "use strict";

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
        previewMobile: false,
        previewScroll: { x: 0, y: 0 },
        dirty: false,
        fileStore: new Map()
    };

    var el = {
        connectFolderBtn: document.getElementById("connectFolderBtn"),
        saveAllBtn: document.getElementById("saveAllBtn"),
        newWorkBtn: document.getElementById("newWorkBtn"),
        showWorksBtn: document.getElementById("showWorksBtn"),
        worksPanel: document.getElementById("worksPanel"),
        componentsPanel: document.getElementById("componentsPanel"),
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
        articleMainColor: document.getElementById("articleMainColor"),
        articleMainColorText: document.getElementById("articleMainColorText"),
        articleSecondaryColor: document.getElementById("articleSecondaryColor"),
        articleSecondaryColorText: document.getElementById("articleSecondaryColorText"),
        articleBackgroundColor: document.getElementById("articleBackgroundColor"),
        articleBackgroundColorText: document.getElementById("articleBackgroundColorText"),
        articleFavorite: document.getElementById("articleFavorite"),
        moveUpBtn: document.getElementById("moveUpBtn"),
        moveDownBtn: document.getElementById("moveDownBtn"),
        deleteComponentBtn: document.getElementById("deleteComponentBtn"),
        cmsEditorPanel: document.getElementById("cmsEditorPanel"),
        cmsPropsPanel: document.getElementById("cmsPropsPanel"),
        cmsEmptyState: document.getElementById("cmsEmptyState"),
        previewBody: document.getElementById("previewBody"),
        previewFullscreenBtn: document.getElementById("previewFullscreenBtn"),
        previewMobileBtn: document.getElementById("previewMobileBtn"),
        workPreview: document.getElementById("workPreview"),
        previewPath: document.getElementById("previewPath"),
        serverImagePicker: document.getElementById("serverImagePicker"),
        pickerCloseBtn: document.getElementById("pickerCloseBtn"),
        pickerSearch: document.getElementById("pickerSearch"),
        pickerGrid: document.getElementById("pickerGrid"),
        status: document.getElementById("cmsStatus"),
        target: document.getElementById("cmsTarget")
    };

    function setLeftMode(mode) {
        var showComponents = mode === "components";
        el.worksPanel.classList.toggle("is-hidden", showComponents);
        el.componentsPanel.classList.toggle("is-hidden", !showComponents);
        el.showWorksBtn.classList.toggle("is-hidden", !showComponents);
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

    function splitToolsList(value) {
        return (value || "")
            .split(/[\n,]+/)
            .map(function (item) {
                return item.trim();
            })
            .filter(Boolean);
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

    function buildApiUrl(path) {
        var base = state.apiBase || "";
        return base ? base + path : path;
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
            if (node.tagName && node.tagName.toLowerCase() === "img") {
                node.setAttribute("src", cmp.src || "");
                if (cmp.alt) {
                    node.setAttribute("alt", cmp.alt);
                }
            }
            return;
        }

        if (cmp.type === "iframe") {
            var iframe = node.tagName && node.tagName.toLowerCase() === "iframe" ? node : node.querySelector("iframe");
            if (!iframe) {
                return;
            }
            iframe.setAttribute("src", cmp.src || "");
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
            if (cmp.controls === false) {
                video.removeAttribute("controls");
            } else {
                video.setAttribute("controls", "");
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
        }
    }

    function parseIndex() {
        var parser = new DOMParser();
        state.indexDoc = parser.parseFromString(state.indexText, "text/html");

        var anchors = state.indexDoc.querySelectorAll("#assignment_list a[href]");
        state.works = Array.from(anchors).map(function (a) {
            var li = a.querySelector("li");
            var title = (li.querySelector(".assignment-title") || {}).textContent || a.getAttribute("href");
            var cleanTitle = title.replace(/^★\s*/, "").trim();
            var category = ((li.querySelector(".assignment-category") || {}).textContent || "").trim();
            var desc = ((li.querySelector(".assignment-desc") || {}).textContent || "").trim();
            var preview = li.getAttribute("data-preview") || "";
            var favorite = li.classList.contains("favorites") || /^★/.test(title.trim());

            return {
                href: a.getAttribute("href"),
                title: cleanTitle,
                category: category,
                description: desc,
                preview: preview,
                favorite: favorite,
                tools: [],
                htmlText: "",
                styleHref: "",
                styleText: "",
                palette: { mainColor: "", secondaryColor: "", backgroundColor: "" },
                doc: null,
                components: []
            };
        });
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
            li.innerHTML = "<div>" + (work.favorite ? "★ " : "") + escapeHtml(work.title) + "</div>";
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
                    pushComponent({
                        type: "link",
                        href: child.getAttribute("href") || "",
                        target: child.getAttribute("target") || "",
                        rel: child.getAttribute("rel") || "",
                        className: child.getAttribute("class") || "",
                        html: child.innerHTML || child.textContent || "",
                        text: child.textContent || "",
                        sourcePath: childPath
                    });
                    return;
                }

                if (tag === "img") {
                    pushComponent({
                        type: "image",
                        src: child.getAttribute("src") || "",
                        alt: child.getAttribute("alt") || "",
                        sourcePath: childPath
                    });
                    return;
                }

                if (tag === "iframe") {
                    pushComponent({
                        type: "iframe",
                        src: child.getAttribute("src") || "",
                        title: child.getAttribute("title") || "",
                        allow: child.getAttribute("allow") || "",
                        referrerpolicy: child.getAttribute("referrerpolicy") || "",
                        sourcePath: childPath
                    });
                    return;
                }

                if (tag === "video") {
                    var source = child.querySelector("source");
                    pushComponent({
                        type: "video",
                        src: (source && source.getAttribute("src")) || child.getAttribute("src") || "",
                        controls: child.hasAttribute("controls"),
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
        el.articleTools.value = (work.tools || []).join("\n");
        el.articlePreview.value = work.preview;
        el.articleMainColor.value = work.palette && work.palette.mainColor ? work.palette.mainColor : "#000000";
        el.articleMainColorText.value = work.palette && work.palette.mainColor ? work.palette.mainColor : "#000000";
        el.articleSecondaryColor.value = work.palette && work.palette.secondaryColor ? work.palette.secondaryColor : "#6f5cff";
        el.articleSecondaryColorText.value = work.palette && work.palette.secondaryColor ? work.palette.secondaryColor : "#6f5cff";
        el.articleBackgroundColor.value = work.palette && work.palette.backgroundColor ? work.palette.backgroundColor : "#ffffff";
        el.articleBackgroundColorText.value = work.palette && work.palette.backgroundColor ? work.palette.backgroundColor : "#ffffff";
        el.articleFavorite.checked = !!work.favorite;
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
                if (["png", "jpg", "jpeg", "webp", "gif", "svg", "avif", "bmp", "tif", "tiff"].indexOf(ext) !== -1) {
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

                        var image = document.createElement("img");
                        image.src = "../" + encodeURI(entry.path) + (entry.mtime ? "?v=" + encodeURIComponent(entry.mtime) : "");
                        image.alt = entry.name || "image";
                        image.loading = "lazy";
                        image.decoding = "async";

                        var fileRow = document.createElement("div");
                        fileRow.className = "picker-file";

                        var icon = document.createElement("span");
                        icon.className = "file-icon";

                        var name = document.createElement("span");
                        name.className = "file-name";
                        name.textContent = entry.name || basename(entry.path);

                        fileRow.appendChild(icon);
                        fileRow.appendChild(name);

                        button.appendChild(image);
                        button.appendChild(fileRow);
                        button.addEventListener("click", function () {
                            onSelect(entry.path);
                            closeImagePicker();
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

            addTextarea("Inhoud", cmp.text || "", function (value) {
                cmp.text = value;
                cmp.html = plainTextToHtml(value);
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
            return;
        }

        if (cmp.type === "iframe") {
            addInput("Embed URL", cmp.src || "", function (value) {
                cmp.src = value;
                patchPreviewComponent(idx);
            });
            return;
        }

        if (cmp.type === "video") {
            addInput("Video URL", cmp.src || "", function (value) {
                cmp.src = value;
                patchPreviewComponent(idx);
            });

            var videoControls = document.createElement("label");
            videoControls.className = "checkline";
            var checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = !!cmp.controls;
            checkbox.addEventListener("change", function () {
                cmp.controls = checkbox.checked;
                state.dirty = true;
                patchPreviewComponent(idx);
            });
            videoControls.appendChild(checkbox);
            videoControls.appendChild(document.createTextNode("Controls"));
            el.componentProps.appendChild(videoControls);
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
                wrappedIframe.setAttribute("src", cmp.src || "");
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

            var iframe = doc.createElement("iframe");
            iframe.setAttribute("src", cmp.src || "");
            iframe.setAttribute("frameborder", "0");
            iframe.setAttribute("allow", cmp.allow || "autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share");
            iframe.setAttribute("referrerpolicy", cmp.referrerpolicy || "strict-origin-when-cross-origin");
            if (cmp.title) {
                iframe.setAttribute("title", cmp.title);
            }
            iframe.style.width = "100%";
            iframe.style.minHeight = "420px";
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
            video.setAttribute("src", cmp.src || "");
            video.setAttribute("playsinline", "");
            video.style.width = "100%";
            video.style.maxHeight = "520px";
            if (cmp.controls !== false) {
                video.setAttribute("controls", "");
            }
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

    function patchPreviewComponent(index) {
        try {
            var doc = el.workPreview.contentDocument;
            var work = state.selectedWork;
            if (!doc || !work || index < 0 || index >= work.components.length) {
                return;
            }

            var cmp = work.components[index];
            var liveNode = findComponentNode(work, index, doc);
            var sourceNode = findComponentNode(work, index, work.doc);
            if (!liveNode || !sourceNode) {
                return;
            }

            setComponentAttributes(liveNode, cmp);
            setComponentAttributes(sourceNode, cmp);

            applyPreviewSelectionState();
            refreshComponentListItem(index);
        } catch (error) {
            // ignore
        }
    }

    function patchPreviewStructure() {
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

            applyPreviewSelectionState();
            win.scrollTo(scrollX, scrollY);
        } catch (error) {
            renderPreviewFromState();
        }
    }

    function renderPreviewFromState() {
        var work = state.selectedWork;
        if (!work || !work.doc) {
            el.workPreview.srcdoc = "";
            return;
        }

        capturePreviewScroll();

        var doc = work.doc.cloneNode(true);
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
            ".cms-preview-component.is-selected{outline-color:rgba(255,140,0,.95);}";
        doc.head.appendChild(bridgeStyle);

        var bridgeScript = doc.createElement("script");
        bridgeScript.textContent =
            "(function(){" +
            "function getCmp(el){return el && el.closest ? el.closest('[data-cms-component-index]') : null;}" +
            "document.addEventListener('mouseover',function(e){var n=getCmp(e.target);var idx=n?n.getAttribute('data-cms-component-index'):'-1';parent.postMessage({type:'cms-preview-hover',index:idx},'*');});" +
            "document.addEventListener('mouseout',function(e){if(!getCmp(e.target)){return;}parent.postMessage({type:'cms-preview-hover',index:'-1'},'*');});" +
            "document.addEventListener('click',function(e){var n=getCmp(e.target);if(!n){return;}e.preventDefault();e.stopPropagation();parent.postMessage({type:'cms-preview-select',index:n.getAttribute('data-cms-component-index')},'*');},true);" +
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
        }, { once: true });

        el.workPreview.srcdoc = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
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
            el.cmsEmptyState.classList.add("is-hidden");
            el.cmsEditorPanel.classList.remove("is-hidden");
            el.cmsPropsPanel.classList.remove("is-hidden");
            setLeftMode("components");
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
            renderWorkList();
            state.dirty = true;
        });

        el.articleCategory.addEventListener("input", function () {
            if (!state.selectedWork) return;
            state.selectedWork.category = el.articleCategory.value;
            state.dirty = true;
        });

        el.articleDesc.addEventListener("input", function () {
            if (!state.selectedWork) return;
            state.selectedWork.description = el.articleDesc.value;
            state.dirty = true;
        });

        el.articleTools.addEventListener("input", function () {
            if (!state.selectedWork) return;
            state.selectedWork.tools = splitToolsList(el.articleTools.value);
            patchPreviewStructure();
            state.dirty = true;
        });

        el.articlePreview.addEventListener("input", function () {
            if (!state.selectedWork) return;
            state.selectedWork.preview = el.articlePreview.value;
            state.dirty = true;
        });

        if (el.articlePreviewPicker) {
            el.articlePreviewPicker.addEventListener("click", function () {
                if (!state.selectedWork) {
                    return;
                }

                openImagePicker(function (serverPath) {
                    state.selectedWork.preview = serverPath;
                    el.articlePreview.value = serverPath;
                    renderWorkList();
                    state.dirty = true;
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
            renderWorkList();
            state.dirty = true;
        });
    }

    function bindComponentActions() {
        document.querySelectorAll("[data-add]").forEach(function (button) {
            button.addEventListener("click", function () {
                if (!state.selectedWork) {
                    return;
                }

                var type = button.getAttribute("data-add");
                var cmp = { type: type };
                if (type === "heading") { cmp.text = "Nieuwe titel"; cmp.level = 3; }
                if (type === "paragraph") cmp.text = "Nieuwe paragraaf";
                if (type === "image") { cmp.src = "images/placeholder.jpg"; cmp.alt = ""; }
                if (type === "iframe") cmp.src = "https://player.vimeo.com/video/000000000";
                if (type === "video") { cmp.src = ""; cmp.controls = true; }
                if (type === "palette") cmp.colors = ["#111111", "#f5f5f5", "#d97706"]; 
                if (type === "list") cmp.items = ["Nieuw item"];

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
            if (!work || idx <= 0) return;
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
            if (!work || idx < 0 || idx >= work.components.length - 1) return;
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
            if (!work || idx < 0) return;
            work.components.splice(idx, 1);
            state.selectedComponentIndex = Math.min(idx, work.components.length - 1);
            state.dirty = true;
            renderComponentList();
            renderComponentProps();
            patchPreviewStructure();
        });
    }

    function syncIndexDoc() {
        state.works.forEach(function (work) {
            var escapedHref = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(work.href) : work.href.replace(/"/g, '\\"');
            var anchor = state.indexDoc.querySelector('#assignment_list a[href="' + escapedHref + '"]');
            if (!anchor) {
                return;
            }

            var li = anchor.querySelector("li");
            if (!li) {
                return;
            }

            li.setAttribute("data-preview", work.preview || "");

            var cat = li.querySelector(".assignment-category");
            if (cat) cat.textContent = work.category || "";

            var title = li.querySelector(".assignment-title");
            if (title) {
                title.textContent = (work.favorite ? "★ " : "") + (work.title || "");
            }

            var desc = li.querySelector(".assignment-desc");
            if (desc) desc.textContent = work.description || "";

            li.classList.toggle("favorites", !!work.favorite);
        });
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

    async function saveAll() {
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
            setSaveButtonState("Saving...", true);
            setStatus("Saving files...", "progress");
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
                    setStatus("Lokale files opgeslagen in " + state.apiRoot + " - index.html + " + String(apiResult.savedWorks || 0) + " work files. " + verification.details, "success");
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
                setStatus("Lokale files opgeslagen in de gekoppelde map - index.html + " + String(savedWorks) + " work files.", "success");
            }

            state.dirty = false;
        } catch (error) {
            setStatus("Save failed: " + error.message, "error");
        } finally {
            setSaveButtonState("Save Files", false);
        }
    }

    function addIndexEntry(name, filename) {
        var normalList = state.indexDoc.querySelector(".normal-list");
        if (!normalList) {
            return;
        }

        var anchor = state.indexDoc.createElement("a");
        anchor.setAttribute("href", filename);
        var li = state.indexDoc.createElement("li");
        li.setAttribute("data-preview", "");
        li.innerHTML =
            "<span class='assignment-category'>Nieuwe categorie</span>" +
            "<span class='assignment-title'>" + escapeHtml(name) + "</span>" +
            "<div class='assignment-desc'>Nieuw werk.</div>";
        anchor.appendChild(li);
        normalList.appendChild(anchor);
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
            }
        });
    }

    function bindPreviewControls() {
        el.previewMobileBtn.addEventListener("click", function () {
            state.previewMobile = !state.previewMobile;
            el.previewMobileBtn.classList.toggle("is-active", state.previewMobile);
            el.workPreview.classList.toggle("is-mobile-preview", state.previewMobile);
        });

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
        bindCollapsibles();
        bindBeforeUnload();

        setLeftMode("works");
        el.cmsEmptyState.classList.remove("is-hidden");
        el.cmsEditorPanel.classList.add("is-hidden");
        el.cmsPropsPanel.classList.add("is-hidden");

        if (state.mode === "api") {
            await loadIndexFromApi();
            return;
        }

        await preloadIndexFromSite();
    }

    init();
})();
