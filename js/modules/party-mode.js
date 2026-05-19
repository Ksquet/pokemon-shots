/**
 * Mode Soiree: draft de cartes et calcul des gorgees.
 */

const PARTY_STORAGE_KEY = 'pokemonShotsPartyState';
const PARTY_DEFAULT_SETTINGS_KEY = 'pokemonShotsPartyDefaultSettings';
const PARTY_PICK_SIZE = 6;
const PARTY_DEFAULT_SETTINGS = {
    poolRatios: {
        common: 0.5,
        uncommon: 0.5
    },
    draftOptionCount: PARTY_PICK_SIZE,
    drinkValues: {
        ownedCard: 1,
        holo: 1,
        reverseHolo: 0,
        doubleRare: 4,
        ultraRare: 7,
        illustrationRare: 5,
        specialIllustrationRare: 7,
        hyperRare: 7,
        fallbackHit: 7
    }
};

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
            window.sharedStore?.saveFromLocalStorage?.(PARTY_STORAGE_KEY);
        } else {
            localStorage.removeItem(PARTY_STORAGE_KEY);
            window.sharedStore?.save?.(PARTY_STORAGE_KEY, null).catch(error => {
                console.warn('[Pokemon Shots] Suppression Supabase du mode soirée échouée.', error);
            });
        }
    }

    function getBoosterHistory() {
        if (Array.isArray(state?.boosterHistory)) {
            return state.boosterHistory;
        }

        return state?.lastResult ? [state.lastResult] : [];
    }

    function recalculatePlayerStatsFromHistory() {
        if (!state?.players) {
            return;
        }

        const history = getBoosterHistory();
        state.players.forEach(player => {
            player.drinkTotal = history.reduce((total, booster) => total + (booster.distribution?.[player.username] || 0), 0);
            player.openedCount = history.filter(booster => booster.opener === player.username).length;
        });
        state.boostersOpened = history.length;
    }

    function getSpecialStatKey(card) {
        if (card.specialType) {
            return card.specialType;
        }

        if (card.isDoubleRare) {
            return 'doubleRare';
        }

        return null;
    }

    function createEmptySpecialStats() {
        return {
            doubleRare: 0,
            ultraRare: 0,
            illustrationRare: 0,
            specialIllustrationRare: 0,
            hyperRare: 0
        };
    }

    function cloneDefaultSettings() {
        return JSON.parse(JSON.stringify(PARTY_DEFAULT_SETTINGS));
    }

    function loadDefaultSettings() {
        try {
            return normalizeSettings(JSON.parse(localStorage.getItem(PARTY_DEFAULT_SETTINGS_KEY)) || {});
        } catch (error) {
            return cloneDefaultSettings();
        }
    }

    function saveDefaultSettings(settings) {
        const normalizedSettings = normalizeSettings(settings);
        localStorage.setItem(PARTY_DEFAULT_SETTINGS_KEY, JSON.stringify(normalizedSettings));
        window.sharedStore?.saveFromLocalStorage?.(PARTY_DEFAULT_SETTINGS_KEY);
        return normalizedSettings;
    }

    function clampNumber(value, min, max, fallback) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return fallback;
        }

        return Math.min(max, Math.max(min, number));
    }

    function normalizeSettings(settings = {}) {
        const defaults = cloneDefaultSettings();

        return {
            poolRatios: {
                common: clampNumber(settings.poolRatios?.common, 0, 1, defaults.poolRatios.common),
                uncommon: clampNumber(settings.poolRatios?.uncommon, 0, 1, defaults.poolRatios.uncommon)
            },
            draftOptionCount: Math.round(clampNumber(settings.draftOptionCount, 2, 12, defaults.draftOptionCount)),
            drinkValues: Object.fromEntries(
                Object.entries(defaults.drinkValues).map(([key, fallback]) => [
                    key,
                    Math.round(clampNumber(settings.drinkValues?.[key], 0, 99, fallback))
                ])
            )
        };
    }

    function getSettings() {
        return normalizeSettings(state?.settings);
    }

    function getPlayerPullStats(username, history) {
        const openedBoosters = history.filter(booster => booster.opener === username);
        const stats = createEmptySpecialStats();

        openedBoosters.forEach(booster => {
            booster.cards?.forEach(card => {
                const statKey = getSpecialStatKey(card);
                if (statKey && statKey in stats) {
                    stats[statKey]++;
                }
            });
        });

        return {
            opened: openedBoosters.length,
            ...stats
        };
    }

    function normalizeState() {
        if (!state) {
            return;
        }

        state.players?.forEach(player => {
            player.ownedCards ||= { common: [], uncommon: [] };
            player.ownedCards.common ||= [];
            player.ownedCards.uncommon ||= [];
        });

        if (!Array.isArray(state.boosterHistory)) {
            state.boosterHistory = state.lastResult ? [state.lastResult] : [];
        }

        if (state.boosterHistory.length) {
            state.lastResult = state.boosterHistory[state.boosterHistory.length - 1];
        }

        state.settings = normalizeSettings(state.settings);
        state.x2Selection ||= null;

        recalculatePlayerStatsFromHistory();
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
        const ratio = getSettings().poolRatios[rarityType] ?? 0.5;
        return Math.floor(Math.floor(poolSize * ratio) / playerCount) * playerCount;
    }

    function ensurePartyPanel() {
        if (!navItem) {
            const navList = document.querySelector('nav ul');
            if (navList) {
                navItem = document.createElement('li');
                navItem.className = 'party-nav-item';
                navItem.innerHTML = '<button type="button">Soirée</button>';
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
        document.querySelector('.collection-panel')?.classList.add('hidden');
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
            window.pokemonShotsApp?.updatePartyOpenerPreview?.();
        }
    }

    function getSelectableUsers() {
        return (window.accounts?.getUsers() || [])
            .filter(user => user.role !== 'admin')
            .sort((a, b) => a.username.localeCompare(b.username));
    }

    function createInitialState(players, mode, settings) {
        return {
            active: true,
            mode,
            settings: normalizeSettings(settings),
            players: shuffle(players).map(username => ({
                username,
                ownedCards: {
                    common: [],
                    uncommon: []
                },
                drinkTotal: 0,
                openedCount: 0
            })),
            openerIndex: 0,
            draft: null,
            x2Selection: null,
            x2Card: null,
            lastResult: null,
            boostersOpened: 0,
            boosterHistory: [],
            createdAt: new Date().toISOString()
        };
    }

    function startParty(players, mode, settings) {
        state = createInitialState(players, mode, settings);

        if (mode === 'random') {
            distributeRandom('common');
            distributeRandom('uncommon');
            startX2Selection();
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

    function getUnassignedCommonCards() {
        const assignedKeys = getAssignedKeys('common');
        return getPool('common').filter(card => !assignedKeys.has(card.key));
    }

    function startX2Selection() {
        const options = getUnassignedCommonCards();
        state.draft = null;
        state.x2Selection = options.length ? { options } : null;
        state.x2Card = null;
    }

    function pickX2Card(cardKey) {
        if (!state?.x2Selection) {
            return;
        }

        const options = state.x2Selection.options || [];
        const card = cardKey === 'random'
            ? shuffle(options)[0]
            : options.find(option => option.key === cardKey);

        if (!card) {
            return;
        }

        state.x2Card = card;
        state.x2Selection = null;
        savePartyState();
        render();
    }

    function startDraft(rarityType) {
        const target = getTargetPickCount(rarityType, state.players.length);

        if (target <= 0) {
            if (rarityType === 'common') {
                startDraft('uncommon');
            } else {
                startX2Selection();
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
        const optionCount = Math.min(getSettings().draftOptionCount, pool.length, remainingToPick + state.players.length - 1);

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

        if (!draft || !player) {
            return;
        }

        const cardIndex = draft.options.findIndex(card => card.key === cardKey);

        if (cardIndex < 0) {
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
                startX2Selection();
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
        const values = getSettings().drinkValues;

        if (card.isReverseHolo) {
            return values.reverseHolo;
        }

        if (card.specialType === 'doubleRare' || card.isDoubleRare) {
            return values.doubleRare;
        }

        if (card.specialType === 'illustrationRare') {
            return values.illustrationRare;
        }

        if (card.specialType === 'ultraRare') {
            return values.ultraRare;
        }

        if (card.specialType === 'specialIllustrationRare') {
            return values.specialIllustrationRare;
        }

        if (card.specialType === 'hyperRare') {
            return values.hyperRare;
        }

        if (card.specialType || ['ultraRare', 'hyperRare', 'secretRare'].includes(card.rarity)) {
            return values.fallbackHit;
        }

        if (card.isFoil) {
            return values.holo;
        }

        return 0;
    }

    function isStandardFoilCard(card) {
        return Boolean(card.isFoil && !card.isReverseHolo && !card.specialType && !card.isDoubleRare);
    }

    function getX2CardsInBooster(boosterCards) {
        if (!state?.x2Card) {
            return [];
        }

        return boosterCards.filter(card => getCardKey(card) === state.x2Card.key);
    }

    function hasPendingX2(result = state?.lastResult) {
        if (!result?.x2?.available || result.x2.skipped) {
            return false;
        }

        const totalUses = result.x2.count || 1;
        const usedCount = result.x2.applications?.length || (result.x2.applied ? 1 : 0);
        return usedCount < totalUses;
    }

    function recomputeEveryoneDrinks(distribution) {
        return state.players.length > 0
            && state.players.every(player => distribution[player.username] === 1);
    }

    function applyX2Target(username) {
        if (!state?.active || !hasPendingX2()) {
            return state?.lastResult || null;
        }

        const result = state.lastResult;
        const normalizedUsername = username || '';
        const targetExists = state.players.some(player => player.username === normalizedUsername);

        if (!targetExists) {
            return result;
        }

        const bonus = result.distribution[normalizedUsername] || 0;
        result.distribution[normalizedUsername] += bonus;
        result.everyoneDrinks = recomputeEveryoneDrinks(result.distribution);
        const applications = result.x2.applications || [];
        applications.push({
            target: normalizedUsername,
            bonus
        });

        result.x2 = {
            ...result.x2,
            applied: applications.length >= (result.x2.count || 1),
            target: normalizedUsername,
            bonus,
            applications
        };
        result.events.push({
            type: 'x2',
            username: normalizedUsername,
            drinks: bonus,
            cardName: result.x2.card.name
        });

        const historyIndex = state.boosterHistory.findIndex(booster => booster.openedAt === result.openedAt);
        if (historyIndex >= 0) {
            state.boosterHistory[historyIndex] = result;
        }

        recalculatePlayerStatsFromHistory();
        savePartyState();
        render();
        return result;
    }

    function scoreBooster(boosterCards) {
        if (!state?.active || state.draft || state.x2Selection) {
            return null;
        }

        const opener = state.players[state.openerIndex];
        const distribution = Object.fromEntries(state.players.map(player => [player.username, 0]));
        const events = [];
        const debugRows = [];

        boosterCards.forEach(card => {
            const owner = getOwnerForCard(card);
            const debugBase = {
                carte: card.name,
                slot: card.DEBUG_ORDER || '-',
                rareté: card.specialType || card.rarity || '-',
                propriétaire: owner?.username || '-',
                ouvreur: opener.username
            };

            if (card.isReverseHolo) {
                const ownedDrinks = owner ? getSettings().drinkValues.ownedCard : 0;
                const reverseBonusDrinks = owner ? getHitDrinkValue(card) : 0;
                const drinks = ownedDrinks + reverseBonusDrinks;

                if (owner && drinks > 0) {
                    distribution[owner.username] += drinks;
                    events.push({
                        type: 'reverse-holo',
                        username: owner.username,
                        drinks,
                        cardName: card.name
                    });
                }
                debugRows.push({
                    ...debugBase,
                    raison: owner ? 'Carte possédée + bonus Reverse holo' : 'Reverse holo non possédée',
                    cible: owner?.username || '-',
                    gorgées: drinks
                });
                return;
            }

            if (owner) {
                const drinks = getSettings().drinkValues.ownedCard;
                if (drinks > 0) {
                    distribution[owner.username] += drinks;
                    events.push({
                        type: 'owned-card',
                        username: owner.username,
                        drinks,
                        cardName: card.name
                    });
                }
                debugRows.push({
                    ...debugBase,
                    raison: 'Carte possédée',
                    cible: owner.username,
                    gorgées: drinks
                });
            }

            if (isStandardFoilCard(card)) {
                const holoDrinks = owner ? getHitDrinkValue(card) : 0;

                if (owner && holoDrinks > 0) {
                    distribution[owner.username] += holoDrinks;
                    events.push({
                        type: 'owned-holo',
                        username: owner.username,
                        drinks: holoDrinks,
                        cardName: card.name
                    });
                }

                debugRows.push({
                    ...debugBase,
                    raison: owner ? 'Carte possédée + bonus rare/holo' : 'Rare/holo non possédée',
                    cible: owner?.username || '-',
                    gorgées: holoDrinks
                });
                return;
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
                debugRows.push({
                    ...debugBase,
                    raison: 'Hit / holo',
                    cible: opener.username,
                    gorgées: hitDrinks
                });
            }

            if (!owner && hitDrinks <= 0) {
                debugRows.push({
                    ...debugBase,
                    raison: 'Aucune gorgée',
                    cible: '-',
                    gorgées: 0
                });
            }
        });

        const everyoneDrinks = recomputeEveryoneDrinks(distribution);
        const nextOpener = state.players[(state.openerIndex + 1) % state.players.length];
        const x2CardsInBooster = getX2CardsInBooster(boosterCards);

        const boosterRecord = {
            opener: opener.username,
            nextOpener: nextOpener.username,
            distribution,
            events,
            everyoneDrinks,
            x2: x2CardsInBooster.length ? {
                available: true,
                applied: false,
                skipped: false,
                count: x2CardsInBooster.length,
                target: null,
                bonus: 0,
                applications: [],
                decidedBy: opener.username,
                card: {
                    ...state.x2Card,
                    pulledCardName: x2CardsInBooster[0].name
                }
            } : null,
            settings: getSettings(),
            cards: boosterCards.map(card => ({
                ...getCardLite(card),
                mappedRarity: app?.boosterOpener?.getMappedRarity(card),
                specialType: card.specialType,
                isDoubleRare: Boolean(card.isDoubleRare),
                isReverseHolo: Boolean(card.isReverseHolo),
                isFoil: Boolean(card.isFoil)
            })),
            openedAt: new Date().toISOString()
        };

        state.boosterHistory ||= [];
        state.boosterHistory.push(boosterRecord);
        state.lastResult = boosterRecord;
        recalculatePlayerStatsFromHistory();
        state.openerIndex = (state.openerIndex + 1) % state.players.length;
        savePartyState();
        render();
        logDrinkCalculation(boosterRecord, debugRows);
        return state.lastResult;
    }

    function logDrinkCalculation(boosterRecord, debugRows) {
        console.groupCollapsed(`[Pokemon Shots] Calcul des gorgées - ${boosterRecord.opener}`);
        console.table(debugRows);
        console.log('Distribution finale:', boosterRecord.distribution);
        console.log('Evenements retenus:', boosterRecord.events);
        console.log('Paramètres utilisés:', boosterRecord.settings.drinkValues);
        console.log('Carte x2:', boosterRecord.x2);
        console.log('Tout le monde boit:', boosterRecord.everyoneDrinks);
        console.groupEnd();
    }

    function getSummary() {
        if (!state?.active || state.draft || state.x2Selection) {
            return null;
        }

        const history = getBoosterHistory();
        const players = state.players.map(player => ({
            username: player.username,
            openedCount: history.filter(booster => booster.opener === player.username).length,
            drinkTotal: history.reduce((total, booster) => total + (booster.distribution?.[player.username] || 0), 0),
            commonCount: player.ownedCards.common.length,
            uncommonCount: player.ownedCards.uncommon.length,
            ownedCards: player.ownedCards,
            pullStats: getPlayerPullStats(player.username, history),
            lastBoosterDrinks: state.lastResult?.distribution?.[player.username] || 0
        }));

        const totalDrinks = players.reduce((total, player) => total + player.drinkTotal, 0);
        const topPlayer = players.reduce((leader, player) => {
            if (!leader || player.drinkTotal > leader.drinkTotal) {
                return player;
            }

            return leader;
        }, null);

        return {
            boostersOpened: history.length,
            totalDrinks,
            currentOpener: state.players[state.openerIndex]?.username || null,
            lastResult: state.lastResult,
            topPlayer,
            boosterHistory: history,
            x2Card: state.x2Card,
            players
        };
    }

    function renderSetup() {
        const users = getSelectableUsers();
        const settings = loadDefaultSettings();
        return `
            <div class="party-header">
                <div>
                    <p>Mode Soirée</p>
                    <h2>Pokémon Shots</h2>
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
                        `).join('') : '<p>Aucun utilisateur créé. Crée des usernames via Connexion.</p>'}
                    </div>
                </section>
                <section>
                    <h3>Préparation</h3>
                    <label><input type="radio" name="party-mode" value="draft" checked> Draft manuel</label>
                    <label><input type="radio" name="party-mode" value="random"> Distribution random</label>
                    ${renderPartySettings(settings)}
                    <button type="button" id="party-start">Lancer la soirée</button>
                </section>
            </div>
        `;
    }

    function renderSettingInput(key, label, value, step = 1, min = 0, max = 99) {
        return `
            <label class="party-setting-field">
                <span>${label}</span>
                <input type="number" name="${key}" value="${value}" min="${min}" max="${max}" step="${step}">
            </label>
        `;
    }

    function renderPartySettings(settings) {
        return `
            <details class="party-settings">
                <summary>Paramètres</summary>
                <div class="party-settings-grid">
                    <section>
                        <h4>Pool de draft</h4>
                        ${renderSettingInput('commonRatio', 'Ratio communes', settings.poolRatios.common, 0.01, 0, 1)}
                        ${renderSettingInput('uncommonRatio', 'Ratio peu communes', settings.poolRatios.uncommon, 0.01, 0, 1)}
                        ${renderSettingInput('draftOptionCount', 'Choix par tour', settings.draftOptionCount, 1, 2, 12)}
                    </section>
                    <section>
                        <h4>Gorgees</h4>
                        ${renderSettingInput('ownedCardDrinks', 'Carte possédée', settings.drinkValues.ownedCard)}
                        ${renderSettingInput('holoDrinks', 'Bonus Holo standard', settings.drinkValues.holo)}
                        ${renderSettingInput('reverseHoloDrinks', 'Bonus Reverse holo possédée', settings.drinkValues.reverseHolo)}
                        ${renderSettingInput('doubleRareDrinks', 'Double Rare', settings.drinkValues.doubleRare)}
                        ${renderSettingInput('ultraRareDrinks', 'Ultra Rare', settings.drinkValues.ultraRare)}
                        ${renderSettingInput('illustrationRareDrinks', 'Illustration Rare', settings.drinkValues.illustrationRare)}
                        ${renderSettingInput('specialIllustrationRareDrinks', 'Illustration Spéciale', settings.drinkValues.specialIllustrationRare)}
                        ${renderSettingInput('hyperRareDrinks', 'Hyper Rare', settings.drinkValues.hyperRare)}
                        ${renderSettingInput('fallbackHitDrinks', 'Autre hit', settings.drinkValues.fallbackHit)}
                    </section>
                </div>
            </details>
        `;
    }

    function renderActivePartySettings() {
        const settings = getSettings();
        return `
            <section class="party-active-settings">
                ${renderPartySettings(settings)}
                <button type="button" id="party-save-settings">Appliquer aux prochains boosters</button>
            </section>
        `;
    }

    function getNumberInputValue(root, name, fallback) {
        const input = root?.querySelector(`[name="${name}"]`);
        return input ? input.value : fallback;
    }

    function collectSettingsFromRoot(root, fallbackSettings = PARTY_DEFAULT_SETTINGS) {
        return normalizeSettings({
            poolRatios: {
                common: getNumberInputValue(root, 'commonRatio', fallbackSettings.poolRatios.common),
                uncommon: getNumberInputValue(root, 'uncommonRatio', fallbackSettings.poolRatios.uncommon)
            },
            draftOptionCount: getNumberInputValue(root, 'draftOptionCount', fallbackSettings.draftOptionCount),
            drinkValues: {
                ownedCard: getNumberInputValue(root, 'ownedCardDrinks', fallbackSettings.drinkValues.ownedCard),
                holo: getNumberInputValue(root, 'holoDrinks', fallbackSettings.drinkValues.holo),
                reverseHolo: getNumberInputValue(root, 'reverseHoloDrinks', fallbackSettings.drinkValues.reverseHolo),
                doubleRare: getNumberInputValue(root, 'doubleRareDrinks', fallbackSettings.drinkValues.doubleRare),
                ultraRare: getNumberInputValue(root, 'ultraRareDrinks', fallbackSettings.drinkValues.ultraRare),
                illustrationRare: getNumberInputValue(root, 'illustrationRareDrinks', fallbackSettings.drinkValues.illustrationRare),
                specialIllustrationRare: getNumberInputValue(root, 'specialIllustrationRareDrinks', fallbackSettings.drinkValues.specialIllustrationRare),
                hyperRare: getNumberInputValue(root, 'hyperRareDrinks', fallbackSettings.drinkValues.hyperRare),
                fallbackHit: getNumberInputValue(root, 'fallbackHitDrinks', fallbackSettings.drinkValues.fallbackHit)
            }
        });
    }

    function collectSettingsFromPanel() {
        return collectSettingsFromRoot(panel, loadDefaultSettings());
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
                <button type="button" id="party-stop">Arrêter</button>
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

    function renderX2Selection() {
        const options = state.x2Selection?.options || [];

        return `
            <div class="party-header">
                <div>
                    <p>Carte x2</p>
                    <h2>Choisissez la carte qui double les gorgées</h2>
                    <span>${options.length} communes disponibles hors mains des joueurs</span>
                </div>
                <button type="button" id="party-stop">Arrêter</button>
            </div>
            <section class="party-x2-intro">
                <div>
                    <strong>Si cette carte sort dans un booster, l'ouvreur choisira quel joueur voit ses gorgées doubler.</strong>
                    <span>Le plus souvent c'est l'ouvreur, sauf si un autre joueur a plus à prendre.</span>
                </div>
                <button type="button" id="party-x2-random">Choisir aléatoirement</button>
            </section>
            <div class="party-draft-grid party-x2-grid">
                ${options.map(card => `
                    <button type="button" class="party-draft-card party-x2-card" data-x2-card-key="${card.key}">
                        <img src="${card.imageUrl || `assets/images/cards/151/${card.id}.jpg`}" alt="${card.name}">
                        <span>${card.name}</span>
                    </button>
                `).join('')}
            </div>
            ${renderPartyRoster()}
        `;
    }

    function renderX2ActiveCard() {
        if (!state.x2Card) {
            return '';
        }

        return `
            <section class="party-x2-active">
                <div>
                    <span>Carte x2</span>
                    <strong>${state.x2Card.name}</strong>
                </div>
                <img src="${state.x2Card.imageUrl || `assets/images/cards/151/${state.x2Card.id}.jpg`}" alt="${state.x2Card.name}">
            </section>
        `;
    }

    function renderPartyRoster() {
        return `
            <div class="party-roster">
                ${state.players.map((player, index) => `
                    <article class="${index === state.openerIndex && !state.draft ? 'is-opener' : ''}">
                        <strong>${player.username}</strong>
                        <span>${player.ownedCards.common.length} C / ${player.ownedCards.uncommon.length} U</span>
                        <em>${player.drinkTotal} gorgées</em>
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
                        <p>Vérification</p>
                        <h3>Cartes des joueurs</h3>
                    </div>
                </div>
                <div class="party-collection-list">
                    ${state.players.map(player => `
                        <details class="party-player-collection">
                            <summary>
                                <strong>${player.username}</strong>
                                <span>${player.ownedCards.common.length} communes - ${player.ownedCards.uncommon.length} peu communes</span>
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
                <h3>Récap du dernier booster - ${state.lastResult.opener}</h3>
                ${state.lastResult.everyoneDrinks ? `
                    <div class="party-everyone-drinks">
                        <strong>Tout le monde boit !</strong>
                        <span>Une gorgée pour chaque joueur.</span>
                    </div>
                ` : ''}
                <div class="party-drink-grid">
                    ${Object.entries(state.lastResult.distribution).map(([username, drinks]) => `
                        <article>
                            <span>${username}</span>
                            <strong>${drinks}</strong>
                        </article>
                    `).join('')}
                </div>
                ${renderX2ResultControls(state.lastResult)}
                <ul>
                    ${state.lastResult.events.length ? state.lastResult.events.map(event => `
                        <li>${event.username} distribue ${event.drinks} pour ${event.cardName}</li>
                    `).join('') : '<li>Aucune gorgée sur ce booster.</li>'}
                </ul>
            </section>
        `;
    }

    function renderX2ResultControls(result) {
        if (!result.x2?.available) {
            return '';
        }

        const totalUses = result.x2.count || 1;
        const applications = result.x2.applications || (result.x2.applied ? [{
            target: result.x2.target,
            bonus: result.x2.bonus || 0
        }] : []);
        const remainingUses = Math.max(0, totalUses - applications.length);

        if (!remainingUses) {
            return `
                <div class="party-x2-result is-applied">
                    <strong>${totalUses} x2 appliqué${totalUses > 1 ? 's' : ''}</strong>
                    <span>${applications.map(application => `${application.target} +${application.bonus}`).join(' / ')} grâce à ${result.x2.card.name}.</span>
                </div>
            `;
        }

        return `
            <div class="party-x2-result">
                <div>
                    <strong>${result.x2.card.name} est sortie ${totalUses} fois: ${remainingUses} x2 restant${remainingUses > 1 ? 's' : ''}</strong>
                    <span>${result.x2.decidedBy} choisit quel joueur double ses gorgées sur ce booster.</span>
                </div>
                <div class="party-x2-targets">
                    ${Object.entries(result.distribution).map(([username, drinks]) => `
                        <button type="button" class="party-x2-target" data-x2-target="${username}">
                            <span>${username}</span>
                            <strong>${drinks} -> ${drinks * 2}</strong>
                        </button>
                    `).join('')}
                </div>
            </div>
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
                    <button type="button" id="party-stop">Arrêter</button>
                </div>
            </div>
            ${renderPartyRoster()}
            ${renderX2ActiveCard()}
            ${renderActivePartySettings()}
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
        } else if (state.x2Selection) {
            panel.innerHTML = renderX2Selection();
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
            const settings = collectSettingsFromPanel();
            if (players.length < 2) {
                alert('Sélectionne au moins 2 joueurs.');
                return;
            }
            startParty(players, mode, settings);
        });
        panel.querySelectorAll('.party-draft-card[data-card-key]').forEach(button => {
            button.addEventListener('click', () => pickDraftCard(button.dataset.cardKey));
        });
        panel.querySelector('#party-x2-random')?.addEventListener('click', () => pickX2Card('random'));
        panel.querySelectorAll('.party-x2-card').forEach(button => {
            button.addEventListener('click', () => pickX2Card(button.dataset.x2CardKey));
        });
        panel.querySelectorAll('.party-x2-target').forEach(button => {
            button.addEventListener('click', () => applyX2Target(button.dataset.x2Target));
        });
        panel.querySelector('#party-save-settings')?.addEventListener('click', () => {
            if (!state) {
                return;
            }

            state.settings = collectSettingsFromPanel();
            savePartyState();
            render();
        });
        panel.querySelector('#party-open-booster')?.addEventListener('click', () => {
            showBoosterView();
            app?.openBooster();
        });
    }

    async function init(options = {}) {
        app = options.app || null;
        await window.sharedStore?.hydrate?.([
            PARTY_STORAGE_KEY,
            PARTY_DEFAULT_SETTINGS_KEY
        ]);
        state = loadPartyState();
        normalizeState();
        ensurePartyPanel();
        render();
    }

    return {
        init,
        isActive: () => Boolean(state?.active && !state.draft && !state.x2Selection),
        getCardOwner: (card) => state?.active && !state.draft && !state.x2Selection ? getOwnerForCard(card) : null,
        getCurrentOpener: () => state?.active && !state.draft && !state.x2Selection ? state.players[state.openerIndex] : null,
        getDefaultSettings: loadDefaultSettings,
        saveDefaultSettings,
        renderSettings: (settings) => renderPartySettings(normalizeSettings(settings)),
        collectSettings: (root) => collectSettingsFromRoot(root, loadDefaultSettings()),
        applyX2Target,
        hasPendingX2,
        isX2Card: (card) => Boolean(state?.x2Card && getCardKey(card) === state.x2Card.key),
        getSummary,
        scoreBooster
    };
}

window.partyMode = createPartyMode();
