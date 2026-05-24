/**
 * Script principal de l'application Pokemon Shots.
 *
 * Les dépendances sont chargées par des balises <script> classiques dans index.html afin
 * que l'application fonctionne aussi lorsqu'elle est ouverte directement en file://.
 */

// Application principale
const SOLO_STATS_STORAGE_KEY = 'pokemonShotsSoloStats';
const SOLO_STATS_INACTIVITY_LIMIT = 7 * 60 * 60 * 1000;

class PokemonShotsApp {
    constructor() {
        this.boosterOpener = null;
        this.elements = this.cacheElements();
        this.isInitialized = false;
        this.currentBoosterCards = [];
        this.currentCardIndex = 0;
        this.currentBoosterData = [];
        this.currentBoosterIsParty = false;
        this.currentBoosterPartyScored = false;
        this.currentPartyBoosterOpener = null;
        this.currentPartyOpeningLockId = null;
        this.currentPartyMiniGameResult = null;
        this.partyMiniGameActive = false;
        this.partyBoosterSelectionActive = false;
        this.partyMiniGameContinueButton = null;
        this.partyMiniGamePassButton = null;
        this.openingIntroTimeout = null;
        this.currentBoosterImagesReady = Promise.resolve();
        this.suppressNextOpeningClick = false;
        this.displayedStatsLastUsedAt = 0;
        this.displayedStats = this.loadDisplayedStats();
        this.currentAccountUsername = null;
    }

    initDisplayedStats() {
        return {
            opened: 0,
            doubleRare: 0,
            ultraRare: 0,
            illustrationRare: 0,
            specialIllustrationRare: 0,
            hyperRare: 0
        };
    }

    loadDisplayedStats() {
        try {
            const saved = JSON.parse(localStorage.getItem(SOLO_STATS_STORAGE_KEY));
            const lastUsedAt = Number(saved?.lastUsedAt) || 0;

            if (!saved?.stats || Date.now() - lastUsedAt > SOLO_STATS_INACTIVITY_LIMIT) {
                localStorage.removeItem(SOLO_STATS_STORAGE_KEY);
                return this.initDisplayedStats();
            }

            this.displayedStatsLastUsedAt = lastUsedAt;
            return {
                ...this.initDisplayedStats(),
                ...saved.stats
            };
        } catch (error) {
            localStorage.removeItem(SOLO_STATS_STORAGE_KEY);
            return this.initDisplayedStats();
        }
    }

    saveDisplayedStats() {
        this.displayedStatsLastUsedAt = Date.now();
        localStorage.setItem(SOLO_STATS_STORAGE_KEY, JSON.stringify({
            stats: this.displayedStats,
            lastUsedAt: this.displayedStatsLastUsedAt
        }));
    }

    ensureDisplayedStatsFresh() {
        if (
            this.displayedStatsLastUsedAt &&
            Date.now() - this.displayedStatsLastUsedAt > SOLO_STATS_INACTIVITY_LIMIT
        ) {
            this.displayedStats = this.initDisplayedStats();
            localStorage.removeItem(SOLO_STATS_STORAGE_KEY);
            this.currentBoosterCards.forEach(cardElement => {
                delete cardElement.dataset.statsRecorded;
            });
            this.refreshDisplayedStats();
        }
    }

    /**
     * Récupère et met en cache les éléments DOM fréquemment utilisés
     * @returns {Object} Éléments DOM
     */
    cacheElements() {
        return {
            openButton: document.querySelector('.open-button'),
            boosterSelection: document.querySelector('.booster-selection'),
            openingArea: document.getElementById('opening-area'),
            cardsContainer: document.querySelector('.cards-container'),
            revealAllButton: document.getElementById('reveal-all'),
            newBoosterButton: document.getElementById('new-booster'),
            statsPanel: document.querySelector('.stats-panel'),
            loadingIndicator: document.getElementById('loading-indicator'),
            boosterImg: document.getElementById('booster-img'),
            set151Link: document.querySelector('nav li.active a')
        };
    }

    /**
     * Initialise l'application
     */
    async init() {
        if (this.isInitialized) return;

        // Masquer l'indicateur de chargement par défaut
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.style.display = 'none';
        }

        if (this.elements.revealAllButton) {
            this.elements.revealAllButton.setAttribute('aria-label', 'Afficher le récapitulatif avec la barre Espace');
            const revealLabel = this.elements.revealAllButton.querySelector('span');
            if (revealLabel) {
                revealLabel.textContent = 'Récap';
            }
        }

        // Générer l'image du booster
        if (this.elements.boosterImg) {
            this.elements.boosterImg.onerror = () => {
                this.elements.boosterImg.onerror = null;
                this.elements.boosterImg.src = generateBoosterImage();
            };
            this.elements.boosterImg.src = 'assets/images/booster_151.jpg';
        }

        // Générer le dos de carte dynamiquement
        generateCardBack();

        // Initialiser d'abord avec les données statiques pour une utilisation immédiate
        this.initBoosterOpener(window.pokemon151Data);

        // Configurer les événements
        this.setupEventListeners();

        if (window.accounts) {
            await window.accounts.init({
                onSessionChange: (user) => this.handleAccountSessionChange(user)
            });
        }

        if (window.partyMode) {
            await window.partyMode.init({ app: this });
        }

        // Initialiser le panneau de statistiques
        initializeStatsPanel();
        this.refreshDisplayedStats();

        // Initialiser le zoom de carte
        initCardZoom();

        // Charger les données complètes en arrière-plan
        this.loadCardDataInBackground();

