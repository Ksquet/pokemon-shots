/**
 * Module de gestion des statistiques (version simplifiée)
 * Focus uniquement sur les cartes Double Rare
 */

/**
 * Met à jour l'affichage des statistiques
 * @param {Object} stats - Statistiques à afficher
 */
function updateStats(stats) {
    // Mise à jour des compteurs basiques
    updateElementIfExists('opened-count', stats.opened);
    updateElementIfExists('double-rare-count', stats.doubleRare);
    
    // Calculer le taux de pull pour les Double Rare
    if (stats.opened > 0) {
        const pullRate = stats.doubleRare / stats.opened;
        const oneInX = Math.round(1 / pullRate) || 0;
        
        updateElementIfExists('double-rare-rate', (pullRate * 100).toFixed(2) + '%');
        updateElementIfExists('double-rare-oneinx', oneInX);
    }
}

/**
 * Met à jour l'élément HTML s'il existe
 * @param {string} id - ID de l'élément HTML
 * @param {number|string} value - Valeur à afficher
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
            // Formater le nom de la carte (doubleRare -> Double Rare)
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
    const statsPanel = document.querySelector('.stats-panel');
    
    if (!statsPanel) {
        createStatsPanel();
        return;
    }
    
    // Simplifier le panneau existant
    simplifyStatsPanel(statsPanel);
    
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
    
    if (toggleButton && statsPanel) {
        toggleButton.addEventListener('click', function() {
            statsPanel.classList.toggle('collapsed');
        });
    }
}

/**
 * Simplifie le panneau de statistiques existant
 * @param {HTMLElement} panel - Panneau de statistiques
 */
function simplifyStatsPanel(panel) {
    // Supprimer tous les contenus existants sauf le header
    const header = panel.querySelector('.stats-header');
    const content = panel.querySelector('.stats-content');
    
    if (content) {
        content.innerHTML = '';
        
        // Ajouter uniquement les statistiques de base
        const basicStats = document.createElement('div');
        basicStats.className = 'basic-stats';
        basicStats.innerHTML = `
            <p>Boosters ouverts: <span id="opened-count">0</span></p>
            <p>Double Rares: <span id="double-rare-count">0</span></p>
            <p>Taux de pull: <span id="double-rare-rate">0%</span> (1 sur <span id="double-rare-oneinx">0</span>)</p>
        `;
        
        content.appendChild(basicStats);
        
        // Créer le tableau simplifié pour les taux de pull
        const pullRatesDiv = document.createElement('div');
        pullRatesDiv.id = 'pull-rates-panel';
        pullRatesDiv.className = 'pull-rates-panel';
        pullRatesDiv.innerHTML = `
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
        
        content.appendChild(pullRatesDiv);
        
        // Ajouter le bouton de réinitialisation
        const resetButton = document.createElement('button');
        resetButton.id = 'reset-stats';
        resetButton.className = 'reset-button';
        resetButton.textContent = 'Réinitialiser les statistiques';
        
        content.appendChild(resetButton);
    }
}

/**
 * Crée un panneau de statistiques entièrement nouveau
 */
function createStatsPanel() {
    const panel = document.createElement('aside');
    panel.className = 'stats-panel';
    
    panel.innerHTML = `
        <div class="stats-header">
            <h3>Statistiques</h3>
            <button class="toggle-stats-panel" aria-label="Réduire/Agrandir le panneau de statistiques">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>
        </div>
        
        <div class="stats-content">
            <div class="basic-stats">
                <p>Boosters ouverts: <span id="opened-count">0</span></p>
                <p>Double Rares: <span id="double-rare-count">0</span></p>
                <p>Taux de pull: <span id="double-rare-rate">0%</span> (1 sur <span id="double-rare-oneinx">0</span>)</p>
            </div>
            
            <div id="pull-rates-panel" class="pull-rates-panel">
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
            </div>
            
            <button id="reset-stats" class="reset-button">Réinitialiser les statistiques</button>
        </div>
    `;
    
    document.body.appendChild(panel);
}

export {
    updateStats,
    updatePullRates,
    initializeStatsPanel
};