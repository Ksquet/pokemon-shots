/**
 * Module de gestion des boosters Pokémon
 */
class BoosterOpener {
    constructor(setData) {
        this.setData = setData;
        this.stats = this.initStats();
        this.availableRarities = this.checkAvailableRarities();
    }

    /**
     * Initialise les statistiques
     * @returns {Object} Statistiques vides
     */
    initStats() {
        return {
            opened: 0,
            rare: 0,
            doubleRare: 0,
            ultraRare: 0,
            illustrationRare: 0,
            specialIllRare: 0,
            hyperRare: 0
            // foilEnergy a été supprimé
        };
    }

    /**
     * Vérifie quelles raretés sont disponibles dans les données
     * @returns {Object} Objet indiquant la disponibilité de chaque rareté
     */
    checkAvailableRarities() {
        return {
            common: this.setData.some(card => card.rarity === 'common'),
            uncommon: this.setData.some(card => card.rarity === 'uncommon'),
            rare: this.setData.some(card => card.rarity === 'rare'),
            ultraRare: this.setData.some(card => card.rarity === 'ultraRare'),
            secretRare: this.setData.some(card => card.rarity === 'secretRare'),
            trainer: this.setData.some(card => card.rarity === 'trainer'),
            energy: this.setData.some(card => card.rarity === 'energy')
        };
    }

    /**
     * Génère un booster aléatoire
     * @param {number} retries - Nombre de tentatives actuelles
     * @returns {Array} Un tableau d'objets carte
     */
    generateBooster(retries = 0) {
        // Protection contre les boucles infinies
        if (retries > 5) {
            return this.generateFallbackBooster();
        }
        
        // Tableau qui contiendra toutes les cartes du booster
        const booster = [];
        
        // Ajouter les cartes communes (4 cartes)
        for (let i = 0; i < BoosterOpener.BOOSTER_STRUCTURE.common; i++) {
            const card = this.getRandomCardByRarity('common');
            booster.push(card);
        }
        
        // Ajouter les cartes peu communes (3 cartes)
        const uncommonRarity = this.availableRarities.uncommon ? 'uncommon' : 'common';
        for (let i = 0; i < BoosterOpener.BOOSTER_STRUCTURE.uncommon; i++) {
            const card = this.getRandomCardByRarity(uncommonRarity);
            booster.push(card);
        }
        
        // Générer les 3 emplacements foil
        const foilCards = this.generateFoilCards();
        
        // Ajouter les cartes foil au booster
        for (const card of foilCards) {
            booster.push(card);
        }
        
        // Vérification finale du booster
        const verificationResult = this.verifyBoosterContent(booster);
        if (!verificationResult.isValid) {
            return this.generateBooster(retries + 1);
        }
        
        // Incrémenter le compteur de boosters ouverts
        this.stats.opened++;
        
        // Mélanger le booster pour que l'ordre des cartes soit aléatoire
        return this.shuffleArray(booster);
    }

    /**
     * Génère un booster de secours (utilisé en cas d'erreur)
     * @returns {Array} Un booster simple mais valide
     */
    generateFallbackBooster() {
        const booster = [];
        const commonRarity = this.availableRarities.common ? 'common' : 'rare';
        
        // 4 cartes communes (ou rares si pas de communes)
        for (let i = 0; i < 4; i++) {
            const card = this.getRandomCardByRarity(commonRarity);
            booster.push(card);
        }
        
        // 3 cartes uncommon (ou communes si pas d'uncommon)
        const uncommonRarity = this.availableRarities.uncommon ? 'uncommon' : commonRarity;
        for (let i = 0; i < 3; i++) {
            const card = this.getRandomCardByRarity(uncommonRarity);
            booster.push(card);
        }
        
        // 2 cartes rares
        const rareRarity = this.availableRarities.rare ? 'rare' : commonRarity;
        for (let i = 0; i < 2; i++) {
            const card = this.getRandomCardByRarity(rareRarity);
            card.isFoil = true;
            booster.push(card);
        }
        
        // 1 carte ultra-rare ou rare
        const ultraRareRarity = this.availableRarities.ultraRare ? 'ultraRare' : rareRarity;
        const specialCard = this.getRandomCardByRarity(ultraRareRarity);
        specialCard.isFoil = true;
        booster.push(specialCard);
        
        // Incrémenter le compteur
        this.stats.opened++;
        
        // Mélanger le booster
        return this.shuffleArray(booster);
    }

