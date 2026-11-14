/* Analytic Marchenko–Pastur bulk and asymptotic signal-outlier positions.
 * Model: S = T^(1/2)ZZ^T T^(1/2)/n, with p×n i.i.d. standardized Z
 * having finite fourth moment. T has eigenvalues 2.6, 3.5, then ones.
 * For p/n -> gamma in (0,1), the limiting bulk density is
 * rho(lambda) = sqrt((b-lambda)(lambda-a))/(2*pi*gamma*lambda),
 * a = (1-sqrt(gamma))^2, b = (1+sqrt(gamma))^2, zero outside [a,b].
 * Reference: Lacotte & Pilanci, ICML 2020, equation (4), with rho = gamma:
 * https://proceedings.mlr.press/v119/lacotte20a/lacotte20a.pdf
 * The animation changes gamma only, on fixed linear axes. Since gamma < 1,
 * the continuous density has total mass one; no atom at zero is omitted.
 * A fixed population eigenvalue alpha > 1+sqrt(gamma) creates a sample
 * outlier with almost-sure limit alpha*(1+gamma/(alpha-1)). See Baik &
 * Silverstein, Theorem 1.1, equation (1.10), arXiv:math/0408165v1:
 * https://arxiv.org/pdf/math/0408165v1
 * Both chosen population spikes exceed the threshold throughout this loop.
 * Equal-height rust stems mark their limiting SAMPLE positions, not the
 * population values or density heights. Fixed-rank outliers have vanishing
 * empirical mass as p grows and add no area to the limiting MP density.
 * The small rust axis tick marks the bulk mean lambda = 1. No sampled data.
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
    const POPULATION_SPIKES = Object.freeze([2.6, 3.5]);
    const CENTER = (GAMMA_MIN + GAMMA_MAX) / 2;
    const AMPLITUDE = (GAMMA_MAX - GAMMA_MIN) / 2;
    const PHASE = Math.asin((STATIC_GAMMA - CENTER) / AMPLITUDE);
    const SAMPLES = 320;
    const PLOT = Object.freeze({ left: 12, right: 158, top: 20, bottom: 110, xMax: 5, yMax: 2 });
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

    function outlierLocation(populationEigenvalue, gamma) {
        support(gamma);
        if (!Number.isFinite(populationEigenvalue) || populationEigenvalue <= 1 + Math.sqrt(gamma)) {
            throw new RangeError('An upper outlier requires a population spike above 1 + sqrt(gamma).');
        }
        return populationEigenvalue * (1 + gamma / (populationEigenvalue - 1));
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
        const outliers = POPULATION_SPIKES.map(populationEigenvalue => {
            const sampleLimit = outlierLocation(populationEigenvalue, gamma);
            return { populationEigenvalue, sampleLimit, x: projectX(sampleLimit), headY: 78 };
        });
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
            ...[0, 2, 3, 4, 5].map(lambda => ({
                points: [[projectX(lambda), PLOT.bottom], [projectX(lambda), PLOT.bottom + 2.5]],
                stroke: COLORS.axis, width: 0.65
            })),
            { points: curve, stroke: COLORS.curve, width: 1.2 },
            { points: [[projectX(1), PLOT.bottom - 2], [projectX(1), PLOT.bottom + 2.5]],
                stroke: COLORS.accent, width: 1.05 },
            ...outliers.flatMap(({ x, headY }) => [
                { points: [[x, PLOT.bottom], [x, headY]], stroke: COLORS.accent, width: 0.95, opacity: 0.82 },
                // A small round marker: its height and size encode no density.
                { points: Array.from({ length: 24 }, (_, index) => {
                    const angle = 2 * Math.PI * index / 24;
                    return [x + 1.65 * Math.cos(angle), headY + 1.65 * Math.sin(angle)];
                }), closed: true, fill: COLORS.accent, opacity: 0.9 }
            ])
        ];
        return { gamma, support: [a, b], curve, outliers, commands };
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
            '<title id="spectrum-title">Marchenko–Pastur bulk with two signal outliers</title>' +
            `<desc id="spectrum-description">Analytic covariance eigenvalue bulk at aspect ratio gamma=${geometry.gamma.toFixed(2)}. ` +
            'Fixed linear axes: eigenvalue 0 to 5, density 0 to 2. The small rust axis tick marks the bulk mean eigenvalue 1. ' +
            `Equal-height stems mark asymptotic sample outliers at ${geometry.outliers.map(outlier => outlier.sampleLimit.toFixed(2)).join(' and ')}, ` +
            'from fixed population eigenvalues 2.6 and 3.5. The stems encode positions only, adding no density mass. No empirical samples.</desc>' +
            paths.join('') + '</svg>\n';
    }

    if (root) {
        root.ResearchMotion = root.ResearchMotion || {};
        root.ResearchMotion.spectrum = { create, scene, paint, toSVG, width: WIDTH, height: HEIGHT, duration: DURATION };
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { create, density, support, outlierLocation, gammaAt, scene, paint, toSVG,
            width: WIDTH, height: HEIGHT, duration: DURATION, gammaMin: GAMMA_MIN,
            gammaMax: GAMMA_MAX, staticGamma: STATIC_GAMMA, populationSpikes: POPULATION_SPIKES, plot: PLOT };
    }
}(typeof window !== 'undefined' ? window : null));