        this.isInitialized = true;
        this.placeStatsPanelAfterRecap();
        this.updateOpeningControls();
        this.updateAccountDependentUi();
        this.updatePartyOpenerPreview();
    }

    updateAccountDependentUi() {
        if (!this.elements.openButton) {
            return;
        }

        const partyOpeningBlocked = Boolean(
            this.partyBoosterSelectionActive &&
            window.partyMode?.isActive?.() &&
            !window.partyMode?.canCurrentUserOpenCurrentBooster?.()
        );
        this.elements.openButton.disabled = !this.boosterOpener || partyOpeningBlocked;

        if (this.boosterOpener) {
            this.elements.openButton.textContent = this.partyBoosterSelectionActive && window.partyMode?.isActive?.()
                ? 'Ouvrir le booster soirée'
                : 'Ouvrir un booster';
        }
    }

    updatePartyOpenerPreview() {
        if (!this.elements.boosterSelection) {
            return;
        }

        this.elements.boosterSelection.querySelector('.party-selection-opener')?.remove();

        if (!this.partyBoosterSelectionActive || !window.partyMode?.isActive?.()) {
            this.updateAccountDependentUi();
            return;
        }

        const openerBanner = this.createPartyOpenerBanner('Booster soirée pour', { force: true });
        const boosterContainer = this.elements.boosterSelection.querySelector('.booster-container');

        if (openerBanner && boosterContainer) {
            openerBanner.classList.add('party-selection-opener');
            boosterContainer.before(openerBanner);
        }

        this.updateAccountDependentUi();
    }

    placeStatsPanelAfterRecap() {
        if (!this.elements.statsPanel || !this.elements.cardsContainer) {
            return;
        }

        this.elements.cardsContainer.after(this.elements.statsPanel);
    }

    updateOpeningControls() {
        if (!this.elements.revealAllButton || !this.elements.cardsContainer) {
            return;
        }

        const isRecapVisible = this.elements.cardsContainer.classList.contains('recap-grid');
        this.elements.revealAllButton.classList.toggle('hidden', isRecapVisible);
    }

    handleAccountSessionChange(user) {
        const nextUsername = user?.username || null;
        const partyPanel = document.querySelector('.party-panel');
        const wasOnPartyPanel = Boolean(partyPanel && !partyPanel.classList.contains('hidden'));
        const hasSecondaryViewVisible = Boolean(
            document.querySelector('.admin-dashboard:not(.hidden), .collection-panel:not(.hidden), .party-panel:not(.hidden), .guess-card-panel:not(.hidden)')
        );

        if (nextUsername !== this.currentAccountUsername) {
            this.currentAccountUsername = nextUsername;
            this.resetOpeningArea();
            this.resetDisplayedStats();

            if (this.elements.openingArea) {
                this.elements.openingArea.classList.add('hidden');
            }

            if (this.elements.boosterSelection) {
                this.elements.boosterSelection.classList.toggle('hidden', hasSecondaryViewVisible);
            }

            if (this.elements.statsPanel && !nextUsername) {
                this.elements.statsPanel.classList.add('hidden');
            }

            if (wasOnPartyPanel) {
                window.partyMode?.refreshForSessionChange?.({ keepPanelVisible: true });
            }
        }

        this.updateAccountDependentUi();
    }

    /**
     * Configure les écouteurs d'événements
     */
    setupEventListeners() {
        // Ouvrir un booster
        this.elements.openButton.addEventListener('click', () => {
            this.openBooster({ party: this.partyBoosterSelectionActive });
        });

        // Révéler toutes les cartes
        this.elements.revealAllButton.addEventListener('click', () => this.revealAllBoosterCards());

        // Ouvrir un nouveau booster
        this.elements.newBoosterButton.addEventListener('click', () => this.openNewBooster());

        if (this.elements.set151Link) {
            this.elements.set151Link.addEventListener('click', (event) => {
                event.preventDefault();
                this.showSet151View();
            });
        }

        this.elements.cardsContainer.addEventListener('click', (event) => {
            if (this.suppressNextOpeningClick) {
                this.suppressNextOpeningClick = false;
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        }, true);

        this.elements.cardsContainer.addEventListener('pointerdown', (event) => {
            if (event.target.closest('.pack-opening-intro')) {
                event.preventDefault();
                event.stopImmediatePropagation();
                this.suppressNextOpeningClick = true;
                this.currentBoosterImagesReady.finally(() => {
                    this.showCurrentBoosterCard();
                });
                return;
            }

            if (
                this.elements.cardsContainer.classList.contains('opening-sequence') &&
                event.target.closest('.card')
            ) {
                event.preventDefault();
                event.stopImmediatePropagation();
                this.suppressNextOpeningClick = true;
                this.advanceBoosterCard();
            }
        });

        // Raccourcis clavier pour accélérer l'ouverture des boosters
        document.addEventListener('keydown', (event) => this.handleKeyboardShortcuts(event));
    }

    /**
     * Revient a l'ecran principal du set 151.
     * Une ouverture solo en cours est conservee, mais une ouverture soiree
     * est fermee pour permettre de relancer des boosters personnels.
     */
    showSet151View() {
        this.partyBoosterSelectionActive = false;
        document.querySelector('.admin-dashboard')?.classList.add('hidden');
        document.querySelector('.collection-panel')?.classList.add('hidden');
        document.querySelector('.party-panel')?.classList.add('hidden');
        document.querySelector('.guess-card-panel')?.classList.add('hidden');

        if (this.currentBoosterIsParty) {
            this.resetOpeningArea();
            this.elements.openingArea?.classList.add('hidden');
            this.elements.boosterSelection?.classList.remove('hidden');
            this.updatePartyOpenerPreview();
            return;
        }

        const hasOpeningContent = Boolean(
            this.elements.cardsContainer?.querySelector('.card, .pack-opening-intro')
        );

        if (this.elements.openingArea && hasOpeningContent) {
            this.elements.boosterSelection?.classList.add('hidden');
            this.elements.openingArea.classList.remove('hidden');

            if (this.elements.cardsContainer.classList.contains('recap-grid')) {
                this.showStatsAfterSummary();
                setupCardZoomEvents();
            }

            this.updateOpeningControls();
            return;
        }

        this.elements.openingArea?.classList.add('hidden');
        this.elements.boosterSelection?.classList.remove('hidden');
        this.updatePartyOpenerPreview();
    }

    showPartyBoosterSelection() {
        this.partyBoosterSelectionActive = Boolean(window.partyMode?.isActive?.());
        this.resetOpeningArea();
        document.querySelector('.admin-dashboard')?.classList.add('hidden');
        document.querySelector('.collection-panel')?.classList.add('hidden');
        document.querySelector('.party-panel')?.classList.add('hidden');
        document.querySelector('.guess-card-panel')?.classList.add('hidden');
        this.elements.openingArea?.classList.add('hidden');
        this.elements.statsPanel?.classList.add('hidden');
        this.elements.boosterSelection?.classList.remove('hidden');
        this.updatePartyOpenerPreview();
    }

    /**
     * Gère les raccourcis clavier de la zone d'ouverture.
     * @param {KeyboardEvent} event - Evénement clavier
     */
    handleKeyboardShortcuts(event) {
        if (
            event.defaultPrevented ||
            event.repeat ||
            !this.isOpeningAreaVisible()
        ) {
            return;
        }

        if (this.partyMiniGameActive) {
            if (event.code === 'Space') {
                event.preventDefault();
                if (this.partyMiniGameContinueButton) {
                    this.partyMiniGameContinueButton.click();
                } else {
                    this.partyMiniGamePassButton?.click();
                }
            }
            return;
        }

        if (this.isShortcutContextBlocked(event.target)) {
            return;
        }

        if (event.code === 'Space') {
            event.preventDefault();
            this.showBoosterSummary();
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            this.openNewBooster();
        }
    }

    /**
     * Indique si les raccourcis clavier doivent être ignorés.
     * @param {EventTarget} target - Elément ciblé par l'événement clavier
     * @returns {boolean}
     */
    isShortcutContextBlocked(target) {
        if (!(target instanceof Element)) {
            return false;
        }

        const interactiveTags = ['INPUT', 'TEXTAREA', 'SELECT'];

        return (
            target.isContentEditable ||
            interactiveTags.includes(target.tagName) ||
            Boolean(target.closest('.stats-panel, #card-overlay.show'))
        );
    }

    /**
     * Indique si la zone d'ouverture des cartes est affichée.
     * @returns {boolean}
     */
    isOpeningAreaVisible() {
        return (
            this.elements.openingArea &&
            !this.elements.openingArea.classList.contains('hidden')
        );
    }

    /**
     * Initialise le générateur de booster avec les données fournies
     * @param {Array} cardsData - Données des cartes
     */
    initBoosterOpener(cardsData) {
        this.boosterOpener = new BoosterOpener(cardsData);
        window.boosterOpener = this.boosterOpener; // Pour l'accès global
        
        // Activer le bouton d'ouverture
        this.updateAccountDependentUi();
        window.accounts?.refreshCollection?.();
    }

    /**
     * Charge les données des cartes en arrière-plan
     */
    async loadCardDataInBackground() {
        try {
            // Afficher l'indicateur de chargement
            if (this.elements.loadingIndicator) {
                this.elements.loadingIndicator.style.display = 'flex';
            }
            
            // Garder le bouton utilisable avec les données statiques pendant le chargement API.
            if (this.elements.openButton) {
                this.updateAccountDependentUi();
            }
            
            // S'abonner aux mises à jour de progression
            if (window.loadingProgress) {
                window.loadingProgress.onUpdate((percentage) => {
                    // Mettre à jour le texte du bouton avec la progression
                    if (this.elements.openButton && window.accounts?.getCurrentUser()) {
                        this.elements.openButton.textContent = `Ouvrir un booster (sync ${percentage}%)`;
                    }
                });
            }
            
            // Charger les données complètes
            if (typeof window.loadPokemon151Data === 'function') {
                const cardsData = await window.loadPokemon151Data();
                
                // Vérifier si les données ont été chargées avec succès
                if (cardsData && Array.isArray(cardsData) && cardsData.length > 0) {
                    // Mettre à jour l'ouvreur de boosters avec les données complètes.
                    this.initBoosterOpener(cardsData);
                    window.accounts?.refreshCardPricesFromSetData?.(cardsData);
                    
                    // Activer le bouton
                    if (this.elements.openButton) {
                        this.updateAccountDependentUi();
                    }
                } else {
                    console.error("Erreur: Données de l'API invalides ou vides");
                    this.useLocalFallback('Données API invalides, utilisation des données locales.');
                }
            } else {
                this.useLocalFallback('API indisponible, utilisation des données locales.');
            }
        } catch (error) {
            console.error("Erreur lors du chargement des données:", error);
            
            this.useLocalFallback('Erreur API, utilisation des données locales.');
        }
    }


    /**
     * Conserve l'application utilisable lorsque l'API distante est indisponible.
     * @param {string} message - Message court affiché dans la console.
     */
    useLocalFallback(message) {
        console.warn(message);

        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.style.display = 'none';
        }

        if (this.elements.openButton) {
            this.updateAccountDependentUi();
        }
    }

    /**
     * Ouvre un booster et affiche les cartes
     */
    async openBooster(options = {}) {
        // Vérifier que l'ouvreur de boosters est initialisé
        if (!this.boosterOpener) {
            alert('Erreur: Impossible d\'ouvrir un booster pour le moment.');
            return;
        }
        const isPartyBooster = Boolean(options.party && window.partyMode?.isActive());
        this.partyBoosterSelectionActive = false;
        let partyOpeningLock = null;

        if (isPartyBooster) {
            partyOpeningLock = await window.partyMode?.claimOpeningLock?.();

            if (!partyOpeningLock) {
                alert("Ce n'est pas a cet ecran d'ouvrir le booster.");
                window.partyMode?.refreshForSessionChange?.({ keepPanelVisible: true });
                return;
            }
        }

        if (!isPartyBooster) {
            this.ensureDisplayedStatsFresh();
        }

        // Générer un nouveau booster, ou consommer le booster debug préparé par l'admin.
        const booster = window.accounts?.consumeDebugNextBooster?.(this.boosterOpener) || this.boosterOpener.generateBooster();
        this.currentBoosterData = booster;
        this.currentBoosterIsParty = isPartyBooster;
        this.currentBoosterPartyScored = false;
        this.currentPartyBoosterOpener = isPartyBooster
            ? (window.partyMode?.getCurrentOpener?.()?.username || null)
            : null;
        this.currentPartyOpeningLockId = partyOpeningLock?.id || null;
        this.currentPartyMiniGameResult = null;
        this.partyMiniGameActive = false;

        if (!isPartyBooster) {
            window.accounts?.recordBooster(booster, window.accounts?.getCurrentUser?.()?.username);
        }
        
        // Vider le conteneur de cartes
        this.elements.cardsContainer.innerHTML = '';
        document.querySelector('.party-inline-result')?.remove();
        this.elements.cardsContainer.classList.remove('recap-grid');
        this.elements.cardsContainer.classList.add('opening-sequence');
        this.updateOpeningControls();
        
        // Créer et ajouter les cartes au DOM
        this.currentBoosterCards = renderBoosterCards(booster, null);
        this.applyPartyOwnershipBadges(booster, this.currentBoosterCards);
        this.applyPartyX2Badges(booster, this.currentBoosterCards);
        this.currentCardIndex = 0;
        this.currentBoosterImagesReady = this.preloadBoosterImages(this.currentBoosterCards);

        if (!this.currentBoosterIsParty) {
            this.displayedStats.opened++;
            this.saveDisplayedStats();
            this.refreshDisplayedStats();
        }
        
        // Afficher la zone d'ouverture et masquer la sélection de booster
        this.elements.boosterSelection.classList.add('hidden');
        this.elements.openingArea.classList.remove('hidden');
        
        this.elements.statsPanel.classList.add('hidden');
        
        if (this.shouldStartPartyMiniGame()) {
            this.startPartyMiniGame();
        } else {
            this.startSequentialOpening();
        }
    }

    shouldStartPartyMiniGame() {
        return Boolean(
            this.currentBoosterIsParty &&
            window.partyMode?.isMiniGameEnabled?.() &&
            this.getCurrentSetPokemonNames().length
        );
    }

    getCurrentSetPokemonNames() {
        const cards = this.boosterOpener?.setData || [];
        const seen = new Set();

        return cards
            .filter(card => {
                const type = this.normalizeGuessText(card.type);
                const rarity = this.normalizeGuessText(card.rarity);
                const mappedRarity = this.boosterOpener?.getMappedRarity?.(card);

                return (
                    card?.name &&
                    !type.includes('dresseur') &&
                    !type.includes('trainer') &&
                    !type.includes('energie') &&
                    !type.includes('energy') &&
                    mappedRarity !== 'trainer' &&
                    mappedRarity !== 'energy' &&
                    rarity !== 'trainer' &&
                    rarity !== 'energy'
                );
            })
            .map(card => this.getBasePokemonName(card.name))
            .filter(name => {
                const key = this.normalizeGuessText(name);
                if (!key || seen.has(key)) {
                    return false;
                }

                seen.add(key);
                return true;
            })
            .sort((a, b) => a.localeCompare(b, 'fr'));
    }

    async getPartyMiniGameCandidates() {
        const pokemonNames = this.getCurrentSetPokemonNames();

        if (typeof window.loadMiniGameCardsForPokemonNames !== 'function') {
            return this.getFallbackPartyMiniGameCandidates();
        }

        try {
            const cards = await window.loadMiniGameCardsForPokemonNames(pokemonNames);
            return cards.length ? cards : this.getFallbackPartyMiniGameCandidates();
        } catch (error) {
            console.warn('[Pokemon Shots] Chargement des cartes du mini-jeu echoue.', error);
            return this.getFallbackPartyMiniGameCandidates();
        }
    }

    getFallbackPartyMiniGameCandidates() {
        const cards = this.boosterOpener?.setData || [];
        const names = new Set(this.getCurrentSetPokemonNames().map(name => this.normalizeGuessText(name)));

        return cards.filter(card => names.has(this.normalizeGuessText(this.getBasePokemonName(card.name))));
    }

    getPartyMiniGameAnswerOptions() {
        return this.getCurrentSetPokemonNames();
    }

    pickPartyMiniGameCard(candidates, pokemonNames = this.getCurrentSetPokemonNames()) {
        if (typeof window.pickCardByPokemonWeight === 'function') {
            return window.pickCardByPokemonWeight(candidates, pokemonNames);
        }

        return candidates[Math.floor(Math.random() * candidates.length)] || null;
    }

    async enrichPartyMiniGameCard(card) {
        if (typeof window.loadMiniGameCardDetails !== 'function') {
            return card;
        }

        try {
            return await window.loadMiniGameCardDetails(card);
        } catch (error) {
            console.warn('[Pokemon Shots] Detail de la carte du mini-jeu indisponible.', error);
            return card;
        }
    }

    getCardImageUrl(card) {
        return card?.imageUrl || `assets/images/cards/151/${card?.id}.jpg`;
    }

    pixelateMiniGameImage(img, imageUrl, pixelWidth = 14) {
        const source = new Image();
        if (/^https?:/i.test(imageUrl)) {
            source.crossOrigin = 'anonymous';
        }

        source.onload = () => {
            try {
                const safePixelWidth = Math.max(4, Math.round(Number(pixelWidth) || 14));
                const pixelHeight = Math.max(6, Math.round(safePixelWidth * 230 / 165));
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = safePixelWidth;
                canvas.height = pixelHeight;
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(source, 0, 0, pixelWidth, pixelHeight);
                img.src = canvas.toDataURL('image/png');
                img.dataset.fullSrc = imageUrl;
            } catch (error) {
                img.dataset.fullSrc = imageUrl;
            }
        };

        source.onerror = () => {
            img.dataset.fullSrc = imageUrl;
        };
        source.src = imageUrl;
    }


    getBasePokemonName(name) {
        return String(name || '')
            .replace(/\s*[- ](?:ex|v|vmax|vstar|gx|lv\.?\s*x)$/i, '')
            .replace(/\s*\(.*?\)\s*$/i, '')
            .trim();
    }

    normalizeGuessText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    isCorrectMiniGameGuess(guess, card) {
        const normalizedGuess = this.normalizeGuessText(guess);
        const validAnswers = [
            card.answerName,
            card.name,
            this.getBasePokemonName(card.name)
        ].map(answer => this.normalizeGuessText(answer));

        return Boolean(normalizedGuess && validAnswers.includes(normalizedGuess));
    }

    async startPartyMiniGame() {
        this.clearOpeningIntroTimeout();
        this.partyMiniGameActive = true;
        this.partyMiniGameContinueButton = null;
        this.partyMiniGamePassButton = null;
        this.elements.openingArea?.classList.add('party-mini-game-active');
        this.elements.cardsContainer.innerHTML = `
            <div class="party-mini-game">
                <section class="party-mini-game-dialog">
                    <div class="party-mini-game-content">
                        <p>Mini-jeu</p>
                        <h2>Chargement de la carte mystere...</h2>
                        <span>On pioche dans toutes les cartes TCGdex du Pokemon.</span>
                    </div>
                </section>
            </div>
        `;
        this.elements.cardsContainer.classList.add('opening-sequence');
        this.elements.cardsContainer.classList.remove('recap-grid');
        this.updateOpeningControls();

        const candidates = await this.getPartyMiniGameCandidates();
        let card = this.pickPartyMiniGameCard(candidates);

        if (!card) {
            this.partyMiniGameActive = false;
            this.elements.openingArea?.classList.remove('party-mini-game-active');
            this.startSequentialOpening();
            return;
        }

        card = await this.enrichPartyMiniGameCard(card);

        this.elements.cardsContainer.innerHTML = '';

        let attemptsLeft = 2;
        let attemptsUsed = 0;
        let lastAnswer = '';
        const rejectedAnswers = new Set();
        const answerOptions = this.getPartyMiniGameAnswerOptions();
        const stage = document.createElement('div');
        stage.className = 'party-mini-game';

        const openerBanner = this.createPartyOpenerBanner('Mini-jeu pour', { force: true });
        if (openerBanner) {
            stage.appendChild(openerBanner);
        }

        const imageUrl = this.getCardImageUrl(card);
        stage.insertAdjacentHTML('beforeend', `
            <section class="party-mini-game-dialog">
                <div class="party-mini-game-card">
                    <img class="is-pixelated" src="${imageUrl}" alt="Carte mystere">
                </div>
                <div class="party-mini-game-content">
                    <p>Mini-jeu</p>
                    <h2>Quel Pokemon est sur cette carte ?</h2>
                    <span class="party-mini-game-attempts">2 tentatives restantes</span>
                    <form class="party-mini-game-form">
                        <label>
                            <span>Nom du Pokemon</span>
                            <input type="search" autocomplete="off" required>
                        </label>
                        <div class="party-mini-game-suggestions" role="listbox"></div>
                        <div class="party-mini-game-actions">
                            <button type="submit">Valider</button>
                            <button type="button" class="party-mini-game-pass">Passer</button>
                        </div>
                    </form>
                    <p class="party-mini-game-feedback" aria-live="polite"></p>
                </div>
            </section>
        `);

        this.elements.cardsContainer.appendChild(stage);

        const form = stage.querySelector('.party-mini-game-form');
        const input = stage.querySelector('input');
        const attempts = stage.querySelector('.party-mini-game-attempts');
        const feedback = stage.querySelector('.party-mini-game-feedback');
        const suggestions = stage.querySelector('.party-mini-game-suggestions');
        this.partyMiniGamePassButton = stage.querySelector('.party-mini-game-pass');
        const mysteryImage = stage.querySelector('.party-mini-game-card img');
        if (mysteryImage) {
            mysteryImage.onerror = () => handleImageError(mysteryImage, card);
            this.pixelateMiniGameImage(
                mysteryImage,
                imageUrl,
                window.partyMode?.getMiniGamePixelation?.() || 14
            );
        }

        const renderSuggestions = () => {
            const query = this.normalizeGuessText(input.value);
            if (!query) {
                suggestions.innerHTML = '';
                return;
            }

            const matches = answerOptions
                .filter(name => {
                    const normalizedName = this.normalizeGuessText(name);
                    return !rejectedAnswers.has(normalizedName) && normalizedName.includes(query);
                })
                .slice(0, 8);

            suggestions.innerHTML = matches.map(name => `
                <button type="button" role="option" data-suggestion="${name}">${name}</button>
            `).join('');
        };

        input.addEventListener('input', renderSuggestions);
        input.addEventListener('focus', renderSuggestions);
        suggestions.addEventListener('click', (event) => {
            const button = event.target.closest('[data-suggestion]');
            if (!button) {
                return;
            }

            input.value = button.dataset.suggestion;
            suggestions.innerHTML = '';
            input.focus();
        });
        renderSuggestions();

        const finish = (success, answer = '') => {
            this.finishPartyMiniGame(stage, card, {
                success,
                attemptsUsed,
                answer
            });
        };

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const answer = input.value.trim();
            if (!answer) {
                return;
            }

            attemptsUsed++;
            lastAnswer = answer;

            if (this.isCorrectMiniGameGuess(answer, card)) {
                finish(true, answer);
                return;
            }

            rejectedAnswers.add(this.getRejectedAnswerKey(answer, answerOptions));
            attemptsLeft--;
            if (attemptsLeft <= 0) {
                finish(false, answer);
                return;
            }

            attempts.textContent = '1 tentative restante';
            feedback.textContent = 'Pas celui-la. Encore une tentative.';
            input.value = '';
            renderSuggestions();
            input.focus();
        });

        this.partyMiniGamePassButton?.addEventListener('click', () => {
            finish(false, lastAnswer);
        });

        input.focus();
    }

    getRejectedAnswerKey(answer, answerOptions) {
        const normalizedAnswer = this.normalizeGuessText(answer);
        const matchingOption = answerOptions.find(name => this.normalizeGuessText(name) === normalizedAnswer);
        return this.normalizeGuessText(matchingOption || answer);
    }

    finishPartyMiniGame(stage, card, result) {
        const priceMarkup = renderCardmarketPriceMarkup?.(card, 'mini-card-price') || '';
        const setDetails = [
            card.setName,
            card.localId ? `#${card.localId}` : null,
            card.rarity
        ].filter(Boolean).join(' - ');

        this.currentPartyMiniGameResult = {
            ...result,
            card: {
                key: card.localId || card.number || card.id || card.name,
                id: card.id,
                localId: card.localId,
                name: card.answerName || this.getBasePokemonName(card.name),
                shownCardName: card.name,
                number: card.number,
                imageUrl: card.imageUrl,
                type: card.type,
                setName: card.setName || null,
                rarity: card.rarity || null
            }
        };

        const image = stage.querySelector('.party-mini-game-card img');
        const content = stage.querySelector('.party-mini-game-content');
        if (image) {
            image.classList.remove('is-pixelated');
            if (image.dataset.fullSrc) {
                image.src = image.dataset.fullSrc;
            }
        }

        if (content) {
            content.innerHTML = `
                <p>${result.success ? 'Trouve !' : 'Reponse'}</p>
                <h2>${card.answerName || this.getBasePokemonName(card.name)}</h2>
                <div class="party-mini-game-card-meta">
                    <strong>${card.name}</strong>
                    ${setDetails ? `<span>${setDetails}</span>` : ''}
                    ${priceMarkup}
                </div>
                <span>${result.success ? 'Bonus x2 gagne pour ce booster.' : 'La carte mystere est revelee avant le booster.'}</span>
                <button type="button" class="party-mini-game-continue">Ouvrir le booster</button>
            `;
        }

        this.partyMiniGamePassButton = null;
        this.partyMiniGameContinueButton = stage.querySelector('.party-mini-game-continue');
        this.partyMiniGameContinueButton?.addEventListener('click', () => {
            this.partyMiniGameActive = false;
            this.partyMiniGameContinueButton = null;
            this.elements.openingArea?.classList.remove('party-mini-game-active');
            this.startSequentialOpening();
        });
    }

    /**
     * Ajoute les badges de propriété en mode soirée.
     * @param {Array} booster - Données du booster courant.
     * @param {HTMLElement[]} cardElements - Cartes rendues dans le DOM.
     */
    applyPartyOwnershipBadges(booster, cardElements) {
        if (!this.currentBoosterIsParty) {
            return;
        }

        booster.forEach((card, index) => {
            const owner = window.partyMode.getCardOwner(card);
            const cardElement = cardElements[index];

            if (!owner || !cardElement) {
                return;
            }

            cardElement.classList.add('owned-party-card');
            const badge = document.createElement('span');
            badge.className = 'party-card-owner-badge';
            badge.textContent = owner.username;
            badge.title = `${owner.username} possède cette carte`;
            cardElement.appendChild(badge);
        });
    }

    applyPartyX2Badges(booster, cardElements) {
        if (!this.currentBoosterIsParty) {
            return;
        }

        booster.forEach((card, index) => {
            if (!window.partyMode.isX2Card?.(card)) {
                return;
            }

            const cardElement = cardElements[index];
            if (!cardElement) {
                return;
            }

            cardElement.classList.add('party-x2-pulled-card');
            const badge = document.createElement('span');
            badge.className = 'party-x2-card-badge';
            badge.textContent = 'x2';
            badge.title = 'Carte x2 de la soirée';
            cardElement.appendChild(badge);
        });
    }

    startSequentialOpening() {
        this.clearOpeningIntroTimeout();

        const stage = document.createElement('div');
        stage.className = 'single-card-stage';

        const openerBanner = this.createPartyOpenerBanner();
        if (openerBanner) {
            stage.appendChild(openerBanner);
        }

        const intro = document.createElement('div');
        intro.className = 'pack-opening-intro';

        const image = document.createElement('img');
        image.src = 'assets/images/booster_151.jpg';
        image.alt = 'Booster Pokémon 151';

        intro.appendChild(image);
        stage.appendChild(intro);
        this.elements.cardsContainer.appendChild(stage);

        this.openingIntroTimeout = setTimeout(() => {
            this.currentBoosterImagesReady.finally(() => {
                this.showCurrentBoosterCard();
            });
        }, 850);
    }

    createPartyOpenerBanner(label = 'Booster ouvert par', options = {}) {
        if (!options.force && !this.currentBoosterIsParty) {
            return null;
        }

        const opener = window.partyMode?.getCurrentOpener?.();

        if (!opener) {
            return null;
        }

        const openerBanner = document.createElement('div');
        openerBanner.className = 'party-opener-banner';
        openerBanner.innerHTML = `<span>${label}</span><strong>${opener.username}</strong>`;

        return openerBanner;
    }

    preloadBoosterImages(cardElements) {
        const imagePromises = cardElements.map(cardElement => {
            const img = cardElement.querySelector('img');

            if (!img) {
                return Promise.resolve();
            }

            const decodeImage = () => {
                if (typeof img.decode === 'function') {
                    return img.decode().catch(() => {});
                }

                return Promise.resolve();
            };

            if (img.complete) {
                return decodeImage();
            }

            return new Promise(resolve => {
                const finish = () => {
                    decodeImage().finally(resolve);
                };

                img.addEventListener('load', finish, { once: true });
                img.addEventListener('error', finish, { once: true });
            });
        });

        return Promise.all(imagePromises);
    }

    showCurrentBoosterCard() {
        this.clearOpeningIntroTimeout();
        this.elements.cardsContainer.innerHTML = '';
        this.elements.cardsContainer.classList.add('opening-sequence');
        this.elements.cardsContainer.classList.remove('recap-grid');
        this.updateOpeningControls();

        const currentCard = this.currentBoosterCards[this.currentCardIndex];

        if (!currentCard) {
            this.showBoosterSummary();
            return;
        }

        revealCard(currentCard);
        this.recordDisplayedCardStats(currentCard);

        const stage = document.createElement('div');
        stage.className = 'single-card-stage';

        const openerBanner = this.createPartyOpenerBanner();
        if (openerBanner) {
            stage.appendChild(openerBanner);
        }

        const counter = document.createElement('div');
        counter.className = 'opening-counter';
        counter.textContent = `${this.currentCardIndex + 1} / ${this.currentBoosterCards.length}`;

        stage.appendChild(currentCard);
        stage.appendChild(counter);
        this.elements.cardsContainer.appendChild(stage);
    }

    advanceBoosterCard() {
        if (!this.elements.cardsContainer.classList.contains('opening-sequence')) {
            return;
        }

        this.currentCardIndex++;

        if (this.currentCardIndex >= this.currentBoosterCards.length) {
            this.showBoosterSummary();
            return;
        }

        this.showCurrentBoosterCard();
    }

    async showBoosterSummary() {
        this.clearOpeningIntroTimeout();

        if (!this.currentBoosterCards.length) {
            return;
        }

        this.elements.cardsContainer.innerHTML = '';
        this.elements.cardsContainer.classList.remove('opening-sequence');
        this.elements.cardsContainer.classList.add('recap-grid');
        this.updateOpeningControls();

        this.currentBoosterCards.forEach(cardElement => {
            revealCard(cardElement);
            this.recordDisplayedCardStats(cardElement);
            this.elements.cardsContainer.appendChild(cardElement);
        });

        if (this.currentBoosterIsParty && !this.currentBoosterPartyScored) {
            this.currentBoosterPartyScored = true;
            await window.partyMode?.refreshFromSharedStore?.();
            const partyResult = window.partyMode.scoreBooster(this.currentBoosterData || [], {
                openerUsername: this.currentPartyBoosterOpener,
                openingLockId: this.currentPartyOpeningLockId,
                miniGameResult: this.currentPartyMiniGameResult
            });

            if (partyResult) {
                this.renderPartyResultInSummary(partyResult);
            }
        }

        this.showStatsAfterSummary();
        setupCardZoomEvents();
    }

    showStatsAfterSummary() {
        if (!this.elements.statsPanel) {
            return;
        }

        this.placeStatsPanelAfterRecap();
        const partySummary = this.currentBoosterIsParty ? (window.partyMode?.getSummary?.() || null) : null;

        updateStatsPanelMode(this.currentBoosterIsParty ? 'party' : 'solo');
        updatePartyStats(partySummary);

        if (partySummary) {
            this.refreshStatsFromSnapshot(partySummary.pullStats || this.initDisplayedStats());
        } else {
            this.refreshDisplayedStats();
        }

        this.elements.statsPanel.classList.remove('hidden', 'collapsed');
    }

    refreshPartyStatsPanel() {
        if (
            !this.currentBoosterIsParty ||
            !this.elements.statsPanel ||
            this.elements.statsPanel.classList.contains('hidden')
        ) {
            return;
        }

        updateStatsPanelMode('party');
        const partySummary = window.partyMode?.getSummary?.() || null;
        updatePartyStats(partySummary);
        this.refreshStatsFromSnapshot(partySummary?.pullStats || this.initDisplayedStats());
    }

    renderPartyResultInSummary(result) {
        if (!result) {
            return;
        }

        document.querySelector('.party-inline-result')?.remove();
        const resultElement = document.createElement('section');
        resultElement.className = 'party-inline-result';
        resultElement.innerHTML = this.getPartyResultSummaryMarkup(result);
        this.elements.cardsContainer.before(resultElement);
        this.bindPartyX2ResultControls(resultElement);
    }

    getPartyResultSummaryMarkup(result) {
        return `
            <div class="party-inline-header">
                <div class="is-current-opener">
                    <span>Booster ouvert par</span>
                    <strong>${result.opener}</strong>
                </div>
                <div>
                    <span>Prochain à ouvrir</span>
                    <strong>${result.nextOpener || '-'}</strong>
                </div>
            </div>
            <h3>Gorgées à distribuer</h3>
            ${result.everyoneDrinks ? `
                <div class="party-everyone-drinks">
                    <strong>Tout le monde boit !</strong>
                    <span>Une gorgée pour chaque joueur.</span>
                </div>
            ` : ''}
            ${this.getPartyMiniGameResultMarkup(result)}
            <div class="party-drink-grid">
                ${Object.entries(result.distribution).map(([username, drinks]) => `
                    <article>
                        <span>${username}</span>
                        <strong>${drinks}</strong>
                    </article>
                `).join('')}
            </div>
            ${this.getPartyX2ResultMarkup(result)}
        `;
    }

    getPartyMiniGameResultMarkup(result) {
        if (!result.miniGame?.card) {
            return '';
        }

        return `
            <div class="party-x2-result ${result.miniGame.success ? 'is-applied' : ''}">
                <strong>Mini-jeu: ${result.miniGame.card.name}</strong>
                <span>${result.miniGame.success ? 'Bonne reponse, un x2 est disponible sur ce booster.' : 'Pas de x2 cette fois.'}</span>
            </div>
        `;
    }

    getPartyX2ResultMarkup(result) {
        if (!result.x2?.available) {
            return '';
        }

        const totalUses = result.x2.count || 1;
        const applications = result.x2.applications || (result.x2.applied ? [{
            target: result.x2.target,
            bonus: result.x2.bonus || 0
        }] : []);
        const remainingUses = Math.max(0, totalUses - applications.length);
        const pendingLabel = totalUses > 1
            ? `${remainingUses} x2 restant${remainingUses > 1 ? 's' : ''} sur ${totalUses}`
            : `${result.x2.card.name}: 1 x2 disponible`;

        if (!remainingUses) {
            return `
                <div class="party-x2-result is-applied">
                    <strong>${totalUses} x2 appliqué${totalUses > 1 ? 's' : ''}</strong>
                    <span>${applications.map(application => `${application.target} +${application.bonus}`).join(' / ')} grâce à ${result.x2.card.name}.</span>
                    ${this.getEvolutionFamilyX2Markup(result.x2)}
                </div>
            `;
        }

        return `
            <div class="party-x2-result">
                <div>
                    <strong>${pendingLabel}</strong>
                    <span>${result.x2.decidedBy} choisit quel joueur double ses gorgées sur ce booster.</span>
                </div>
                ${this.getEvolutionFamilyX2Markup(result.x2)}
                <div class="party-x2-targets">
                    ${Object.entries(result.distribution).map(([username, drinks]) => `
                        <button type="button" class="party-x2-target" data-x2-target="${username}">
                            <span>${username}</span>
                            <strong>${drinks} -> ${drinks * 2}</strong>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    getEvolutionFamilyX2Markup(x2) {
        const families = x2?.card?.evolutionFamilies || [];

        if (!families.length) {
            return '';
        }

        return `
            <div class="party-evolution-bonus">
                ${families.map(family => `
                    <article>
                        <strong>${family.label}</strong>
                        <div class="party-evolution-cards">
                            ${family.cards.map(card => `
                                <figure>
                                    <img src="${card.imageUrl || `assets/images/cards/151/${card.id}.jpg`}" alt="${card.name}">
                                    <figcaption>${card.name}</figcaption>
                                </figure>
                            `).join('')}
                        </div>
                    </article>
                `).join('')}
            </div>
        `;
    }

    bindPartyX2ResultControls(resultElement) {
        resultElement.querySelectorAll('.party-x2-target').forEach(button => {
            button.addEventListener('click', () => {
                const updatedResult = window.partyMode?.applyX2Target?.(button.dataset.x2Target);
                this.renderPartyResultInSummary(updatedResult);
                this.showStatsAfterSummary();
            });
        });
    }

    recordDisplayedCardStats(cardElement) {
        if (this.currentBoosterIsParty) {
            return;
        }

        if (cardElement.dataset.statsRecorded === 'true') {
            return;
        }

        const specialType = cardElement.dataset.specialType;

        if (specialType && specialType in this.displayedStats) {
            this.displayedStats[specialType]++;
        } else if (cardElement.dataset.isDoubleRare === 'true') {
            this.displayedStats.doubleRare++;
        }

        cardElement.dataset.statsRecorded = 'true';
        this.saveDisplayedStats();
        this.refreshDisplayedStats();
    }

    refreshDisplayedStats() {
        updateStats(this.displayedStats);
        updatePullRates(this.getDisplayedPullRates());
    }

    refreshStatsFromSnapshot(stats) {
        updateStats(stats);
        updatePullRates(this.getPullRatesForStats(stats));
    }

    getPullRatesForStats(stats) {
        const comparison = {};
        const pullRates = BoosterOpener.PULL_RATES;

        for (const [key, expectedRate] of Object.entries(pullRates)) {
            const actualRate = stats.opened > 0
                ? (stats[key] || 0) / stats.opened
                : 0;

            comparison[key] = {
                expected: expectedRate,
                actual: actualRate,
                expectedText: `1 sur ${Math.round(1 / expectedRate)}`,
                actualText: actualRate > 0 ? `1 sur ${Math.round(1 / actualRate)}` : 'N/A',
                difference: actualRate > 0 ? (actualRate - expectedRate) / expectedRate * 100 : 0
            };
        }

        return {
            totalOpened: stats.opened,
            comparison
        };
    }

    getDisplayedPullRates() {
        return this.getPullRatesForStats(this.displayedStats);
    }

    resetDisplayedStats() {
        this.displayedStats = this.initDisplayedStats();
        this.saveDisplayedStats();
        this.currentBoosterCards.forEach(cardElement => {
            delete cardElement.dataset.statsRecorded;
        });
        this.refreshDisplayedStats();
    }

    revealAllBoosterCards() {
        this.showBoosterSummary();
    }

    /**
     * Ouvre un nouveau booster depuis le bouton ou le raccourci clavier.
     */
    openNewBooster() {
        const shouldOpenPartyBooster = this.currentBoosterIsParty;
        this.resetOpeningArea();
        this.openBooster({ party: shouldOpenPartyBooster });
    }

    /**
     * Réinitialise la zone d'ouverture pour un nouveau booster
     */
    resetOpeningArea() {
        this.clearOpeningIntroTimeout();
        this.currentBoosterCards = [];
        this.currentCardIndex = 0;
        this.currentBoosterData = [];
        this.currentBoosterIsParty = false;
        this.currentBoosterPartyScored = false;
        this.currentPartyBoosterOpener = null;
        this.currentPartyOpeningLockId = null;
        this.currentPartyMiniGameResult = null;
        this.partyMiniGameActive = false;
        this.partyMiniGameContinueButton = null;
        this.partyMiniGamePassButton = null;
        this.elements.cardsContainer.innerHTML = '';
        this.elements.openingArea?.classList.remove('party-mini-game-active');
        document.querySelector('.party-inline-result')?.remove();
        this.elements.statsPanel?.classList.add('hidden');
        this.elements.cardsContainer.classList.remove('opening-sequence', 'recap-grid');
        this.updateOpeningControls();
    }

    clearOpeningIntroTimeout() {
        if (this.openingIntroTimeout) {
            clearTimeout(this.openingIntroTimeout);
            this.openingIntroTimeout = null;
        }
    }
}

// Initialiser l'application quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    const app = new PokemonShotsApp();
    window.pokemonShotsApp = app;
    app.init();
});

// Exposer l'application pour les tests et le débogage manuel.
window.PokemonShotsApp = PokemonShotsApp;
