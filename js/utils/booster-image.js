/**
 * Utilitaires pour générer des images de boosters
 */

/**
 * Génère une image de booster
 * @returns {string} URL de données de l'image générée
 */
export function generateBoosterImage() {
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
        
        // Convertir le canvas en data URL
        return canvas.toDataURL('image/png');
    } catch (error) {
        // Image de secours si la génération échoue
        return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="250" height="350" viewBox="0 0 250 350"><rect fill="%23ff3e3e" width="250" height="350"/><text fill="white" font-family="Arial" font-size="24" text-anchor="middle" x="125" y="175">Booster 151</text></svg>';
    }
}