/**
 * Classe qui gère l'ouverture de boosters Pokémon
 * Version définitive respectant la structure et les probabilités exactes
 */
class BoosterOpener {
    constructor(setData) {
        this.setData = setData;
        this.stats = {
            opened: 0,
            rare: 0,
            doubleRare: 0,
            ultraRare: 0,
            illustrationRare: 0,
            specialIllRare: 0,
            hyperRare: 0,
            foilEnergy: 0
        };
    }

    /**
     * Structure fixe des boosters
     */
    static BOOSTER_STRUCTURE = {
        common: 4,    // 4 cartes communes
        uncommon: 3,  // 3 cartes peu communes
        foil: 3       // 3 cartes brillantes (dont au moins une rare ou plus)
    };

    /**
     * Nombre maximum absolu d'ultra-rares par booster
     */
    static MAX_ULTRA_RARES = 2;

    /**
     * Taux de pull exacts pour chaque type de carte spéciale
     * Source: Statistiques officielles
     */
    static PULL_RATES = {
        foilEnergy: 0.2483,        // 24.83% - 1 sur 4 packs
        doubleRare: 0.1328,        // 13.28% - 1 sur 8 packs
        ultraRare: 0.0644,         // 6.44% - 1 sur 16 packs
        illustrationRare: 0.0850,  // 8.50% - 1 sur 12 packs
        specialIllRare: 0.0311,    // 3.11% - 1 sur 32 packs
        hyperRare: 0.0194          // 1.94% - 1 sur 51 packs
    };

    /**
     * Génère un booster aléatoire
     * @returns {Array} Un tableau d'objets carte
     */
    generateBooster() {
        // Tableau qui contiendra toutes les cartes du booster
        const booster = [];
        
        // 1. Ajouter les cartes communes (4 cartes)
        for (let i = 0; i < BoosterOpener.BOOSTER_STRUCTURE.common; i++) {
            const card = this.getRandomCardByRarity('common');
            booster.push(card);
        }
        
        // 2. Ajouter les cartes peu communes (3 cartes)
        for (let i = 0; i < BoosterOpener.BOOSTER_STRUCTURE.uncommon; i++) {
            const card = this.getRandomCardByRarity('uncommon');
            booster.push(card);
        }
        
        // 3. Générer les 3 emplacements foil
        const foilCards = this.generateFoilCards();
        
        // 4. Ajouter les cartes foil au booster
        for (const card of foilCards) {
            booster.push(card);
        }
        
        // 5. Incrémenter le compteur de boosters ouverts
        this.stats.opened++;
        
        // 6. Mélanger le booster pour que l'ordre des cartes soit aléatoire
        return this.shuffleArray(booster);
    }

