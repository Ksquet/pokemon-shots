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
            boosterImg: document.getElementById('booster-img')
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
            Boolean(target.closest('.stats-panel, #debug-panel, #card-overlay.show'))
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
                    console.log(`Données de l'API chargées avec succès: ${cardsData.length} cartes`);
                    
                    // IMPORTANT: Loguer les raretés disponibles pour le débogage
                    const rarities = [...new Set(cardsData.map(card => card.rarity))];
                    console.log('Raretés disponibles dans les données de l\'API:', rarities);
                    
                    // Mettre à jour l'ouvreur de boosters avec les données complètes
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
        
        // Générer un nouveau booster
        const booster = this.boosterOpener.generateBooster();
        this.currentBoosterData = booster;
        this.currentBoosterPartyScored = false;
        window.accounts?.recordBooster(booster);
        
        // Vider le conteneur de cartes
        this.elements.cardsContainer.innerHTML = '';
        document.querySelector('.party-inline-result')?.remove();
        this.elements.cardsContainer.classList.remove('recap-grid');
        this.elements.cardsContainer.classList.add('opening-sequence');
        
        // Créer et ajouter les cartes au DOM
        this.currentBoosterCards = renderBoosterCards(booster, null);
        this.applyPartyOwnershipBadges(booster, this.currentBoosterCards);
        this.currentCardIndex = 0;
        this.currentBoosterImagesReady = this.preloadBoosterImages(this.currentBoosterCards);
        this.displayedStats.opened++;
        this.refreshDisplayedStats();
        
        // Afficher la zone d'ouverture et masquer la sélection de booster
        this.elements.boosterSelection.classList.add('hidden');
        this.elements.openingArea.classList.remove('hidden');
        
        this.elements.statsPanel.classList.add('hidden');
        
        // Mettre à jour les statistiques
        this.refreshDisplayedStats();
        
        // Mettre à jour les taux de pull
        this.refreshDisplayedStats();
        
        // Réinitialiser les événements de zoom des cartes
        this.startSequentialOpening();
    }

    /**
     * Révèle toutes les cartes du booster actuel
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

        const resultElement = document.createElement('section');
        resultElement.className = 'party-inline-result';
        resultElement.innerHTML = `
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
            <div class="party-drink-grid">
                ${Object.entries(result.distribution).map(([username, drinks]) => `
                    <article>
                        <span>${username}</span>
                        <strong>${drinks}</strong>
                    </article>
                `).join('')}
            </div>
        `;
        this.elements.cardsContainer.before(resultElement);
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

function enableDebugMode() {
    // S'assurer que l'ouvreur de boosters est initialisé
    if (!window.boosterOpener) {
        console.error("Erreur: Ouvreur de boosters non initialisé");
        return;
    }
    
    // Activer le logging dans l'ouvreur de boosters
    window.boosterOpener.enableLogging = true;
    
    // Créer le panneau de débogage s'il n'existe pas
    if (!document.getElementById('debug-panel')) {
        createDebugPanel();
    }
    
    // Rendre visible le panneau
    const debugPanel = document.getElementById('debug-panel');
    debugPanel.style.display = 'block';
    
    // Ajouter un hook pour intercepter et analyser chaque booster généré
    const originalGenerateBooster = window.boosterOpener.generateBooster;
    window.boosterOpener.generateBooster = function() {
        const booster = originalGenerateBooster.call(this);
        
        // Analyse après la génération
        analyzeNewBooster(booster);
        
        return booster;
    };
    
    // Afficher un message de confirmation
    console.log("Mode débogage activé - Ouvrez un booster pour commencer l'analyse");
    updateDebugPanel("Mode débogage activé - Ouvrez un booster pour commencer l'analyse");
}

/**
 * Crée le panneau de débogage
 */
