/**
 * Classe qui gère l'ouverture de boosters Pokémon
 * Avec distribution officielle des raretés
 */
class BoosterOpener {
    constructor(setData) {
        this.setData = setData;
        this.stats = {
            opened: 0,
            rare: 0,
            ultraRare: 0
        };
    }

    /**
     * Distribution des raretés dans un booster standard selon les règles officielles
     * Source: Site officiel Pokémon
     */
    static RARITY_DISTRIBUTION = {
        common: 4,      // 4 cartes communes
        uncommon: 3,    // 3 cartes peu communes
        foils: 2,       // 2 cartes brillantes (dont au moins une rare ou plus)
        rareOrBetter: 1, // 1 carte rare ou mieux (comptée dans les foils)
        energy: 1       // 1 carte énergie
    };

    /**
     * Probabilités d'obtenir des cartes de différentes raretés pour l'emplacement "rare ou mieux"
     */
    static RARE_SLOT_PROBABILITIES = {
        rare: 0.80,      // 80% de chance d'avoir une rare standard
        ultraRare: 0.15, // 15% de chance d'avoir une ultra rare (EX, Full Art, etc.)
        secretRare: 0.05 // 5% de chance d'avoir une secrète rare
    };

    /**
     * Génère un booster aléatoire
     * @returns {Array} Un tableau d'objets carte
     */
    generateBooster() {
        const booster = [];
        
        // 1. Ajouter les cartes communes (4 cartes)
        for (let i = 0; i < BoosterOpener.RARITY_DISTRIBUTION.common; i++) {
            booster.push(this.getRandomCardByRarity('common'));
        }
        
        // 2. Ajouter les cartes peu communes (3 cartes)
        for (let i = 0; i < BoosterOpener.RARITY_DISTRIBUTION.uncommon; i++) {
            booster.push(this.getRandomCardByRarity('uncommon'));
        }
        
        // 3. Ajouter la carte "rare ou mieux" basée sur les probabilités
        const rareSlotRandom = Math.random();
        let rareSlotRarity = 'rare'; // Par défaut
        
        if (rareSlotRandom < BoosterOpener.RARE_SLOT_PROBABILITIES.secretRare) {
            rareSlotRarity = 'secretRare';
            this.stats.ultraRare++;
        } else if (rareSlotRandom < BoosterOpener.RARE_SLOT_PROBABILITIES.secretRare + 
                   BoosterOpener.RARE_SLOT_PROBABILITIES.ultraRare) {
            rareSlotRarity = 'ultraRare';
            this.stats.ultraRare++;
        } else {
            this.stats.rare++;
        }
        
        booster.push(this.getRandomCardByRarity(rareSlotRarity));
        
        // 4. Ajouter une deuxième carte brillante (généralement rare, parfois uncommon)
        // Cette carte complète les 3 foils mentionnés (avec la rare ou mieux déjà ajoutée)
        const secondFoilRandom = Math.random();
        const secondFoilRarity = secondFoilRandom < 0.7 ? 'rare' : 'uncommon';
        booster.push(this.getRandomCardByRarity(secondFoilRarity));
        
        if (secondFoilRarity === 'rare') {
            this.stats.rare++;
        }
        
        // 5. Ajouter la carte énergie
        booster.push(this.getRandomCardByRarity('energy'));
        
        // Incrémenter le compteur de boosters ouverts
        this.stats.opened++;
        
        // Mélanger le booster pour que l'ordre des cartes soit aléatoire
        return this.shuffleArray(booster);
    }

    /**
     * Obtient une carte aléatoire d'une rareté spécifique
     * @param {string} rarity - La rareté de la carte à obtenir
     * @returns {Object} Un objet représentant une carte
     */
    getRandomCardByRarity(rarity) {
        const cardsOfRarity = this.setData.filter(card => card.rarity === rarity);
        
        if (cardsOfRarity.length === 0) {
            console.warn(`Aucune carte de rareté ${rarity} trouvée. Utilisation d'une carte commune à la place.`);
            return this.getRandomCardByRarity('common');
        }
        
        const randomIndex = Math.floor(Math.random() * cardsOfRarity.length);
        return cardsOfRarity[randomIndex];
    }

    /**
     * Mélange un tableau (algorithme de Fisher-Yates)
     * @param {Array} array - Le tableau à mélanger
     * @returns {Array} Le tableau mélangé
     */
    shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    /**
     * Réinitialise les statistiques
     */
    resetStats() {
        this.stats = {
            opened: 0,
            rare: 0,
            ultraRare: 0
        };
    }

    /**
     * Obtient les statistiques actuelles
     * @returns {Object} Les statistiques
     */
    getStats() {
        return this.stats;
    }
}

// Exporter la classe pour qu'elle soit accessible depuis d'autres scripts
window.BoosterOpener = BoosterOpener;