    /**
     * Génère les 3 cartes foil selon les probabilités exactes
     * @returns {Array} Tableau de 3 cartes foil
     */
    generateFoilCards() {
        // Tableau qui contiendra les cartes foil
        const foilCards = [];
        
        // Variables de suivi
        let ultraRareCount = 0;
        let hasRare = false;
        
        // Tableau pour stocker toutes les cartes ultra-rares potentielles
        const potentialUltraRares = [];
        
        // 1. Déterminer quelles cartes spéciales apparaissent dans ce booster
        // en suivant EXACTEMENT les taux de pull

        // Hyper Rare (1 sur 51 packs) - La plus rare
        if (Math.random() < BoosterOpener.PULL_RATES.hyperRare) {
            const card = this.getRandomCardByRarity('secretRare');
            card.isFoil = true;
            card.specialType = 'hyper';
            potentialUltraRares.push(card);
        }
        
        // Special Illustration Rare (1 sur 32 packs)
        if (Math.random() < BoosterOpener.PULL_RATES.specialIllRare) {
            const card = this.getRandomCardByRarity('ultraRare');
            card.isFoil = true;
            card.specialType = 'specialIll';
            potentialUltraRares.push(card);
        }
        
        // Illustration Rare (1 sur 12 packs)
        if (Math.random() < BoosterOpener.PULL_RATES.illustrationRare) {
            const card = this.getRandomCardByRarity('ultraRare');
            card.isFoil = true;
            card.specialType = 'illustration';
            potentialUltraRares.push(card);
        }
        
        // Ultra Rare standard (1 sur 16 packs)
        if (Math.random() < BoosterOpener.PULL_RATES.ultraRare) {
            const card = this.getRandomCardByRarity('ultraRare');
            card.isFoil = true;
            card.specialType = 'standard';
            potentialUltraRares.push(card);
        }
        
        // Trier et limiter les ultra-rares à 2 maximum
        const selectedUltraRares = potentialUltraRares.slice(0, 2);
        
        // Ajouter les ultra-rares sélectionnées
        foilCards.push(...selectedUltraRares);
        
        // Double Rare (1 sur 8 packs)
        if (Math.random() < BoosterOpener.PULL_RATES.doubleRare) {
            const card = this.getRandomCardByRarity('rare');
            card.isFoil = true;
            card.specialType = 'double';
            foilCards.push(card);
            hasRare = true;
            this.stats.doubleRare++;
        }
        
        // Foil Energy (1 sur 4 packs)
        if (Math.random() < BoosterOpener.PULL_RATES.foilEnergy) {
            const card = this.getRandomCardByRarity('energy');
            card.isFoil = true;
            card.specialType = 'foil';
            foilCards.push(card);
            this.stats.foilEnergy++;
        }
        
        // Mettre à jour les statistiques
        selectedUltraRares.forEach(card => {
            if (card.specialType === 'standard') this.stats.ultraRare++;
            else if (card.specialType === 'illustration') this.stats.illustrationRare++;
            else if (card.specialType === 'specialIll') this.stats.specialIllRare++;
            else if (card.specialType === 'hyper') this.stats.hyperRare++;
        });
        
        // 2. S'assurer qu'on a au moins une carte rare si aucune n'a été tirée
        if (!hasRare && foilCards.length < 3) {
            const card = this.getRandomCardByRarity('rare');
            card.isFoil = true;
            foilCards.push(card);
            this.stats.rare++;
        }
        
        // 3. Compléter jusqu'à avoir exactement 3 cartes foil
        while (foilCards.length < 3) {
            // Déterminer quelle type de carte ajouter
            const randomValue = Math.random();
            
            if (randomValue < 0.2) {
                // 20% de chance d'ajouter une rare standard
                const card = this.getRandomCardByRarity('rare');
                card.isFoil = true;
                foilCards.push(card);
                this.stats.rare++;
            } 
            else if (randomValue < 0.6) {
                // 40% de chance d'ajouter une peu commune
                const card = this.getRandomCardByRarity('uncommon');
                card.isFoil = true;
                foilCards.push(card);
            }
            else if (randomValue < 0.8) {
                // 20% de chance d'ajouter une commune
                const card = this.getRandomCardByRarity('common');
                card.isFoil = true;
                foilCards.push(card);
            }
            else {
                // 20% de chance d'ajouter une énergie (sauf si déjà présente)
                if (!foilCards.some(card => card.rarity === 'energy')) {
                    const card = this.getRandomCardByRarity('energy');
                    card.isFoil = true;
                    foilCards.push(card);
                } else {
                    // Si on a déjà une énergie, ajouter une peu commune
                    const card = this.getRandomCardByRarity('uncommon');
                    card.isFoil = true;
                    foilCards.push(card);
                }
            }
        }
        
        return foilCards;
    }