    /**
     * Génère les 3 cartes foil selon les probabilités exactes
     * @returns {Array} Tableau de 3 cartes foil
     */
    generateFoilCards() {
        // Tableau qui contiendra les cartes foil
        const foilCards = [];
        
        // COMPTEUR GLOBAL des ultra-rares dans le booster
        let ultraRareCount = 0;
        
        // Indicateur pour savoir si on a au moins une rare
        let hasRare = false;
        
        // Tableau pour stocker les candidats ultra-rares potentiels
        const potentialUltraRares = [];
        
        // Vérifier si on a des ultra-rares disponibles
        if (this.availableRarities.ultraRare || this.availableRarities.secretRare) {
            // Hyper Rare (1 sur 51 packs)
            if (Math.random() < BoosterOpener.PULL_RATES.hyperRare) {
                const card = this.getRandomCardByRarity('secretRare');
                card.isFoil = true;
                card.specialType = 'hyper';
                potentialUltraRares.push({ card, priority: 0 }); // Plus haute priorité
            }
            
            // Special Illustration Rare (1 sur 32 packs)
            if (Math.random() < BoosterOpener.PULL_RATES.specialIllRare) {
                const card = this.getRandomCardByRarity('ultraRare');
                card.isFoil = true;
                card.specialType = 'specialIll';
                potentialUltraRares.push({ card, priority: 1 });
            }
            
            // Illustration Rare (1 sur 12 packs)
            if (Math.random() < BoosterOpener.PULL_RATES.illustrationRare) {
                const card = this.getRandomCardByRarity('ultraRare');
                card.isFoil = true;
                card.specialType = 'illustration';
                potentialUltraRares.push({ card, priority: 2 });
            }
            
            // Ultra Rare standard (1 sur 16 packs)
            if (Math.random() < BoosterOpener.PULL_RATES.ultraRare) {
                const card = this.getRandomCardByRarity('ultraRare');
                card.isFoil = true;
                card.specialType = 'standard';
                potentialUltraRares.push({ card, priority: 3 });
            }
            
            // Trier les ultra-rares par ordre de priorité (les plus rares en premier)
            potentialUltraRares.sort((a, b) => a.priority - b.priority);
            
            // Limiter strictement à 2 ultra-rares maximum
            const selectedUltraRares = potentialUltraRares
                .slice(0, BoosterOpener.MAX_ULTRA_RARES)
                .map(item => item.card);
            
            // Ajouter les ultra-rares sélectionnées au booster
            for (const card of selectedUltraRares) {
                foilCards.push(card);
                ultraRareCount++;
                hasRare = true;
                
                // Mettre à jour les statistiques
                if (card.specialType === 'standard') this.stats.ultraRare++;
                else if (card.specialType === 'illustration') this.stats.illustrationRare++;
                else if (card.specialType === 'specialIll') this.stats.specialIllRare++;
                else if (card.specialType === 'hyper') this.stats.hyperRare++;
            }
        }
        
        // Double Rare (1 sur 8 packs)
        if (this.availableRarities.rare && Math.random() < BoosterOpener.PULL_RATES.doubleRare) {
            const card = this.getRandomCardByRarity('rare');
            card.isFoil = true;
            card.specialType = 'double';
            foilCards.push(card);
            hasRare = true;
            this.stats.doubleRare++;
        }
        
        // S'assurer qu'on a au moins une carte rare ou mieux
        if (!hasRare && foilCards.length < 3) {
            // Utiliser une rare si disponible, sinon utiliser une autre rareté
            const rareRarity = this.availableRarities.rare ? 'rare' : 
                               (this.availableRarities.uncommon ? 'uncommon' : 'common');
            
            const card = this.getRandomCardByRarity(rareRarity);
            card.isFoil = true;
            foilCards.push(card);
            
            if (rareRarity === 'rare') {
                this.stats.rare++;
                hasRare = true;
            }
        }
        
        // Compléter jusqu'à avoir exactement 3 cartes foil
        while (foilCards.length < 3) {
            // Déterminer quel type de carte ajouter
            const randomValue = Math.random();
            
            if (randomValue < 0.4 && !hasRare && this.availableRarities.rare) {
                // 40% de chance d'ajouter une rare standard si on n'en a pas encore
                const card = this.getRandomCardByRarity('rare');
                card.isFoil = true;
                foilCards.push(card);
                this.stats.rare++;
                hasRare = true;
            }
            else if (randomValue < 0.7 && this.availableRarities.uncommon) {
                // 30% de chance d'ajouter une peu commune
                const card = this.getRandomCardByRarity('uncommon');
                card.isFoil = true;
                foilCards.push(card);
            }
            else {
                // 30% de chance d'ajouter une commune
                const card = this.getRandomCardByRarity('common');
                card.isFoil = true;
                foilCards.push(card);
            }
        }
        
        // Vérification finale pour s'assurer qu'on a exactement 3 cartes
        return foilCards.slice(0, 3);
    }

