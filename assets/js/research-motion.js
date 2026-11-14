/* Shared lifecycle for the research-topic illustrations. */
(() => {
    "use strict";

    const group = document.querySelector("[data-research-motion]");
    if (!group) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const toggle = group.querySelector("[data-motion-toggle]");
    const label = toggle && toggle.querySelector("[data-motion-label]");
    const growthStatus = group.querySelector("[data-growth-status]");
    const growthTrack = group.querySelector("[data-growth-track]");
    const growthMarker = group.querySelector("[data-growth-marker]");
    const growthNames = new Set(["spectrum", "volterra"]);
    const growthViews = [];
    const scenes = [];
    let paused = false;
    let motionOptIn = false;
    let visible = !("IntersectionObserver" in window);
    let elapsed = 0;
    let request = null;
    let previousTime = null;
    let lastPaint = null;

    group.querySelectorAll("canvas[data-motion-scene]").forEach(canvas => {
        const factory = window.ResearchMotion && window.ResearchMotion[canvas.dataset.motionScene];
        const fallback = canvas.parentElement.querySelector("[data-motion-fallback]");
        if (fallback && growthNames.has(canvas.dataset.motionScene)) growthViews.push({ canvas, fallback });
        if (!factory || !fallback) return;
        try {
            if (typeof canvas.getContext !== "function" || !canvas.getContext("2d")) return;
            const renderer = factory.create(canvas);
            canvas.hidden = false;
            renderer.render(0, staticMode());
            fallback.hidden = true;
            scenes.push({ canvas, fallback, renderer });
        } catch (_) {
            canvas.hidden = true;
            fallback.hidden = false;
        }
    });

    if (!scenes.length) return;

    function staticMode() {
        return motionPreference.matches && !motionOptIn;
    }

    function updateControl() {
        if (!toggle) return;
        const stopped = paused || staticMode();
        toggle.hidden = !scenes.length;
        toggle.dataset.paused = String(stopped);
        if (label) label.textContent = stopped ? "Play motion" : "Pause motion";
        toggle.setAttribute("aria-label", stopped ? "Play research animations" : "Pause research animations");
    }

    function updateGrowthStatus() {
        const paired = growthViews.length === 2 && growthViews.every(view =>
            scenes.some(scene => scene.canvas === view.canvas));
        // Both plots share one sample-size readout. If either renderer fails,
        // restore both largest-size stills so their displayed states agree.
        if (!paired) {
            growthViews.forEach(view => {
                view.canvas.hidden = true;
                view.fallback.hidden = false;
                const index = scenes.findIndex(scene => scene.canvas === view.canvas);
                if (index !== -1) scenes.splice(index, 1);
            });
        }
        if (growthStatus) {
            const growth = window.ResearchMotion && window.ResearchMotion.growth;
            const state = paired && growth ? growth.state(elapsed, staticMode()) :
                { label: "n = 4096", opacity: 1, progress: 1 };
            if (growthStatus.textContent !== state.label) growthStatus.textContent = state.label;
            growthStatus.parentElement.style.opacity = String(state.opacity);
            if (growthTrack) {
                growthTrack.hidden = !paired;
                growthTrack.style.opacity = String(state.opacity);
            }
            if (growthMarker) growthMarker.style.left = `${state.progress * 100}%`;
        }
    }

    function paint() {
        for (let index = scenes.length - 1; index >= 0; index -= 1) {
            const scene = scenes[index];
            try {
                scene.renderer.render(elapsed, staticMode());
            } catch (_) {
                scene.canvas.hidden = true;
                scene.fallback.hidden = false;
                scenes.splice(index, 1);
            }
        }
        updateGrowthStatus();
        updateControl();
    }

    function active() {
        return scenes.length > 0 && visible && !document.hidden && !paused && !staticMode();
    }

    function stop() {
        if (request !== null) window.cancelAnimationFrame(request);
        request = null;
        previousTime = null;
        lastPaint = null;
    }

    function frame(timestamp) {
        request = null;
        if (!active()) return;
        if (previousTime !== null) elapsed += Math.min(timestamp - previousTime, 100) / 1000;
        previousTime = timestamp;
        // The illustrations need only 30 paints/second, even on faster displays.
        if (lastPaint === null || timestamp - lastPaint >= 1000 / 30) {
            paint();
            lastPaint = timestamp;
        }
        if (active()) request = window.requestAnimationFrame(frame);
    }

    function sync() {
        stop();
        if (!document.hidden) paint();
        if (active()) request = window.requestAnimationFrame(frame);
    }

    if (toggle && label) {
        toggle.addEventListener("click", () => {
            if (staticMode()) {
                // Respect the system preference initially, while allowing
                // the visitor to explicitly start this illustration.
                motionOptIn = true;
                paused = false;
                elapsed = 0;
            } else {
                paused = !paused;
            }
            sync();
        });
    }

    if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver(entries => {
            visible = entries.some(entry => entry.isIntersecting);
            if (visible) sync();
            else stop();
        }, { threshold: 0.01 });
        observer.observe(group);
    }

    if ("ResizeObserver" in window) {
        new ResizeObserver(() => {
            if (!document.hidden) paint();
        }).observe(group);
    } else {
        window.addEventListener("resize", paint);
    }

    document.addEventListener("visibilitychange", sync);
    motionPreference.addEventListener("change", () => {
        motionOptIn = false;
        sync();
    });
    sync();
})();
