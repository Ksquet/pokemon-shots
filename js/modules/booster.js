/**
 * Solution complète pour le problème des Double Rare
 * À intégrer dans le fichier booster.js
 */

class BoosterOpener {
    constructor(setData) {
        this.setData = setData;
        this.stats = this.initStats();
        this.rarityMapping = this.analyzeRarities();
        this.availableRarities = this.checkAvailableRarities();
        
        // Journalisation pour débogage
        this.debugMode = true;
        this.log = [];
    }

    /**
     * Initialise les statistiques
     * @returns {Object} Statistiques vides
     */
    initStats() {
        return {
            opened: 0,        // Nombre total de boosters ouverts
            doubleRare: 0     // Nombre de doubles rares obtenues
        };
    }

    /**
     * Ajoute une entrée au journal de débogage
     * @param {string} message - Message à journaliser
     */
    addLog(message) {
        if (this.debugMode) {
            console.log(`[Booster] ${message}`);
            this.log.push({
                time: new Date(),
                message
            });
        }
    }

    /**
     * Analyse les raretés disponibles dans les données
     * @returns {Object} Mapping des raretés
     */
    analyzeRarities() {
        const rarities = {};
        const rarityMap = {};
        
        // Compter les cartes par rareté
        this.setData.forEach(card => {
            const rarity = card.rarity || 'unknown';
            if (!rarities[rarity]) {
                rarities[rarity] = 0;
            }
            rarities[rarity]++;
        });
        
        // Analyser les noms de rareté
        for (const rarity in rarities) {
            // Déterminer la catégorie de base
            if (rarity.match(/commun|common/i)) {
                rarityMap[rarity] = 'common';
            } else if (rarity.match(/peu.*commun|uncommon/i)) {
                rarityMap[rarity] = 'uncommon';
            } else if (rarity.match(/rare(?!.*double|.*brillant)/i)) {
                rarityMap[rarity] = 'rare';
            } else if (rarity.match(/double.*rare|rare.*brillan/i)) {
                rarityMap[rarity] = 'doubleRare';
            } else if (rarity.match(/ultra.*rare|rare.*holo.*v|illustration.*rare/i)) {
                rarityMap[rarity] = 'ultraRare';
            } else if (rarity.match(/secret|hyper|arc.*en.*ciel|illustration.*speciale/i)) {
                rarityMap[rarity] = 'secretRare';
            } else if (rarity.match(/dresseur|trainer/i)) {
                rarityMap[rarity] = 'trainer';
            } else if (rarity.match(/energie|energy/i)) {
                rarityMap[rarity] = 'energy';
            } else {
                rarityMap[rarity] = 'unknown';
            }
        }
        
        // Analyser chaque carte pour les cas particuliers
        this.setData.forEach(card => {
            // Si une carte a "-ex" dans son ID ou son nom, elle est probablement Double Rare
            if ((card.id && card.id.toLowerCase().includes('-ex')) || 
                (card.name && card.name.toLowerCase().endsWith(' ex'))) {
                
                // Capturer la rareté originale avant de l'écraser
                const originalRarity = card.rarity;
                const mappedRarity = rarityMap[originalRarity] || 'unknown';
                
                // Si elle n'est pas déjà identifiée comme doubleRare, la marquer
                if (mappedRarity !== 'doubleRare') {
                    this.addLog(`Carte ${card.name} (${card.id}) avec rareté ${originalRarity} classée comme doubleRare car son nom/ID contient 'ex'`);
                    rarityMap[originalRarity] = 'doubleRare';
                }
            }
        });
        
        // Journaliser pour débogage
        if (this.debugMode) {
            console.log('Raretés détectées:', rarities);
            console.log('Mapping des raretés:', rarityMap);
        }
        
        return rarityMap;
    }

    /**
     * Vérifie quelles raretés sont disponibles après mapping
     * @returns {Object} Disponibilité des raretés
     */
    checkAvailableRarities() {
        const available = {
            common: false,
            uncommon: false,
            rare: false,
            doubleRare: false,
            ultraRare: false,
            secretRare: false,
            trainer: false,
            energy: false
        };
        
        // Vérifier chaque carte
        this.setData.forEach(card => {
            const rarity = card.rarity || 'unknown';
            const mappedRarity = this.rarityMapping[rarity] || 'unknown';
            
            if (mappedRarity in available) {
                available[mappedRarity] = true;
            }
        });
        
        // Journaliser pour débogage
        if (this.debugMode) {
            console.log('Raretés disponibles après mapping:', available);
        }
        
        return available;
    }
    
