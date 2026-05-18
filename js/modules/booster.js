/**
 * Générateur de boosters Pokémon 151 basé sur la répartition décrite pour S/V 151.
 */

class BoosterOpener {
    constructor(setData) {
        this.setData = setData;
        this.debugMode = false;
        this.log = [];
        this.stats = this.initStats();
        this.rarityMapping = this.analyzeRarities();
        this.availableRarities = this.checkAvailableRarities();
    }

    /**
     * Initialise les statistiques.
     * @returns {Object} Statistiques vides.
     */
    initStats() {
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
     * Retourne les catégories qui doivent alimenter les statistiques de hits.
     * @returns {Array<string>} Catégories spéciales suivies.
     */
    getSpecialStatTypes() {
        return ['doubleRare', 'ultraRare', 'illustrationRare', 'specialIllustrationRare', 'hyperRare'];
    }

    /**
     * Normalise les anciens et nouveaux noms de types spéciaux.
     * @returns {Object} Alias de types spéciaux vers les compteurs.
     */
    getSpecialTypeAliases() {
        return {
            double: 'doubleRare',
            doubleRare: 'doubleRare',
            standard: 'ultraRare',
            ultraRare: 'ultraRare',
            illustration: 'illustrationRare',
            illustrationRare: 'illustrationRare',
            specialIll: 'specialIllustrationRare',
            specialIllRare: 'specialIllustrationRare',
            specialIllustrationRare: 'specialIllustrationRare',
            hyper: 'hyperRare',
            hyperRare: 'hyperRare'
        };
    }

    /**
     * Ajoute une entrée au journal de débogage.
     * @param {string} message - Message à journaliser.
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
     * Normalise une chaîne pour comparer les raretés françaises et anglaises.
     * @param {string} value - Valeur à normaliser.
     * @returns {string} Valeur normalisée.
     */
    normalizeText(value) {
        return String(value || '')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[\s_-]+/g, ' ')
            .trim();
    }

    /**
     * Convertit la rareté fournie par les données en catégorie de tirage.
     * L'ordre est volontairement du plus spécifique au plus générique pour éviter
     * que "Ultra Rare", "Double Rare" ou "Hyper Rare" soient classées en simple "Rare".
     * @param {string} rarity - Rareté brute de la carte.
     * @returns {string} Catégorie de tirage.
     */
    classifyRarity(rarity) {
        const normalized = this.normalizeText(rarity);

        if (/peu commun|uncommon/.test(normalized)) {
            return 'uncommon';
        }

        if (/commun|common/.test(normalized)) {
            return 'common';
        }

        if (/double rare|rare double|double/.test(normalized)) {
            return 'doubleRare';
        }

        if (/special illustration rare|special ill rare|illustration speciale|speciale illustration|sir/.test(normalized)) {
            return 'specialIllustrationRare';
        }

        if (/illustration rare|rare illustration|ir/.test(normalized)) {
            return 'illustrationRare';
        }

        if (/hyper rare|rare hyper|hyper|secret rare|rare secrete|secrete|secret/.test(normalized)) {
            return 'hyperRare';
        }

        if (/ultra rare|rare ultra|ultra/.test(normalized)) {
            return 'ultraRare';
        }

        if (/dresseur|trainer/.test(normalized)) {
            return 'trainer';
        }

        if (/energie|energy/.test(normalized)) {
            return 'energy';
        }

        if (/rare/.test(normalized)) {
            return 'rare';
        }

        return 'unknown';
    }


    /**
     * Détermine la rareté mappée d'une carte en tenant compte de specialType,
     * rarity et originalRarity. Cela évite qu'une carte API mal normalisée
     * comme Carabaffe avec originalRarity "Illustration rare" reste classée commune.
     * @param {Object} card - Carte à classifier.
     * @returns {string} Catégorie de rareté.
     */
    getMappedRarityForCard(card) {
        const specialTypeAliases = this.getSpecialTypeAliases();
        const specialStatTypes = this.getSpecialStatTypes();

        if (card.specialType && specialTypeAliases[card.specialType]) {
            return specialTypeAliases[card.specialType];
        }

        const originalRarityType = this.classifyRarity(card.originalRarity);
        if (specialStatTypes.includes(originalRarityType)) {
            return originalRarityType;
        }

        const rarity = card.rarity || 'unknown';
        return this.rarityMapping?.[rarity] || this.classifyRarity(rarity);
    }

