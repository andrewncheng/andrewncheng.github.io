/* Shared presentation clock for four discrete sample-size states.
 * Crossfades change opacity only; they do not define intermediate datasets.
 * The caller owns scheduling, pause behavior, and reduced-motion policy.
 */
(function (root) {
    'use strict';

    const levels = Object.freeze([64, 256, 1024, 4096]);
    const duration = 16;
    const smooth = value => value * value * (3 - 2 * value);

    function state(elapsedSeconds, staticMode = false) {
        if (staticMode) return { weights: [0, 0, 0, 1], label: 'n = 4096', opacity: 1 };
        const time = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
        const remainder = time % duration;
        const phase = remainder < 0 ? remainder + duration : remainder;
        const weights = [0, 0, 0, 0];
        let label = 'n = 64';
        if (phase < 0.6) {
            weights[0] = smooth(phase / 0.6);
        } else if (phase < 3.2) {
            weights[0] = 1;
        } else if (phase < 4.4) {
            const mix = smooth((phase - 3.2) / 1.2);
            weights[0] = 1 - mix;
            weights[1] = mix;
            label = 'n = 64 → 256';
        } else if (phase < 7) {
            weights[1] = 1;
            label = 'n = 256';
        } else if (phase < 8.2) {
            const mix = smooth((phase - 7) / 1.2);
            weights[1] = 1 - mix;
            weights[2] = mix;
            label = 'n = 256 → 1024';
        } else if (phase < 10.8) {
            weights[2] = 1;
            label = 'n = 1024';
        } else if (phase < 12) {
            const mix = smooth((phase - 10.8) / 1.2);
            weights[2] = 1 - mix;
            weights[3] = mix;
            label = 'n = 1024 → 4096';
        } else if (phase < 14.6) {
            weights[3] = 1;
            label = 'n = 4096';
        } else if (phase < 15.4) {
            weights[3] = 1 - smooth((phase - 14.6) / 0.8);
            label = 'n = 4096';
        }
        return { weights, label, opacity: weights.reduce((sum, weight) => sum + weight, 0) };
    }

    const growth = Object.freeze({ levels, duration, state });
    if (root) {
        root.ResearchMotion = root.ResearchMotion || {};
        root.ResearchMotion.growth = growth;
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = growth;
}(typeof window !== 'undefined' ? window : null));
