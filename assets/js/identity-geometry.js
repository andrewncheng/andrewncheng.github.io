/* A filled Möbius ribbon with an illustrative neural graph in its aperture.
 * M(u,v)=((2+v cos(phi)) cos u, (2+v cos(phi)) sin u, v sin(phi)),
 * phi=atan2(.24 sin(u/2),cos(u/2)), 0<=u<=2pi, -.63<=v<=.63.
 * phi runs continuously from 0 to pi, concentrating the turn at one shoulder.
 * M(2pi,v)=M(0,-v): one genuine half twist with a broad filled surface.
 * The camera motion is rigid; graph pulses are decorative signal markers.
 * Scheduling, pause, and reduced-motion policy belong to the caller.
 */
(function (root) {
    'use strict';

    const WIDTH = 120, HEIGHT = 100, DURATION = 20;
    const TAU = Math.PI * 2;
    const LENGTH_SAMPLES = 96, WIDTH_SAMPLES = 4;
    const HALF_WIDTH = 0.63, TWIST = 0.24;
    const SCALE = 18;
    const PAPER = '#faf9f6', INK = '#242e29', SAGE = '#536c60', RUST = '#984c36';
    const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
    const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
    const normalize = a => { const length = Math.hypot(...a); return a.map(value => value / length); };
    const light = normalize([-0.45, -0.55, 1]);

    function ribbon(u, v) {
        const angle = Math.atan2(TWIST * Math.sin(u / 2), Math.cos(u / 2));
        const radius = 2 + v * Math.cos(angle);
        return [radius * Math.cos(u), radius * Math.sin(u), v * Math.sin(angle)];
    }

    function normal(u, v) {
        const c = Math.cos(u), s = Math.sin(u);
        const angle = Math.atan2(TWIST * Math.sin(u / 2), Math.cos(u / 2));
        const h = Math.cos(angle), k = Math.sin(angle);
        const derivative = TWIST / (2 * (Math.cos(u / 2) ** 2 + TWIST ** 2 * Math.sin(u / 2) ** 2));
        const du = [-(2 + v * h) * s - derivative * v * k * c,
            (2 + v * h) * c - derivative * v * k * s, derivative * v * h];
        const dv = [h * c, h * s, k];
        return normalize([du[1] * dv[2] - du[2] * dv[1],
            du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]]);
    }

    function transform(point, yaw, pitch) {
        const [x, y, z] = point;
        const a = x * Math.cos(yaw) - y * Math.sin(yaw);
        const b = x * Math.sin(yaw) + y * Math.cos(yaw);
        return [a, b * Math.cos(pitch) - z * Math.sin(pitch), b * Math.sin(pitch) + z * Math.cos(pitch)];
    }

    function project(point) {
        return { x: WIDTH / 2 + SCALE * point[0], y: HEIGHT / 2 - SCALE * point[1], depth: point[2] };
    }

    function mix(a, b, weight) {
        return '#' + [1, 3, 5].map(offset => {
            const first = parseInt(a.slice(offset, offset + 2), 16);
            const last = parseInt(b.slice(offset, offset + 2), 16);
            return Math.round(first + weight * (last - first)).toString(16).padStart(2, '0');
        }).join('');
    }

    const MODEL = [];
    for (let i = 0; i < LENGTH_SAMPLES; i += 1) {
        const u0 = TAU * i / LENGTH_SAMPLES, u1 = TAU * (i + 1) / LENGTH_SAMPLES;
        for (let j = 0; j < WIDTH_SAMPLES; j += 1) {
            const v0 = -HALF_WIDTH + 2 * HALF_WIDTH * j / WIDTH_SAMPLES;
            const v1 = -HALF_WIDTH + 2 * HALF_WIDTH * (j + 1) / WIDTH_SAMPLES;
            MODEL.push({ points: [ribbon(u0, v0), ribbon(u1, v0), ribbon(u1, v1), ribbon(u0, v1)],
                normal: normal((u0 + u1) / 2, (v0 + v1) / 2) });
        }
    }
    // The graph faces the reader inside the aperture, independently of the
    // ribbon's gentle tilt. Its nodes represent an illustration, not a model.
    const NODES = [[46, 45], [46, 55], [60, 40], [60, 50], [60, 60], [74, 45], [74, 55]];
    const EDGES = [[0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4],
        [2, 5], [2, 6], [3, 5], [3, 6], [4, 5], [4, 6]];

    function circle(x, y, radius) {
        return Array.from({ length: 20 }, (_, i) => {
            const t = TAU * i / 20;
            return [x + radius * Math.cos(t), y + radius * Math.sin(t)];
        });
    }

    function scene(elapsedSeconds = 0, staticMode = false, pose) {
        const time = staticMode || !Number.isFinite(elapsedSeconds) ? 0 : elapsedSeconds;
        const remainder = time % DURATION;
        const phase = TAU * (remainder < 0 ? remainder + DURATION : remainder) / DURATION;
        const yaw = pose && Number.isFinite(pose.yaw) ? pose.yaw : -Math.PI / 3 + 0.10 * Math.sin(phase);
        const pitch = pose && Number.isFinite(pose.pitch) ? pose.pitch : 0.79 + 0.04 * Math.cos(phase);
        const transformed = point => transform(point, yaw, pitch);
        const map = point => project(transformed(point));
        const commands = MODEL.map(face => {
            const points = face.points.map(map);
            let n = transform(face.normal, yaw, pitch);
            if (n[2] < 0) n = n.map(value => -value);
            const diffuse = Math.max(0, dot(n, light));
            const color = mix(mix(INK, SAGE, 0.82), PAPER, 0.09 + 0.43 * diffuse ** 1.4);
            return { role: 'ribbon', points: points.map(p => [p.x, p.y]), closed: true,
                fill: color, stroke: color, width: 0.32, depth: points.reduce((sum, p) => sum + p.depth, 0) / 4 };
        });

        for (const v of [-HALF_WIDTH, HALF_WIDTH]) {
            for (let i = 0; i < LENGTH_SAMPLES; i += 1) {
                const u = TAU * i / LENGTH_SAMPLES;
                const a = map(ribbon(u, v)), b = map(ribbon(u + TAU / LENGTH_SAMPLES, v));
                const accent = v > 0 && u > Math.PI * 1.12 && u < Math.PI * 1.78;
                commands.push({ role: accent ? 'copper-edge' : 'ribbon-edge', points: [[a.x, a.y], [b.x, b.y]],
                    stroke: accent ? mix(RUST, PAPER, 0.12) : mix(INK, SAGE, 0.45),
                    width: accent ? 1.12 : 0.56, depth: (a.depth + b.depth) / 2 + 0.012 });
            }
        }

        const nodes = NODES.map(([x, y]) => ({ x, y, depth: 0 }));
        EDGES.forEach(([from, to]) => {
            const a = nodes[from], b = nodes[to];
            commands.push({ role: 'network-edge', points: [[a.x, a.y], [b.x, b.y]],
                stroke: mix(SAGE, PAPER, 0.42), width: 0.78, depth: 0 });
        });
        nodes.forEach((point, index) => commands.push({ role: 'neuron', points: circle(point.x, point.y, 2.35),
            closed: true, fill: index === 3 ? RUST : PAPER, stroke: index === 3 ? RUST : SAGE, width: 1.2, depth: 0.016 }));
        if (!staticMode) {
            const travel = ((phase / TAU * 3) % 1) * 2;
            const step = Math.floor(travel), amount = travel - step;
            for (const route of [[0, 3, 6], [1, 4, 5]]) {
                const a = nodes[route[step]], b = nodes[route[step + 1]];
                const x = a.x + amount * (b.x - a.x), y = a.y + amount * (b.y - a.y);
                commands.push({ role: 'signal', points: circle(x, y, 1.42), closed: true,
                    fill: RUST, opacity: 0.85 * Math.sin(Math.PI * amount), depth: a.depth + amount * (b.depth - a.depth) + 0.025 });
            }
        }
        commands.sort((a, b) => a.depth - b.depth);
        return { phase, yaw, pitch, nodes, commands };
    }

    function paint(context, geometry) {
        context.lineCap = 'round'; context.lineJoin = 'round';
        geometry.commands.forEach(command => {
            context.beginPath();
            command.points.forEach(([x, y], i) => { if (i) context.lineTo(x, y); else context.moveTo(x, y); });
            if (command.closed) context.closePath();
            context.globalAlpha = command.opacity === undefined ? 1 : command.opacity;
            if (command.fill) { context.fillStyle = command.fill; context.fill(); }
            if (command.stroke) { context.strokeStyle = command.stroke; context.lineWidth = command.width; context.stroke(); }
        });
        context.globalAlpha = 1;
    }

    function create(canvas) {
        const context = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
        if (!context) throw new Error('A 2D canvas is required for the identity illustration.');
        return { render(elapsedSeconds, staticMode) {
            const width = canvas.clientWidth > 0 ? canvas.clientWidth : 88;
            const height = canvas.clientHeight > 0 ? canvas.clientHeight : 74;
            const requested = Number(root && root.devicePixelRatio);
            const dpr = Number.isFinite(requested) ? clamp(requested, 1, 2) : 1;
            const pixelWidth = Math.max(1, Math.round(width * dpr)), pixelHeight = Math.max(1, Math.round(height * dpr));
            if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
            if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
            context.setTransform(dpr, 0, 0, dpr, 0, 0); context.clearRect(0, 0, width, height);
            context.save(); const scale = Math.min(width / WIDTH, height / HEIGHT);
            context.translate((width - WIDTH * scale) / 2, (height - HEIGHT * scale) / 2); context.scale(scale, scale);
            paint(context, scene(elapsedSeconds, Boolean(staticMode))); context.restore();
        } };
    }

    function toSVG(width = WIDTH, height = HEIGHT, elapsedSeconds = 0, staticMode = true, pose) {
        const number = value => Number(value.toFixed(4));
        const paths = scene(elapsedSeconds, staticMode, pose).commands.map(command => {
            const d = command.points.map(([x, y], i) => (i ? 'L' : 'M') + number(x) + ' ' + number(y)).join(' ') + (command.closed ? ' Z' : '');
            return '<path d="' + d + '" fill="' + (command.fill || 'none') + '"' +
                (command.stroke ? ' stroke="' + command.stroke + '" stroke-width="' + command.width + '"' : '') +
                (command.opacity === undefined ? '' : ' opacity="' + number(command.opacity) + '"') + '/>';
        });
        return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height +
            '" viewBox="0 0 120 100" role="img" aria-labelledby="identity-title" stroke-linecap="round" stroke-linejoin="round">' +
            '<title id="identity-title">Möbius ribbon with a neural network</title>' + paths.join('') + '</svg>\n';
    }

    const api = { create, scene, toSVG, ribbon, normal, transform, duration: DURATION, width: WIDTH, height: HEIGHT };
    if (root) root.IdentityGeometry = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : null));