    /**
     * Analyse les raretés disponibles dans les données.
     * @returns {Object} Mapping des raretés brutes vers les catégories de tirage.
     */
    analyzeRarities() {
        const rarities = {};
        const rarityMap = {};

        this.setData.forEach(card => {
            const rarity = card.rarity || 'unknown';
            rarities[rarity] = (rarities[rarity] || 0) + 1;
        });

        for (const rarity in rarities) {
            rarityMap[rarity] = this.classifyRarity(rarity);
        }

        this.addLog(`Raretés détectées: ${JSON.stringify(rarities)}`);
        this.addLog(`Mapping des raretés: ${JSON.stringify(rarityMap)}`);

        return rarityMap;
    }

    /**
     * Vérifie quelles raretés sont disponibles après mapping.
     * @returns {Object} Disponibilité des raretés.
     */
    checkAvailableRarities() {
        const available = {
            common: false,
            uncommon: false,
            rare: false,
            doubleRare: false,
            ultraRare: false,
            illustrationRare: false,
            specialIllustrationRare: false,
            hyperRare: false,
            trainer: false,
            energy: false
        };

        this.setData.forEach(card => {
            const mappedRarity = this.getMappedRarityForCard(card);

            if (mappedRarity in available) {
                available[mappedRarity] = true;
            }
        });

        this.addLog(`Raretés disponibles après mapping: ${JSON.stringify(available)}`);

        return available;
    }

    /**
     * Obtient une carte de type spécifique selon le mapping de raretés.
     * @param {string} rarityType - Type de rareté mappée.
     * @returns {Object} Carte aléatoire du type demandé.
     */
    getCardByMappedRarity(rarityType) {
        const eligibleCards = this.getCardsByMappedRarity(rarityType);

        if (eligibleCards.length === 0) {
            this.addLog(`Aucune carte trouvée pour le type "${rarityType}"`);
            return this.createGenericCard(rarityType);
        }

        const randomIndex = Math.floor(Math.random() * eligibleCards.length);
        const selectedCard = eligibleCards[randomIndex];

        this.addLog(`Carte sélectionnée: ${selectedCard.name} (${selectedCard.id}), type: ${rarityType}, rareté originale: ${selectedCard.rarity}`);

        return JSON.parse(JSON.stringify(selectedCard));
    }

    /**
     * Liste les cartes correspondant à une catégorie de rareté.
     * @param {string} rarityType - Catégorie de rareté.
     * @returns {Array} Cartes éligibles.
     */
    getCardsByMappedRarity(rarityType) {
        return this.setData.filter(card => this.getMappedRarityForCard(card) === rarityType);
    }

    /**
     * Obtient une carte aléatoire parmi plusieurs catégories de rareté.
     * @param {Array<string>} rarityTypes - Catégories acceptées.
     * @returns {Object} Carte aléatoire.
     */
    getCardByAnyMappedRarity(rarityTypes) {
        const eligibleCards = rarityTypes.flatMap(rarityType => this.getCardsByMappedRarity(rarityType));

        if (eligibleCards.length === 0) {
            return this.createGenericCard(rarityTypes[0] || 'unknown');
        }

        const selectedCard = eligibleCards[Math.floor(Math.random() * eligibleCards.length)];
        return JSON.parse(JSON.stringify(selectedCard));
    }

