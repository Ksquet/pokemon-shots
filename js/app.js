/**
 * Script principal de l'application Pokemon Shots
 */
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
            // Vérifier si nous avons des données en cache avant de montrer l'indicateur
            const cachedData = localStorage.getItem('pokemon151Data');
            let shouldShowIndicator = true;
            
            if (cachedData) {
                const { timestamp } = JSON.parse(cachedData);
                const oneWeek = 7 * 24 * 60 * 60 * 1000;
                
                if (Date.now() - timestamp < oneWeek) {
                    shouldShowIndicator = false;
                }
            }
            
            // Afficher l'indicateur uniquement si on va charger depuis l'API
            if (shouldShowIndicator && this.elements.loadingIndicator) {
                this.elements.loadingIndicator.style.display = 'flex';
            }
            
            // S'abonner aux mises à jour de progression
            if (window.loadingProgress) {
                window.loadingProgress.onUpdate((percentage) => {
                    // Mise à jour silencieuse
                });
            }
            
            // Charger les données complètes
            if (typeof window.loadPokemon151Data === 'function') {
                const cardsData = await window.loadPokemon151Data();
                
                // Vérifier si les données ont été chargées avec succès
                if (cardsData && Array.isArray(cardsData) && cardsData.length > 0) {
                    // Mettre à jour l'ouvreur de boosters avec les données complètes
                    this.initBoosterOpener(cardsData);
                }
            }
        } catch (error) {
            // Les données statiques restent en place
            
            // Masquer l'indicateur en cas d'erreur
            if (this.elements.loadingIndicator) {
                this.elements.loadingIndicator.style.display = 'none';
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
        // Soit passer revealCard comme fonction de callback, soit ne pas passer de callback
        // Si vous passez this.revealCard, assurez-vous que c'est une méthode de la classe
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