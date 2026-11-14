/* Original schematic artwork. It depicts a decision flow, not measured model data. */
(function (root) {
    'use strict';

    const WIDTH = 170;
    const HEIGHT = 130;
    const DURATION = 11.5;
    const COLORS = {
        paper: '#faf9f6',
        forest: '#536c60',
        slate: '#8c9c94',
        line: '#c4cdc4',
        grid: '#b8c3b9',
        edge: '#9eada4',
        cell: '#d4ded2',
        activeCell: '#7e9686',
        rust: '#984c36'
    };
    const TOKENS = [
        [12, 51, 15], [31, 51, 8],
        [12, 63, 9], [25, 63, 17],
        [12, 75, 19], [35, 75, 5]
    ];
    // Back-to-front order; each plane has the same 26 × 44 geometry.
    const PLANES = [
        { x: 80, y: 30, fill: '#dfe5dd', start: 4, cells: [[2, 1], [1, 3]] },
        { x: 70, y: 36, fill: '#e8ede7', start: 3, cells: [[2, 0], [2, 2]] },
        { x: 60, y: 42, fill: '#f2f5ef', start: 2, cells: [[0, 1], [1, 2], [2, 0]] }
    ];

    function clamp(value) {
        return Math.max(0, Math.min(1, value));
    }

    function ease(start, end, value) {
        const progress = clamp((value - start) / (end - start));
        return progress * progress * (3 - 2 * progress);
    }

    function line(context, x1, y1, x2, y2, color, width) {
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.strokeStyle = color;
        context.lineWidth = width;
        context.stroke();
    }

    function circle(context, x, y, radius, fill, stroke) {
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        if (fill) {
            context.fillStyle = fill;
            context.fill();
        }
        if (stroke) {
            context.strokeStyle = stroke;
            context.lineWidth = 1;
            context.stroke();
        }
    }

    function plane(context, geometry, activation) {
        context.save();
        context.transform(1, 8 / 26, 0, 1, geometry.x, geometry.y);
        context.fillStyle = geometry.fill;
        context.fillRect(0, 0, 26, 44);

        geometry.cells.forEach(([column, row]) => {
            const x = column * 26 / 3;
            const y = row * 11;
            context.fillStyle = COLORS.cell;
            context.fillRect(x, y, 26 / 3, 11);
            context.globalAlpha = activation * 0.65;
            context.fillStyle = COLORS.activeCell;
            context.fillRect(x, y, 26 / 3, 11);
            context.globalAlpha = 1;
        });

        for (let column = 1; column < 3; column += 1) {
            line(context, column * 26 / 3, 0, column * 26 / 3, 44, COLORS.grid, 0.55);
        }
        for (let row = 1; row < 4; row += 1) {
            line(context, 0, row * 11, 26, row * 11, COLORS.grid, 0.55);
        }
        context.strokeStyle = COLORS.edge;
        context.lineWidth = 0.9;
        context.strokeRect(0, 0, 26, 44);
        context.globalAlpha = activation * 0.65;
        context.strokeStyle = COLORS.forest;
        context.strokeRect(0, 0, 26, 44);
        context.restore();
    }

    function draw(context, time, staticMode) {
        const fade = staticMode ? 1 : 1 - ease(9.7, DURATION, time);
        const selected = staticMode ? 1 : ease(5.9, 6.6, time) * fade;
        context.lineCap = 'round';
        context.lineJoin = 'round';

        // The unselected schematic stays legible throughout the loop.
        line(context, 44, 65, 60, 65, COLORS.line, 1);
        [38, 92].forEach(y => {
            context.beginPath();
            context.moveTo(106, 65);
            context.bezierCurveTo(123, 65, 128, y, 148, y);
            context.strokeStyle = COLORS.line;
            context.lineWidth = 1;
            context.stroke();
        });
        line(context, 106, 65, 148, 65, COLORS.line, 1);

        TOKENS.forEach(([x, y, width], index) => {
            line(context, x, y, x + width, y, COLORS.slate, 2.1);
            context.globalAlpha = staticMode ? 0.6 : ease(0.2 + index * 0.12, 1.3 + index * 0.12, time) * fade;
            line(context, x, y, x + width, y, COLORS.forest, 2.1);
            context.globalAlpha = 1;
        });

        PLANES.forEach(geometry => {
            const activation = staticMode ? 0.7 : ease(geometry.start, geometry.start + 0.8, time) * fade;
            plane(context, geometry, activation);
        });

        [38, 65, 92].forEach(y => {
            circle(context, 153, y, 4.6, COLORS.paper, COLORS.edge);
        });

        const outputProgress = staticMode ? 1 : ease(4.9, 6.3, time);
        if (outputProgress > 0) {
            context.globalAlpha = fade;
            line(context, 107, 65, 107 + outputProgress * 41, 65, COLORS.rust, 1.25);
            context.globalAlpha = 1;
        }

        context.globalAlpha = selected;
        circle(context, 153, 65, 6.2, COLORS.paper, COLORS.rust);
        circle(context, 153, 65, 2.7, COLORS.rust);
        context.globalAlpha = 1;

        if (!staticMode) {
            const inputAlpha = ease(0.9, 1.1, time) * (1 - ease(2.3, 2.5, time));
            context.globalAlpha = inputAlpha;
            circle(context, 44 + ease(0.9, 2.5, time) * 16, 65, 1.8, COLORS.forest);
            const outputAlpha = ease(4.9, 5.1, time) * (1 - ease(6.1, 6.4, time));
            context.globalAlpha = outputAlpha;
            circle(context, 107 + outputProgress * 41, 65, 1.9, COLORS.rust);
            context.globalAlpha = 1;
        }
    }

    function create(canvas) {
        const context = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;

        return {
            render(elapsedSeconds, staticMode) {
                if (!context) return;
                const width = canvas.clientWidth > 0 ? canvas.clientWidth : WIDTH;
                const height = canvas.clientHeight > 0 ? canvas.clientHeight : HEIGHT;
                const dpr = Math.min(2, Math.max(1, Number(root.devicePixelRatio) || 1));
                const pixelWidth = Math.max(1, Math.round(width * dpr));
                const pixelHeight = Math.max(1, Math.round(height * dpr));
                if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
                if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

                context.setTransform(dpr, 0, 0, dpr, 0, 0);
                context.globalAlpha = 1;
                context.clearRect(0, 0, width, height);
                context.save();
                const scale = Math.min(width / WIDTH, height / HEIGHT);
                context.translate((width - WIDTH * scale) / 2, (height - HEIGHT * scale) / 2);
                context.scale(scale, scale);
                const elapsed = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
                const time = ((elapsed % DURATION) + DURATION) % DURATION;
                draw(context, time, Boolean(staticMode));
                context.restore();
            }
        };
    }

    const api = { create };
    root.ResearchMotion = root.ResearchMotion || {};
    root.ResearchMotion.decisions = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