function createDebugPanel() {
    // Créer le panneau
    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 10px;
        width: 500px;
        max-height: 300px;
        background: rgba(0, 0, 0, 0.8);
        color: #0f0;
        font-family: monospace;
        padding: 10px;
        border-radius: 5px;
        z-index: 9999;
        overflow-y: auto;
        font-size: 12px;
        display: none;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    `;
    
    // En-tête du panneau
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        padding-bottom: 5px;
        border-bottom: 1px solid #0f0;
    `;
    
    const title = document.createElement('h3');
    title.textContent = "Débogage Double Rare";
    title.style.margin = "0";
    
    const closeButton = document.createElement('button');
    closeButton.textContent = "X";
    closeButton.style.cssText = `
        background: transparent;
        border: 1px solid #f00;
        color: #f00;
        padding: 2px 5px;
        cursor: pointer;
    `;
    closeButton.onclick = function() {
        panel.style.display = 'none';
    };
    
    header.appendChild(title);
    header.appendChild(closeButton);
    panel.appendChild(header);
    
    // Corps du panneau
    const content = document.createElement('div');
    content.id = 'debug-content';
    panel.appendChild(content);
    
    // Boutons d'action
    const actions = document.createElement('div');
    actions.style.cssText = `
        display: flex;
        gap: 5px;
        margin-top: 10px;
        padding-top: 5px;
        border-top: 1px solid #0f0;
    `;
    
    // Bouton test
    const testButton = document.createElement('button');
    testButton.textContent = "Test Double Rare";
    testButton.style.cssText = `
        background: #005500;
        color: white;
        border: none;
        padding: 5px 10px;
        cursor: pointer;
    `;
    testButton.onclick = function() {
        runDoubleRareTest();
    };
    
    // Bouton pour voir le log
    const logButton = document.createElement('button');
    logButton.textContent = "Voir Log";
    logButton.style.cssText = `
        background: #000055;
        color: white;
        border: none;
        padding: 5px 10px;
        cursor: pointer;
    `;
    logButton.onclick = function() {
        showDebugLog();
    };
    
    // Bouton pour exporter le log
    const exportButton = document.createElement('button');
    exportButton.textContent = "Exporter Log";
    exportButton.style.cssText = `
        background: #555500;
        color: white;
        border: none;
        padding: 5px 10px;
        cursor: pointer;
    `;
    exportButton.onclick = function() {
        exportDebugLog();
    };
    
    actions.appendChild(testButton);
    actions.appendChild(logButton);
    actions.appendChild(exportButton);
    panel.appendChild(actions);
    
    // Ajouter au DOM
    document.body.appendChild(panel);
}

/**
 * Met à jour le contenu du panneau de débogage
 * @param {string} message - Message à afficher
 */
function updateDebugPanel(message) {
    const content = document.getElementById('debug-content');
    if (content) {
        const entry = document.createElement('div');
        entry.innerHTML = `[${new Date().toLocaleTimeString()}] ${message}`;
        content.appendChild(entry);
        
        // Auto-scroll vers le bas
        content.scrollTop = content.scrollHeight;
        
        // Limiter le nombre d'entrées
        while (content.children.length > 100) {
            content.removeChild(content.firstChild);
        }
    }
}

/**
 * Analyse un booster nouvellement créé
 * @param {Array} booster - Le booster à analyser
 */
