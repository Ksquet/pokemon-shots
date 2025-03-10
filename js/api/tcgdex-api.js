/**
 * Module d'intégration de l'API TCGdex pour le set Pokémon 151
 * Utilise directement les données en français retournées par l'API
 */

// Fonction pour charger les données du set Pokémon 151
async function loadPokemon151Data() {
    try {
        console.log('Chargement des données du set Pokémon 151 depuis TCGdex...');
        
        // ID du set et chemin pour les images
        const setId = 'sv03.5'; 
        const fullSetPath = 'sv/sv03.5';
        
        // Récupérer les détails du set
        const setResponse = await fetch(`https://api.tcgdex.net/v2/fr/sets/${setId}`);
        
        if (!setResponse.ok) {
            throw new Error(`Erreur lors de la récupération du set: ${setResponse.status}`);
        }
        
        const setData = await setResponse.json();
        console.log(`Set trouvé: ${setData.name} (${setData.id})`);
        console.log(`Nombre de cartes: ${setData.cardCount?.total || 'inconnu'}`);
        
        // Tableau pour stocker les cartes converties
        const convertedCards = [];
        
        // Tableau de correspondance des raretés de l'API vers celles de l'application
        const rarityMap = {
            'Commune': 'common',
            'Peu commune': 'uncommon',
            'Rare': 'rare',
            'Rare Holo': 'rare',
            'Ultra Rare': 'ultraRare',
            'Rare Holo V': 'ultraRare',
            'Rare Holo VMAX': 'ultraRare',
            'Rare Holo VSTAR': 'ultraRare',
            'Arc-en-ciel Rare': 'secretRare',
            'Rare Secrète': 'secretRare'
        };
        
        // Récupérer les détails de chaque carte
        if (setData.cards && Array.isArray(setData.cards)) {
            let processedCount = 0;
            
            for (const cardSummary of setData.cards) {
                try {
                    // Récupérer les détails complets de la carte
                    // Construire l'URL avec l'ID local de la carte (qui est déjà formaté correctement)
                    const cardResponse = await fetch(`https://api.tcgdex.net/v2/fr/sets/${setId}/${cardSummary.localId}`);
                    
                    if (!cardResponse.ok) {
                        throw new Error(`Erreur lors de la récupération de la carte ${cardSummary.id}: ${cardResponse.status}`);
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
                    
                    // Ajouter la carte formatée au tableau
                    convertedCards.push({
                        id: formattedId,
                        name: cardData.name,
                        type: type,
                        rarity: rarity,
                        number: `${cardData.localId}/165`,
                        localId: cardData.localId,
                        imageUrl: imageUrl
                    });
                    
                    // Incrémenter le compteur et afficher la progression
                    processedCount++;
                    if (processedCount % 10 === 0 || processedCount === setData.cards.length) {
                        console.log(`Progression: ${processedCount}/${setData.cards.length} cartes chargées`);
                    }
                    
                } catch (cardError) {
                    console.warn(`Problème avec la carte ${cardSummary.id}:`, cardError);
                    
                    // Version simplifiée comme solution de secours
                    convertedCards.push({
                        id: `151-${cardSummary.localId}`,
                        name: cardSummary.name,
                        type: 'Incolore',
                        rarity: 'common',
                        number: `${cardSummary.localId}/165`,
                        localId: cardSummary.localId,
                        imageUrl: `https://assets.tcgdex.net/fr/${fullSetPath}/${cardSummary.localId}/high.jpg`
                    });
                }
            }
        }
        
        // Vérifier si nous avons des cartes
        if (convertedCards.length > 0) {
            console.log(`Chargement terminé: ${convertedCards.length} cartes récupérées avec succès`);
            return convertedCards;
        } else {
            throw new Error('Aucune carte récupérée');
        }
        
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        console.log('Utilisation des données statiques comme solution de secours');
        
        // Retourner les données statiques en cas d'erreur
        return window.pokemon151Data || [];
    }
}

// Rendre la fonction accessible depuis app.js
window.loadPokemon151Data = loadPokemon151Data;