/* Explore original paper figures without interpolating or replacing their data. */
(() => {
    "use strict";

    const research = document.getElementById("research");
    if (!research) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const svgCache = new Map();
    const explorers = new Map();
    const dialog = document.getElementById("research-figure-dialog");
    const dialogImage = dialog && dialog.querySelector("[data-dialog-image]");
    const dialogViewport = dialog && dialog.querySelector("[data-dialog-viewport]");
    let expanded = null;

    function announce(state, message) {
        state.figure.querySelector("[data-figure-announcement]").textContent = message;
    }

    function cancelPanelSelection(state) {
        state.selectionToken += 1;
        if (state.pendingPanel) state.pendingPanel.removeAttribute("aria-busy");
        state.pendingPanel = null;
        state.figure.setAttribute("aria-busy", "false");
    }

    function stopPlayback(state) {
        window.clearTimeout(state.timer);
        state.timer = null;
        state.playbackToken += 1;
        state.playbackState = "idle";
        cancelPanelSelection(state);
        const button = state.figure.querySelector("[data-play-settings]");
        if (button) {
            button.textContent = reducedMotion.matches ? "Next setting" : "Play settings";
            button.setAttribute("aria-pressed", "false");
            button.removeAttribute("aria-busy");
            button.removeAttribute("aria-label");
        }
    }

    function waitForImage(image) {
        return new Promise((resolve, reject) => {
            let decoding = false;
            const finish = error => {
                window.clearTimeout(timeout);
                image.removeEventListener("load", loaded);
                image.removeEventListener("error", failed);
                if (error) reject(error);
                else resolve(image);
            };
            const failed = () => finish(new Error("Figure could not be loaded"));
            const loaded = () => {
                if (decoding) return;
                decoding = true;
                if (typeof image.decode === "function") image.decode().then(() => finish(), failed);
                else finish();
            };
            const timeout = window.setTimeout(() => finish(new Error("Figure loading timed out")), 20000);
            image.addEventListener("load", loaded);
            image.addEventListener("error", failed);
            if (image.complete) {
                if (image.naturalWidth) loaded();
                else failed();
            }
        });
    }

    function preloadPanel(source) {
        const image = new Image();
        image.decoding = "async";
        image.src = source;
        return waitForImage(image);
    }

    function applySeriesFocus(state) {
        if (!state.svg) return;
        state.svg.querySelectorAll("[data-series]").forEach(node => {
            const series = node.getAttribute("data-series");
            if (!state.focusKeys.has(series)) return;
            if (!state.originalOpacity.has(node)) {
                state.originalOpacity.set(node, node.style.opacity);
            }
            node.style.opacity = state.focus === "all" || state.focus === series
                ? state.originalOpacity.get(node)
                : "0.12";
        });
    }

    async function enhanceSvg(state, source, token) {
        if (!state.figure.hasAttribute("data-inline-svg")) return;
        const url = new URL(source, document.baseURI);
        if (url.origin !== window.location.origin) return;
        try {
            if (!svgCache.has(url.href)) {
                svgCache.set(url.href, fetch(url.href).then(response => {
                    if (!response.ok) throw new Error("Figure could not be loaded");
                    return response.text();
                }).catch(error => {
                    svgCache.delete(url.href);
                    throw error;
                }));
            }
            const documentSvg = new DOMParser().parseFromString(await svgCache.get(url.href), "image/svg+xml");
            if (token !== state.loadToken || documentSvg.querySelector("parsererror")) return;
            const svg = documentSvg.documentElement;
            if (svg.localName !== "svg" || !svg.querySelector("[data-series]")) return;

            // Assets are authored locally; retain only passive SVG content.
            svg.querySelectorAll("script, foreignObject, iframe, object, embed, audio, video").forEach(node => node.remove());
            [svg, ...svg.querySelectorAll("*")].forEach(node => {
                [...node.attributes].forEach(attribute => {
                    const name = attribute.name.toLowerCase();
                    if (name.startsWith("on") || ((name === "href" || name === "xlink:href") && !attribute.value.startsWith("#"))) {
                        node.removeAttribute(attribute.name);
                    }
                });
            });
            svg.classList.add("figure-inline-svg");
            svg.setAttribute("role", "img");
            svg.setAttribute("aria-label", state.image.alt);
            svg.setAttribute("focusable", "false");
            state.graphic.appendChild(svg);
            state.svg = svg;
            state.image.hidden = true;
            state.figure.querySelector("[data-series-controls]").hidden = false;
            applySeriesFocus(state);
        } catch (_) {
            // The original image remains readable when SVG enhancement is unavailable.
        }
    }

    function commitPanel(state, button) {
        state.panels.forEach(panel => panel.setAttribute("aria-pressed", String(panel === button)));
        state.panelIndex = state.panels.indexOf(button);
        state.currentSource = button.dataset.panelSrc;
        state.image.src = state.currentSource;
        state.image.alt = button.dataset.panelAlt;
        state.image.width = Number(button.dataset.panelWidth);
        state.image.height = Number(button.dataset.panelHeight);
        state.figure.querySelector("[data-figure-caption]").textContent = button.dataset.panelCaption;
        state.expand.href = state.currentSource;
        if (state.svg) state.svg.remove();
        state.svg = null;
        state.image.hidden = false;
        const seriesControls = state.figure.querySelector("[data-series-controls]");
        if (seriesControls) seriesControls.hidden = true;
        state.loadToken += 1;
        enhanceSvg(state, state.currentSource, state.loadToken);
    }

    async function selectPanel(state, button, options = {}) {
        cancelPanelSelection(state);
        const token = state.selectionToken;
        const isCurrent = options.isCurrent || (() => true);
        if (!isCurrent()) return false;
        if (button.dataset.panelSrc === state.currentSource && (state.svg || (state.image.complete && state.image.naturalWidth))) return true;
        state.pendingPanel = button;
        state.figure.setAttribute("aria-busy", "true");
        button.setAttribute("aria-busy", "true");
        try {
            const decoded = options.decodedImage || await preloadPanel(button.dataset.panelSrc);
            if (token !== state.selectionToken || !isCurrent()) return false;
            state.decodedPanel = decoded;
            commitPanel(state, button);
            announce(state, `Showing ${button.textContent.trim()}.`);
            return true;
        } catch (_) {
            if (token === state.selectionToken && isCurrent()) {
                announce(state, `Could not load ${button.textContent.trim()}. The current figure is unchanged; try again when the connection is available.`);
            }
            return false;
        } finally {
            if (token === state.selectionToken) {
                state.pendingPanel = null;
                button.removeAttribute("aria-busy");
                state.figure.setAttribute("aria-busy", "false");
            }
        }
    }

    async function playSettings(state) {
        if (state.playbackState !== "idle") {
            stopPlayback(state);
            return;
        }
        const panels = state.playPanels;
        if (!panels.length) return;
        cancelPanelSelection(state);
        if (reducedMotion.matches) {
            const current = panels.indexOf(state.panels[state.panelIndex]);
            await selectPanel(state, panels[(current + 1) % panels.length]);
            return;
        }
        const button = state.figure.querySelector("[data-play-settings]");
        const token = ++state.playbackToken;
        state.playbackState = "loading";
        button.textContent = "Loading…";
        button.setAttribute("aria-pressed", "true");
        button.setAttribute("aria-busy", "true");
        button.setAttribute("aria-label", "Cancel loading figure panels");
        const active = () => token === state.playbackToken && !document.hidden && !reducedMotion.matches;
        try {
            const loadedPanels = state.loadedPanels || await Promise.all(panels.map(panel => preloadPanel(panel.dataset.panelSrc)));
            if (!active()) return;
            state.loadedPanels = loadedPanels;
            state.playbackState = "playing";
            button.textContent = "Pause";
            button.removeAttribute("aria-busy");
            button.removeAttribute("aria-label");
            const showPanel = async index => {
                if (!active()) return;
                const selected = await selectPanel(state, panels[index], { decodedImage: loadedPanels[index], isCurrent: active });
                if (!active()) return;
                if (!selected) {
                    stopPlayback(state);
                    return;
                }
                try {
                    await waitForImage(state.image);
                    if (!active()) return;
                    state.timer = window.setTimeout(() => {
                        if (!active()) return;
                        if (index + 1 < panels.length) showPanel(index + 1);
                        else stopPlayback(state);
                    }, 2400);
                } catch (_) {
                    if (!active()) return;
                    stopPlayback(state);
                    announce(state, "Playback stopped because a panel could not be loaded. You can select a setting or try again.");
                }
            };
            await showPanel(0);
        } catch (_) {
            if (token === state.playbackToken) {
                stopPlayback(state);
                announce(state, "The panels could not all be loaded. You can select a setting or try playback again.");
            }
        }
    }

    function sizeDialogImage() {
        if (!expanded || !dialog.open || !dialogImage.naturalWidth) return;
        const width = dialogImage.naturalWidth;
        const height = dialogImage.naturalHeight;
        const fit = Math.max(0.01, Math.min((dialogViewport.clientWidth - 48) / width, (dialogViewport.clientHeight - 48) / height));
        const scale = fit * (expanded.zoom === "fit" ? 1 : Number(expanded.zoom));
        dialogImage.style.width = `${width * scale}px`;
        dialogImage.style.height = `${height * scale}px`;
    }

    function showDialogView(view) {
        if (!expanded) return;
        expanded.view = view;
        dialog.querySelectorAll("[data-dialog-view]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.dialogView === view)));
        const full = view === "full";
        dialog.querySelector("[data-dialog-caption]").textContent = full
            ? expanded.state.figure.dataset.fullCaption
            : expanded.state.figure.querySelector("[data-figure-caption]").textContent;
        dialogImage.alt = full ? expanded.state.figure.dataset.fullAlt : expanded.state.image.alt;
        dialogImage.src = full ? expanded.state.figure.dataset.fullSrc : expanded.state.currentSource;
        dialogViewport.scrollTo(0, 0);
        if (dialogImage.complete) sizeDialogImage();
    }

    function openFigure(state, trigger) {
        explorers.forEach(stopPlayback);
        const initialView = state.figure.dataset.initialView === "full" ? "full" : "selected";
        expanded = { state, trigger, view: initialView, zoom: "fit" };
        dialog.querySelector("[data-dialog-title]").textContent = state.figure.dataset.figureTitle;
        dialog.querySelector("[data-dialog-caption]").textContent = state.figure.querySelector("[data-figure-caption]").textContent;
        const source = dialog.querySelector("[data-dialog-source]");
        source.href = state.figure.dataset.source;
        dialog.querySelector("[data-dialog-views]").hidden = state.currentSource === state.figure.dataset.fullSrc;
        dialog.querySelectorAll("[data-dialog-zoom]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.dialogZoom === "fit")));
        dialog.showModal();
        showDialogView(initialView);
    }

    research.querySelectorAll("[data-figure-explorer]").forEach(figure => {
        const state = {
            figure,
            image: figure.querySelector("[data-figure-image]"),
            graphic: figure.querySelector("[data-figure-graphic]"),
            expand: figure.querySelector("[data-expand-figure]"),
            panels: [...figure.querySelectorAll("[data-panel-src]")],
            playPanels: [...figure.querySelectorAll("[data-panel-src][data-play-panel]")],
            focusKeys: new Set([...figure.querySelectorAll("[data-focus-series]")].map(button => button.dataset.focusSeries).filter(key => key !== "all")),
            originalOpacity: new WeakMap(),
            focus: "all",
            svg: null,
            loadToken: 0,
            selectionToken: 0,
            pendingPanel: null,
            decodedPanel: null,
            panelIndex: 0,
            timer: null,
            playbackToken: 0,
            playbackState: "idle",
            loadedPanels: null
        };
        state.currentSource = state.image.getAttribute("src");
        state.panelIndex = state.panels.findIndex(panel => panel.dataset.panelSrc === state.currentSource);
        state.panels.forEach((panel, index) => panel.setAttribute("aria-pressed", String(index === state.panelIndex)));
        explorers.set(figure, state);
        figure.querySelectorAll("[data-enhancement]").forEach(control => { control.hidden = false; });
        enhanceSvg(state, state.currentSource, state.loadToken);
        stopPlayback(state);
    });

    research.addEventListener("click", event => {
        const control = event.target.closest("button, [data-expand-figure]");
        if (!control) return;
        const state = explorers.get(control.closest("[data-figure-explorer]"));
        if (!state) return;
        if (control.hasAttribute("data-expand-figure") && dialog && typeof dialog.showModal === "function"
            && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            openFigure(state, control);
        } else if (control.hasAttribute("data-panel-src")) {
            stopPlayback(state);
            selectPanel(state, control);
        } else if (control.hasAttribute("data-focus-series") && state.svg) {
            state.focus = control.dataset.focusSeries;
            state.figure.querySelectorAll("[data-focus-series]").forEach(button => button.setAttribute("aria-pressed", String(button === control)));
            applySeriesFocus(state);
            announce(state, state.focus === "all" ? "Showing all original series." : `Highlighting ${control.dataset.focusLabel || control.textContent.trim()}; other series are dimmed.`);
        } else if (control.hasAttribute("data-play-settings")) {
            playSettings(state);
        }
    });

    if (dialog) {
        dialogImage.addEventListener("load", sizeDialogImage);
        dialog.addEventListener("click", event => {
            const control = event.target.closest("button");
            if (!control || !expanded) return;
            if (control.hasAttribute("data-dialog-close")) dialog.close();
            if (control.hasAttribute("data-dialog-view")) showDialogView(control.dataset.dialogView);
            if (control.hasAttribute("data-dialog-zoom")) {
                expanded.zoom = control.dataset.dialogZoom;
                dialog.querySelectorAll("[data-dialog-zoom]").forEach(button => button.setAttribute("aria-pressed", String(button === control)));
                sizeDialogImage();
                dialogViewport.scrollTo(0, 0);
            }
        });
        dialog.addEventListener("close", () => {
            const trigger = expanded && expanded.trigger;
            expanded = null;
            if (trigger && trigger.isConnected) trigger.focus();
        });
        window.addEventListener("resize", sizeDialogImage);
    }

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) explorers.forEach(stopPlayback);
    });
    reducedMotion.addEventListener("change", () => explorers.forEach(stopPlayback));
})();