    /**
     * Obtient une carte de type spécifique selon le mapping de raretés
     * @param {string} rarityType - Type de rareté mappée
     * @returns {Object} Carte aléatoire du type demandé
     */
    getCardByMappedRarity(rarityType) {
        // Trouver toutes les raretés d'origine qui correspondent au type mappé
        const originalRarities = Object.entries(this.rarityMapping)
            .filter(([originalRarity, mappedRarity]) => mappedRarity === rarityType)
            .map(([originalRarity]) => originalRarity);
        
        if (originalRarities.length === 0) {
            this.addLog(`Aucune rareté originale trouvée pour le type "${rarityType}"`);
            return this.createGenericCard(rarityType);
        }
        
        // Filtrer les cartes par ces raretés d'origine
        const eligibleCards = this.setData.filter(card => 
            originalRarities.includes(card.rarity)
        );
        
        if (eligibleCards.length === 0) {
            this.addLog(`Aucune carte trouvée pour le type "${rarityType}" (raretés: ${originalRarities.join(', ')})`);
            return this.createGenericCard(rarityType);
        }
        
        // Sélectionner une carte aléatoire
        const randomIndex = Math.floor(Math.random() * eligibleCards.length);
        const selectedCard = eligibleCards[randomIndex];
        
        this.addLog(`Carte sélectionnée: ${selectedCard.name} (${selectedCard.id}), type: ${rarityType}, rareté originale: ${selectedCard.rarity}`);
        
        // Créer une copie profonde pour éviter les modifications croisées
        return JSON.parse(JSON.stringify(selectedCard));
    }

    /**
     * Crée une carte générique en cas d'urgence
     * @param {string} rarityType - Type de rareté
     * @returns {Object} Carte générique
     */
    createGenericCard(rarityType) {
        return {
            id: `generic-${Math.floor(Math.random() * 1000)}`,
            name: `Carte ${rarityType}`,
            type: 'Incolore',
            rarity: rarityType,
            number: `?/?`,
            imageUrl: null
        };
    }

    /**
     * Génère un booster aléatoire
     * @returns {Array} Un tableau d'objets carte
     */
    generateBooster() {
        this.addLog(`Génération d'un nouveau booster (#${this.stats.opened + 1})`);
        
        // Tableau qui contiendra toutes les cartes du booster
        const booster = [];
        // Flag pour suivre si ce booster contient une Double Rare
        let hasDoubleRare = false;
        
        // Ajouter les cartes communes (4 cartes)
        for (let i = 0; i < BoosterOpener.BOOSTER_STRUCTURE.common; i++) {
            const card = this.getCardByMappedRarity('common');
            card.DEBUG_ORDER = `C${i+1}`;
            booster.push(card);
        }
        
        // Ajouter les cartes peu communes (3 cartes)
        const uncommonRarity = this.availableRarities.uncommon ? 'uncommon' : 'common';
        for (let i = 0; i < BoosterOpener.BOOSTER_STRUCTURE.uncommon; i++) {
            const card = this.getCardByMappedRarity(uncommonRarity);
            card.DEBUG_ORDER = `U${i+1}`;
            booster.push(card);
        }
        
        // Ajouter les cartes rares (3 cartes)
        for (let i = 0; i < BoosterOpener.BOOSTER_STRUCTURE.foil; i++) {
            // Pour le dernier slot: chance d'obtenir une Double Rare
            if (i === 2 && this.availableRarities.doubleRare && Math.random() < BoosterOpener.PULL_RATES.doubleRare) {
                // Sélectionner une carte mappée comme "doubleRare"
                const card = this.getCardByMappedRarity('doubleRare');
                card.isFoil = true;
                card.specialType = 'double';
                card.isDoubleRare = true;
                card.DEBUG_ORDER = `DR`;
                
                // Ajouter un marqueur visuel pour débogage
                if (this.debugMode) {
                    card.name = `[DR] ${card.name}`;
                }
                
                booster.push(card);
                
                // Marquer ce booster comme contenant une Double Rare
                hasDoubleRare = true;
                this.addLog(`Double Rare générée: ${card.name} (${card.id})`);
            } else {
                // Carte rare standard ou commune/peu commune selon disponibilité
                const rarity = (i === 2 && this.availableRarities.rare) ? 'rare' : 
                              (this.availableRarities.uncommon ? 'uncommon' : 'common');
                
                const card = this.getCardByMappedRarity(rarity);
                
                // CORRECTION: Vérifier si malgré tout, on a sélectionné une Double Rare
                // Cela peut arriver si la rareté originale est doubleRare mais a été mal mappée
                const originalRarity = card.rarity || 'unknown';
                if (originalRarity === 'doubleRare' || 
                    this.rarityMapping[originalRarity] === 'doubleRare' ||
                    originalRarity.toLowerCase().includes('double') ||
                    (card.id && card.id.includes('-ex'))) {
                    
                    this.addLog(`CORRECTION: Carte ${card.name} (${card.id}) détectée comme Double Rare par sa rareté (${originalRarity}) ou son ID`);
                    
                    // Marquer comme Double Rare
                    card.isFoil = true;
                    card.specialType = 'double';
                    card.isDoubleRare = true;
                    card.DEBUG_ORDER = `DR`;
                    
                    // Ajouter un marqueur visuel pour débogage
                    if (this.debugMode) {
                        card.name = `[DR] ${card.name}`;
                    }
                    
                    // Marquer ce booster comme contenant une Double Rare
                    hasDoubleRare = true;
                } else {
                    card.isFoil = true;
                    card.DEBUG_ORDER = `R${i+1}`;
                }
                
                booster.push(card);
            }
        }
        
        // Incrémenter le compteur de boosters ouverts
        this.stats.opened++;
        
        // Incrémenter le compteur de Double Rare UNIQUEMENT si le booster en contient réellement une
        if (hasDoubleRare) {
            this.stats.doubleRare++;
            this.addLog(`Stats mises à jour - Double Rare: ${this.stats.doubleRare}/${this.stats.opened}`);
        }
        
        // Vérification finale du contenu du booster
        const doubleRareCards = booster.filter(card => card.isDoubleRare === true);
        this.addLog(`Vérification finale: ${doubleRareCards.length} Double Rare(s)`);
        
        // Ne pas mélanger pour le débogage, ou décommenter pour retrouver le comportement normal
        // return booster;
        return this.shuffleArray(booster);
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
        this.addLog(`Statistiques réinitialisées`);
    }

