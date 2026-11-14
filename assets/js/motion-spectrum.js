/* A separate seeded Gaussian illustration of finite-dimensional concentration.
 * Four genuine spectra: n=64,256,1024,4096; p=n/2; fixed population spikes
 * 2.6 and 3.5. The reproducible generator and all eigenvalues are retained in
 * scripts/generate-spectrum-illustration.py and images/motion/spectrum-*.json.
 * The MP target at gamma=.5 and asymptotic sample-outlier guides stay fixed.
 * Bulk histograms exclude the largest two eigenvalues and use counts/(p*binWidth).
 * Rust stems mark those actual eigenvalues, including ordinary fluctuations;
 * their equal heights encode positions only, not mass or density.
 * Crossfades change opacity only, never eigenvalues, bins, or intermediate n.
 * References: Baik–Silverstein, arXiv:math/0408165v1, Eq1.2 and Theorem1.1.
 * No owned clock, listener, data fetch, or animation loop.
 */
(function (root) {
    'use strict';

    const growth = root && root.ResearchMotion && root.ResearchMotion.growth ||
        (typeof module !== 'undefined' && module.exports ? require('./motion-growth.js') : null);
    const WIDTH = 170;
    const HEIGHT = 130;
    // Generated from the retained data artifact; raw eigenvalues stay in that artifact.
    const DATA = {"gamma":0.5,"populationSpikes":[2.6,3.5],"binWidth":0.125,"xMax":5.0,"yMax":2.0,"dataSHA256":"6eaa8869c12ba7e895d8d790b9dee4e97059b58382a77277164eaf7ef1f3ce30","checkpoints":[{"n":64,"p":32,"counts":[0,4,4,2,3,3,1,0,3,1,2,1,1,1,0,1,0,1,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"topEigenvalues":[2.8377057871302673,3.9117292366855922]},{"n":256,"p":128,"counts":[5,13,13,10,10,8,7,7,6,6,5,5,5,5,3,4,3,3,2,3,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"topEigenvalues":[3.472234324839405,3.6617112842515174]},{"n":1024,"p":512,"counts":[12,57,50,43,38,35,31,28,26,24,21,20,19,17,17,13,13,11,11,8,6,6,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"topEigenvalues":[3.2236242023797343,4.314472778796308]},{"n":4096,"p":2048,"counts":[51,227,200,173,153,138,124,113,103,96,86,80,73,68,62,56,52,46,41,36,29,24,14,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"topEigenvalues":[3.3920142139417155,4.214578098895645]}]};
    const PLOT = Object.freeze({ left: 12, right: 158, top: 20, bottom: 110, xMax: DATA.xMax, yMax: DATA.yMax });
    const COLORS = Object.freeze({ curve: '#536c60', fill: '#b5c7b5', axis: '#b8c3b9', guide: '#a7b6aa', accent: '#984c36' });

    function support(gamma) {
        if (!Number.isFinite(gamma) || gamma <= 0 || gamma >= 1) {
            throw new RangeError('The illustrated MP family requires 0 < gamma < 1.');
        }
        return [(1 - Math.sqrt(gamma)) ** 2, (1 + Math.sqrt(gamma)) ** 2];
    }

    function density(lambda, gamma) {
        const [a, b] = support(gamma);
        if (!Number.isFinite(lambda) || lambda <= a || lambda >= b) return 0;
        return Math.sqrt((b - lambda) * (lambda - a)) / (2 * Math.PI * gamma * lambda);
    }

    function outlierLocation(alpha, gamma) {
        support(gamma);
        if (!Number.isFinite(alpha) || alpha <= 1 + Math.sqrt(gamma)) {
            throw new RangeError('A supercritical population spike is required.');
        }
        return alpha * (1 + gamma / (alpha - 1));
    }

    const projectX = lambda => PLOT.left + lambda / PLOT.xMax * (PLOT.right - PLOT.left);
    const projectY = value => PLOT.bottom - value / PLOT.yMax * (PLOT.bottom - PLOT.top);
    const circle = (x, y, radius) => Array.from({ length: 24 }, (_, index) => {
        const angle = 2 * Math.PI * index / 24;
        return [x + radius * Math.cos(angle), y + radius * Math.sin(angle)];
    });

    function histogramPoints(checkpoint) {
        const points = [[projectX(0), PLOT.bottom]];
        checkpoint.counts.forEach((count, index) => {
            const y = projectY(count / (checkpoint.p * DATA.binWidth));
            points.push([projectX(index * DATA.binWidth), y]);
            points.push([projectX((index + 1) * DATA.binWidth), y]);
        });
        points.push([projectX(PLOT.xMax), PLOT.bottom]);
        return points;
    }

    function stateAt(elapsedSeconds, staticMode) {
        if (!growth || typeof growth.state !== 'function') throw new Error('The shared growth helper is required.');
        return growth.state(elapsedSeconds, staticMode);
    }

    function scene(elapsedSeconds = 0, staticMode = false) {
        const state = stateAt(elapsedSeconds, staticMode);
        const [a, b] = support(DATA.gamma);
        const curve = Array.from({ length: 321 }, (_, index) => {
            const lambda = index === 0 ? a : index === 320 ? b :
                a + (b - a) * (1 - Math.cos(Math.PI * index / 320)) / 2;
            return [projectX(lambda), projectY(density(lambda, DATA.gamma))];
        });
        const guides = DATA.populationSpikes.map(populationEigenvalue => {
            const sampleLimit = outlierLocation(populationEigenvalue, DATA.gamma);
            return { populationEigenvalue, sampleLimit, x: projectX(sampleLimit), headY: 78 };
        });
        const layers = DATA.checkpoints.map((checkpoint, index) => ({
            n: checkpoint.n, p: checkpoint.p, weight: state.weights[index],
            histogram: histogramPoints(checkpoint),
            eigenvalues: checkpoint.topEigenvalues,
            stems: checkpoint.topEigenvalues.map(eigenvalue => ({ eigenvalue, x: projectX(eigenvalue), headY: 78 }))
        }));
        const commands = [
            { role: 'reference', points: [[PLOT.left, PLOT.bottom], [PLOT.right, PLOT.bottom]], stroke: COLORS.axis, width: 0.7 },
            ...Array.from({ length: Math.floor(PLOT.xMax) + 1 }, (_, lambda) => ({
                role: 'reference', points: [[projectX(lambda), PLOT.bottom], [projectX(lambda), PLOT.bottom + 2.5]],
                stroke: COLORS.axis, width: 0.65
            })),
            ...guides.flatMap(({ x, headY }) => [
                { role: 'reference', points: [[x, PLOT.bottom], [x, headY]], stroke: COLORS.guide, width: 0.7, dash: [2, 2] },
                { role: 'reference', points: circle(x, headY, 2.5), closed: true, stroke: COLORS.guide, width: 0.7 }
            ])
        ];
        // Weights already contain the reset fade; do not multiply state.opacity again.
        layers.forEach(layer => {
            if (layer.weight <= 0) return;
            commands.push({ role: 'empirical', n: layer.n, points: layer.histogram, closed: true,
                fill: COLORS.fill, opacity: 0.5 * layer.weight });
            commands.push({ role: 'empirical', n: layer.n, points: layer.histogram,
                stroke: COLORS.curve, width: 0.55, opacity: 0.52 * layer.weight });
        });
        commands.push({ role: 'reference', points: curve, stroke: COLORS.curve, width: 1.25 });
        layers.forEach(layer => {
            if (layer.weight <= 0) return;
            layer.stems.forEach(({ x, headY }) => {
                commands.push({ role: 'empirical', n: layer.n, points: [[x, PLOT.bottom], [x, headY]],
                    stroke: COLORS.accent, width: 0.95, opacity: 0.88 * layer.weight });
                commands.push({ role: 'empirical', n: layer.n, points: circle(x, headY, 1.65),
                    closed: true, fill: COLORS.accent, opacity: 0.95 * layer.weight });
            });
        });
        return { gamma: DATA.gamma, support: [a, b], curve, guides, layers, state, commands };
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
            context.setLineDash(command.dash || []);
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
        context.setLineDash([]);
        context.globalAlpha = 1;
    }

    function create(canvas) {
        const context = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
        if (!context) throw new Error('A 2D canvas is required for the spectrum illustration.');
        stateAt(0, true);
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
                (command.dash ? ` stroke-dasharray="${command.dash.join(' ')}"` : '') +
                (command.stroke ? ` stroke="${command.stroke}" stroke-width="${command.width}" stroke-linecap="round" stroke-linejoin="round"` : '') + '/>';
        });
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="spectrum-title spectrum-description">` +
            '<title id="spectrum-title">Finite Gaussian spectra and a fixed Marchenko–Pastur target</title>' +
            `<desc id="spectrum-description">Separate seeded Gaussian illustration; ${geometry.state.label}, p=n/2. ` +
            'The fixed curve is the limiting MP density at gamma=0.5. Shaded steps are computed bulk histograms. ' +
            'Rust stems mark the two actual largest sample eigenvalues; pale dashed guides mark fixed asymptotic locations 3.4125 and 4.2. ' +
            'Stem heights encode no density. Crossfades represent transitions between four computed sizes, not new intermediate data.</desc>' +
            paths.join('') + '</svg>\n';
    }

    const api = { create, scene, paint, toSVG, width: WIDTH, height: HEIGHT, duration: growth ? growth.duration : 16 };
    if (root) {
        root.ResearchMotion = root.ResearchMotion || {};
        root.ResearchMotion.spectrum = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { ...api, data: DATA, density, support, outlierLocation, plot: PLOT, gamma: DATA.gamma };
    }
}(typeof window !== 'undefined' ? window : null));