    /**
     * Obtient une carte aléatoire d'une rareté spécifique
     * @param {string} rarity - La rareté de la carte à obtenir
     * @returns {Object} Un objet représentant une carte
     */
    getRandomCardByRarity(rarity) {
        // Filtrer les cartes par rareté
        let cardsOfRarity;
        
        if (rarity === 'ultraRare') {
            // Pour les ultra-rares, inclure également les secrètes rares
            cardsOfRarity = this.setData.filter(card => 
                card.rarity === 'ultraRare');
        } else if (rarity === 'secretRare') {
            cardsOfRarity = this.setData.filter(card => 
                card.rarity === 'secretRare');
            
            // Si pas de cartes secrètes, utiliser des ultra-rares
            if (cardsOfRarity.length === 0) {
                cardsOfRarity = this.setData.filter(card => 
                    card.rarity === 'ultraRare');
            }
        } else {
            cardsOfRarity = this.setData.filter(card => card.rarity === rarity);
        }
        
        if (cardsOfRarity.length === 0) {
            console.warn(`Aucune carte de rareté ${rarity} trouvée. Utilisation d'une carte commune à la place.`);
            return this.getRandomCardByRarity('common');
        }
        
        const randomIndex = Math.floor(Math.random() * cardsOfRarity.length);
        return { ...cardsOfRarity[randomIndex] }; // Créer une copie pour éviter les problèmes de référence
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
            doubleRare: 0,
            ultraRare: 0,
            illustrationRare: 0,
            specialIllRare: 0,
            hyperRare: 0,
            foilEnergy: 0
        };
    }

    /**
     * Obtient les statistiques actuelles
     * @returns {Object} Les statistiques
     */
    getStats() {
        return this.stats;
    }
    
    /**
     * Vérifie le contenu d'un booster (fonction de débogage)
     * @param {Array} booster - Le booster à vérifier
     * @returns {Object} Statistiques du booster
     */
    checkBoosterContent(booster) {
        const counts = {
            total: booster.length,
            common: 0,
            uncommon: 0,
            rare: 0,
            ultraRare: 0,
            energy: 0,
            foils: 0
        };
        
        // Compter les cartes par rareté
        booster.forEach(card => {
            if (card.rarity === 'common') counts.common++;
            else if (card.rarity === 'uncommon') counts.uncommon++;
            else if (card.rarity === 'rare') counts.rare++;
            else if (card.rarity === 'ultraRare' || card.rarity === 'secretRare') counts.ultraRare++;
            else if (card.rarity === 'energy') counts.energy++;
            
            // Compter les foils
            if (card.isFoil) counts.foils++;
        });
        
        // Vérifier que la structure est valide
        const isValid = counts.total === 10 && 
                         counts.common === 4 && 
                         counts.uncommon === 3 && 
                         counts.foils === 3 && 
                         counts.ultraRare <= 2 && 
                         (counts.rare + counts.ultraRare >= 1);
        
        return {
            counts,
            isValid,
            message: isValid ? 'Structure valide' : 'Structure invalide'
        };
    }
    
    /**
     * Vérifie si les statistiques correspondent aux taux de pull attendus
     * @returns {Object} Statistiques comparées aux taux théoriques
     */
    checkPullRates() {
        if (this.stats.opened === 0) {
            return { message: "Pas de boosters ouverts" };
        }
        
        const actual = {
            foilEnergy: this.stats.foilEnergy / this.stats.opened,
            doubleRare: this.stats.doubleRare / this.stats.opened,
            ultraRare: this.stats.ultraRare / this.stats.opened,
            illustrationRare: this.stats.illustrationRare / this.stats.opened,
            specialIllRare: this.stats.specialIllRare / this.stats.opened,
            hyperRare: this.stats.hyperRare / this.stats.opened
        };
        
        const expected = BoosterOpener.PULL_RATES;
        
        const comparison = {};
        for (const key in expected) {
            comparison[key] = {
                expected: expected[key],
                actual: actual[key],
                expectedText: `1 sur ${Math.round(1 / expected[key])}`,
                actualText: `1 sur ${Math.round(1 / (actual[key] || 0.0001))}`,
                difference: actual[key] ? (actual[key] - expected[key]) / expected[key] * 100 : 'N/A'
            };
        }
        
        return {
            totalOpened: this.stats.opened,
            comparison,
            message: "Comparaison des taux de pull"
        };
    }
}

// Exporter la classe pour qu'elle soit accessible depuis d'autres scripts
window.BoosterOpener = BoosterOpener;