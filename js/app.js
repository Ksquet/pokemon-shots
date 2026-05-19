/**
 * Script principal de l'application Pokemon Shots.
 *
 * Les dépendances sont chargées par des balises <script> classiques dans index.html afin
 * que l'application fonctionne aussi lorsqu'elle est ouverte directement en file://.
 */

// Application principale
class PokemonShotsApp {
    constructor() {
        this.boosterOpener = null;
        this.elements = this.cacheElements();
        this.isInitialized = false;
        this.currentBoosterCards = [];
        this.currentCardIndex = 0;
        this.currentBoosterData = [];
        this.currentBoosterPartyScored = false;
        this.openingIntroTimeout = null;
        this.currentBoosterImagesReady = Promise.resolve();
        this.suppressNextOpeningClick = false;
        this.displayedStats = this.initDisplayedStats();
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
            this.elements.revealAllButton.setAttribute('aria-label', 'Afficher le recapitulatif avec la barre Espace');
            const revealLabel = this.elements.revealAllButton.querySelector('span');
            if (revealLabel) {
                revealLabel.textContent = 'Recap';
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
            window.accounts.init({
                onSessionChange: (user) => this.handleAccountSessionChange(user)
            });
        }

        if (window.partyMode) {
            window.partyMode.init({ app: this });
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
        this.updateAccountDependentUi();
        this.updatePartyOpenerPreview();
    }

    updateAccountDependentUi() {
        if (!this.elements.openButton) {
            return;
        }

        this.elements.openButton.disabled = !this.boosterOpener;

        if (this.boosterOpener) {
            this.elements.openButton.textContent = 'Ouvrir un booster';
        }
    }

    updatePartyOpenerPreview() {
        if (!this.elements.boosterSelection) {
            return;
        }

        this.elements.boosterSelection.querySelector('.party-selection-opener')?.remove();

        const openerBanner = this.createPartyOpenerBanner('Prochain a ouvrir');
        if (!openerBanner) {
            return;
        }

        const preview = document.createElement('div');
        preview.className = 'party-selection-opener';
        preview.appendChild(openerBanner);

        const boosterContainer = this.elements.boosterSelection.querySelector('.booster-container');
        this.elements.boosterSelection.insertBefore(preview, boosterContainer);
    }

    placeStatsPanelAfterRecap() {
        if (!this.elements.statsPanel || !this.elements.cardsContainer) {
            return;
        }

        this.elements.cardsContainer.after(this.elements.statsPanel);
    }

    handleAccountSessionChange(user) {
        const nextUsername = user?.username || null;

        if (nextUsername !== this.currentAccountUsername) {
            this.currentAccountUsername = nextUsername;
            this.resetOpeningArea();
            this.resetDisplayedStats();

            if (this.elements.openingArea) {
                this.elements.openingArea.classList.add('hidden');
            }

            if (this.elements.boosterSelection) {
                this.elements.boosterSelection.classList.remove('hidden');
            }

            if (this.elements.statsPanel && !nextUsername) {
                this.elements.statsPanel.classList.add('hidden');
            }
        }

        this.updateAccountDependentUi();
    }

    /**
     * Configure les écouteurs d'événements
     */
    setupEventListeners() {
        // Ouvrir un booster
        this.elements.openButton.addEventListener('click', () => this.openBooster());

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
     * Revient a l'ecran principal du set 151 en conservant l'ouverture courante.
     * Si un recap existe deja, notamment en mode soiree, il est restaure au lieu
     * de revenir brutalement a la selection du booster.
     */
    showSet151View() {
        document.querySelector('.admin-dashboard')?.classList.add('hidden');
        document.querySelector('.collection-panel')?.classList.add('hidden');
        document.querySelector('.party-panel')?.classList.add('hidden');

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

            return;
        }

        this.elements.openingArea?.classList.add('hidden');
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
            this.isShortcutContextBlocked(event.target) ||
            !this.isOpeningAreaVisible()
        ) {
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
    openBooster() {
        // Vérifier que l'ouvreur de boosters est initialisé
        if (!this.boosterOpener) {
            alert('Erreur: Impossible d\'ouvrir un booster pour le moment.');
            return;
        }
        
        // Générer un nouveau booster, ou consommer le booster debug préparé par l'admin.
        const booster = window.accounts?.consumeDebugNextBooster?.(this.boosterOpener) || this.boosterOpener.generateBooster();
        this.currentBoosterData = booster;
        this.currentBoosterPartyScored = false;
        const collectionOwner = window.partyMode?.isActive()
            ? window.partyMode.getCurrentOpener?.()?.username
            : window.accounts?.getCurrentUser?.()?.username;
        window.accounts?.recordBooster(booster, collectionOwner);
        
        // Vider le conteneur de cartes
        this.elements.cardsContainer.innerHTML = '';
        document.querySelector('.party-inline-result')?.remove();
        this.elements.cardsContainer.classList.remove('recap-grid');
        this.elements.cardsContainer.classList.add('opening-sequence');
        
        // Créer et ajouter les cartes au DOM
        this.currentBoosterCards = renderBoosterCards(booster, null);
        this.applyPartyOwnershipBadges(booster, this.currentBoosterCards);
        this.applyPartyX2Badges(booster, this.currentBoosterCards);
        this.currentCardIndex = 0;
        this.currentBoosterImagesReady = this.preloadBoosterImages(this.currentBoosterCards);
        this.displayedStats.opened++;
        this.refreshDisplayedStats();
        
        // Afficher la zone d'ouverture et masquer la sélection de booster
        this.elements.boosterSelection.classList.add('hidden');
        this.elements.openingArea.classList.remove('hidden');
        
        this.elements.statsPanel.classList.add('hidden');
        
        this.startSequentialOpening();
    }

    /**
     * Ajoute les badges de propriété en mode soirée.
     * @param {Array} booster - Données du booster courant.
     * @param {HTMLElement[]} cardElements - Cartes rendues dans le DOM.
     */
    applyPartyOwnershipBadges(booster, cardElements) {
        if (!window.partyMode?.isActive()) {
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
            badge.title = `${owner.username} possede cette carte`;
            cardElement.appendChild(badge);
        });
    }

    applyPartyX2Badges(booster, cardElements) {
        if (!window.partyMode?.isActive()) {
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
            badge.title = 'Carte x2 de la soiree';
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
        image.alt = 'Booster Pokemon 151';

        intro.appendChild(image);
        stage.appendChild(intro);
        this.elements.cardsContainer.appendChild(stage);

        this.openingIntroTimeout = setTimeout(() => {
            this.currentBoosterImagesReady.finally(() => {
                this.showCurrentBoosterCard();
            });
        }, 850);
    }

    createPartyOpenerBanner(label = 'Booster ouvert par') {
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

    showBoosterSummary() {
        this.clearOpeningIntroTimeout();

        if (!this.currentBoosterCards.length) {
            return;
        }

        this.elements.cardsContainer.innerHTML = '';
        this.elements.cardsContainer.classList.remove('opening-sequence');
        this.elements.cardsContainer.classList.add('recap-grid');

        this.currentBoosterCards.forEach(cardElement => {
            revealCard(cardElement);
            this.recordDisplayedCardStats(cardElement);
            this.elements.cardsContainer.appendChild(cardElement);
        });

        if (window.partyMode?.isActive() && !this.currentBoosterPartyScored) {
            const partyResult = window.partyMode.scoreBooster(this.currentBoosterData || []);
            this.currentBoosterPartyScored = true;
            this.renderPartyResultInSummary(partyResult);
        }

        this.showStatsAfterSummary();
        setupCardZoomEvents();
    }

    showStatsAfterSummary() {
        if (!this.elements.statsPanel) {
            return;
        }

        this.placeStatsPanelAfterRecap();
        updatePartyStats(window.partyMode?.getSummary?.() || null);
        this.refreshDisplayedStats();
        this.elements.statsPanel.classList.remove('hidden', 'collapsed');
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
                    <span>Prochain a ouvrir</span>
                    <strong>${result.nextOpener || '-'}</strong>
                </div>
            </div>
            <h3>Gorgees a distribuer</h3>
            ${result.everyoneDrinks ? `
                <div class="party-everyone-drinks">
                    <strong>Tout le monde boit !</strong>
                    <span>Une gorgee pour chaque joueur.</span>
                </div>
            ` : ''}
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

        if (!remainingUses) {
            return `
                <div class="party-x2-result is-applied">
                    <strong>${totalUses} x2 applique${totalUses > 1 ? 's' : ''}</strong>
                    <span>${applications.map(application => `${application.target} +${application.bonus}`).join(' / ')} grace a ${result.x2.card.name}.</span>
                </div>
            `;
        }

        return `
            <div class="party-x2-result">
                <div>
                    <strong>${result.x2.card.name} est sortie ${totalUses} fois: ${remainingUses} x2 restant${remainingUses > 1 ? 's' : ''}</strong>
                    <span>${result.x2.decidedBy} choisit quel joueur double ses gorgees sur ce booster.</span>
                </div>
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
        this.refreshDisplayedStats();
    }

    refreshDisplayedStats() {
        updateStats(this.displayedStats);
        updatePullRates(this.getDisplayedPullRates());
    }

    getDisplayedPullRates() {
        const comparison = {};
        const pullRates = BoosterOpener.PULL_RATES;

        for (const [key, expectedRate] of Object.entries(pullRates)) {
            const actualRate = this.displayedStats.opened > 0
                ? (this.displayedStats[key] || 0) / this.displayedStats.opened
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
            totalOpened: this.displayedStats.opened,
            comparison
        };
    }

    resetDisplayedStats() {
        this.displayedStats = this.initDisplayedStats();
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
        this.resetOpeningArea();
        this.openBooster();
    }

    /**
     * Réinitialise la zone d'ouverture pour un nouveau booster
     */
    resetOpeningArea() {
        this.clearOpeningIntroTimeout();
        this.currentBoosterCards = [];
        this.currentCardIndex = 0;
        this.currentBoosterData = [];
        this.currentBoosterPartyScored = false;
        this.elements.cardsContainer.innerHTML = '';
        document.querySelector('.party-inline-result')?.remove();
        this.elements.statsPanel?.classList.add('hidden');
        this.elements.cardsContainer.classList.remove('opening-sequence', 'recap-grid');
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
