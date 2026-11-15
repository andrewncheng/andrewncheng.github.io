/* A (2, 3) torus knot: two turns around the torus and three around its tube.
 * r(t) = ((2 + .8 cos 3t) cos 2t, (2 + .8 cos 3t) sin 2t, .8 sin 3t).
 * All motion is a rigid rotation, followed by a fixed camera tilt and an
 * orthographic projection. The tilted axis keeps the silhouette open.
 * Crossing gaps are drawn on the nearer branch using its actual depth.
 * The caller owns scheduling, pause behavior, and reduced-motion policy.
 */
(function (root) {
    'use strict';

    const SIZE = 80;
    const DURATION = 15;
    const SAMPLES = 360;
    const TAU = 2 * Math.PI;
    const PITCH = 0.62;
    const START = Math.PI / 2 + 0.08;
    const SCALE = 68 / 5.6;
    const LINE = 2.05;
    const PAPER = '#faf9f6';
    const SAGE = '#536c60';
    const RUST = '#984c36';

    function curve(t) {
        const radius = 2 + 0.8 * Math.cos(3 * t);
        return [radius * Math.cos(2 * t), radius * Math.sin(2 * t), 0.8 * Math.sin(3 * t)];
    }

    function rotate(point, angle) {
        const [x, y, z] = point;
        const ca = Math.cos(angle), sa = Math.sin(angle);
        const cp = Math.cos(PITCH), sp = Math.sin(PITCH);
        const a = ca * x - sa * y;
        const b = sa * x + ca * y;
        return [a, cp * b - sp * z, sp * b + cp * z];
    }

    function sampleCurve(count = SAMPLES) {
        const points = Array.from({ length: count }, (_, i) => curve(TAU * i / count));
        points.push(points[0].slice());
        return points;
    }

    const MODEL = sampleCurve();

    function angleAt(elapsedSeconds, staticMode) {
        if (staticMode) return START;
        const time = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
        const remainder = time % DURATION;
        const phase = remainder < 0 ? remainder + DURATION : remainder;
        return START + TAU * phase / DURATION;
    }

    function project(point) {
        return { x: SIZE / 2 + SCALE * point[0], y: SIZE / 2 - SCALE * point[1], depth: point[2] };
    }

    // Find actual projected intersections of non-neighboring curve segments.
    function intersections(points) {
        const count = points.length - 1;
        const found = [];
        const cross = (a, b, c, d) => a * d - b * c;
        for (let i = 0; i < count; i += 1) {
            const a = points[i], b = points[i + 1];
            const ux = b.x - a.x, uy = b.y - a.y;
            for (let j = i + 1; j < count; j += 1) {
                if (Math.min(j - i, count - (j - i)) < 6) continue;
                const c = points[j], d = points[j + 1];
                const vx = d.x - c.x, vy = d.y - c.y;
                const determinant = cross(ux, uy, vx, vy);
                if (Math.abs(determinant) < 1e-10) continue;
                const dx = c.x - a.x, dy = c.y - a.y;
                const s = cross(dx, dy, vx, vy) / determinant;
                const t = cross(dx, dy, ux, uy) / determinant;
                if (s < 0 || s >= 1 || t < 0 || t >= 1) continue;
                const p = { x: a.x + s * ux, y: a.y + s * uy };
                const z1 = a.depth + s * (b.depth - a.depth);
                const z2 = c.depth + t * (d.depth - c.depth);
                if (found.some(hit => Math.hypot(hit.x - p.x, hit.y - p.y) < 0.05)) continue;
                found.push({ ...p, front: z1 > z2 ? i + s : j + t,
                    back: z1 > z2 ? j + t : i + s,
                    frontDepth: Math.max(z1, z2), backDepth: Math.min(z1, z2) });
            }
        }
        return found.sort((a, b) => a.frontDepth - b.frontDepth);
    }

    function tint(hex, depth) {
        const strength = 0.71 + 0.26 * Math.max(0, Math.min(1, (depth + 2.8) / 5.6));
        const rgb = [1, 3, 5].map(offset => {
            const color = parseInt(hex.slice(offset, offset + 2), 16);
            const paper = parseInt(PAPER.slice(offset, offset + 2), 16);
            return Math.round(paper + strength * (color - paper));
        });
        return '#' + rgb.map(value => value.toString(16).padStart(2, '0')).join('');
    }

    function material(index) {
        const wrapped = ((index % SAMPLES) + SAMPLES) % SAMPLES;
        return wrapped >= 18 && wrapped < 48 ? RUST : SAGE;
    }

    function scene(elapsedSeconds = 0, staticMode = false) {
        const angle = angleAt(elapsedSeconds, staticMode);
        const rotated = MODEL.map(point => rotate(point, angle));
        const points = rotated.map(project);
        const commands = [];
        for (let i = 0; i < SAMPLES; i += 6) {
            const portion = points.slice(i, i + 7);
            const depth = portion.reduce((sum, point) => sum + point.depth, 0) / portion.length;
            commands.push({ role: 'curve', depth, points: portion.map(p => [p.x, p.y]),
                stroke: tint(material(i + 3), depth), width: LINE });
        }
        commands.sort((a, b) => a.depth - b.depth);
        const crossings = intersections(points);
        crossings.forEach(crossing => {
            const center = Math.floor(crossing.front);
            const indices = Array.from({ length: 16 }, (_, i) => center - 7 + i);
            const portion = indices.map(i => points[(i + SAMPLES) % SAMPLES]);
            commands.push({ role: 'crossing-halo', depth: crossing.frontDepth,
                points: portion.map(p => [p.x, p.y]), stroke: PAPER, width: 4.7 });
            // Keep the accent attached to the curve even when it crosses itself.
            for (let i = 0; i < portion.length - 1; i += 1) {
                const a = portion[i], b = portion[i + 1];
                const depth = (a.depth + b.depth) / 2;
                commands.push({ role: 'overpass', depth, points: [[a.x, a.y], [b.x, b.y]],
                    stroke: tint(material(indices[i] + 0.5), depth), width: LINE });
            }
        });
        return { angle, points, rotated, crossings, commands };
    }

    function paint(context, geometry) {
        context.globalAlpha = 1;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        geometry.commands.forEach(command => {
            context.beginPath();
            command.points.forEach(([x, y], index) => {
                if (index) context.lineTo(x, y);
                else context.moveTo(x, y);
            });
            context.strokeStyle = command.stroke;
            context.lineWidth = command.width;
            context.stroke();
        });
    }

    function create(canvas) {
        const context = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
        if (!context) throw new Error('A 2D canvas is required for the trefoil illustration.');
        return {
            render(elapsedSeconds, staticMode) {
                const width = canvas.clientWidth > 0 ? canvas.clientWidth : 40;
                const height = canvas.clientHeight > 0 ? canvas.clientHeight : 40;
                const requestedDpr = Number(root && root.devicePixelRatio);
                const dpr = Number.isFinite(requestedDpr) ? Math.min(2, Math.max(1, requestedDpr)) : 1;
                const pixelWidth = Math.max(1, Math.round(width * dpr));
                const pixelHeight = Math.max(1, Math.round(height * dpr));
                if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
                if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
                context.setTransform(dpr, 0, 0, dpr, 0, 0);
                context.clearRect(0, 0, width, height);
                context.save();
                const scale = Math.min(width, height) / SIZE;
                context.translate((width - SIZE * scale) / 2, (height - SIZE * scale) / 2);
                context.scale(scale, scale);
                paint(context, scene(elapsedSeconds, Boolean(staticMode)));
                context.restore();
            }
        };
    }

    function toSVG(width = SIZE, height = SIZE, elapsedSeconds = 0, staticMode = true) {
        const number = value => Number(value.toFixed(5));
        const paths = scene(elapsedSeconds, staticMode).commands.map(command => {
            const d = command.points.map(([x, y], i) => (i ? 'L' : 'M') + number(x) + ' ' + number(y)).join(' ');
            return '<path d="' + d + '" fill="none" stroke="' + command.stroke + '" stroke-width="' + command.width + '"/>';
        });
        return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height +
            '" viewBox="0 0 80 80" role="img" aria-labelledby="trefoil-title" stroke-linecap="round" stroke-linejoin="round">' +
            '<title id="trefoil-title">Trefoil knot</title>' + paths.join('') + '</svg>\n';
    }

    const api = { create, scene, toSVG, curve, rotate, sampleCurve, intersections,
        duration: DURATION, size: SIZE, samples: SAMPLES, pitch: PITCH };
    if (root) root.TrefoilGeometry = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : null));
