/* Shared presentation clock for four discrete sample-size states.
 * Crossfades change opacity only; they do not define intermediate datasets.
 * The caller owns scheduling, pause behavior, and reduced-motion policy.
 */
(function (root) {
    'use strict';

    const levels = Object.freeze([64, 256, 1024, 4096]);
    const duration = 9.6;
    const smooth = value => value * value * (3 - 2 * value);

    function state(elapsedSeconds, staticMode = false) {
        if (staticMode) return { weights: [0, 0, 0, 1], label: 'n = 4096', opacity: 1, progress: 1 };
        const time = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
        const remainder = time % duration;
        const phase = remainder < 0 ? remainder + duration : remainder;
        const weights = [0, 0, 0, 0];
        let label = 'n = 64';
        if (phase < 0.35) {
            weights[0] = 1;
        } else if (phase < 2.55) {
            const mix = smooth((phase - 0.35) / 2.2);
            weights[0] = 1 - mix;
            weights[1] = mix;
            label = 'n = 64 → 256';
        } else if (phase < 2.9) {
            weights[1] = 1;
            label = 'n = 256';
        } else if (phase < 5.1) {
            const mix = smooth((phase - 2.9) / 2.2);
            weights[1] = 1 - mix;
            weights[2] = mix;
            label = 'n = 256 → 1024';
        } else if (phase < 5.45) {
            weights[2] = 1;
            label = 'n = 1024';
        } else if (phase < 7.65) {
            const mix = smooth((phase - 5.45) / 2.2);
            weights[2] = 1 - mix;
            weights[3] = mix;
            label = 'n = 1024 → 4096';
        } else if (phase < 8.5) {
            weights[3] = 1;
            label = 'n = 4096';
        } else if (phase < 9) {
            weights[3] = 1 - smooth((phase - 8.5) / 0.5);
            label = 'n = 4096';
        } else if (phase < 9.5) {
            weights[0] = smooth((phase - 9) / 0.5);
        } else {
            weights[0] = 1;
        }
        const opacity = weights.reduce((sum, weight) => sum + weight, 0);
        // The marker shows progress between the four checkpoints, not a
        // claim about an uncomputed intermediate sample size.
        const progress = opacity ? weights.reduce((sum, weight, index) => sum + weight * index, 0) / (3 * opacity) : 0;
        return { weights, label, opacity, progress };
    }

    const growth = Object.freeze({ levels, duration, state });
    if (root) {
        root.ResearchMotion = root.ResearchMotion || {};
        root.ResearchMotion.growth = growth;
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = growth;
}(typeof window !== 'undefined' ? window : null));