function analyzeNewBooster(booster) {
    // Comptage des cartes par type
    const doubleRares = booster.filter(card => 
        card.isDoubleRare === true || card.specialType === 'double'
    );
    
    // Afficher l'analyse
    updateDebugPanel(`Nouveau booster généré: ${booster.length} cartes`);
    
    if (doubleRares.length > 0) {
        updateDebugPanel(`<span style="color:#ffff00">Ce booster contient ${doubleRares.length} Double Rare(s)</span>`);
        
        doubleRares.forEach((card, index) => {
            updateDebugPanel(`&nbsp;&nbsp;Double Rare #${index+1}: ${card.name} (${card.id})`);
            updateDebugPanel(`&nbsp;&nbsp;&nbsp;&nbsp;- specialType: ${card.specialType || 'non défini'}`);
            updateDebugPanel(`&nbsp;&nbsp;&nbsp;&nbsp;- isDoubleRare: ${card.isDoubleRare || false}`);
            updateDebugPanel(`&nbsp;&nbsp;&nbsp;&nbsp;- isFoil: ${card.isFoil || false}`);
            updateDebugPanel(`&nbsp;&nbsp;&nbsp;&nbsp;- DEBUG_ORDER: ${card.DEBUG_ORDER || 'non défini'}`);
        });
    } else {
        updateDebugPanel(`<span style="color:#888888">Aucune Double Rare dans ce booster</span>`);
    }
    
    // Vérifier les statistiques
    const stats = window.boosterOpener.getStats();
    updateDebugPanel(`Statistiques: ${stats.doubleRare} Double Rare(s) sur ${stats.opened} boosters`);
    
    // Vérifier la cohérence
    const hasDoubleRareInBooster = doubleRares.length > 0;
    const doubleRareCountIncremented = stats.doubleRare > 0 && 
        stats.doubleRare === (window.previousDoubleRareCount || 0) + (hasDoubleRareInBooster ? 1 : 0);
    
    if (hasDoubleRareInBooster && !doubleRareCountIncremented) {
        updateDebugPanel(`<span style="color:#ff0000">ERREUR: Double Rare présente mais compteur non incrémenté!</span>`);
    } else if (!hasDoubleRareInBooster && doubleRareCountIncremented) {
        updateDebugPanel(`<span style="color:#ff0000">ERREUR: Double Rare absente mais compteur incrémenté!</span>`);
    }
    
    // Mettre à jour le compteur précédent
    window.previousDoubleRareCount = stats.doubleRare;
}

/**
 * Exécute un test automatique pour les Double Rare
 */
function runDoubleRareTest() {
    if (!window.boosterOpener) {
        updateDebugPanel("Erreur: Ouvreur de boosters non initialisé");
        return;
    }
    
    updateDebugPanel("=== TEST AUTOMATIQUE DOUBLE RARE ===");
    
    // Sauvegarder l'état actuel
    const originalPullRate = window.boosterOpener.constructor.PULL_RATES.doubleRare;
    const originalStats = { ...window.boosterOpener.getStats() };
    
    // Forcer un taux de 100% pour les tests
    window.boosterOpener.constructor.PULL_RATES.doubleRare = 1.0;
    updateDebugPanel("Taux de pull forcé à 100% pour le test");
    
    // Générer un booster de test
    const testBooster = window.boosterOpener.generateBooster();
    
    // Vérifier si le booster contient une Double Rare
    const doubleRares = testBooster.filter(card => 
        card.isDoubleRare === true || card.specialType === 'double'
    );
    
    if (doubleRares.length > 0) {
        updateDebugPanel(`<span style="color:#00ff00">TEST RÉUSSI: Le booster contient ${doubleRares.length} Double Rare(s) comme prévu</span>`);
    } else {
        updateDebugPanel(`<span style="color:#ff0000">TEST ÉCHOUÉ: Aucune Double Rare générée malgré un taux de 100%</span>`);
    }
    
    // Rétablir les valeurs d'origine
    window.boosterOpener.constructor.PULL_RATES.doubleRare = originalPullRate;
    window.boosterOpener.stats = originalStats;
    
    updateDebugPanel("Test terminé et valeurs d'origine restaurées");
}

/**
 * Affiche le log de débogage complet
 */
function showDebugLog() {
    if (!window.boosterOpener) {
        updateDebugPanel("Erreur: Ouvreur de boosters non initialisé");
        return;
    }
    
    const log = window.boosterOpener.getDebugLog();
    if (log.length === 0) {
        updateDebugPanel("Le log est vide");
        return;
    }
    
    updateDebugPanel(`=== LOG DE DÉBOGAGE (${log.length} entrées) ===`);
    log.forEach((entry, index) => {
        updateDebugPanel(`${index+1}. [${entry.time.toLocaleTimeString()}] ${entry.message}`);
    });
}

/**
 * Exporte le log de débogage
 */