    /**
     * Obtient les statistiques actuelles
     * @returns {Object} Les statistiques
     */
    getStats() {
        return { ...this.stats };
    }
    
    /**
     * Vérifie si les statistiques correspondent aux taux de pull attendus
     * @returns {Object} Statistiques comparées aux taux théoriques
     */
    checkPullRates() {
        if (this.stats.opened === 0) {
            return { 
                message: "Pas de boosters ouverts",
                totalOpened: 0,
                comparison: {
                    doubleRare: {
                        expected: BoosterOpener.PULL_RATES.doubleRare,
                        actual: 0,
                        expectedText: `1 sur ${Math.round(1 / BoosterOpener.PULL_RATES.doubleRare)}`,
                        actualText: "N/A",
                        difference: 0
                    }
                }
            };
        }
        
        const actual = {
            doubleRare: this.stats.doubleRare / this.stats.opened
        };
        
        const expected = {
            doubleRare: BoosterOpener.PULL_RATES.doubleRare
        };
        
        const comparison = {};
        for (const key in expected) {
            comparison[key] = {
                expected: expected[key],
                actual: actual[key] || 0,
                expectedText: `1 sur ${Math.round(1 / expected[key])}`,
                actualText: actual[key] ? `1 sur ${Math.round(1 / actual[key])}` : "N/A",
                difference: actual[key] ? (actual[key] - expected[key]) / expected[key] * 100 : 0
            };
        }
        
        return {
            totalOpened: this.stats.opened,
            comparison
        };
    }
    
    /**
     * Exporte le journal de débogage
     * @returns {string} Journal formaté
     */
    exportLog() {
        return this.log.map(entry => 
            `[${entry.time.toLocaleTimeString()}] ${entry.message}`
        ).join('\n');
    }
}

// Structure fixe des boosters
BoosterOpener.BOOSTER_STRUCTURE = {
    common: 4,    // 4 cartes communes
    uncommon: 3,  // 3 cartes peu communes
    foil: 3       // 3 cartes brillantes (dont au moins une rare ou plus)
};

// Taux de pull exacts pour chaque type de carte spéciale
BoosterOpener.PULL_RATES = {
    doubleRare: 0.1328  // 13.28% - 1 sur 8 packs
};

// Exporter la classe pour qu'elle soit accessible depuis d'autres scripts
export default BoosterOpener;