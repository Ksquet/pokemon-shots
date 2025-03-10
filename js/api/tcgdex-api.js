/**
 * Module d'intégration de l'API TCGdex pour le set Pokémon 151
 * Version optimisée avec mise en cache et indicateur de progression
 */

// Fonction pour charger les données du set Pokémon 151
async function loadPokemon151Data() {
    try {
        console.log('Chargement des données du set Pokémon 151 depuis TCGdex...');
        
        // ID du set et chemin pour les images
        const setId = 'sv03.5'; 
        const fullSetPath = 'sv/sv03.5';
        
        // Vérifier si nous avons des données en cache
        const cachedData = localStorage.getItem('pokemon151Data');
        
        if (cachedData) {
            const { data, timestamp } = JSON.parse(cachedData);
            const oneWeek = 7 * 24 * 60 * 60 * 1000; // 7 jours en millisecondes
            
            if (Date.now() - timestamp < oneWeek) {
                console.log('Utilisation des données en cache (moins de 7 jours)');
                
                // Masquer immédiatement l'indicateur de chargement puisqu'on utilise des données en cache
                const loadingIndicator = document.getElementById('loading-indicator');
                if (loadingIndicator) {
                    loadingIndicator.style.display = 'none';
                }
                
                return data;
            }
        }
        
        // Récupérer les détails du set
        const setResponse = await fetch(`https://api.tcgdex.net/v2/fr/sets/${setId}`);
        
        if (!setResponse.ok) {
            throw new Error(`Erreur lors de la récupération du set: ${setResponse.status}`);
        }
        
        const setData = await setResponse.json();
        console.log(`Set trouvé: ${setData.name} (${setData.id})`);
        console.log(`Nombre de cartes: ${setData.cardCount?.total || 'inconnu'}`);
        
        // Initialiser la progression
        if (window.loadingProgress) {
            const totalCards = setData.cards?.length || 0;
            window.loadingProgress.init(totalCards);
        }
        
        // Tableau pour stocker les cartes converties
        const convertedCards = [];
        
        // Tableau de correspondance des raretés de l'API vers celles de l'application
        const rarityMap = {
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
        
        // Récupérer les détails de chaque carte, mais avec un traitement par lots
        if (setData.cards && Array.isArray(setData.cards)) {
            let processedCount = 0;
            const totalCards = setData.cards.length;
            const batchSize = 5; // Nombre de requêtes à exécuter en parallèle
            
            // Traiter les cartes par lots pour accélérer le chargement
            for (let i = 0; i < totalCards; i += batchSize) {
                const cardBatch = setData.cards.slice(i, i + batchSize);
                const promises = cardBatch.map(async (cardSummary) => {
                    try {
                        // Récupérer les détails complets de la carte
                        const cardResponse = await fetch(`https://api.tcgdex.net/v2/fr/sets/${setId}/${cardSummary.localId}`);
                        
                        if (!cardResponse.ok) {
                            throw new Error(`Erreur de récupération (${cardResponse.status})`);
                        }
                        
                        const cardData = await cardResponse.json();
                        
                        // Déterminer la rareté pour l'application
                        let rarity = 'common'; // Valeur par défaut
                        
                        if (cardData.rarity) {
                            // Utiliser la correspondance si disponible, sinon valeur par défaut
                            rarity = rarityMap[cardData.rarity] || 'common';
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
                        const imageUrl = `https://assets.tcgdex.net/fr/${fullSetPath}/${cardData.localId}/high.jpg`;
                        
                        return {
                            id: formattedId,
                            name: cardData.name,
                            type: type,
                            rarity: rarity,
                            number: `${cardData.localId}/165`,
                            localId: cardData.localId,
                            imageUrl: imageUrl
                        };
                    } catch (cardError) {
                        console.warn(`Problème avec la carte ${cardSummary.id}:`, cardError);
                        
                        // Version simplifiée comme solution de secours
                        return {
                            id: `151-${cardSummary.localId}`,
                            name: cardSummary.name,
                            type: 'Incolore',
                            rarity: 'common',
                            number: `${cardSummary.localId}/165`,
                            localId: cardSummary.localId,
                            imageUrl: `https://assets.tcgdex.net/fr/${fullSetPath}/${cardSummary.localId}/high.jpg`
                        };
                    }
                });
                
                // Attendre que toutes les requêtes du lot soient terminées
                const cardResults = await Promise.all(promises);
                
                // Ajouter les cartes au tableau
                for (const card of cardResults) {
                    if (card) {
                        convertedCards.push(card);
                    }
                }
                
                // Mise à jour du compteur et de la progression
                processedCount += cardBatch.length;
                
                // Mettre à jour la progression
                if (window.loadingProgress) {
                    window.loadingProgress.update(cardBatch.length);
                }
                
                // Log de progression
                console.log(`Progression: ${processedCount}/${totalCards} cartes chargées (${Math.round(processedCount/totalCards*100)}%)`);
            }
        }
        
        // Vérifier si nous avons des cartes
        if (convertedCards.length > 0) {
            console.log(`Chargement terminé: ${convertedCards.length} cartes récupérées avec succès`);
            
            // Mettre en cache les données pour les prochaines visites
            localStorage.setItem('pokemon151Data', JSON.stringify({
                data: convertedCards,
                timestamp: Date.now()
            }));
            
            return convertedCards;
        } else {
            throw new Error('Aucune carte récupérée');
        }
        
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        console.log('Utilisation des données statiques comme solution de secours');
        
        // Mettre à jour l'indicateur de progression en cas d'erreur
        if (window.loadingProgress) {
            window.loadingProgress.update(100); // Signaler que le chargement est terminé
        }
        
        // Retourner les données statiques en cas d'erreur
        return window.pokemon151Data || [];
    }
}

// Rendre la fonction accessible depuis app.js
window.loadPokemon151Data = loadPokemon151Data;

/**
 * Fonctions pour gérer l'indicateur de chargement
 */

let totalCards = 0;
let loadedCards = 0;
const progressCallbacks = [];

/**
 * Initialise le compteur de progression
 * @param {number} total - Nombre total de cartes à charger
 */
function initProgress(total) {
    totalCards = total;
    loadedCards = 0;
    updateProgressUI(0);
}

/**
 * Met à jour la progression et informe les callbacks
 * @param {number} increment - Nombre de cartes supplémentaires chargées
 */
function updateProgress(increment = 1) {
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
function onProgressUpdate(callback) {
    if (typeof callback === 'function') {
        progressCallbacks.push(callback);
    }
}

// Rendre les fonctions accessibles globalement
window.loadingProgress = {
    init: initProgress,
    update: updateProgress,
    onUpdate: onProgressUpdate
};