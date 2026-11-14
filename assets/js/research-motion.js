/* Shared lifecycle for the research-topic illustrations. */
(() => {
    "use strict";

    const group = document.querySelector("[data-research-motion]");
    if (!group) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const toggle = group.querySelector("[data-motion-toggle]");
    const label = toggle && toggle.querySelector("[data-motion-label]");
    const growthStatus = group.querySelector("[data-growth-status]");
    const growthNames = new Set(["spectrum", "volterra"]);
    const growthViews = [];
    const scenes = [];
    let paused = false;
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
            renderer.render(0, motionPreference.matches);
            fallback.hidden = true;
            scenes.push({ canvas, fallback, renderer });
        } catch (_) {
            canvas.hidden = true;
            fallback.hidden = false;
        }
    });

    if (!scenes.length) return;

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
            const state = paired && growth ? growth.state(elapsed, motionPreference.matches) :
                { label: "n = 4096", opacity: 1 };
            growthStatus.textContent = state.label;
            growthStatus.parentElement.style.opacity = String(state.opacity);
        }
    }

    function paint() {
        for (let index = scenes.length - 1; index >= 0; index -= 1) {
            const scene = scenes[index];
            try {
                scene.renderer.render(elapsed, motionPreference.matches);
            } catch (_) {
                scene.canvas.hidden = true;
                scene.fallback.hidden = false;
                scenes.splice(index, 1);
            }
        }
        updateGrowthStatus();
        if (toggle) toggle.hidden = !scenes.length || motionPreference.matches;
    }

    function active() {
        return scenes.length > 0 && visible && !document.hidden && !paused && !motionPreference.matches;
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
        toggle.hidden = motionPreference.matches;
        toggle.addEventListener("click", () => {
            paused = !paused;
            toggle.dataset.paused = String(paused);
            label.textContent = paused ? "Play motion" : "Pause motion";
            toggle.setAttribute("aria-label", paused ? "Play research animations" : "Pause research animations");
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
    motionPreference.addEventListener("change", sync);
    sync();
})();
