/* Analytic Marchenko–Pastur density, not empirical eigenvalue data.
 * Limiting eigenvalue law of XX^T/n for X in R^(p×n) with i.i.d.,
 * mean-zero, unit-variance entries and aspect ratio gamma = p/n in (0,1):
 * rho(lambda) = sqrt((b-lambda)(lambda-a))/(2*pi*gamma*lambda),
 * a = (1-sqrt(gamma))^2, b = (1+sqrt(gamma))^2, zero outside [a,b].
 * Reference: Lacotte & Pilanci, ICML 2020, equation (4), with rho = gamma:
 * https://proceedings.mlr.press/v119/lacotte20a/lacotte20a.pdf
 * The animation changes gamma only, on fixed linear axes. Since gamma < 1,
 * the continuous density has total mass one; no atom at zero is omitted.
 * The small rust tick marks the constant mean lambda = 1.
 * This renderer owns no animation loop, observer, or event listener.
 */
(function (root) {
    'use strict';

    const WIDTH = 170;
    const HEIGHT = 130;
    const DURATION = 12;
    const GAMMA_MIN = 0.15;
    const GAMMA_MAX = 0.8;
    const STATIC_GAMMA = 0.45;
    const CENTER = (GAMMA_MIN + GAMMA_MAX) / 2;
    const AMPLITUDE = (GAMMA_MAX - GAMMA_MIN) / 2;
    const PHASE = Math.asin((STATIC_GAMMA - CENTER) / AMPLITUDE);
    const SAMPLES = 320;
    const PLOT = Object.freeze({ left: 12, right: 158, top: 20, bottom: 110, xMax: 4, yMax: 2 });
    const COLORS = Object.freeze({ curve: '#536c60', fill: '#d4ded2', axis: '#b8c3b9', accent: '#984c36' });

    function support(gamma) {
        if (!Number.isFinite(gamma) || gamma <= 0 || gamma >= 1) {
            throw new RangeError('The illustrated Marchenko–Pastur family requires 0 < gamma < 1.');
        }
        const radius = Math.sqrt(gamma);
        return [(1 - radius) ** 2, (1 + radius) ** 2];
    }

    function density(lambda, gamma) {
        const [a, b] = support(gamma);
        if (!Number.isFinite(lambda) || lambda <= a || lambda >= b) return 0;
        return Math.sqrt((b - lambda) * (lambda - a)) / (2 * Math.PI * gamma * lambda);
    }

    function gammaAt(elapsedSeconds, staticMode = false) {
        if (staticMode) return STATIC_GAMMA;
        const elapsed = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
        const time = ((elapsed % DURATION) + DURATION) % DURATION;
        return CENTER + AMPLITUDE * Math.sin(2 * Math.PI * time / DURATION + PHASE);
    }

    const projectX = lambda => PLOT.left + lambda / PLOT.xMax * (PLOT.right - PLOT.left);
    const projectY = value => PLOT.bottom - value / PLOT.yMax * (PLOT.bottom - PLOT.top);

    function scene(elapsedSeconds = 0, staticMode = false) {
        const gamma = gammaAt(elapsedSeconds, staticMode);
        const [a, b] = support(gamma);
        const curve = [];
        // Cosine spacing resolves the steep lower edge without smoothing the
        // density or overshooting its support. Every vertex evaluates the formula.
        for (let index = 0; index <= SAMPLES; index += 1) {
            const lambda = index === 0 ? a : index === SAMPLES ? b :
                a + (b - a) * (1 - Math.cos(Math.PI * index / SAMPLES)) / 2;
            curve.push([projectX(lambda), projectY(density(lambda, gamma))]);
        }
        const commands = [
            { points: curve, closed: true, fill: COLORS.fill, opacity: 0.6 },
            { points: [[PLOT.left, PLOT.bottom], [PLOT.right, PLOT.bottom]], stroke: COLORS.axis, width: 0.7 },
            ...[0, 2, 3, 4].map(lambda => ({
                points: [[projectX(lambda), PLOT.bottom], [projectX(lambda), PLOT.bottom + 2.5]],
                stroke: COLORS.axis, width: 0.65
            })),
            { points: curve, stroke: COLORS.curve, width: 1.2 },
            { points: [[projectX(1), PLOT.bottom - 2], [projectX(1), PLOT.bottom + 2.5]],
                stroke: COLORS.accent, width: 1.05 }
        ];
        return { gamma, support: [a, b], curve, commands };
    }

    function paint(context, geometry) {
        context.lineCap = 'round';
        context.lineJoin = 'round';
        for (const command of geometry.commands) {
            context.beginPath();
            command.points.forEach(([x, y], index) => {
                if (index === 0) context.moveTo(x, y);
                else context.lineTo(x, y);
            });
            if (command.closed) context.closePath();
            context.globalAlpha = command.opacity === undefined ? 1 : command.opacity;
            if (command.fill) {
                context.fillStyle = command.fill;
                context.fill();
            }
            if (command.stroke) {
                context.strokeStyle = command.stroke;
                context.lineWidth = command.width;
                context.stroke();
            }
        }
        context.globalAlpha = 1;
    }

    function create(canvas) {
        const context = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
        if (!context) throw new Error('A 2D canvas is required for the spectrum illustration.');
        return {
            render(elapsedSeconds, staticMode) {
                const width = canvas.clientWidth > 0 ? canvas.clientWidth : WIDTH;
                const height = canvas.clientHeight > 0 ? canvas.clientHeight : HEIGHT;
                const requestedDpr = Number(root && root.devicePixelRatio);
                const dpr = Number.isFinite(requestedDpr) ? Math.min(2, Math.max(1, requestedDpr)) : 1;
                const pixelWidth = Math.max(1, Math.round(width * dpr));
                const pixelHeight = Math.max(1, Math.round(height * dpr));
                if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
                if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
                context.setTransform(dpr, 0, 0, dpr, 0, 0);
                context.clearRect(0, 0, width, height);
                context.save();
                const scale = Math.min(width / WIDTH, height / HEIGHT);
                context.translate((width - WIDTH * scale) / 2, (height - HEIGHT * scale) / 2);
                context.scale(scale, scale);
                paint(context, scene(elapsedSeconds, Boolean(staticMode)));
                context.restore();
            }
        };
    }

    function toSVG(width = WIDTH, height = HEIGHT, elapsedSeconds = 0, staticMode = true) {
        const geometry = scene(elapsedSeconds, staticMode);
        const number = value => Number(value.toFixed(5));
        const paths = geometry.commands.map(command => {
            const d = command.points.map(([x, y], index) => `${index ? 'L' : 'M'}${number(x)} ${number(y)}`).join(' ') +
                (command.closed ? ' Z' : '');
            return `<path d="${d}" fill="${command.fill || 'none'}" opacity="${command.opacity === undefined ? 1 : command.opacity}"` +
                (command.stroke ? ` stroke="${command.stroke}" stroke-width="${command.width}" stroke-linecap="round" stroke-linejoin="round"` : '') + '/>';
        });
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="spectrum-title spectrum-description">` +
            '<title id="spectrum-title">Marchenko–Pastur density</title>' +
            `<desc id="spectrum-description">Analytic covariance eigenvalue density at aspect ratio gamma=${geometry.gamma.toFixed(2)}. ` +
            'Fixed linear axes: eigenvalue 0 to 4, density 0 to 2. The rust tick marks the mean eigenvalue 1. No empirical samples.</desc>' +
            paths.join('') + '</svg>\n';
    }

    if (root) {
        root.ResearchMotion = root.ResearchMotion || {};
        root.ResearchMotion.spectrum = { create };
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { create, density, support, gammaAt, scene, toSVG,
            width: WIDTH, height: HEIGHT, duration: DURATION, gammaMin: GAMMA_MIN,
            gammaMax: GAMMA_MAX, staticGamma: STATIC_GAMMA, plot: PLOT };
    }
}(typeof window !== 'undefined' ? window : null));
