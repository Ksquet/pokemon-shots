/**
 * Module de gestion des statistiques de pull.
 */

const STAT_LABELS = {
    doubleRare: 'Double Rare',
    ultraRare: 'Ultra Rare',
    illustrationRare: 'Illustration Rare',
    specialIllustrationRare: 'Special Illustration',
    hyperRare: 'Hyper Rare'
};

function toKebabCase(value) {
    return value.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function formatRate(count, opened) {
    return opened > 0 ? `${(count / opened * 100).toFixed(1)}%` : '0%';
}

function formatOneInX(count, opened) {
    return opened > 0 && count > 0 ? Math.round(opened / count) : 'N/A';
}

function formatPercent(value) {
    return `${(value * 100).toFixed(1)}%`;
}

function updateElementIfExists(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value ?? 0;
    }
}

function createStatCardsMarkup() {
    return Object.entries(STAT_LABELS).map(([key, label]) => {
        const id = toKebabCase(key);
        return `
            <article class="stat-card stat-${id}">
                <div class="stat-card-label">${label}</div>
                <div class="stat-card-value" id="${id}-count">0</div>
                <div class="stat-card-meta">
                    <span id="${id}-rate">0%</span>
                    <span>1/<span id="${id}-oneinx">N/A</span></span>
                </div>
            </article>
        `;
    }).join('');
}

function updateStats(stats) {
    updateElementIfExists('opened-count', stats.opened);
    updateElementIfExists('total-boosters-opened', stats.opened);

    for (const key of Object.keys(STAT_LABELS)) {
        const count = stats[key] || 0;
        const id = toKebabCase(key);
        updateElementIfExists(`${id}-count`, count);
        updateElementIfExists(`${id}-rate`, formatRate(count, stats.opened));
        updateElementIfExists(`${id}-oneinx`, formatOneInX(count, stats.opened));
    }
}

function updatePullRates(pullRates) {
    const list = document.getElementById('pull-rates-list');
    if (!list) {
        return;
    }

    list.innerHTML = '';

    for (const [key, data] of Object.entries(pullRates.comparison)) {
        const label = STAT_LABELS[key] || key;
        const expectedPercent = formatPercent(data.expected);
        const actualPercent = formatPercent(data.actual);
        const actualWidth = Math.min(Math.max(data.actual * 100, 0), 100);
        const expectedWidth = Math.min(Math.max(data.expected * 100, 0), 100);
        const diffClass = Math.abs(data.difference) < 10
            ? 'neutral'
            : data.difference > 0 ? 'positive' : 'negative';

        const row = document.createElement('article');
        row.className = `pull-rate-row ${diffClass}`;
        row.innerHTML = `
            <div class="pull-rate-head">
                <span class="pull-rate-name">${label}</span>
                <span class="pull-rate-actual">${actualPercent}</span>
            </div>
            <div class="pull-rate-bar" aria-hidden="true">
                <span class="pull-rate-expected" style="width: ${expectedWidth}%"></span>
                <span class="pull-rate-current" style="width: ${actualWidth}%"></span>
            </div>
            <div class="pull-rate-meta">
                <span>Theorie ${expectedPercent} (${data.expectedText})</span>
                <span>Reel ${data.actualText}</span>
            </div>
        `;

        list.appendChild(row);
    }

    updateElementIfExists('total-boosters-opened', pullRates.totalOpened);
}

function renderStatsPanel(panel) {
    panel.innerHTML = `
        <div class="stats-header">
            <div>
                <p class="stats-eyebrow">Session</p>
                <h3>Statistiques</h3>
            </div>
            <button class="toggle-stats-panel" aria-label="Reduire ou agrandir le panneau de statistiques" aria-expanded="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>
        </div>

        <div class="stats-content">
            <section class="stats-overview" aria-label="Boosters ouverts">
                <div>
                    <span class="stats-overview-label">Boosters</span>
                    <strong id="opened-count">0</strong>
                </div>
                <button id="reset-stats" class="reset-button" type="button">Reset</button>
            </section>

            <section class="stats-grid" aria-label="Raretés obtenues">
                ${createStatCardsMarkup()}
            </section>

            <section id="pull-rates-panel" class="pull-rates-panel" aria-label="Comparaison des taux de pull">
                <div class="pull-rates-title">
                    <h4>Taux de pull</h4>
                    <span><span id="total-boosters-opened">0</span> ouverts</span>
                </div>
                <div id="pull-rates-list" class="pull-rates-list"></div>
            </section>
        </div>
    `;
}

function initializeStatsPanel() {
    let statsPanel = document.querySelector('.stats-panel');

    if (!statsPanel) {
        statsPanel = document.createElement('aside');
        statsPanel.className = 'stats-panel hidden';
        document.body.appendChild(statsPanel);
    }

    renderStatsPanel(statsPanel);

    const resetButton = document.getElementById('reset-stats');
    if (resetButton) {
        resetButton.addEventListener('click', function() {
            if (!window.boosterOpener) {
                return;
            }

            window.boosterOpener.resetStats();
            if (window.pokemonShotsApp && typeof window.pokemonShotsApp.resetDisplayedStats === 'function') {
                window.pokemonShotsApp.resetDisplayedStats();
            } else {
                updateStats(window.boosterOpener.getStats());
                updatePullRates(window.boosterOpener.checkPullRates());
            }
        });
    }

    const toggleButton = statsPanel.querySelector('.toggle-stats-panel');
    if (toggleButton) {
        toggleButton.addEventListener('click', function() {
            const isCollapsed = statsPanel.classList.toggle('collapsed');
            toggleButton.setAttribute('aria-expanded', String(!isCollapsed));
        });
    }
}

Object.assign(window, {
    updateStats,
    updatePullRates,
    initializeStatsPanel
});
