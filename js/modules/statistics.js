/**
 * Module de gestion des statistiques
 */

/**
 * Met à jour l'affichage des statistiques
 * @param {Object} stats - Statistiques à afficher
 */
function updateStats(stats) {
    // Mise à jour des compteurs basiques
    updateElementIfExists('opened-count', stats.opened);
    updateElementIfExists('rare-count', stats.rare);
    
    // Pour les cartes ultra-rares, on additionne toutes les raretés supérieures
    const totalUltraRareCount = (stats.ultraRare || 0) + 
                                (stats.illustrationRare || 0) + 
                                (stats.specialIllRare || 0) + 
                                (stats.hyperRare || 0);
    updateElementIfExists('ultra-rare-count', totalUltraRareCount);
    
    // Mise à jour des compteurs détaillés
    updateElementIfExists('double-rare-count', stats.doubleRare);
    updateElementIfExists('standard-ultra-count', stats.ultraRare);
    updateElementIfExists('ill-rare-count', stats.illustrationRare);
    updateElementIfExists('special-ill-count', stats.specialIllRare);
    updateElementIfExists('hyper-rare-count', stats.hyperRare);
    updateElementIfExists('foil-energy-count', stats.foilEnergy);
}

/**
 * Met à jour l'élément HTML s'il existe
 * @param {string} id - ID de l'élément HTML
 * @param {number} value - Valeur à afficher
 */
function updateElementIfExists(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value || 0;
    }
}

/**
 * Met à jour l'affichage des taux de pull réels vs théoriques
 * @param {Object} pullRates - Données de taux de pull
 */
function updatePullRates(pullRates) {
    // Mettre à jour le tableau de comparaison si l'élément existe
    const tableBody = document.getElementById('pull-rates-table-body');
    if (tableBody) {
        tableBody.innerHTML = ''; // Effacer le contenu actuel
        
        for (const [key, data] of Object.entries(pullRates.comparison)) {
            // Formater le nom de la carte (foilEnergy -> Foil Energy)
            const formattedName = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase());
            
            // Créer une classe pour la différence (positif, négatif ou neutre)
            const diffClass = Math.abs(data.difference) < 10 
                ? 'neutral' 
                : data.difference > 0 ? 'positive' : 'negative';
            
            // Créer la ligne du tableau
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formattedName}</td>
                <td>${(data.expected * 100).toFixed(2)}%</td>
                <td>${data.expectedText}</td>
                <td>${(data.actual * 100).toFixed(2)}%</td>
                <td>${data.actualText}</td>
                <td class="${diffClass}">${data.difference.toFixed(1)}%</td>
            `;
            
            tableBody.appendChild(row);
        }
    }
    
    // Mettre à jour le nombre total de boosters ouverts
    const totalElement = document.getElementById('total-boosters-opened');
    if (totalElement) {
        totalElement.textContent = pullRates.totalOpened;
    }
}

/**
 * Initialise le panneau de statistiques
 */
function initializeStatsPanel() {
    // S'assurer que le panneau existe
    const detailedStats = document.getElementById('detailed-stats');
    const pullRatesPanel = document.getElementById('pull-rates-panel');
    
    if (detailedStats) {
        // Créer les compteurs détaillés s'ils n'existent pas
        const detailedCounters = [
            { id: 'double-rare-count', label: 'Double Rares' },
            { id: 'standard-ultra-count', label: 'Ultra Rares standard' },
            { id: 'ill-rare-count', label: 'Illustration Rares' },
            { id: 'special-ill-count', label: 'Special Illustration' },
            { id: 'hyper-rare-count', label: 'Hyper Rares' }
            // Suppression de la ligne 'foil-energy-count'
        ];
        
        detailedCounters.forEach(counter => {
            if (!document.getElementById(counter.id)) {
                addStatElement('detailed-stats', counter.id, counter.label);
            }
        });
    }
    
    // Si l'élément foil-energy-count existe, le masquer
    const foilEnergyCount = document.getElementById('foil-energy-count');
    if (foilEnergyCount && foilEnergyCount.parentElement) {
        foilEnergyCount.parentElement.style.display = 'none';
    }
    
    if (pullRatesPanel && !document.getElementById('pull-rates-table-body')) {
        createPullRatesTable('pull-rates-panel');
    }
    
    // Gestionnaire pour le bouton de réinitialisation
    const resetButton = document.getElementById('reset-stats');
    if (resetButton) {
        resetButton.addEventListener('click', function() {
            if (confirm('Êtes-vous sûr de vouloir réinitialiser toutes les statistiques?')) {
                if (window.boosterOpener) {
                    window.boosterOpener.resetStats();
                    updateStats(window.boosterOpener.getStats());
                }
            }
        });
    }
    
    // Gestionnaire pour réduire/agrandir le panneau
    const toggleButton = document.querySelector('.toggle-stats-panel');
    const statsPanel = document.querySelector('.stats-panel');
    
    if (toggleButton && statsPanel) {
        toggleButton.addEventListener('click', function() {
            statsPanel.classList.toggle('collapsed');
        });
    }
}

/**
 * Ajoute un élément statistique au panneau
 * @param {string} parentId - ID de l'élément parent
 * @param {string} id - ID du nouvel élément
 * @param {string} label - Libellé de la statistique
 */
function addStatElement(parentId, id, label) {
    const parent = document.getElementById(parentId);
    if (parent) {
        const paragraph = document.createElement('p');
        paragraph.innerHTML = `${label}: <span id="${id}">0</span>`;
        parent.appendChild(paragraph);
    }
}

/**
 * Crée le tableau de comparaison des taux de pull
 * @param {string} parentId - ID de l'élément parent
 */
function createPullRatesTable(parentId) {
    const parent = document.getElementById(parentId);
    if (!parent) return;
    
    const tableContainer = document.createElement('div');
    tableContainer.className = 'pull-rates-container';
    
    tableContainer.innerHTML = `
        <h4>Comparaison des taux de pull</h4>
        <p>Boosters ouverts: <span id="total-boosters-opened">0</span></p>
        <table class="pull-rates-table">
            <thead>
                <tr>
                    <th>Type de carte</th>
                    <th>Taux théorique</th>
                    <th>Théorique (1 sur X)</th>
                    <th>Taux réel</th>
                    <th>Réel (1 sur X)</th>
                    <th>Différence</th>
                </tr>
            </thead>
            <tbody id="pull-rates-table-body">
                <!-- Contenu généré dynamiquement -->
            </tbody>
        </table>
    `;
    
    parent.appendChild(tableContainer);
}

export {
    updateStats,
    updatePullRates,
    initializeStatsPanel
};
