/**
 * Module d'intégration de l'API TCGdex pour le set Pokémon 151
 */

// Configuration de l'API
const API_CONFIG = {
    baseUrl: 'https://api.tcgdex.net/v2/fr',
    setId: 'sv03.5',
    fullSetPath: 'sv/sv03.5',
    cacheTime: 7 * 24 * 60 * 60 * 1000, // 7 jours en millisecondes
    cacheKey: 'pokemon151Data'
};

// Mappings des raretés
const RARITY_MAP = {
    'Commune': 'common',
    'Peu Commune': 'uncommon',
    'Rare': 'rare',
    'Rare Holo': 'rare',
    'Ultra Rare': 'ultraRare',
    'Rare Holo V': 'ultraRare',
    'Rare Holo VMAX': 'ultraRare',
    'Rare Holo VSTAR': 'ultraRare',
    'Arc-en-ciel Rare': 'secretRare',
    'Rare Secrète': 'secretRare',
    'Hyper rare': 'secretRare',
    'Secret Rare': 'secretRare',
    'Illustration rare': 'ultraRare',
    'Illustration spéciale rare': 'ultraRare',
    'Double rare': 'doubleRare'
};

/**
 * Vérifie si des données en cache sont valides
 * @returns {Object|null} Données en cache ou null
 */
function getValidCachedData() {
    try {
        const cachedData = localStorage.getItem(API_CONFIG.cacheKey);
        
        if (cachedData) {
            const { data, timestamp } = JSON.parse(cachedData);
            
            if (Date.now() - timestamp < API_CONFIG.cacheTime) {
                return data;
            }
        }
    } catch (error) {
        // Ignorer les erreurs de cache et continuer avec le chargement depuis l'API
    }
    
    return null;
}

/**
 * Convertit une carte de l'API en format standard pour l'application
 * @param {Object} cardData - Données de carte depuis l'API
 * @returns {Object} Carte au format de l'application
 */
function convertCardData(cardData) {
    // Déterminer la rareté pour l'application
    let rarity = 'common'; // Valeur par défaut
    
    if (cardData.rarity) {
        // Utiliser la correspondance si disponible, sinon valeur par défaut
        rarity = RARITY_MAP[cardData.rarity] || 'common';
    }
    
    // Les types sont déjà en français
    let type = 'Incolore'; // Valeur par défaut
    
    if (cardData.types && cardData.types.length > 0) {
        type = cardData.types[0];
    }
    
    // Gestion spéciale pour les cartes Dresseur et Énergie
    if (cardData.category === 'Dresseur') {
        rarity = 'trainer';
        type = 'Dresseur';
    } else if (cardData.category === 'Énergie') {
        rarity = 'energy';
        // Le type est déjà déterminé correctement
    }
    
    // ID formaté pour l'application
    const formattedId = `151-${cardData.localId}`;
    
    // Construire l'URL de l'image
    const imageUrl = `https://assets.tcgdex.net/fr/${API_CONFIG.fullSetPath}/${cardData.localId}/high.jpg`;
    
    return {
        id: formattedId,
        name: cardData.name,
        type: type,
        rarity: rarity,
        number: `${cardData.localId}/165`,
        localId: cardData.localId,
        imageUrl: imageUrl
    };
}

/**
 * Charge les détails d'une carte spécifique
 * @param {string} cardId - ID de la carte dans l'API
 * @returns {Promise<Object>} Carte convertie
 */
async function loadCardDetails(cardId) {
    try {
        const cardResponse = await fetch(`${API_CONFIG.baseUrl}/sets/${API_CONFIG.setId}/${cardId}`);
        
        if (!cardResponse.ok) {
            throw new Error(`Erreur de récupération (${cardResponse.status})`);
        }
        
        const cardData = await cardResponse.json();
        return convertCardData(cardData);
    } catch (error) {
        // Version simplifiée comme solution de secours
        return {
            id: `151-${cardId}`,
            name: `Carte #${cardId}`,
            type: 'Incolore',
            rarity: 'common',
            number: `${cardId}/165`,
            localId: cardId,
            imageUrl: `https://assets.tcgdex.net/fr/${API_CONFIG.fullSetPath}/${cardId}/high.jpg`
        };
    }
}

/**
 * Traite un lot de cartes en parallèle
 * @param {Array} cardBatch - Lot de cartes à traiter
 * @param {Function} progressCallback - Callback pour la progression
 * @returns {Promise<Array>} Cartes traitées
 */
