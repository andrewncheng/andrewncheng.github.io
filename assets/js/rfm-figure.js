/* Verbatim word lists from Figure 1C, arXiv:2610.09196v1, page 13.
 * t = 0 contains randomly selected words, not learned neighbors.
 * t = 1 and t = 5 contain the paper's selected cosine-neighbor examples.
 */
(function () {
    'use strict';

    const checkpoints = {
        '0': {
            label: 'Random baseline',
            note: 'Randomly selected words at t = 0 provide a baseline before our algorithm learns features.',
            words: {
                democracy: 'banana, violin, glacier, cactus, toaster',
                bank: 'octopus, velvet, comet, cabbage, lantern',
                moose: 'spreadsheet, opera, subway, almond, telescope',
                translates: 'volcano, bicycle, pillow, aspirin, galaxy',
                converting: 'quartz, meadow, suitcase, thunder, bracelet',
                kidnapping: 'canvas, lemon, orbit, fountain, notebook',
                influx: 'keyboard, dolphin, marble, espresso, sandal'
            }
        },
        '1': {
            label: 'After 1 update',
            note: 'Words similar to each query in the feature space learned at iteration t = 1 of our algorithm.',
            words: {
                democracy: 'political, revolution, politics, politicians, politically',
                bank: 'deposits, banks, central, deposit, banking',
                moose: 'glen, needless, geterrorstate, apiculture, destined',
                translates: 'unfamiliar, imply, ironic, compares, metaphor',
                converting: 'secondly, theoretically, lastly, ideally, transforming',
                kidnapping: 'jailed, committing, convictions, awaiting, imprisoned',
                influx: 'fleeing, serbia, migrant, seekers, hungarian'
            }
        },
        '5': {
            label: 'After 5 updates',
            note: 'Words similar to each query in the feature space learned at iteration t = 5 of our algorithm.',
            words: {
                democracy: 'authoritarian, dictatorship, political, legitimacy, revolution',
                bank: 'deposits, fargo, deposit, central, banks',
                moose: 'deer, hunters, wolves, elephants, turtle',
                translates: 'phrases, implies, dictionary, meaning, translated',
                converting: 'convert, converted, conversion, generates, storing',
                kidnapping: 'charged, pleaded, convicted, counts, felony',
                influx: 'migrants, migration, refugees, asylum, refugee'
            }
        }
    };

    function initialize(container) {
        const controls = container.querySelector('[data-rfm-checkpoints]');
        const buttons = Array.from(container.querySelectorAll('button[data-rfm-checkpoint]'));
        const label = container.querySelector('[data-rfm-stage-label]');
        const note = container.querySelector('[data-rfm-stage-note]');
        const announcement = container.querySelector('[data-rfm-announcement]');
        const rows = Array.from(container.querySelectorAll('tr[data-rfm-query]')).map(row => ({
            query: row.getAttribute('data-rfm-query'),
            cell: row.querySelector('td[data-rfm-neighbors]')
        }));
        const queries = Object.keys(checkpoints['5'].words);
        const validRows = rows.length === queries.length &&
            new Set(rows.map(row => row.query)).size === queries.length &&
            rows.every(row => row.cell && queries.includes(row.query));
        const validButtons = buttons.length === 3 &&
            new Set(buttons.map(button => button.getAttribute('data-rfm-checkpoint'))).size === 3 &&
            buttons.every(button => Object.hasOwn(checkpoints, button.getAttribute('data-rfm-checkpoint')));

        // Keep the authored checkpoint-5 table if enhancement cannot be completed.
        if (!controls || !label || !note || !validRows || !validButtons) return;

        let current = '5';

        function show(checkpoint, announce) {
            const data = checkpoints[checkpoint];
            rows.forEach(row => { row.cell.textContent = data.words[row.query]; });
            buttons.forEach(button => {
                button.setAttribute('aria-pressed', String(button.getAttribute('data-rfm-checkpoint') === checkpoint));
            });
            label.textContent = data.label;
            note.textContent = data.note;
            current = checkpoint;
            if (announce && announcement) {
                announcement.textContent = data.label + '. Seven query-word examples shown.';
            }
        }

        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const checkpoint = button.getAttribute('data-rfm-checkpoint');
                if (checkpoint !== current) show(checkpoint, true);
            });
        });

        show('5', false);
        controls.hidden = false;
    }

    function initializeAll() {
        document.querySelectorAll('[data-rfm-words]').forEach(initialize);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAll, { once: true });
    } else {
        initializeAll();
    }
}());
