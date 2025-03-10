/**
 * Script principal de l'application Pokemon Shots
 */
document.addEventListener('DOMContentLoaded', () => {
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

    // Vérifier si les données du set sont disponibles
    if (!window.pokemon151Data || !Array.isArray(window.pokemon151Data)) {
        console.error('Les données du set Pokémon 151 ne sont pas disponibles.');
        alert('Erreur: Les données du set Pokémon 151 ne peuvent pas être chargées.');
        return;
    }

    // Initialiser l'ouvreur de boosters avec les données du set 151
    const boosterOpener = new BoosterOpener(window.pokemon151Data);

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
     * Ouvre un booster et affiche les cartes
     */
    function openBooster() {
        // Générer un nouveau booster
        const booster = boosterOpener.generateBooster();
        
        // Vider le conteneur de cartes
        cardsContainer.innerHTML = '';
        
        // Créer et ajouter chaque carte au DOM
        booster.forEach((card, index) => {
            const cardElement = document.createElement('div');
            cardElement.classList.add('card');
            
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
                this.src = `https://via.placeholder.com/165x230?text=${card.name}`;
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

    // Créer un placeholder pour le dos des cartes si l'image n'existe pas
    const cardBackImage = new Image();
    cardBackImage.src = 'assets/images/card-back.jpg';
    cardBackImage.onerror = function() {
        document.documentElement.style.setProperty(
            '--card-back-image', 
            'url(https://via.placeholder.com/165x230/333333/ffffff?text=Pokemon)'
        );
    };
});