    /**
     * Vérifie que le contenu du booster respecte toutes les règles
     * @param {Array} booster - Le booster à vérifier
     * @returns {Object} Résultat de la vérification
     */
    verifyBoosterContent(booster) {
        // Compter les cartes par type
        const counts = {
            total: 0,
            common: 0,
            uncommon: 0,
            rare: 0,
            ultraRare: 0,
            foils: 0
        };
        
        // Vérifier chaque carte
        booster.forEach(card => {
            counts.total++;
            
            // Compter par rareté
            if (card.rarity === 'common') counts.common++;
            else if (card.rarity === 'uncommon') counts.uncommon++;
            else if (card.rarity === 'rare') counts.rare++;
            else if (card.rarity === 'ultraRare' || card.rarity === 'secretRare') counts.ultraRare++;
            
            // Compter les foils
            if (card.isFoil) counts.foils++;
        });
        
        // Vérifier les règles
        const totalValid = counts.total === 10;
        const foilsValid = counts.foils === 3;
        const ultraRaresValid = counts.ultraRare <= BoosterOpener.MAX_ULTRA_RARES;
        
        // Vérifier qu'on a au moins une rare ou ultra-rare, si disponible
        const rareValid = this.availableRarities.rare || this.availableRarities.ultraRare || 
                          this.availableRarities.secretRare ? 
                          (counts.rare + counts.ultraRare >= 1) : true;
        
        // Résultat global - plus souple pour s'adapter aux données disponibles
        return {
            counts,
            isValid: totalValid && foilsValid && ultraRaresValid && rareValid
        };
    }

    /**
     * Obtient une carte aléatoire d'une rareté spécifique
     * @param {string} rarity - La rareté de la carte à obtenir
     * @returns {Object} Un objet représentant une carte
     */
    getRandomCardByRarity(rarity) {
        // Adaptation: si la rareté demandée n'est pas disponible, retourner une carte commune
        if (!this.availableRarities[rarity]) {
            const fallbackRarity = this.getFallbackRarity();
            return this.getRandomCardByRarity(fallbackRarity);
        }
        
        // Filtrer les cartes par rareté
        const cardsOfRarity = this.setData.filter(card => card.rarity === rarity);
        
        if (cardsOfRarity.length === 0) {
            return this.createGenericCard(rarity);
        }
        
        const randomIndex = Math.floor(Math.random() * cardsOfRarity.length);
        return { ...cardsOfRarity[randomIndex] }; // Créer une copie pour éviter les problèmes de référence
    }

    /**
     * Obtient une rareté de repli disponible
     * @returns {string} Une rareté disponible
     */
    getFallbackRarity() {
        // Vérifier les raretés dans cet ordre de préférence
        const rarityOrder = ['common', 'uncommon', 'rare', 'ultraRare', 'energy', 'trainer'];
        
        for (const rarity of rarityOrder) {
            if (this.availableRarities[rarity]) {
                return rarity;
            }
        }
        
        // En dernier recours, retourner 'common' et on créera une carte générique
        return 'common';
    }

    /**
     * Crée une carte générique (en cas d'urgence)
     * @param {string} rarity - La rareté souhaitée
     * @returns {Object} Un objet carte générique
     */
    createGenericCard(rarity) {
        return {
            id: `generic-${Math.floor(Math.random() * 1000)}`,
            name: `Carte ${rarity}`,
            type: 'Incolore',
            rarity: rarity,
            number: `0/0`,
            imageUrl: null
        };
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
        this.stats = this.initStats();
    }

    /**
     * Obtient les statistiques actuelles
     * @returns {Object} Les statistiques
     */
    getStats() {
        return this.stats;
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
            doubleRare: this.stats.doubleRare / this.stats.opened,
            ultraRare: this.stats.ultraRare / this.stats.opened,
            illustrationRare: this.stats.illustrationRare / this.stats.opened,
            specialIllRare: this.stats.specialIllRare / this.stats.opened,
            hyperRare: this.stats.hyperRare / this.stats.opened
            // foilEnergy a été supprimé
        };
        
        const expected = BoosterOpener.PULL_RATES;
        
        const comparison = {};
        for (const key in expected) {
            comparison[key] = {
                expected: expected[key],
                actual: actual[key] || 0,
                expectedText: `1 sur ${Math.round(1 / expected[key])}`,
                actualText: `1 sur ${Math.round(1 / (actual[key] || 0.0001))}`,
                difference: actual[key] ? (actual[key] - expected[key]) / expected[key] * 100 : 0
            };
        }
        
        return {
            totalOpened: this.stats.opened,
            comparison
        };
    }
}

// Structure fixe des boosters
BoosterOpener.BOOSTER_STRUCTURE = {
    common: 4,    // 4 cartes communes
    uncommon: 3,  // 3 cartes peu communes
    foil: 3       // 3 cartes brillantes (dont au moins une rare ou plus)
};

// Nombre maximum absolu d'ultra-rares par booster
BoosterOpener.MAX_ULTRA_RARES = 2;

// Taux de pull exacts pour chaque type de carte spéciale
BoosterOpener.PULL_RATES = {
    // foilEnergy: 0.2483,        // 24.83% - 1 sur 4 packs
    doubleRare: 0.1328,        // 13.28% - 1 sur 8 packs
    ultraRare: 0.0644,         // 6.44% - 1 sur 16 packs
    illustrationRare: 0.0850,  // 8.50% - 1 sur 12 packs
    specialIllRare: 0.0311,    // 3.11% - 1 sur 32 packs
    hyperRare: 0.0194          // 1.94% - 1 sur 51 packs
};

// Exporter la classe pour qu'elle soit accessible depuis d'autres scripts
export default BoosterOpener;