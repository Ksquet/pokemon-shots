/**
 * Script principal de l'application Pokemon Shots
 * Modifié pour récupérer les données depuis l'API TCGdex
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Éléments DOM
    const openButton = document.querySelector('.open-button');
    const boosterSelection = document.querySelector('.booster-selection');
    const openingArea = document.getElementById('opening-area');
    const cardsContainer = document.querySelector('.cards-container');
    const revealAllButton = document.getElementById('reveal-all');
    const newBoosterButton = document.getElementById('new-booster');
    const statsPanel = document.querySelector('.stats-panel');
    const openedCount = document.getElementById('opened-count');
    const rareCount = document.getElementById('rare-count');
    const ultraRareCount = document.getElementById('ultra-rare-count');
    const boosterImg = document.getElementById('booster-img');

    // Masquer l'indicateur de chargement par défaut
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }

    // Variable pour stocker l'ouvreur de boosters
    let boosterOpener;

    /**
     * Génère une image de booster dynamiquement
     */
    function generateBoosterImage() {
        try {
            // Canvas pour générer le booster
            const canvas = document.createElement('canvas');
            canvas.width = 250;
            canvas.height = 350;
            const ctx = canvas.getContext('2d');
            
            // Dégradé de fond rouge/bleu
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#ff3e3e');
            gradient.addColorStop(1, '#3e66ff');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Cadre
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
            
            // Nom du set
            ctx.fillStyle = 'white';
            ctx.font = 'bold 30px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('POKÉMON', canvas.width / 2, 60);
            ctx.font = 'bold 50px Arial';
            ctx.fillText('151', canvas.width / 2, 120);
            
            // Pokéball simplifiée
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2 + 30;
            const radius = 70;
            
            // Cercle externe
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.fillStyle = 'white';
            ctx.fill();
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Moitié supérieure rouge
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, Math.PI, 0);
            ctx.fillStyle = '#ff3e3e';
            ctx.fill();
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Ligne centrale
            ctx.beginPath();
            ctx.moveTo(centerX - radius, centerY);
            ctx.lineTo(centerX + radius, centerY);
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Cercle central
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius / 4, 0, 2 * Math.PI);
            ctx.fillStyle = 'white';
            ctx.fill();
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Texte de bas
            ctx.font = '12px Arial';
            ctx.fillStyle = 'white';
            ctx.fillText('10 CARTES À COLLECTIONNER', canvas.width / 2, canvas.height - 30);
            
            // Convertir le canvas en data URL et l'assigner à l'image
            return canvas.toDataURL('image/png');
        } catch (error) {
            console.error('Erreur lors de la génération de l\'image du booster:', error);
            return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="250" height="350" viewBox="0 0 250 350"><rect fill="%23ff3e3e" width="250" height="350"/><text fill="white" font-family="Arial" font-size="24" text-anchor="middle" x="125" y="175">Booster 151</text></svg>';
        }
    }

    // Générer l'image du booster au chargement de la page
    if (boosterImg) {
        boosterImg.src = generateBoosterImage();
    }

    // Initialisation: récupérer les données des cartes
    try {
        // Activer le bouton immédiatement avec les données statiques
        openButton.textContent = 'Ouvrir un booster';
        openButton.disabled = false;
        
        // Initialiser d'abord avec les données statiques pour une utilisation immédiate
        boosterOpener = new BoosterOpener(window.pokemon151Data);

        // S'assurer que boosterOpener est accessible depuis l'extérieur
        window.boosterOpener = boosterOpener;
        
        // Charger les données complètes en arrière-plan
        loadCardDataInBackground();
        
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        
        // Afficher un message d'erreur utilisateur
        alert('Erreur lors du chargement des cartes. Utilisation des données de secours.');
        
        // Utiliser les données statiques comme solution de secours
        boosterOpener = new BoosterOpener(window.pokemon151Data);
        
        // Activer le bouton d'ouverture
        openButton.disabled = false;
        openButton.textContent = 'Ouvrir un booster';
    }

    /**
     * Charge les données des cartes en arrière-plan
     */
    async function loadCardDataInBackground() {
        try {
            // Vérifier si nous avons des données en cache avant de montrer l'indicateur
            const cachedData = localStorage.getItem('pokemon151Data');
            let shouldShowIndicator = true;
            
            if (cachedData) {
                const { timestamp } = JSON.parse(cachedData);
                const oneWeek = 7 * 24 * 60 * 60 * 1000;
                
                if (Date.now() - timestamp < oneWeek) {
                    // Si les données en cache sont récentes, ne pas montrer l'indicateur
                    shouldShowIndicator = false;
                }
            }
            
            // Afficher l'indicateur uniquement si on va charger depuis l'API
            if (shouldShowIndicator && loadingIndicator) {
                loadingIndicator.style.display = 'flex';
            }
            
            // S'abonner aux mises à jour de progression
            if (window.loadingProgress) {
                window.loadingProgress.onUpdate((percentage) => {
                    console.log(`Chargement des cartes: ${percentage}%`);
                });
            }
            
            // Charger les données complètes
            if (typeof window.loadPokemon151Data === 'function') {
                const cardsData = await window.loadPokemon151Data();
                
                // Vérifier si les données ont été chargées avec succès
                if (cardsData && Array.isArray(cardsData) && cardsData.length > 0) {
                    console.log(`${cardsData.length} cartes chargées avec succès`);
                    
                    // Mettre à jour l'ouvreur de boosters avec les données complètes
                    boosterOpener = new BoosterOpener(cardsData);
                }
            }
        } catch (error) {
            console.error('Erreur lors du chargement en arrière-plan:', error);
            // Les données statiques restent en place, pas besoin de modifier l'interface
            
            // Masquer l'indicateur en cas d'erreur
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
        }

        // Mettre à jour l'ouvreur de boosters avec les données complètes
        boosterOpener = new BoosterOpener(cardsData);
        window.boosterOpener = boosterOpener; // S'assurer qu'il est accessible globalement
    }

    // Gestionnaire d'événement pour l'ouverture d'un booster
    openButton.addEventListener('click', () => {
        openBooster();
    });

    // Gestionnaire d'événement pour révéler toutes les cartes
    revealAllButton.addEventListener('click', () => {
        revealAllCards();
    });

    // Gestionnaire d'événement pour ouvrir un nouveau booster
    newBoosterButton.addEventListener('click', () => {
        resetOpeningArea();
        openBooster();
    });

    /**
     * Gère l'erreur de chargement d'une image en créant une image de secours
     * @param {HTMLImageElement} img - L'élément image qui a échoué
     * @param {Object} card - La carte associée à l'image
     */
    function handleImageError(img, card) {
        try {
            // Canvas pour générer l'image
            const canvas = document.createElement('canvas');
            canvas.width = 165;
            canvas.height = 230;
            const ctx = canvas.getContext('2d');
            
            // Déterminer la couleur de fond selon le type de la carte
            let bgColor = '#A8A8A8'; // Gris par défaut
            
            // Correspondance type -> couleur
            const typeColors = {
                'Plante': '#78C850',
                'Feu': '#F08030',
                'Eau': '#6890F0',
                'Électrique': '#F8D030',
                'Psy': '#F85888',
                'Combat': '#C03028',
                'Obscurité': '#705848',
                'Métal': '#B8B8D0',
                'Fée': '#EE99AC',
                'Dragon': '#7038F8',
                'Incolore': '#A8A878'
            };
            
            if (typeColors[card.type]) {
                bgColor = typeColors[card.type];
            }
            
            // Dessiner le fond
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Ajouter une bordure
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
            
            // Ajouter le texte
            ctx.fillStyle = '#FFF';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 4;
            
            // Si le nom est trop long, le réduire
            const maxWidth = canvas.width - 20;
            let fontSize = 16;
            ctx.font = `bold ${fontSize}px Arial`;
            
            while (ctx.measureText(card.name).width > maxWidth && fontSize > 8) {
                fontSize--;
                ctx.font = `bold ${fontSize}px Arial`;
            }
            
            // Dessiner le texte centré
            ctx.fillText(card.name, canvas.width / 2, canvas.height / 2);
            
            // Ajouter le type en plus petit
            ctx.font = '12px Arial';
            ctx.fillText(card.type, canvas.width / 2, canvas.height / 2 + 25);
            
            // Ajouter l'ID/numéro de la carte
            ctx.font = '10px Arial';
            ctx.fillText(card.number, canvas.width / 2, canvas.height - 20);
            
            // Convertir le canvas en data URL
            img.src = canvas.toDataURL('image/png');
        } catch (error) {
            console.error('Erreur lors de la génération de l\'image de carte:', error);
            img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="165" height="230" viewBox="0 0 165 230"><rect fill="%23808080" width="165" height="230"/><text fill="white" font-family="Arial" font-size="14" text-anchor="middle" x="82.5" y="115">' + card.name + '</text></svg>';
        }
    }

    /**
     * Ouvre un booster et affiche les cartes
     */
    function openBooster() {
        // Vérifier que l'ouvreur de boosters est initialisé
        if (!boosterOpener) {
            console.error('L\'ouvreur de boosters n\'est pas initialisé');
            alert('Erreur: Impossible d\'ouvrir un booster pour le moment.');
            return;
        }
        
        // Générer un nouveau booster
        const booster = boosterOpener.generateBooster();
        
        // Vider le conteneur de cartes
        cardsContainer.innerHTML = '';
        
        // Créer et ajouter chaque carte au DOM
        booster.forEach((card, index) => {
            const cardElement = document.createElement('div');
            cardElement.classList.add('card');
            cardElement.dataset.cardId = card.id;
            
            // Ajouter la classe de rareté pour les animations
            if (card.rarity === 'rare') {
                cardElement.classList.add('rare');
            } else if (['ultraRare', 'secretRare'].includes(card.rarity)) {
                cardElement.classList.add('ultra-rare');
            }
            
            // Créer l'élément image
            const cardImage = document.createElement('img');
            cardImage.src = card.imageUrl || `assets/images/cards/151/${card.id}.jpg`;
            cardImage.alt = card.name;
            cardImage.onerror = function() {
                handleImageError(this, card);
            };
            
            // Ajouter l'image à la carte
            cardElement.appendChild(cardImage);
            
            // Ajouter un délai pour l'animation d'entrée
            cardElement.style.animationDelay = `${index * 0.1}s`;
            
            // Ajouter la carte au conteneur
            cardsContainer.appendChild(cardElement);
            
            // Ajouter l'événement de clic pour révéler la carte
            cardElement.addEventListener('click', (e) => {
                console.log("Clic sur une carte détecté!");
                
                // Si la carte n'est pas encore révélée, on la révèle
                if (!cardElement.classList.contains('revealed')) {
                    console.log("La carte n'est pas révélée, on la révèle");
                    revealCard(cardElement);
                    e.stopPropagation();
                } else {
                    console.log("La carte est déjà révélée, clic pour zoom possible");
                }
            });
        });
        
        // Afficher la zone d'ouverture et masquer la sélection de booster
        boosterSelection.classList.add('hidden');
        openingArea.classList.remove('hidden');
        
        // Afficher le panneau de statistiques
        statsPanel.classList.remove('hidden');
        
        // Mettre à jour les statistiques
        updateStats();

        // Réinitialiser les événements de zoom des cartes
        if (typeof window.setupCardZoomEvents === 'function') {
            window.setupCardZoomEvents();
        }
    }

    /**
     * Révèle une carte spécifique
     * @param {HTMLElement} cardElement - L'élément DOM de la carte à révéler
     */
    function revealCard(cardElement) {
        if (!cardElement.classList.contains('revealed')) {
            cardElement.classList.add('revealed');
        }
    }

    /**
     * Révèle toutes les cartes
     */
    function revealAllCards() {
        const cards = document.querySelectorAll('.card:not(.revealed)');
        
        // Révéler les cartes avec un délai pour un effet séquentiel
        cards.forEach((card, index) => {
            setTimeout(() => {
                revealCard(card);
            }, index * 200);
        });
        
        // Réinitialiser les événements de zoom des cartes après révélation
        setTimeout(() => {
            if (typeof window.setupCardZoomEvents === 'function') {
                window.setupCardZoomEvents();
            }
        }, cards.length * 200 + 100);
    }

    /**
     * Réinitialise la zone d'ouverture pour un nouveau booster
     */
    function resetOpeningArea() {
        cardsContainer.innerHTML = '';
    }

    /**
     * Met à jour l'affichage des statistiques
     */
    function updateStats() {
        const stats = boosterOpener.getStats();
        
        // Mise à jour des compteurs basiques (compatibilité avec l'interface d'origine)
        document.getElementById('opened-count').textContent = stats.opened;
        document.getElementById('rare-count').textContent = stats.rare;
        
        // Pour les cartes ultra-rares, on additionne toutes les raretés supérieures
        const totalUltraRareCount = (stats.ultraRare || 0) + 
                                    (stats.illustrationRare || 0) + 
                                    (stats.specialIllRare || 0) + 
                                    (stats.hyperRare || 0);
        document.getElementById('ultra-rare-count').textContent = totalUltraRareCount;
        
        // Mise à jour des compteurs détaillés (si les éléments existent)
        updateElementIfExists('double-rare-count', stats.doubleRare);
        updateElementIfExists('standard-ultra-count', stats.ultraRare);
        updateElementIfExists('ill-rare-count', stats.illustrationRare);
        updateElementIfExists('special-ill-count', stats.specialIllRare);
        updateElementIfExists('hyper-rare-count', stats.hyperRare);
        updateElementIfExists('foil-energy-count', stats.foilEnergy);
        
        // Calculer et afficher les taux de pull réels vs théoriques
        if (stats.opened >= 10) {
            updatePullRates();
        }
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
     */
    function updatePullRates() {
        const pullRates = boosterOpener.checkPullRates();
        
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
     * Ajoute un élément statistique au panneau
     * Cette fonction peut être appelée lors de l'initialisation pour créer 
     * dynamiquement les éléments statistiques supplémentaires
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

    // Ces fonctions peuvent être appelées lors de l'initialisation pour 
    // ajouter dynamiquement les éléments statistiques supplémentaires
    function initializeStatsPanel() {
        // Ajouter les compteurs détaillés
        addStatElement('detailed-stats', 'double-rare-count', 'Double Rares');
        addStatElement('detailed-stats', 'standard-ultra-count', 'Ultra Rares standard');
        addStatElement('detailed-stats', 'ill-rare-count', 'Illustration Rares');
        addStatElement('detailed-stats', 'special-ill-count', 'Special Illustration');
        addStatElement('detailed-stats', 'hyper-rare-count', 'Hyper Rares');
        addStatElement('detailed-stats', 'foil-energy-count', 'Énergies brillantes');
        
        // Créer le tableau de comparaison
        createPullRatesTable('pull-rates-panel');
    }

    // Appeler cette fonction après que le DOM est chargé
    // document.addEventListener('DOMContentLoaded', initializeStatsPanel);

    // Génération du dos de carte dynamiquement
    generateCardBack();
    
    /**
     * Génère une image pour le dos des cartes
     */
    function generateCardBack() {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 165;
            canvas.height = 230;
            const ctx = canvas.getContext('2d');
            
            // Fond rouge foncé
            ctx.fillStyle = '#8B0000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Motif du dos de carte
            ctx.fillStyle = '#6D0000';
            for (let i = 0; i < canvas.width; i += 10) {
                for (let j = 0; j < canvas.height; j += 10) {
                    if ((i + j) % 20 === 0) {
                        ctx.fillRect(i, j, 5, 5);
                    }
                }
            }
            
            // Logo stylisé
            ctx.font = 'bold 20px Arial';
            ctx.fillStyle = '#FFD700';
            ctx.textAlign = 'center';
            ctx.fillText('POKÉMON', canvas.width / 2, canvas.height / 2 - 10);
            ctx.fillText('TCG', canvas.width / 2, canvas.height / 2 + 20);
            
            // Appliquer comme image de fond
            document.documentElement.style.setProperty(
                '--card-back-image', 
                `url(${canvas.toDataURL('image/png')})`
            );
        } catch (error) {
            console.error('Erreur lors de la génération du dos de carte:', error);
            // Utiliser une image de secours simple si le canvas échoue
            document.documentElement.style.setProperty(
                '--card-back-image', 
                'url(data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="165" height="230" viewBox="0 0 165 230"><rect fill="%238B0000" width="165" height="230"/><text fill="%23FFD700" font-family="Arial" font-size="20" text-anchor="middle" x="82.5" y="115">POKÉMON TCG</text></svg>)'
            );
        }
    }

    // Fonctionnalité pour agrandir les cartes en cliquant dessus
    // Éléments DOM
    const cardOverlay = document.getElementById('card-overlay');
    const zoomedCardImage = document.getElementById('zoomed-card-image');
    const zoomedCardName = document.getElementById('zoomed-card-name');
    const zoomedCardType = document.getElementById('zoomed-card-type');
    const zoomedCardRarity = document.getElementById('zoomed-card-rarity');
    const zoomedCardNumber = document.getElementById('zoomed-card-number');

    // Fonction pour convertir les raretés techniques en texte lisible
    function formatRarity(rarity) {
        const rarityMap = {
            'common': 'Commune',
            'uncommon': 'Peu commune',
            'rare': 'Rare',
            'ultraRare': 'Ultra rare',
            'secretRare': 'Secrète rare',
            'doubleRare': 'Double rare',
            'trainer': 'Dresseur',
            'energy': 'Énergie'
        };
        return rarityMap[rarity] || rarity;
    }

    // Fonction pour afficher l'overlay avec la carte agrandie
    function showCardOverlay(card, imageUrl) {
        console.log("Tentative d'affichage de l'overlay pour la carte:", card.name);
        
        const cardOverlay = document.getElementById('card-overlay');
        
        if (!cardOverlay) {
            console.error("Element #card-overlay introuvable!");
            return;
        }
        
        console.log("Éléments d'overlay trouvés, mise à jour des informations");
        
        // Vérifier si les éléments existent
        const zoomedCardImage = document.getElementById('zoomed-card-image');
        const zoomedCardName = document.getElementById('zoomed-card-name');
        const zoomedCardType = document.getElementById('zoomed-card-type');
        const zoomedCardRarity = document.getElementById('zoomed-card-rarity');
        const zoomedCardNumber = document.getElementById('zoomed-card-number');
        
        console.log("Images trouvées?", !!zoomedCardImage);
        console.log("Nom trouvé?", !!zoomedCardName);
        
        // Mise à jour des informations de la carte
        if (zoomedCardImage) zoomedCardImage.src = imageUrl;
        if (zoomedCardImage) zoomedCardImage.alt = card.name;
        if (zoomedCardName) zoomedCardName.textContent = card.name;
        if (zoomedCardType) zoomedCardType.textContent = card.type;
        if (zoomedCardRarity) zoomedCardRarity.textContent = formatRarity(card.rarity);
        if (zoomedCardNumber) zoomedCardNumber.textContent = card.number;
        
        // Afficher l'overlay
        console.log("Classes de l'overlay avant:", cardOverlay.className);
        cardOverlay.classList.remove('hidden');
        console.log("Classes de l'overlay après suppression de 'hidden':", cardOverlay.className);
        
        setTimeout(() => {
            console.log("Ajout de la classe 'show' à l'overlay");
            cardOverlay.classList.add('show');
            if (zoomedCardImage) zoomedCardImage.classList.add('zooming-in');
            console.log("Classes finales de l'overlay:", cardOverlay.className);
        }, 10);
    }

    // Fonction pour fermer l'overlay
    function hideCardOverlay() {
        if (!cardOverlay) return;
        
        cardOverlay.classList.remove('show');
        setTimeout(() => {
            cardOverlay.classList.add('hidden');
            zoomedCardImage.classList.remove('zooming-in');
        }, 300);
    }

    // Gestionnaire d'événement pour le clic sur une carte
    function setupCardZoomEvents() {
        const cardsContainer = document.querySelector('.cards-container');
        
        if (cardsContainer) {
            // Utiliser la délégation d'événements pour gérer les cartes dynamiques
            cardsContainer.addEventListener('click', function(event) {
                const cardElement = event.target.closest('.card');
                
                // Vérifier que c'est une carte révélée
                if (cardElement && cardElement.classList.contains('revealed')) {
                    // Obtenir l'URL de l'image directement
                    const imageUrl = cardElement.querySelector('img').src;
                    console.log("Zoom sur l'image:", imageUrl);
                    
                    // Afficher juste l'image agrandie
                    showSimpleCardZoom(imageUrl);
                }
            });
        }
        
        // Fermer l'overlay en cliquant dessus
        const cardOverlay = document.getElementById('card-overlay');
        if (cardOverlay) {
            cardOverlay.addEventListener('click', function(event) {
                hideCardOverlay();
            });
        }
    }
    
    // Fonction simplifiée pour afficher l'image zoomée
    function showSimpleCardZoom(imageUrl) {
        const cardOverlay = document.getElementById('card-overlay');
        const zoomedCardImage = document.getElementById('zoomed-card-image');
        
        if (!cardOverlay || !zoomedCardImage) {
            console.error("Éléments d'overlay introuvables!");
            return;
        }
        
        // Mettre à jour uniquement l'image
        zoomedCardImage.src = imageUrl;
        
        // Afficher l'overlay
        cardOverlay.classList.remove('hidden');
        setTimeout(() => {
            cardOverlay.classList.add('show');
            zoomedCardImage.classList.add('zooming-in');
        }, 10);
    }
    
    // Fonction pour masquer l'overlay
    function hideCardOverlay() {
        const cardOverlay = document.getElementById('card-overlay');
        if (!cardOverlay) return;
        
        cardOverlay.classList.remove('show');
        setTimeout(() => {
            cardOverlay.classList.add('hidden');
        }, 300);
    }

    // Configurer les événements de zoom une fois que le DOM est chargé
    setupCardZoomEvents();

    // Exposer la fonction de configuration pour qu'elle puisse être appelée après 
    // l'ajout dynamique de nouvelles cartes
    window.setupCardZoomEvents = setupCardZoomEvents;


});