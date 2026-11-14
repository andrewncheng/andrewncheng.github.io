/* An illustrative graph manifold, independent of the published paper figures.
 * f(x,y) = .20 x² + .42 y² + .055 sin²(1.1 x + .65 y).
 * The surface is (x,y,f(x,y)); the objective is its height f.
 * Hessian(f) >= (.40 - .11 * (1.1² + .65²)) I > .2204 I,
 * so the origin is the unique global minimum. The induced metric is
 * G = I + grad(f) grad(f)^T. Iterates use G^-1 grad(f), graph retraction,
 * and Armijo backtracking. Animation interpolates the accepted coordinates
 * and lifts every displayed point back to the graph.
 * No clocks, observers, event listeners, or animation loops are owned here.
 */
(function (root) {
    'use strict';

    const RX = 1.95;
    const RY = 1.38;
    const CAMERA = 0.58;
    const ORBIT = 0.018;
    const DURATION = 11.4;
    const TAU = Math.PI * 2;
    const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
    const smooth = value => value * value * (3 - 2 * value);

    function objective(x, y) {
        const wave = Math.sin(1.1 * x + 0.65 * y);
        return 0.20 * x * x + 0.42 * y * y + 0.055 * wave * wave;
    }

    function gradient(x, y) {
        const wave = 0.055 * Math.sin(2 * (1.1 * x + 0.65 * y));
        return [0.40 * x + 1.1 * wave, 0.84 * y + 0.65 * wave];
    }

    function graphPoint(x, y) {
        return { x, y, z: objective(x, y) };
    }

    function inducedMetric(x, y) {
        const [gx, gy] = gradient(x, y);
        return [[1 + gx * gx, gx * gy], [gx * gy, 1 + gy * gy]];
    }

    function riemannianGradient(x, y) {
        const [gx, gy] = gradient(x, y);
        const denominator = 1 + gx * gx + gy * gy;
        return [gx / denominator, gy / denominator];
    }

    function descent(start = [-1.55, -0.75]) {
        let [x, y] = start;
        const points = [{ ...graphPoint(x, y), step: 0, backtracks: 0 }];
        for (let iteration = 0; iteration < 160; iteration += 1) {
            const [gx, gy] = gradient(x, y);
            if (Math.hypot(gx, gy) < 1e-9) break;
            const [vx, vy] = riemannianGradient(x, y);
            const normSquared = gx * vx + gy * vy;
            let step = 1.4;
            let backtracks = 0;
            let next;
            while (backtracks < 40) {
                next = graphPoint(x - step * vx, y - step * vy);
                const [nx, ny] = gradient(next.x, next.y);
                // The second condition also keeps each interpolated segment
                // descending: convexity makes its directional derivative monotone.
                if (next.z <= objective(x, y) - 1e-4 * step * normSquared &&
                    nx * vx + ny * vy >= 0) break;
                step *= 0.5;
                backtracks += 1;
            }
            if (backtracks === 40) throw new Error('Manifold descent did not find a valid step.');
            x = next.x;
            y = next.y;
            points.push({ ...next, step, backtracks });
        }
        return points;
    }

    function project(point, azimuth = CAMERA) {
        const c = Math.cos(azimuth);
        const s = Math.sin(azimuth);
        const depth = s * point.x + c * point.y;
        return { x: c * point.x - s * point.y, y: 0.70 * depth - 1.28 * point.z, depth };
    }

    function buildGeometry() {
        const cells = [];
        const wires = [];
        const rim = [];
        const radial = 9;
        const angular = 48;
        const polar = (r, angle) => graphPoint(RX * r * Math.cos(angle), RY * r * Math.sin(angle));
        for (let ring = 0; ring < radial; ring += 1) {
            for (let wedge = 0; wedge < angular; wedge += 1) {
                const a = TAU * wedge / angular;
                const b = TAU * (wedge + 1) / angular;
                const r = ring / radial;
                const q = (ring + 1) / radial;
                cells.push([polar(r, a), polar(q, a), polar(q, b), polar(r, b)]);
            }
        }
        for (let line = -4; line <= 4; line += 1) {
            const offset = line * 0.20;
            const extent = Math.sqrt(1 - offset * offset);
            const across = [];
            const along = [];
            for (let i = 0; i <= 60; i += 1) {
                const t = extent * (2 * i / 60 - 1);
                across.push(graphPoint(RX * offset, RY * t));
                along.push(graphPoint(RX * t, RY * offset));
            }
            wires.push(across, along);
        }
        for (let i = 0; i <= 120; i += 1) rim.push(polar(1, TAU * i / 120));

        const iterates = descent();
        const trail = [];
        let distance = 0;
        iterates.forEach((point, index) => {
            if (!index) {
                trail.push({ ...point, distance });
                return;
            }
            const previous = iterates[index - 1];
            for (let j = 1; j <= 14; j += 1) {
                const t = j / 14;
                const next = graphPoint(previous.x + t * (point.x - previous.x), previous.y + t * (point.y - previous.y));
                const last = trail[trail.length - 1];
                distance += Math.hypot(next.x - last.x, next.y - last.y, next.z - last.z);
                trail.push({ ...next, distance });
            }
        });

        // Stable framing includes both ends of the very small camera sway.
        const bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
        [CAMERA - ORBIT, CAMERA, CAMERA + ORBIT].forEach(angle => {
            [...rim, ...wires.flat()].forEach(point => {
                const p = project(point, angle);
                bounds.left = Math.min(bounds.left, p.x);
                bounds.right = Math.max(bounds.right, p.x);
                bounds.top = Math.min(bounds.top, p.y);
                bounds.bottom = Math.max(bounds.bottom, p.y);
            });
        });
        return { cells, wires, rim, iterates, trail, length: distance, bounds };
    }

    function sampleTrajectory(model, fraction) {
        const target = clamp(fraction, 0, 1) * model.length;
        let lo = 0;
        let hi = model.trail.length - 1;
        while (lo + 1 < hi) {
            const mid = Math.floor((lo + hi) / 2);
            if (model.trail[mid].distance <= target) lo = mid;
            else hi = mid;
        }
        const a = model.trail[lo];
        const b = model.trail[hi];
        const t = b.distance > a.distance ? (target - a.distance) / (b.distance - a.distance) : 0;
        return { point: graphPoint(a.x + t * (b.x - a.x), a.y + t * (b.y - a.y)), index: lo };
    }

    const MODEL = buildGeometry();

    function scene(width, height, elapsedSeconds = 0, staticMode = true) {
        const phase = ((Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0) % DURATION + DURATION) % DURATION;
        const angle = CAMERA + (staticMode ? 0 : ORBIT * Math.sin(TAU * phase / DURATION));
        const progress = staticMode ? 1 : smooth(clamp((phase - 0.45) / 7.9, 0, 1));
        const fade = staticMode ? 1 : Math.min(smooth(clamp(phase / 0.45, 0, 1)), 1 - smooth(clamp((phase - 10.25) / 1.15, 0, 1)));
        const unit = Math.max(0.35, Math.min(width / 170, height / 130));
        const bounds = MODEL.bounds;
        const margin = 9 * unit;
        const scale = Math.min((width - margin * 2) / (bounds.right - bounds.left), (height - margin * 2) / (bounds.bottom - bounds.top));
        const ox = (width - (bounds.left + bounds.right) * scale) / 2;
        const oy = (height - (bounds.top + bounds.bottom) * scale) / 2 - 2 * unit;
        const map = point => {
            const p = project(point, angle);
            return [ox + p.x * scale, oy + p.y * scale];
        };
        const commands = [];
        const addPath = (points, options) => commands.push({ kind: 'path', points: points.map(map), ...options });
        const origin = map(graphPoint(0, 0));
        commands.push({ kind: 'ellipse', x: origin[0], y: origin[1] + 6 * unit, rx: 20 * unit, ry: 4 * unit, fill: '#728375', opacity: 0.065 });

        MODEL.cells.map(points => ({ points, depth: points.reduce((sum, p) => sum + project(p, angle).depth, 0) / 4 }))
            .sort((a, b) => a.depth - b.depth)
            .forEach(cell => {
                const illumination = clamp((cell.depth + 1.8) / 3.6, 0, 1);
                addPath(cell.points, { closed: true, fill: '#92aa97', opacity: 0.11 + illumination * 0.065 });
            });
        MODEL.wires.forEach(wire => addPath(wire, { stroke: '#78917f', lineWidth: 0.68 * unit, opacity: 0.37 }));
        addPath(MODEL.rim, { stroke: '#7b9381', lineWidth: 0.88 * unit, opacity: 0.58 });

        // A small quiet marker identifies the unique minimum throughout the cycle.
        commands.push({ kind: 'circle', x: origin[0], y: origin[1], radius: 3.5 * unit, fill: '#faf9f6', opacity: 0.95 });
        commands.push({ kind: 'circle', x: origin[0], y: origin[1], radius: 1.7 * unit, fill: '#77907d', opacity: 0.72 });

        const sampled = sampleTrajectory(MODEL, progress);
        const visible = MODEL.trail.slice(0, sampled.index + 1);
        visible.push(sampled.point);
        if (progress > 0) {
            addPath(visible, { stroke: '#faf9f6', lineWidth: 3.4 * unit, opacity: 0.84 * fade });
            addPath(visible, { stroke: '#b8764f', lineWidth: 1.55 * unit, opacity: 0.85 * fade });
        }
        // The converged numerical endpoint is < 3e-9 from the exact origin.
        const position = progress === 1 ? origin : map(sampled.point);
        commands.push({ kind: 'circle', x: position[0], y: position[1], radius: 8 * unit, fill: '#c68559', opacity: 0.10 * fade });
        commands.push({ kind: 'circle', x: position[0], y: position[1], radius: 3.25 * unit, fill: '#b96d43', opacity: fade });
        commands.push({ kind: 'circle', x: position[0] - 0.7 * unit, y: position[1] - 0.8 * unit, radius: 0.8 * unit, fill: '#f4cfad', opacity: 0.85 * fade });
        return commands;
    }

    function paint(context, commands) {
        commands.forEach(command => {
            context.beginPath();
            if (command.kind === 'path') {
                command.points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
                if (command.closed) context.closePath();
            } else if (command.kind === 'ellipse') {
                context.ellipse(command.x, command.y, command.rx, command.ry, 0, 0, TAU);
            } else {
                context.arc(command.x, command.y, command.radius, 0, TAU);
            }
            context.globalAlpha = command.opacity;
            if (command.fill) {
                context.fillStyle = command.fill;
                context.fill();
            }
            if (command.stroke) {
                context.strokeStyle = command.stroke;
                context.lineWidth = command.lineWidth;
                context.lineCap = 'round';
                context.lineJoin = 'round';
                context.stroke();
            }
        });
        context.globalAlpha = 1;
    }

    function create(canvas) {
        const context = canvas.getContext('2d');
        if (!context) throw new Error('A 2D canvas is required for the manifold illustration.');
        return {
            render(elapsedSeconds, staticMode) {
                const width = canvas.clientWidth > 0 ? canvas.clientWidth : 170;
                const height = canvas.clientHeight > 0 ? canvas.clientHeight : 130;
                const dpr = clamp(root && root.devicePixelRatio || 1, 1, 2);
                const pixelWidth = Math.round(width * dpr);
                const pixelHeight = Math.round(height * dpr);
                if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
                if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
                context.setTransform(dpr, 0, 0, dpr, 0, 0);
                context.clearRect(0, 0, width, height);
                paint(context, scene(width, height, elapsedSeconds, Boolean(staticMode)));
            }
        };
    }

    function toSVG(width = 340, height = 260) {
        const number = value => Number(value.toFixed(3));
        const elements = scene(width, height, 0, true).map(command => {
            const style = ` fill="${command.fill || 'none'}" opacity="${number(command.opacity)}"` +
                (command.stroke ? ` stroke="${command.stroke}" stroke-width="${number(command.lineWidth)}" stroke-linecap="round" stroke-linejoin="round"` : '');
            if (command.kind === 'path') {
                const d = command.points.map(([x, y], index) => `${index ? 'L' : 'M'}${number(x)} ${number(y)}`).join('') + (command.closed ? 'Z' : '');
                return `<path d="${d}"${style}/>`;
            }
            if (command.kind === 'ellipse') return `<ellipse cx="${number(command.x)}" cy="${number(command.y)}" rx="${number(command.rx)}" ry="${number(command.ry)}"${style}/>`;
            return `<circle cx="${number(command.x)}" cy="${number(command.y)}" r="${number(command.radius)}"${style}/>`;
        });
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="manifold-title"><title id="manifold-title">Gradient descent on a curved surface</title>${elements.join('')}</svg>\n`;
    }

    if (root) {
        root.ResearchMotion = root.ResearchMotion || {};
        root.ResearchMotion.manifold = { create };
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { objective, gradient, graphPoint, inducedMetric, riemannianGradient, descent, project, buildGeometry, sampleTrajectory, scene, toSVG, create, duration: DURATION };
    }
}(typeof window !== 'undefined' ? window : null));