function exportDebugLog() {
    if (!window.boosterOpener) {
        updateDebugPanel("Erreur: Ouvreur de boosters non initialisé");
        return;
    }
    
    const log = window.boosterOpener.exportLog();
    if (!log) {
        updateDebugPanel("Aucun log à exporter");
        return;
    }
    
    // Créer un élément pour le téléchargement
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(log));
    element.setAttribute('download', `pokemon-shots-debug-${new Date().toISOString().slice(0,10)}.log`);
    element.style.display = 'none';
    
    // Ajouter au DOM et simuler un clic
    document.body.appendChild(element);
    element.click();
    
    // Nettoyer
    document.body.removeChild(element);
    updateDebugPanel("Log exporté avec succès");
}

// Exposer les fonctions de débogage globalement
window.pokemonDebug = {
    enable: enableDebugMode,
    update: updateDebugPanel,
    test: runDoubleRareTest,
    showLog: showDebugLog,
    exportLog: exportDebugLog
};

// Message dans la console
console.log("Module de débogage chargé. Utilisez window.pokemonDebug.enable() pour activer le débogage.");

/**
 * Outil d'analyse des raretés de l'API
 * À ajouter en tant que script de débogage temporaire
 */

/**
 * Analyse toutes les raretés disponibles dans les données de l'API
 * et affiche un rapport détaillé
 */
