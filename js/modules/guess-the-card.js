(function initGuessTheCardModule() {
    const STORAGE_KEY = 'pokemonShotsGuessTheCardSettings';
    const DEFAULT_SETTINGS = {
        generation: 'gen1',
        pixelation: 14
    };

    let panel = null;
    let navItem = null;
    let currentCard = null;
    let currentPixelation = DEFAULT_SETTINGS.pixelation;
    let rejectedAnswers = new Set();
    let attempts = 0;

    function getApp() {
        return window.pokemonShotsApp || null;
    }

    function clampNumber(value, min, max, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
    }

    function loadSettings() {
        try {
            return normalizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {});
        } catch (error) {
            return { ...DEFAULT_SETTINGS };
        }
    }

    function saveSettings(settings) {
        const normalized = normalizeSettings(settings);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
    }

    function normalizeSettings(settings = {}) {
        return {
            generation: settings.generation === 'gen1' ? 'gen1' : DEFAULT_SETTINGS.generation,
            pixelation: Math.round(clampNumber(settings.pixelation, 6, 40, DEFAULT_SETTINGS.pixelation))
        };
    }

    function ensurePanel() {
        if (!navItem) {
            const navList = document.querySelector('nav ul');
            if (navList) {
                navItem = document.createElement('li');
                navItem.className = 'guess-card-nav-item';
                navItem.innerHTML = '<button type="button">Guess the card</button>';
                navList.appendChild(navItem);
                navItem.querySelector('button').addEventListener('click', showPanel);
            }
        }

        if (panel) {
            return;
        }

        panel = document.createElement('section');
        panel.className = 'guess-card-panel hidden';
        document.querySelector('main')?.appendChild(panel);
    }

    function hideMainViews() {
        document.querySelector('.booster-selection')?.classList.add('hidden');
        document.getElementById('opening-area')?.classList.add('hidden');
        document.querySelector('.stats-panel')?.classList.add('hidden');
        document.querySelector('.admin-dashboard')?.classList.add('hidden');
        document.querySelector('.collection-panel')?.classList.add('hidden');
        document.querySelector('.party-panel')?.classList.add('hidden');
    }

    function showPanel() {
        ensurePanel();
        hideMainViews();
        render();
        panel.classList.remove('hidden');
    }

    function getGenerationNames(settings) {
        const app = getApp();
        if (settings.generation === 'gen1' && app?.getCurrentSetPokemonNames) {
            return app.getCurrentSetPokemonNames();
        }

        return [];
    }

    async function getCandidates(settings) {
        const names = getGenerationNames(settings);

        if (!names.length || typeof window.loadMiniGameCardsForPokemonNames !== 'function') {
            return [];
        }

        try {
            const cards = await window.loadMiniGameCardsForPokemonNames(names);
            return cards.length ? cards : [];
        } catch (error) {
            console.warn('[Pokemon Shots] Chargement Guess the card echoue.', error);
            return [];
        }
    }

    async function enrichCard(card) {
        if (typeof window.loadMiniGameCardDetails !== 'function') {
            return card;
        }

        try {
            return await window.loadMiniGameCardDetails(card);
        } catch (error) {
            console.warn('[Pokemon Shots] Detail Guess the card indisponible.', error);
            return card;
        }
    }

    function pickCardFairlyByPokemon(cards, pokemonNames) {
        if (typeof window.pickCardByPokemonWeight === 'function') {
            return window.pickCardByPokemonWeight(cards, pokemonNames);
        }

        return cards[Math.floor(Math.random() * cards.length)] || null;
    }

    function getImageUrl(card) {
        return card?.imageUrl || `assets/images/cards/151/${card?.id}.jpg`;
    }

    function normalizeText(value) {
        return getApp()?.normalizeGuessText?.(value) || String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function getBaseName(name) {
        return getApp()?.getBasePokemonName?.(name) || String(name || '')
            .replace(/\s*[- ](?:ex|v|vmax|vstar|gx|lv\.?\s*x)$/i, '')
            .trim();
    }

    function isCorrectGuess(guess) {
        const normalizedGuess = normalizeText(guess);
        const validAnswers = [
            currentCard?.answerName,
            currentCard?.name,
            getBaseName(currentCard?.name)
        ].map(normalizeText);

        return Boolean(normalizedGuess && validAnswers.includes(normalizedGuess));
    }

    function render() {
        const settings = loadSettings();
        panel.innerHTML = `
            <div class="guess-card-header">
                <div>
                    <p>Mini-jeu</p>
                    <h2>Guess the card</h2>
                </div>
                <button type="button" id="guess-card-back">Retour aux boosters</button>
            </div>
            <section class="guess-card-settings">
                <label>
                    <span>Generation</span>
                    <select name="generation">
                        <option value="gen1" ${settings.generation === 'gen1' ? 'selected' : ''}>1G - 151 Pokemon</option>
                    </select>
                </label>
                <label>
                    <span>Pixelisation de depart</span>
                    <input type="number" name="pixelation" min="6" max="40" step="1" value="${settings.pixelation}">
                </label>
                <button type="button" id="guess-card-start">Nouvelle carte</button>
            </section>
            <section class="guess-card-stage">
                <p class="guess-card-empty">Lance une carte pour commencer.</p>
            </section>
        `;

        bindStaticEvents();
    }

    function collectSettings() {
        return saveSettings({
            generation: panel.querySelector('[name="generation"]')?.value || DEFAULT_SETTINGS.generation,
            pixelation: panel.querySelector('[name="pixelation"]')?.value || DEFAULT_SETTINGS.pixelation
        });
    }

    function bindStaticEvents() {
        panel.querySelector('#guess-card-back')?.addEventListener('click', () => {
            panel.classList.add('hidden');
            getApp()?.showSet151View?.();
        });

        panel.querySelector('#guess-card-start')?.addEventListener('click', startRound);
        panel.querySelectorAll('.guess-card-settings input, .guess-card-settings select').forEach(input => {
            input.addEventListener('change', collectSettings);
        });
    }

    function renderSuggestions(input, suggestions, answerOptions) {
        const query = normalizeText(input.value);
        if (!query) {
            suggestions.innerHTML = '';
            return;
        }

        const matches = answerOptions
            .filter(name => {
                const normalizedName = normalizeText(name);
                return !rejectedAnswers.has(normalizedName) && normalizedName.includes(query);
            })
            .slice(0, 8);

        suggestions.innerHTML = matches.map(name => `
            <button type="button" role="option" data-suggestion="${name}">${name}</button>
        `).join('');
    }

    function pixelateCurrentCard() {
        const img = panel.querySelector('.guess-card-image img');
        if (!img || !currentCard) {
            return;
        }

        const imageUrl = getImageUrl(currentCard);
        img.onerror = () => handleImageError(img, currentCard);
        getApp()?.pixelateMiniGameImage?.(img, imageUrl, currentPixelation);
    }

    async function startRound() {
        const settings = collectSettings();
        const stage = panel.querySelector('.guess-card-stage');
        stage.innerHTML = '<p class="guess-card-empty">Chargement de la carte...</p>';

        const pokemonNames = getGenerationNames(settings);
        const candidates = await getCandidates(settings);
        currentCard = await enrichCard(pickCardFairlyByPokemon(candidates, pokemonNames));

        if (!currentCard) {
            stage.innerHTML = '<p class="guess-card-empty">Impossible de charger une carte pour le moment.</p>';
            return;
        }

        currentPixelation = settings.pixelation;
        rejectedAnswers = new Set();
        attempts = 0;
        renderRound(settings);
        pixelateCurrentCard();
    }

    function renderRound(settings) {
        const answerOptions = getGenerationNames(settings);
        const stage = panel.querySelector('.guess-card-stage');
        stage.innerHTML = `
            <div class="guess-card-play">
                <div class="guess-card-image">
                    <img class="is-pixelated" src="${getImageUrl(currentCard)}" alt="Carte mystere">
                </div>
                <div class="guess-card-content">
                    <p>Generation 1</p>
                    <h3>Quel Pokemon est sur cette carte ?</h3>
                    <span class="guess-card-attempts">Essais illimites</span>
                    <form class="guess-card-form">
                        <label>
                            <span>Nom du Pokemon</span>
                            <input type="search" autocomplete="off" required>
                        </label>
                        <div class="guess-card-suggestions" role="listbox"></div>
                        <div class="guess-card-actions">
                            <button type="submit">Valider</button>
                            <button type="button" id="guess-card-reveal">Reveler</button>
                        </div>
                    </form>
                    <p class="guess-card-feedback" aria-live="polite"></p>
                </div>
            </div>
        `;

        const form = stage.querySelector('.guess-card-form');
        const input = stage.querySelector('input');
        const suggestions = stage.querySelector('.guess-card-suggestions');
        const feedback = stage.querySelector('.guess-card-feedback');
        const attemptsElement = stage.querySelector('.guess-card-attempts');

        input.addEventListener('input', () => renderSuggestions(input, suggestions, answerOptions));
        input.addEventListener('focus', () => renderSuggestions(input, suggestions, answerOptions));
        suggestions.addEventListener('click', event => {
            const button = event.target.closest('[data-suggestion]');
            if (!button) {
                return;
            }

            input.value = button.dataset.suggestion;
            suggestions.innerHTML = '';
            input.focus();
        });

        form.addEventListener('submit', event => {
            event.preventDefault();
            const answer = input.value.trim();
            if (!answer) {
                return;
            }

            attempts++;

            if (isCorrectGuess(answer)) {
                revealAnswer(true);
                return;
            }

            rejectedAnswers.add(getRejectedAnswerKey(answer, answerOptions));
            currentPixelation = Math.min(90, currentPixelation + 7);
            attemptsElement.textContent = `${attempts} essai${attempts > 1 ? 's' : ''}`;
            feedback.textContent = 'Pas celle-la. La carte devient un peu plus nette.';
            input.value = '';
            renderSuggestions(input, suggestions, answerOptions);
            pixelateCurrentCard();
            input.focus();
        });

        stage.querySelector('#guess-card-reveal')?.addEventListener('click', () => revealAnswer(false));

        input.focus();
    }

    function getRejectedAnswerKey(answer, answerOptions) {
        const normalizedAnswer = normalizeText(answer);
        const matchingOption = answerOptions.find(name => normalizeText(name) === normalizedAnswer);
        return normalizeText(matchingOption || answer);
    }

    function revealAnswer(success) {
        const image = panel.querySelector('.guess-card-image img');
        const content = panel.querySelector('.guess-card-content');
        const priceMarkup = renderCardmarketPriceMarkup?.(currentCard, 'mini-card-price') || '';
        const setDetails = [
            currentCard.setName,
            currentCard.localId ? `#${currentCard.localId}` : null,
            currentCard.rarity
        ].filter(Boolean).join(' - ');

        if (image) {
            image.classList.remove('is-pixelated');
            image.src = image.dataset.fullSrc || getImageUrl(currentCard);
        }

        content.innerHTML = `
            <p>${success ? 'Trouve !' : 'Reponse'}</p>
            <h3>${currentCard.answerName || getBaseName(currentCard.name)}</h3>
            <div class="party-mini-game-card-meta">
                <strong>${currentCard.name}</strong>
                ${setDetails ? `<span>${setDetails}</span>` : ''}
                ${priceMarkup}
            </div>
            <span>${attempts} essai${attempts > 1 ? 's' : ''}</span>
            <button type="button" id="guess-card-next">Nouvelle carte</button>
        `;

        content.querySelector('#guess-card-next')?.addEventListener('click', startRound);
    }

    document.addEventListener('DOMContentLoaded', () => {
        ensurePanel();
    });
})();
