/**
 * Module de gestion du zoom des cartes
 */

/**
 * Affiche l'overlay avec la carte agrandie
 * @param {string} imageUrl - URL de l'image à agrandir
 */
function showCardZoom(imageUrl) {
    const cardOverlay = document.getElementById('card-overlay');
    const zoomedCardImage = document.getElementById('zoomed-card-image');
    
    if (!cardOverlay || !zoomedCardImage) {
        return;
    }
    
    // Empêcher la propagation des événements
    const stopPropagation = (e) => {
        e.stopPropagation();
    };
    
    // Mettre à jour l'image
    zoomedCardImage.src = imageUrl;
    
    // Afficher l'overlay
    cardOverlay.classList.remove('hidden');
    setTimeout(() => {
        cardOverlay.classList.add('show');
        zoomedCardImage.classList.add('zooming-in');
    }, 10);
    
    // Empêcher le clic sur l'image de fermer l'overlay
    zoomedCardImage.addEventListener('click', stopPropagation);
    
    // S'assurer que l'overlay est au-dessus de tout
    cardOverlay.style.zIndex = '3000';
}

/**
 * Masque l'overlay de zoom
 */
function hideCardZoom() {
    const cardOverlay = document.getElementById('card-overlay');
    const zoomedCardImage = document.getElementById('zoomed-card-image');
    
    if (!cardOverlay) return;
    
    cardOverlay.classList.remove('show');
    setTimeout(() => {
        cardOverlay.classList.add('hidden');
        if (zoomedCardImage) {
            zoomedCardImage.classList.remove('zooming-in');
        }
    }, 300);
}

/**
 * Configure les événements pour le zoom des cartes
 */
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
                // Empêcher l'événement de se propager
                event.stopPropagation();
                // Afficher l'image agrandie
                showCardZoom(imageUrl);
            }
        });
    }
    
    // Fermer l'overlay en cliquant dessus
    const cardOverlay = document.getElementById('card-overlay');
    if (cardOverlay) {
        cardOverlay.addEventListener('click', function(event) {
            // Vérifier que le clic n'est pas sur l'image elle-même
            if (!event.target.closest('.card-zoom-container img')) {
                hideCardZoom();
            }
        });
    }
}

/**
 * Crée les éléments HTML nécessaires pour le zoom des cartes
 */
function createCardZoomElements() {
    // Vérifier si les éléments existent déjà
    if (document.getElementById('card-overlay')) {
        return;
    }
    
    // Créer l'overlay
    const overlay = document.createElement('div');
    overlay.id = 'card-overlay';
    overlay.className = 'card-overlay hidden';
    
    // Créer le conteneur de zoom
    const zoomContainer = document.createElement('div');
    zoomContainer.className = 'card-zoom-container';
    
    // Créer l'image zoomée
    const zoomedImage = document.createElement('img');
    zoomedImage.id = 'zoomed-card-image';
    zoomedImage.alt = 'Carte agrandie';
    
    // Assembler les éléments
    zoomContainer.appendChild(zoomedImage);
    overlay.appendChild(zoomContainer);
    document.body.appendChild(overlay);
    
    // Ajouter les styles si nécessaire
    if (!document.querySelector('style[data-for="card-zoom"]')) {
        const style = document.createElement('style');
        style.setAttribute('data-for', 'card-zoom');
        style.textContent = `
            .card-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.8);
                z-index: 3000;
                display: flex;
                justify-content: center;
                align-items: center;
                cursor: pointer;
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none;
            }
            
            .card-overlay.show {
                opacity: 1;
                pointer-events: auto;
            }
            
            .card-overlay.hidden {
                display: none;
            }
            
            .card-zoom-container {
                display: flex;
                justify-content: center;
                align-items: center;
                max-width: 90%;
                max-height: 90%;
                pointer-events: none;
            }
            
            #zoomed-card-image {
                max-height: 80vh;
                max-width: 90%;
                box-shadow: 0 0 30px rgba(255, 255, 255, 0.2);
                border-radius: 10px;
                pointer-events: auto;
                cursor: default;
            }
            
            @keyframes zoomIn {
                from {
                    opacity: 0;
                    transform: scale(0.8);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }
            
            .zooming-in {
                animation: zoomIn 0.3s forwards;
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Initialise la fonctionnalité de zoom des cartes
 */
function initCardZoom() {
    createCardZoomElements();
    setupCardZoomEvents();
}

export {
    showCardZoom,
    hideCardZoom,
    setupCardZoomEvents,
    initCardZoom
};