    /**
     * Crée une carte générique en cas d'urgence.
     * @param {string} rarityType - Type de rareté.
     * @returns {Object} Carte générique.
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
     * Ajoute les métadonnées visuelles et statistiques d'un slot spécial.
     * @param {Object} card - Carte à annoter.
     * @param {string} rarityType - Catégorie spéciale tirée.
     * @param {string} order - Position de débogage.
     * @returns {Object} Carte annotée.
     */
    markSpecialCard(card, rarityType, order) {
        card.isFoil = true;
        card.specialType = rarityType;
        card.DEBUG_ORDER = order;

        if (rarityType === 'doubleRare') {
            card.isDoubleRare = true;
        }

        return card;
    }

    /**
     * Tire une carte spéciale uniquement si la catégorie existe dans les données.
     * @param {string} rarityType - Catégorie spéciale souhaitée.
     * @param {string} order - Position de débogage.
     * @returns {Object|null} Carte spéciale ou null si indisponible.
     */
    tryPullSpecialCard(rarityType, order) {
        if (!this.availableRarities[rarityType]) {
            this.addLog(`Tirage ${rarityType} ignoré: aucune carte de cette rareté dans les données`);
            return null;
        }

        return this.markSpecialCard(this.getCardByMappedRarity(rarityType), rarityType, order);
    }

    /**
     * Tire une carte reverse holo simulée parmi les communes, peu communes et rares standards.
     * @param {string} order - Position de débogage.
     * @returns {Object} Carte reverse holo simulée.
     */
    pullReverseHolo(order) {
        const rarityTypes = ['common', 'uncommon', 'rare'].filter(rarityType => this.availableRarities[rarityType]);
        const card = this.getCardByAnyMappedRarity(rarityTypes.length > 0 ? rarityTypes : ['common']);
        card.isFoil = true;
        card.isReverseHolo = true;
        card.DEBUG_ORDER = order;
        return card;
    }

    /**
     * Tire la 10e carte: Illustration Rare, Special Illustration Rare ou Reverse Holo.
     * @returns {Object} Carte du deuxième slot reverse.
     */
    pullSecondReverseSlot() {
        const roll = Math.random();
        const rates = BoosterOpener.PULL_RATES;

        if (roll < rates.illustrationRare) {
            const card = this.tryPullSpecialCard('illustrationRare', 'IR');
            if (card) {
                return card;
            }
        }

        if (roll < rates.illustrationRare + rates.specialIllustrationRare) {
            const card = this.tryPullSpecialCard('specialIllustrationRare', 'SIR');
            if (card) {
                return card;
            }
        }

        return this.pullReverseHolo('RH2');
    }

    /**
     * Tire la carte du dernier slot: Rare, Double Rare, Ultra Rare ou Hyper Rare.
     * @returns {Object} Carte du slot rare.
     */
    pullRareSlot() {
        const roll = Math.random();
        const rates = BoosterOpener.PULL_RATES;

        if (roll < rates.hyperRare) {
            const card = this.tryPullSpecialCard('hyperRare', 'HR');
            if (card) {
                return card;
            }
        }

        if (roll < rates.hyperRare + rates.doubleRare) {
            const card = this.tryPullSpecialCard('doubleRare', 'DR');
            if (card) {
                return card;
            }
        }

        if (roll < rates.hyperRare + rates.doubleRare + rates.ultraRare) {
            const card = this.tryPullSpecialCard('ultraRare', 'UR');
            if (card) {
                return card;
            }
        }

        const card = this.availableRarities.rare
            ? this.getCardByMappedRarity('rare')
            : this.getCardByAnyMappedRarity(['common', 'uncommon']);
        card.isFoil = true;
        card.DEBUG_ORDER = 'R';
        return card;
    }

