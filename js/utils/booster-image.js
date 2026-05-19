/**
 * Utilitaires pour générer des images de boosters
 */

/**
 * Génère une image de booster
 * @returns {string} URL de données de l'image générée
 */
function generateBoosterImage() {
    try {
        // Canvas pour générer le booster
        const canvas = document.createElement('canvas');
        canvas.width = 250;
        canvas.height = 350;
        const ctx = canvas.getContext('2d');
        
        // Fond unifie avec le theme Pokeball de l'interface.
        ctx.fillStyle = '#e3352f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#f8fbff';
        ctx.fillRect(0, canvas.height * 0.45, canvas.width, canvas.height * 0.13);

        ctx.fillStyle = '#2f67d8';
        ctx.fillRect(0, canvas.height * 0.58, canvas.width, canvas.height * 0.42);

        ctx.fillStyle = '#ffcb05';
        ctx.fillRect(0, canvas.height * 0.545, canvas.width, 8);
        
        // Cadre
        ctx.strokeStyle = '#ffffff';
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
        ctx.fillStyle = '#e3352f';
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
        
        // Convertir le canvas en data URL
        return canvas.toDataURL('image/png');
    } catch (error) {
        // Image de secours si la génération échoue
        return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="250" height="350" viewBox="0 0 250 350"><rect fill="%23e3352f" width="250" height="158"/><rect fill="%23f8fbff" y="158" width="250" height="44"/><rect fill="%232f67d8" y="202" width="250" height="148"/><rect fill="%23ffcb05" y="190" width="250" height="8"/><text fill="white" font-family="Arial" font-size="24" font-weight="700" text-anchor="middle" x="125" y="92">POKEMON</text><text fill="white" font-family="Arial" font-size="52" font-weight="700" text-anchor="middle" x="125" y="270">151</text></svg>';
    }
}

window.generateBoosterImage = generateBoosterImage;