function analyzeApiRarities() {
    // Créer un conteneur modal pour l'affichage
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        overflow: auto;
    `;
    
    // Créer l'en-tête
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        padding: 15px;
        background: #333;
        position: sticky;
        top: 0;
    `;
    
    const title = document.createElement('h2');
    title.textContent = 'Analyse des raretés de l\'API';
    title.style.color = 'white';
    title.style.margin = '0';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'X';
    closeBtn.style.cssText = `
        background: #f44336;
        color: white;
        border: none;
        padding: 5px 10px;
        font-size: 16px;
        cursor: pointer;
    `;
    closeBtn.onclick = () => document.body.removeChild(modal);
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    modal.appendChild(header);
    
    // Conteneur principal
    const content = document.createElement('div');
    content.style.cssText = `
        padding: 20px;
        color: white;
        font-family: monospace;
        flex: 1;
        overflow: auto;
    `;
    modal.appendChild(content);
    
    // Ajouter au DOM
    document.body.appendChild(modal);
    
    // Fonction pour ajouter du contenu
    function addContent(html) {
        const p = document.createElement('p');
        p.innerHTML = html;
        content.appendChild(p);
    }
    
    // Vérifier si l'ouvreur de boosters est initialisé
    if (!window.boosterOpener || !window.boosterOpener.setData) {
        addContent('<span style="color:#ff6b6b">Erreur: Données non disponibles. L\'ouvreur de boosters n\'est pas initialisé.</span>');
        
        // Bouton pour charger les données
        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Charger les données de l\'API';
        loadBtn.style.cssText = `
            background: #4CAF50;
            color: white;
            border: none;
            padding: 10px 15px;
            margin-top: 15px;
            cursor: pointer;
        `;
        loadBtn.onclick = async () => {
            loadBtn.disabled = true;
            loadBtn.textContent = 'Chargement...';
            
            try {
                if (typeof window.loadPokemon151Data === 'function') {
                    addContent('<span style="color:#4ecdc4">Chargement des données de l\'API en cours...</span>');
                    const cardsData = await window.loadPokemon151Data();
                    
                    if (cardsData && Array.isArray(cardsData) && cardsData.length > 0) {
                        addContent(`<span style="color:#4ecdc4">Données chargées: ${cardsData.length} cartes</span>`);
                        analyzeData(cardsData);
                    } else {
                        addContent('<span style="color:#ff6b6b">Erreur: Les données reçues sont vides ou invalides</span>');
                    }
                } else {
                    addContent('<span style="color:#ff6b6b">Erreur: Fonction de chargement non disponible</span>');
                }
            } catch (error) {
                addContent(`<span style="color:#ff6b6b">Erreur lors du chargement: ${error.message}</span>`);
            } finally {
                loadBtn.textContent = 'Charger les données de l\'API';
                loadBtn.disabled = false;
            }
        };
        
        content.appendChild(loadBtn);
        return;
    }
    
    // Analyser les données disponibles
    analyzeData(window.boosterOpener.setData);
    
    function analyzeData(data) {
        addContent(`<strong>Nombre total de cartes:</strong> ${data.length}`);
        
        // Analyser les raretés
        const rarities = {};
        data.forEach(card => {
            const rarity = card.rarity || 'non définie';
            if (!rarities[rarity]) {
                rarities[rarity] = [];
            }
            rarities[rarity].push(card);
        });
        
        // Afficher les raretés
        addContent('<strong>Raretés détectées:</strong>');
        
        let hasDoubleRare = false;
        
        for (const [rarity, cards] of Object.entries(rarities)) {
            const color = rarity.includes('Double') || rarity.includes('double') ? '#ffd700' : '#fff';
            addContent(`<span style="color:${color}">- ${rarity}: ${cards.length} cartes</span>`);
            
            if (rarity.includes('Double') || rarity.includes('double')) {
                hasDoubleRare = true;
            }
        }
        
        // Conseils basés sur l'analyse
        addContent('<br><strong>Analyse:</strong>');
        
        if (hasDoubleRare) {
            addContent('<span style="color:#4ecdc4">✓ Des cartes Double Rare ont été détectées dans l\'API.</span>');
            addContent('Pour que le système fonctionne correctement, assurez-vous que votre code cherche spécifiquement ces raretés.');
        } else {
            addContent('<span style="color:#ff6b6b">✗ Aucune carte avec une rareté "Double Rare" n\'a été détectée.</span>');
            addContent('Vous devez adapter votre code pour identifier les cartes Double Rare autrement:');
            addContent('1. Soit vérifier les autres propriétés des cartes qui pourraient indiquer une Double Rare');
            addContent('2. Soit créer une liste spécifique d\'IDs de cartes qui sont des Double Rare');
        }
        
        // Afficher les 5 premières cartes de chaque rareté pour vérification
        addContent('<br><strong>Exemples de cartes par rareté:</strong>');
        
        for (const [rarity, cards] of Object.entries(rarities)) {
            const sampleCards = cards.slice(0, 5);
            
            addContent(`<span style="color:#4ecdc4"><strong>${rarity}</strong> (${cards.length} cartes):</span>`);
            
            sampleCards.forEach(card => {
                addContent(`&nbsp;&nbsp;- ${card.name} (ID: ${card.id}, Numéro: ${card.number || 'N/A'})`);
            });
            
            if (cards.length > 5) {
                addContent(`&nbsp;&nbsp;... et ${cards.length - 5} autres cartes`);
            }
            
            addContent('<br>');
        }
        
        // Recommandations
        addContent('<strong>Recommandations:</strong>');
        addContent('1. Modifiez le code de génération de boosters pour utiliser les raretés exactes de l\'API');
        addContent('2. Assurez-vous que les constantes RARITY_MAP dans tcgdex-api.js correspondent aux raretés de l\'API');
        addContent('3. Si nécessaire, créez une liste manuelle d\'IDs pour les Double Rare');
        
        // Créer un aperçu exportable
        const exportBtn = document.createElement('button');
        exportBtn.textContent = 'Exporter le rapport';
        exportBtn.style.cssText = `
            background: #4361ee;
            color: white;
            border: none;
            padding: 10px 15px;
            margin-top: 15px;
            cursor: pointer;
        `;
        exportBtn.onclick = () => {
            const exportText = content.innerText;
            const blob = new Blob([exportText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'analyse-raretes-api.txt';
            a.click();
            URL.revokeObjectURL(url);
        };
        
        content.appendChild(exportBtn);
    }
}

// Rendre la fonction disponible globalement
window.analyzeApiRarities = analyzeApiRarities;

// Message dans la console
console.log("Outil d'analyse des raretés chargé. Utilisez window.analyzeApiRarities() pour lancer l'analyse.");