async function processCardBatch(cardBatch, progressCallback) {
    const promises = cardBatch.map(cardSummary => loadCardDetails(cardSummary.localId));
    const results = await Promise.all(promises);
    
    if (progressCallback) {
        progressCallback(cardBatch.length);
    }
    
    return results;
}

/**
 * Charge les données du set Pokémon 151
 * @returns {Promise<Array>} Tableau de cartes
 */
async function loadPokemon151Data() {
    try {
        // Vérifier le cache d'abord
        const cachedData = getValidCachedData();
        
        if (cachedData) {
            // Masquer immédiatement l'indicateur de chargement
            const loadingIndicator = document.getElementById('loading-indicator');
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
            
            return cachedData;
        }
        
        // Récupérer les détails du set
        const setResponse = await fetch(`${API_CONFIG.baseUrl}/sets/${API_CONFIG.setId}`);
        
        if (!setResponse.ok) {
            throw new Error(`Erreur lors de la récupération du set: ${setResponse.status}`);
        }
        
        const setData = await setResponse.json();
        
        // Initialiser la progression
        if (window.loadingProgress) {
            const totalCards = setData.cards?.length || 0;
            window.loadingProgress.init(totalCards);
        }
        
        // Tableau pour stocker les cartes converties
        const convertedCards = [];
        
        // Récupérer les détails de chaque carte, mais avec un traitement par lots
        if (setData.cards && Array.isArray(setData.cards)) {
            const totalCards = setData.cards.length;
            const batchSize = 5; // Nombre de requêtes à exécuter en parallèle
            
            // Traiter les cartes par lots pour accélérer le chargement
            for (let i = 0; i < totalCards; i += batchSize) {
                const cardBatch = setData.cards.slice(i, i + batchSize);
                const cardResults = await processCardBatch(cardBatch, 
                    (count) => window.loadingProgress?.update(count));
                
                // Ajouter les cartes au tableau
                for (const card of cardResults) {
                    if (card) {
                        convertedCards.push(card);
                    }
                }
            }
        }
        
        // Vérifier si nous avons des cartes
        if (convertedCards.length > 0) {
            // Mettre en cache les données pour les prochaines visites
            localStorage.setItem(API_CONFIG.cacheKey, JSON.stringify({
                data: convertedCards,
                timestamp: Date.now()
            }));
            
            return convertedCards;
        } else {
            throw new Error('Aucune carte récupérée');
        }
    } catch (error) {
        // Signaler que le chargement est terminé même en cas d'erreur
        if (window.loadingProgress) {
            window.loadingProgress.update(100);
        }
        
        // Retourner les données statiques en cas d'erreur
        return window.pokemon151Data || [];
    }
}

// Module de progression du chargement
const loadingProgress = (() => {
    let totalCards = 0;
    let loadedCards = 0;
    const progressCallbacks = [];
    
    /**
     * Initialise le compteur de progression
     * @param {number} total - Nombre total de cartes à charger
     */
    function init(total) {
        totalCards = total;
        loadedCards = 0;
        updateProgressUI(0);
    }
    
    /**
     * Met à jour la progression et informe les callbacks
     * @param {number} increment - Nombre de cartes supplémentaires chargées
     */
    function update(increment = 1) {
        loadedCards += increment;
        const percentage = Math.min(Math.round((loadedCards / totalCards) * 100), 100);
        updateProgressUI(percentage);
    }
    
    /**
     * Met à jour l'interface utilisateur avec la progression
     * @param {number} percentage - Pourcentage de progression (0-100)
     */
    function updateProgressUI(percentage) {
        const progressElement = document.querySelector('.loading-progress');
        if (progressElement) {
            progressElement.textContent = `${percentage}%`;
        }
        
        // Informer tous les callbacks de la progression
        progressCallbacks.forEach(callback => callback(percentage));
        
        // Si le chargement est terminé, marquer l'indicateur comme terminé
        if (percentage >= 100) {
            const indicator = document.getElementById('loading-indicator');
            if (indicator) {
                setTimeout(() => {
                    indicator.classList.add('done');
                }, 500);
            }
        }
    }
    
    /**
     * Ajoute un callback pour suivre la progression
     * @param {Function} callback - Fonction à appeler lors des mises à jour
     */
    function onUpdate(callback) {
        if (typeof callback === 'function') {
            progressCallbacks.push(callback);
        }
    }
    
    return {
        init,
        update,
        onUpdate
    };
})();

// Exports
window.loadPokemon151Data = loadPokemon151Data;
window.loadingProgress = loadingProgress;