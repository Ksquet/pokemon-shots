# Pokémon Shots

Simulateur non officiel d'ouverture de boosters Pokémon 151.

## Lancer l'application

### Option simple

Ouvrez directement `index.html` dans votre navigateur.

Le projet n'utilise plus de modules JavaScript ES chargés via `type="module"`, ce qui évite l'erreur CORS liée aux URLs `file://` :

```text
Access to script at 'file:///.../js/app.js' from origin 'null' has been blocked by CORS policy
```

### Option recommandée pour le développement

L'ouverture en `file://` fonctionne, mais un serveur local reste plus proche d'un vrai environnement web, notamment pour les appels API et le cache navigateur.

Depuis le dossier du projet :

```bash
python -m http.server 8000
```

Puis ouvrez : <http://localhost:8000>

## Fonctionnement

- Les données locales du set 151 sont chargées immédiatement pour que le bouton d'ouverture soit utilisable sans réseau.
- L'API TCGdex est synchronisée en arrière-plan quand elle est disponible.
- Si l'API échoue ou renvoie des données invalides, l'application garde les données locales au lieu de bloquer le bouton.

## Structure

```text
index.html                  Page principale
css/main.css                Styles principaux
css/animations.css          Animations
js/app.js                   Initialisation et orchestration
js/data/pokemon151.js       Données locales de secours
js/api/tcgdex-api.js        Chargement API TCGdex
js/modules/booster.js       Génération des boosters et statistiques
js/modules/card-renderer.js Rendu et révélation des cartes
js/modules/card-zoom.js     Zoom des cartes
js/modules/statistics.js    Panneau de statistiques
js/modules/accounts.js      Comptes locaux, collections et vue admin
js/modules/party-mode.js    Mode soirée et calcul des gorgées
js/utils/booster-image.js   Image de booster générée en canvas
```
