(function () {
    "use strict";

    const knot = document.querySelector("[data-intro-knot]");
    if (!knot) return;

    const canvas = knot.querySelector("[data-trefoil-canvas]");
    const fallback = knot.querySelector("[data-trefoil-fallback]");
    const toggle = knot.querySelector("[data-trefoil-toggle]");
    if (!canvas || !fallback || !toggle || !window.TrefoilGeometry) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let renderer;
    let healthy = true;
    let paused = false;
    let optedIn = false;
    let visible = !("IntersectionObserver" in window);
    let elapsed = 0;
    let frame = null;
    let previous = null;
    let lastPaint = null;

    function still() {
        return preference.matches && !optedIn;
    }

    function stop() {
        if (frame !== null) window.cancelAnimationFrame(frame);
        frame = null;
        previous = null;
        lastPaint = null;
    }

    function recover() {
        healthy = false;
        stop();
        canvas.hidden = true;
        fallback.hidden = false;
        toggle.hidden = true;
    }

    function paint() {
        if (!healthy) return;
        try {
            renderer.render(elapsed, still());
        } catch (_) {
            recover();
        }
    }

    function active() {
        return healthy && visible && !document.hidden && !paused && !still();
    }

    function tick(now) {
        frame = null;
        if (!active()) {
            stop();
            return;
        }
        if (previous !== null) elapsed += Math.min(100, Math.max(0, now - previous)) / 1000;
        previous = now;
        if (lastPaint === null || now - lastPaint >= 1000 / 30) {
            paint();
            lastPaint = now;
        }
        if (active()) frame = window.requestAnimationFrame(tick);
    }

    function sync() {
        const label = paused || still() ? "Play trefoil animation" : "Pause trefoil animation";
        toggle.setAttribute("aria-label", label);
        toggle.title = label;
        if (active()) {
            if (frame === null) frame = window.requestAnimationFrame(tick);
        } else {
            stop();
        }
    }

    // Keep the SVG visible until a complete canvas frame has rendered successfully.
    try {
        canvas.hidden = false;
        renderer = window.TrefoilGeometry.create(canvas);
        paint();
        if (!healthy) return;
        fallback.hidden = true;
        toggle.hidden = false;
    } catch (_) {
        recover();
        return;
    }

    toggle.addEventListener("click", function () {
        if (still()) {
            optedIn = true;
            paused = false;
        } else {
            paused = !paused;
        }
        sync();
    });

    function preferenceChanged() {
        optedIn = false;
        paint();
        sync();
    }
    if (preference.addEventListener) preference.addEventListener("change", preferenceChanged);
    else preference.addListener(preferenceChanged);

    document.addEventListener("visibilitychange", sync);

    if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver(function (entries) {
            visible = entries.some(function (entry) { return entry.isIntersecting; });
            sync();
        });
        observer.observe(knot);
    }

    function resize() {
        if (!document.hidden) paint();
    }
    if ("ResizeObserver" in window) {
        const observer = new ResizeObserver(resize);
        observer.observe(knot);
    } else {
        window.addEventListener("resize", resize);
    }

    sync();
}());
