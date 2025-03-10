/**
 * Module de gestion du rendu des cartes
 */

/**
 * Gère l'erreur de chargement d'une image en créant une image de secours
 * @param {HTMLImageElement} img - L'élément image qui a échoué
 * @param {Object} card - La carte associée à l'image
 */
function handleImageError(img, card) {
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
        'Incolore': '#A8A878',
        'Dresseur': '#C19B7C',
        'Énergie': '#E0E0E0'
    };
    
    try {
        // Canvas pour générer l'image
        const canvas = document.createElement('canvas');
        canvas.width = 165;
        canvas.height = 230;
        const ctx = canvas.getContext('2d');
        
        // Déterminer la couleur de fond selon le type de la carte
        let bgColor = '#A8A8A8'; // Gris par défaut
        
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
        // Fallback minimaliste en cas d'erreur
        img.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="165" height="230" viewBox="0 0 165 230"><rect fill="%23808080" width="165" height="230"/><text fill="white" font-family="Arial" font-size="14" text-anchor="middle" x="82.5" y="115">${card.name}</text></svg>`;
    }
}

/**
 * Crée les éléments DOM des cartes d'un booster
 * @param {Array} booster - Tableau de cartes
 * @param {Function} [onReveal=null] - Fonction à appeler lors de la révélation d'une carte (optionnelle)
 * @returns {Array} Tableau d'éléments DOM des cartes
 */
function renderBoosterCards(booster, onReveal = null) {
    const cardElements = [];
    
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
        
        // Ajouter l'événement de clic pour révéler la carte
        cardElement.addEventListener('click', (e) => {
            // Si la carte n'est pas encore révélée, on la révèle
            if (!cardElement.classList.contains('revealed')) {
                // Utiliser la fonction de révélation locale si aucun callback n'est fourni
                if (typeof onReveal === 'function') {
                    onReveal(cardElement);
                } else {
                    revealCard(cardElement);
                }
                e.stopPropagation();
            }
        });
        
        cardElements.push(cardElement);
    });
    
    return cardElements;
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
 * Révèle toutes les cartes avec un effet séquentiel
 * @param {NodeList} cards - Liste de cartes à révéler
 * @param {Function} callback - Fonction à appeler une fois toutes les cartes révélées
 */
function revealAllCards(cards, callback) {
    // Révéler les cartes avec un délai pour un effet séquentiel
    cards.forEach((card, index) => {
        setTimeout(() => {
            revealCard(card);
        }, index * 200);
    });
    
    // Callback après que toutes les cartes sont révélées
    if (callback && typeof callback === 'function') {
        setTimeout(() => {
            callback();
        }, cards.length * 200 + 100);
    }
}

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
        // Utiliser une image de secours simple si le canvas échoue
        document.documentElement.style.setProperty(
            '--card-back-image', 
            'url(data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="165" height="230" viewBox="0 0 165 230"><rect fill="%238B0000" width="165" height="230"/><text fill="%23FFD700" font-family="Arial" font-size="20" text-anchor="middle" x="82.5" y="115">POKÉMON TCG</text></svg>)'
        );
    }
}

export {
    handleImageError,
    renderBoosterCards,
    revealCard,
    revealAllCards,
    generateCardBack
};