/**
 * Script principal de l'application Pokemon Shots
 */
// Import des modules modifiés
import BoosterOpener from './modules/booster.js';
import { renderBoosterCards, revealCard, revealAllCards, generateCardBack } from './modules/card-renderer.js';
import { updateStats, updatePullRates, initializeStatsPanel } from './modules/statistics.js';
import { initCardZoom, setupCardZoomEvents } from './modules/card-zoom.js';
import { generateBoosterImage } from './utils/booster-image.js';

// Application principale
class PokemonShotsApp {
    constructor() {
        this.boosterOpener = null;
        this.elements = this.cacheElements();
        this.isInitialized = false;
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

        // Générer l'image du booster
        if (this.elements.boosterImg) {
            this.elements.boosterImg.src = generateBoosterImage();
        }

        // Générer le dos de carte dynamiquement
        generateCardBack();

        // Initialiser d'abord avec les données statiques pour une utilisation immédiate
        this.initBoosterOpener(window.pokemon151Data);

        // Configurer les événements
        this.setupEventListeners();

        // Initialiser le panneau de statistiques
        initializeStatsPanel();

        // Initialiser le zoom de carte
        initCardZoom();

        // Charger les données complètes en arrière-plan
        this.loadCardDataInBackground();

        this.isInitialized = true;
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
        this.elements.newBoosterButton.addEventListener('click', () => {
            this.resetOpeningArea();
            this.openBooster();
        });
    }

    /**
     * Initialise le générateur de booster avec les données fournies
     * @param {Array} cardsData - Données des cartes
     */
    initBoosterOpener(cardsData) {
        this.boosterOpener = new BoosterOpener(cardsData);
        window.boosterOpener = this.boosterOpener; // Pour l'accès global
        
        // Activer le bouton d'ouverture
        this.elements.openButton.textContent = 'Ouvrir un booster';
        this.elements.openButton.disabled = false;
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
            
            // Désactiver le bouton pendant le chargement
            if (this.elements.openButton) {
                this.elements.openButton.disabled = true;
                this.elements.openButton.textContent = 'Chargement des cartes...';
            }
            
            // S'abonner aux mises à jour de progression
            if (window.loadingProgress) {
                window.loadingProgress.onUpdate((percentage) => {
                    // Mettre à jour le texte du bouton avec la progression
                    if (this.elements.openButton) {
                        this.elements.openButton.textContent = `Chargement des cartes... ${percentage}%`;
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
                        this.elements.openButton.disabled = false;
                        this.elements.openButton.textContent = 'Ouvrir un booster';
                    }
                } else {
                    console.error("Erreur: Données de l'API invalides ou vides");
                    // Afficher un message d'erreur
                    if (this.elements.openButton) {
                        this.elements.openButton.disabled = true;
                        this.elements.openButton.textContent = 'Erreur de chargement - Rechargez la page';
                    }
                }
            } else {
                console.error("Erreur: Fonction loadPokemon151Data non disponible");
            }
        } catch (error) {
            console.error("Erreur lors du chargement des données:", error);
            
            // Masquer l'indicateur en cas d'erreur
            if (this.elements.loadingIndicator) {
                this.elements.loadingIndicator.style.display = 'none';
            }
            
            // Afficher un message d'erreur
            if (this.elements.openButton) {
                this.elements.openButton.disabled = true;
                this.elements.openButton.textContent = 'Erreur de chargement - Rechargez la page';
            }
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
        
        // Vider le conteneur de cartes
        this.elements.cardsContainer.innerHTML = '';
        
        // Créer et ajouter les cartes au DOM
        const cardElements = renderBoosterCards(booster, null);
        cardElements.forEach(cardElement => {
            this.elements.cardsContainer.appendChild(cardElement);
        });
        
        // Afficher la zone d'ouverture et masquer la sélection de booster
        this.elements.boosterSelection.classList.add('hidden');
        this.elements.openingArea.classList.remove('hidden');
        
        // Afficher le panneau de statistiques
        this.elements.statsPanel.classList.remove('hidden');
        
        // Mettre à jour les statistiques
        updateStats(this.boosterOpener.getStats());
        
        // Mettre à jour les taux de pull
        updatePullRates(this.boosterOpener.checkPullRates());
        
        // Réinitialiser les événements de zoom des cartes
        setupCardZoomEvents();
    }

    /**
     * Révèle toutes les cartes du booster actuel
     */
    revealAllBoosterCards() {
        const cards = document.querySelectorAll('.card:not(.revealed)');
        revealAllCards(cards, setupCardZoomEvents);
    }

    /**
     * Réinitialise la zone d'ouverture pour un nouveau booster
     */
    resetOpeningArea() {
        this.elements.cardsContainer.innerHTML = '';
    }
}

// Initialiser l'application quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    const app = new PokemonShotsApp();
    app.init();
});

// Exporter l'application pour les tests
export default PokemonShotsApp;

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

