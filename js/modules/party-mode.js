/**
 * Mode Soiree: draft de cartes et calcul des gorgees.
 */

const PARTY_STORAGE_KEY = 'pokemonShotsPartyState';
const PARTY_PICK_SIZE = 6;

function createPartyMode() {
    let app = null;
    let panel = null;
    let navItem = null;
    let state = loadPartyState();

    function loadPartyState() {
        try {
            return JSON.parse(localStorage.getItem(PARTY_STORAGE_KEY)) || null;
        } catch (error) {
            return null;
        }
    }

    function savePartyState() {
        if (state) {
            localStorage.setItem(PARTY_STORAGE_KEY, JSON.stringify(state));
        } else {
            localStorage.removeItem(PARTY_STORAGE_KEY);
        }
    }

    function shuffle(array) {
        const copy = [...array];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    function getCardKey(card) {
        return card.localId || card.number || card.id || card.name;
    }

    function getCardLite(card) {
        return {
            key: getCardKey(card),
            id: card.id,
            localId: card.localId,
            name: card.name,
            rarity: card.rarity,
            number: card.number,
            imageUrl: card.imageUrl,
            type: card.type
        };
    }

    function getPool(rarityType) {
        if (!app?.boosterOpener) {
            return [];
        }

        return app.boosterOpener.getCardsByMappedRarity(rarityType)
            .filter(card => !card.specialType)
            .map(getCardLite);
    }

    function getTargetPickCount(rarityType, playerCount) {
        const poolSize = getPool(rarityType).length;
        return Math.floor((Math.floor(poolSize / 2)) / playerCount) * playerCount;
    }

    function ensurePartyPanel() {
        if (!navItem) {
            const navList = document.querySelector('nav ul');
            if (navList) {
                navItem = document.createElement('li');
                navItem.className = 'party-nav-item';
                navItem.innerHTML = '<button type="button">Soiree</button>';
                navList.appendChild(navItem);
                navItem.querySelector('button').addEventListener('click', showPanel);
            }
        }

        if (panel) {
            return;
        }

        panel = document.createElement('section');
        panel.className = 'party-panel hidden';
        document.querySelector('main')?.appendChild(panel);
    }

    function hideMainViews() {
        document.querySelector('.booster-selection')?.classList.add('hidden');
        document.getElementById('opening-area')?.classList.add('hidden');
        document.querySelector('.admin-dashboard')?.classList.add('hidden');
    }

    function showPanel() {
        ensurePartyPanel();
        hideMainViews();
        panel.classList.remove('hidden');
        render();
    }

    function showBoosterView() {
        panel?.classList.add('hidden');

        const openingArea = document.getElementById('opening-area');
        const hasBoosterRecap = Boolean(document.querySelector('.cards-container .card'));

        if (openingArea && hasBoosterRecap) {
            openingArea.classList.remove('hidden');
            document.querySelector('.booster-selection')?.classList.add('hidden');
        } else {
            document.querySelector('.booster-selection')?.classList.remove('hidden');
        }
    }

    function getSelectableUsers() {
        return (window.accounts?.getUsers() || [])
            .filter(user => user.role !== 'admin')
            .sort((a, b) => a.username.localeCompare(b.username));
    }

    function createInitialState(players, mode) {
        return {
            active: true,
            mode,
            players: shuffle(players).map(username => ({
                username,
                ownedCards: {
                    common: [],
                    uncommon: []
                },
                drinkTotal: 0
            })),
            openerIndex: 0,
            draft: null,
            lastResult: null,
            createdAt: new Date().toISOString()
        };
    }

    function startParty(players, mode) {
        state = createInitialState(players, mode);

        if (mode === 'random') {
            distributeRandom('common');
            distributeRandom('uncommon');
        } else {
            startDraft('common');
        }

        savePartyState();
        render();
    }

    function getAssignedKeys(rarityType) {
        return new Set(state.players.flatMap(player => player.ownedCards[rarityType].map(card => card.key)));
    }

    function distributeRandom(rarityType) {
        const target = getTargetPickCount(rarityType, state.players.length);
        const cards = shuffle(getPool(rarityType)).slice(0, target);

        cards.forEach((card, index) => {
            state.players[index % state.players.length].ownedCards[rarityType].push(card);
        });
    }

    function startDraft(rarityType) {
        const target = getTargetPickCount(rarityType, state.players.length);

        if (target <= 0) {
            if (rarityType === 'common') {
                startDraft('uncommon');
            } else {
                state.draft = null;
            }
            return;
        }

        state.draft = {
            rarityType,
            target,
            picked: 0,
            round: 0,
            turnIndex: 0,
            roundOrder: [],
            options: []
        };
        prepareDraftRound();
    }

    function prepareDraftRound() {
        const draft = state.draft;
        const alreadyAssigned = getAssignedKeys(draft.rarityType);
        const pool = shuffle(getPool(draft.rarityType).filter(card => !alreadyAssigned.has(card.key)));
        const remainingToPick = draft.target - draft.picked;
        const optionCount = Math.min(PARTY_PICK_SIZE, pool.length, remainingToPick + state.players.length - 1);

        draft.options = pool.slice(0, optionCount);
        const start = draft.round % state.players.length;
        draft.roundOrder = state.players.map((_, index) => (start + index) % state.players.length);
        draft.turnIndex = 0;
    }

    function getCurrentDrafter() {
        if (!state?.draft) {
            return null;
        }

        return state.players[state.draft.roundOrder[state.draft.turnIndex]];
    }

    function pickDraftCard(cardKey) {
        const draft = state.draft;
        const player = getCurrentDrafter();
        const cardIndex = draft.options.findIndex(card => card.key === cardKey);

        if (!draft || !player || cardIndex < 0) {
            return;
        }

        const [card] = draft.options.splice(cardIndex, 1);
        player.ownedCards[draft.rarityType].push(card);
        draft.picked++;
        draft.turnIndex++;

        if (draft.picked >= draft.target) {
            if (draft.rarityType === 'common') {
                startDraft('uncommon');
            } else {
                state.draft = null;
            }
        } else if (draft.turnIndex >= draft.roundOrder.length || draft.options.length === 0) {
            draft.round++;
            prepareDraftRound();
        }

        savePartyState();
        render();
    }

    function getOwnerForCard(card) {
        const key = getCardKey(card);
        const rarity = app?.boosterOpener?.getMappedRarity(card);

        if (rarity !== 'common' && rarity !== 'uncommon') {
            return null;
        }

        return state.players.find(player =>
            player.ownedCards[rarity].some(ownedCard => ownedCard.key === key)
        );
    }

    function getHitDrinkValue(card) {
        if (card.specialType === 'doubleRare' || card.isDoubleRare) {
            return 4;
        }

        if (card.specialType === 'illustrationRare') {
            return 5;
        }

        if (card.specialType || ['ultraRare', 'hyperRare', 'secretRare'].includes(card.rarity)) {
            return 7;
        }

        return 0;
    }

    function scoreBooster(boosterCards) {
        if (!state?.active || state.draft) {
            return null;
        }

        const opener = state.players[state.openerIndex];
        const distribution = Object.fromEntries(state.players.map(player => [player.username, 0]));
        const events = [];

        boosterCards.forEach(card => {
            const owner = getOwnerForCard(card);
            if (owner) {
                const drinks = 1 + (card.isReverseHolo ? 1 : 0);
                distribution[owner.username] += drinks;
                events.push({
                    type: 'owned-card',
                    username: owner.username,
                    drinks,
                    cardName: card.name
                });
            }

            const hitDrinks = getHitDrinkValue(card);
            if (hitDrinks > 0) {
                distribution[opener.username] += hitDrinks;
                events.push({
                    type: 'hit',
                    username: opener.username,
                    drinks: hitDrinks,
                    cardName: card.name
                });
            }
        });

        Object.entries(distribution).forEach(([username, drinks]) => {
            const player = state.players.find(candidate => candidate.username === username);
            if (player) {
                player.drinkTotal += drinks;
            }
        });

        const nextOpener = state.players[(state.openerIndex + 1) % state.players.length];

        state.lastResult = {
            opener: opener.username,
            nextOpener: nextOpener.username,
            distribution,
            events,
            openedAt: new Date().toISOString()
        };
        state.openerIndex = (state.openerIndex + 1) % state.players.length;
        savePartyState();
        render();
        return state.lastResult;
    }

    function renderSetup() {
        const users = getSelectableUsers();
        return `
            <div class="party-header">
                <div>
                    <p>Mode Soiree</p>
                    <h2>Pokemon Shots</h2>
                </div>
                <button type="button" id="party-back">Retour</button>
            </div>
            <div class="party-setup">
                <section>
                    <h3>Participants</h3>
                    <div class="party-user-list">
                        ${users.length ? users.map(user => `
                            <label>
                                <input type="checkbox" value="${user.username}">
                                <span>${user.displayName || user.username}</span>
                            </label>
                        `).join('') : '<p>Aucun utilisateur cree. Cree des usernames via Connexion.</p>'}
                    </div>
                </section>
                <section>
                    <h3>Preparation</h3>
                    <label><input type="radio" name="party-mode" value="draft" checked> Draft manuel</label>
                    <label><input type="radio" name="party-mode" value="random"> Distribution random</label>
                    <button type="button" id="party-start">Lancer la soiree</button>
                </section>
            </div>
        `;
    }

    function renderDraft() {
        const draft = state.draft;
        const player = getCurrentDrafter();
        const pickedText = `${draft.picked}/${draft.target}`;

        return `
            <div class="party-header">
                <div>
                    <p>Draft ${draft.rarityType}</p>
                    <h2>${player.username} choisit une carte</h2>
                    <span>${pickedText} cartes choisies</span>
                </div>
                <button type="button" id="party-stop">Arreter</button>
            </div>
            <div class="party-draft-grid">
                ${draft.options.map(card => `
                    <button type="button" class="party-draft-card" data-card-key="${card.key}">
                        <img src="${card.imageUrl || `assets/images/cards/151/${card.id}.jpg`}" alt="${card.name}">
                        <span>${card.name}</span>
                    </button>
                `).join('')}
            </div>
            ${renderPartyRoster()}
        `;
    }

    function renderPartyRoster() {
        return `
            <div class="party-roster">
                ${state.players.map((player, index) => `
                    <article class="${index === state.openerIndex && !state.draft ? 'is-opener' : ''}">
                        <strong>${player.username}</strong>
                        <span>${player.ownedCards.common.length} C / ${player.ownedCards.uncommon.length} U</span>
                        <em>${player.drinkTotal} gorgees</em>
                    </article>
                `).join('')}
            </div>
        `;
    }

    function renderOwnedCardList(cards) {
        if (!cards.length) {
            return '<p class="party-empty-cards">Aucune carte.</p>';
        }

        return `
            <div class="party-owned-card-grid">
                ${cards.map(card => `
                    <article>
                        <img src="${card.imageUrl || `assets/images/cards/151/${card.id}.jpg`}" alt="${card.name}">
                        <span>${card.name}</span>
                    </article>
                `).join('')}
            </div>
        `;
    }

    function renderPlayerCollections() {
        return `
            <section class="party-collections">
                <div class="party-section-header">
                    <div>
                        <p>Verification</p>
                        <h3>Cartes des joueurs</h3>
                    </div>
                </div>
                <div class="party-collection-list">
                    ${state.players.map(player => `
                        <details class="party-player-collection">
                            <summary>
                                <strong>${player.username}</strong>
                                <span>${player.ownedCards.common.length} communes - ${player.ownedCards.uncommon.length} uncommons</span>
                            </summary>
                            <div class="party-owned-section">
                                <h4>Communes</h4>
                                ${renderOwnedCardList(player.ownedCards.common)}
                            </div>
                            <div class="party-owned-section">
                                <h4>Uncommons</h4>
                                ${renderOwnedCardList(player.ownedCards.uncommon)}
                            </div>
                        </details>
                    `).join('')}
                </div>
            </section>
        `;
    }

    function renderLastResult() {
        if (!state.lastResult) {
            return '';
        }

        return `
            <section class="party-result">
                <h3>Recap du dernier booster - ${state.lastResult.opener}</h3>
                <div class="party-drink-grid">
                    ${Object.entries(state.lastResult.distribution).map(([username, drinks]) => `
                        <article>
                            <span>${username}</span>
                            <strong>${drinks}</strong>
                        </article>
                    `).join('')}
                </div>
                <ul>
                    ${state.lastResult.events.length ? state.lastResult.events.map(event => `
                        <li>${event.username} distribue ${event.drinks} pour ${event.cardName}</li>
                    `).join('') : '<li>Aucune gorgee sur ce booster.</li>'}
                </ul>
            </section>
        `;
    }

    function renderGame() {
        const opener = state.players[state.openerIndex];
        return `
            <div class="party-header">
                <div>
                    <p>Partie en cours</p>
                    <h2>${opener.username} ouvre le prochain booster</h2>
                </div>
                <div class="party-actions">
                    <button type="button" id="party-back">Retour aux boosters</button>
                    <button type="button" id="party-open-booster">Ouvrir le booster</button>
                    <button type="button" id="party-stop">Arreter</button>
                </div>
            </div>
            ${renderPartyRoster()}
            ${renderPlayerCollections()}
            ${renderLastResult()}
        `;
    }

    function render() {
        ensurePartyPanel();
        if (!panel) {
            return;
        }

        if (!state?.active) {
            panel.innerHTML = renderSetup();
        } else if (state.draft) {
            panel.innerHTML = renderDraft();
        } else {
            panel.innerHTML = renderGame();
        }

        bindPanelEvents();
    }

    function bindPanelEvents() {
        panel.querySelector('#party-back')?.addEventListener('click', showBoosterView);
        panel.querySelector('#party-stop')?.addEventListener('click', () => {
            state = null;
            savePartyState();
            render();
        });
        panel.querySelector('#party-start')?.addEventListener('click', () => {
            const players = [...panel.querySelectorAll('.party-user-list input:checked')].map(input => input.value);
            const mode = panel.querySelector('input[name="party-mode"]:checked')?.value || 'draft';
            if (players.length < 2) {
                alert('Selectionne au moins 2 joueurs.');
                return;
            }
            startParty(players, mode);
        });
        panel.querySelectorAll('.party-draft-card').forEach(button => {
            button.addEventListener('click', () => pickDraftCard(button.dataset.cardKey));
        });
        panel.querySelector('#party-open-booster')?.addEventListener('click', () => {
            showBoosterView();
            app?.openBooster();
        });
    }

    function init(options = {}) {
        app = options.app || null;
        ensurePartyPanel();
        render();
    }

    return {
        init,
        isActive: () => Boolean(state?.active && !state.draft),
        getCardOwner: (card) => state?.active && !state.draft ? getOwnerForCard(card) : null,
        scoreBooster
    };
}

window.partyMode = createPartyMode();
