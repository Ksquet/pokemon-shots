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
        // Désactiver le bouton pendant le chargement
        openButton.disabled = true;
        openButton.textContent = 'Chargement des cartes...';
        
        // Vérifier si la fonction loadPokemon151Data existe
        if (typeof window.loadPokemon151Data === 'function') {
            // Charger les données du set 151 via l'API
            const cardsData = await window.loadPokemon151Data();
            
            // Vérifier si les données ont été chargées avec succès
            if (!cardsData || !Array.isArray(cardsData) || cardsData.length === 0) {
                throw new Error('Impossible de récupérer les données des cartes');
            }
            
            console.log(`${cardsData.length} cartes chargées avec succès`);
            
            // Initialiser l'ouvreur de boosters avec les données récupérées
            boosterOpener = new BoosterOpener(cardsData);
        } else {
            // Si la fonction n'existe pas, utiliser les données statiques
            console.warn("La fonction loadPokemon151Data n'est pas disponible, utilisation des données statiques.");
            boosterOpener = new BoosterOpener(window.pokemon151Data);
        }
        
        // Activer le bouton d'ouverture
        openButton.disabled = false;
        openButton.textContent = 'Ouvrir un booster';
        
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
            cardElement.addEventListener('click', () => {
                revealCard(cardElement);
            });
        });
        
        // Afficher la zone d'ouverture et masquer la sélection de booster
        boosterSelection.classList.add('hidden');
        openingArea.classList.remove('hidden');
        
        // Afficher le panneau de statistiques
        statsPanel.classList.remove('hidden');
        
        // Mettre à jour les statistiques
        updateStats();
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
        openedCount.textContent = stats.opened;
        rareCount.textContent = stats.rare;
        ultraRareCount.textContent = stats.ultraRare;
    }

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
});