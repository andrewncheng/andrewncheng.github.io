/* Shared lifecycle for the research-topic illustrations. */
(() => {
    "use strict";

    const group = document.querySelector("[data-research-motion]");
    if (!group) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const toggle = group.querySelector("[data-motion-toggle]");
    const label = toggle && toggle.querySelector("[data-motion-label]");
    const growthStatus = group.querySelector("[data-growth-status]");
    const growthControls = group.querySelector("[data-growth-controls]");
    const growthSlider = group.querySelector("[data-growth-slider]");
    const growthResume = group.querySelector("[data-growth-resume]");
    const growth = window.ResearchMotion && window.ResearchMotion.growth;
    const growthNames = new Set(["spectrum", "volterra"]);
    const growthViews = [];
    const scenes = [];
    let paused = false;
    let motionOptIn = false;
    let visible = !("IntersectionObserver" in window);
    let elapsed = 0;
    let growthElapsed = 0;
    let growthManual = false;
    let growthOptIn = false;
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

    function growthStaticMode() {
        return !growthManual && staticMode() && !growthOptIn;
    }

    function isGrowth(scene) {
        return growthNames.has(scene.canvas.dataset.motionScene);
    }

    function updateControl() {
        if (!toggle) return;
        const stopped = paused || !canAnimate();
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
            const state = paired && growth ? growth.state(growthElapsed, growthStaticMode()) :
                { label: "n = 4096", opacity: 1, progress: 1 };
            if (growthStatus.textContent !== state.label) growthStatus.textContent = state.label;
            growthStatus.parentElement.style.opacity = String(state.opacity);
            if (growthControls) growthControls.hidden = !paired;
            if (growthSlider) {
                growthSlider.disabled = !paired;
                growthSlider.value = String(state.progress * 3);
                growthSlider.setAttribute("aria-valuetext", state.label.includes("→") ?
                    "Transition: " + state.label.replace("→", "to") : state.label);
            }
            if (growthResume) {
                growthResume.hidden = !paired || (!growthManual && !growthStaticMode());
                growthResume.disabled = paused;
            }
        }
    }

    function paint(onlyGrowth = false) {
        for (let index = scenes.length - 1; index >= 0; index -= 1) {
            const scene = scenes[index];
            const highdim = isGrowth(scene);
            if (onlyGrowth && !highdim) continue;
            try {
                scene.renderer.render(highdim ? growthElapsed : elapsed,
                    highdim ? growthStaticMode() : staticMode());
            } catch (_) {
                scene.canvas.hidden = true;
                scene.fallback.hidden = false;
                scenes.splice(index, 1);
            }
        }
        updateGrowthStatus();
        updateControl();
    }

    function canAnimate() {
        return scenes.some(scene =>
            isGrowth(scene) ? !growthManual && !growthStaticMode() : !staticMode());
    }

    function active() {
        return visible && !document.hidden && !paused && canAnimate();
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
        if (previousTime !== null) {
            const delta = Math.min(timestamp - previousTime, 100) / 1000;
            if (!staticMode()) elapsed += delta;
            if (!growthManual && !growthStaticMode()) growthElapsed += delta;
        }
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
            if (!paused && canAnimate()) {
                paused = true;
            } else if (!canAnimate() && staticMode()) {
                // Respect the system preference initially, while allowing
                // the visitor to explicitly start this illustration.
                motionOptIn = true;
                paused = false;
                elapsed = 0;
                if (!growthManual) growthElapsed = 0;
            } else {
                paused = false;
            }
            sync();
        });
    }

    if (growthSlider && growth && typeof growth.timeAtProgress === "function") {
        const seek = () => {
            if (growthSlider.disabled) return;
            const value = Number(growthSlider.value);
            if (!Number.isFinite(value)) return;
            growthManual = true;
            growthElapsed = growth.timeAtProgress(value / 3);
            // Neither the other renderers nor their running clock are touched.
            paint(true);
        };
        growthSlider.addEventListener("pointerdown", seek);
        growthSlider.addEventListener("input", seek);
    }

    if (growthResume) {
        growthResume.addEventListener("click", () => {
            if (growthResume.disabled) return;
            if (growthStaticMode()) growthElapsed = growth.timeAtProgress(1);
            growthManual = false;
            growthOptIn = true;
            paint(true);
            if (request === null && active()) {
                previousTime = null;
                lastPaint = null;
                request = window.requestAnimationFrame(frame);
            }
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
        window.addEventListener("resize", () => paint());
    }

    document.addEventListener("visibilitychange", sync);
    motionPreference.addEventListener("change", () => {
        motionOptIn = false;
        growthOptIn = false;
        growthManual = false;
        sync();
    });
    sync();
})();