    /**
     * Génère un booster aléatoire de 11 cartes jouables (hors carte code), selon la structure 151:
     * 5 communes, 3 peu communes, 1 reverse holo, 1 reverse-or-special et 1 rare ou mieux.
     * @returns {Array} Un tableau d'objets carte.
     */
    generateBooster() {
        this.addLog(`Génération d'un nouveau booster (#${this.stats.opened + 1})`);

        const booster = [];

        for (let i = 0; i < BoosterOpener.BOOSTER_STRUCTURE.common; i++) {
            const card = this.getCardByMappedRarity('common');
            card.DEBUG_ORDER = `C${i + 1}`;
            booster.push(card);
        }

        const uncommonRarity = this.availableRarities.uncommon ? 'uncommon' : 'common';
        for (let i = 0; i < BoosterOpener.BOOSTER_STRUCTURE.uncommon; i++) {
            const card = this.getCardByMappedRarity(uncommonRarity);
            card.DEBUG_ORDER = `U${i + 1}`;
            booster.push(card);
        }

        booster.push(this.pullReverseHolo('RH1'));

        booster.push(this.pullSecondReverseSlot());

        booster.push(this.pullRareSlot());

        this.stats.opened++;
        this.updateStatsFromBooster(booster);

        return booster;
    }

    /**
     * Met à jour les statistiques à partir des cartes spéciales réellement générées.
     * @param {Array} booster - Booster généré.
     */
    updateStatsFromBooster(booster) {
        booster.forEach(card => {
            const statType = this.getStatTypeForCard(card);
            if (statType && statType in this.stats) {
                this.stats[statType]++;
            }
        });
    }

    /**
     * Détermine quelle statistique doit être incrémentée pour une carte.
     * @param {Object} card - Carte à analyser.
     * @returns {string|null} Type de statistique ou null.
     */
    getStatTypeForCard(card) {
        const mappedRarity = this.getMappedRarityForCard(card);
        return mappedRarity in this.stats ? mappedRarity : null;
    }

    /**
     * Mélange un tableau (algorithme de Fisher-Yates).
     * @param {Array} array - Le tableau à mélanger.
     * @returns {Array} Le tableau mélangé.
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
     * Réinitialise les statistiques.
     */
    resetStats() {
        this.stats = this.initStats();
        this.addLog(`Statistiques réinitialisées`);
    }

    /**
     * Obtient les statistiques actuelles.
     * @returns {Object} Les statistiques.
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Vérifie si les statistiques correspondent aux taux de pull attendus.
     * @returns {Object} Statistiques comparées aux taux théoriques.
     */
    checkPullRates() {
        const comparison = {};

        for (const [key, expectedRate] of Object.entries(BoosterOpener.PULL_RATES)) {
            const actualRate = this.stats.opened > 0 ? (this.stats[key] || 0) / this.stats.opened : 0;
            comparison[key] = {
                expected: expectedRate,
                actual: actualRate,
                expectedText: `1 sur ${Math.round(1 / expectedRate)}`,
                actualText: actualRate > 0 ? `1 sur ${Math.round(1 / actualRate)}` : 'N/A',
                difference: actualRate > 0 ? (actualRate - expectedRate) / expectedRate * 100 : 0
            };
        }

        return {
            totalOpened: this.stats.opened,
            comparison
        };
    }

    /**
     * Exporte le journal de débogage.
     * @returns {string} Journal formaté.
     */
    exportLog() {
        return this.log.map(entry =>
            `[${entry.time.toLocaleTimeString()}] ${entry.message}`
        ).join('\n');
    }

    /**
     * Retourne le journal brut pour les outils de débogage existants.
     * @returns {Array} Journal brut.
     */
    getDebugLog() {
        return [...this.log];
    }
}

// Structure fixe des boosters 151 hors carte code.
BoosterOpener.BOOSTER_STRUCTURE = {
    common: 5,
    uncommon: 3,
    reverseHolo: 1,
    reverseOrSpecial: 1,
    rare: 1
};

// Taux de pull par booster d'après la répartition demandée.
BoosterOpener.PULL_RATES = {
    illustrationRare: 1 / 12,
    specialIllustrationRare: 1 / 32,
    hyperRare: 1 / 51,
    doubleRare: 1 / 8,
    ultraRare: 1 / 16
};

// Exposer la classe pour une utilisation sans serveur HTTP (file://) et avec des scripts classiques.
window.BoosterOpener = BoosterOpener;
