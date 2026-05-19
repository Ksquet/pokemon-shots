/**
 * Comptes locaux et historique des boosters.
 *
 * Cette version utilise localStorage: la base est persistante dans ce navigateur,
 * mais elle n'est pas partagee entre plusieurs appareils.
 */

const ACCOUNT_DB_KEY = 'pokemonShotsAccountDb';
const ACCOUNT_SESSION_KEY = 'pokemonShotsSession';
const ACCOUNT_SESSION_DURATION = 24 * 60 * 60 * 1000;
const ADMIN_USERNAME = 'admin';

function normalizeUsername(username) {
    return String(username || '').trim().toLowerCase();
}

function normalizeSearchText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function createDefaultAccountDb() {
    return {
        users: [
            {
                username: ADMIN_USERNAME,
                displayName: 'admin',
                role: 'admin',
                createdAt: new Date().toISOString()
            }
        ],
        boosters: [],
        collections: {},
        debugNextBooster: []
    };
}

function loadAccountDb() {
    try {
        const rawDb = localStorage.getItem(ACCOUNT_DB_KEY);
        if (!rawDb) {
            const db = createDefaultAccountDb();
            saveAccountDb(db);
            return db;
        }

        const db = JSON.parse(rawDb);
        db.users = Array.isArray(db.users) ? db.users : [];
        db.boosters = Array.isArray(db.boosters) ? db.boosters : [];
        db.collections = db.collections && typeof db.collections === 'object' ? db.collections : {};
        db.debugNextBooster = Array.isArray(db.debugNextBooster) ? db.debugNextBooster : [];

        if (!db.users.some(user => user.username === ADMIN_USERNAME)) {
            db.users.unshift({
                username: ADMIN_USERNAME,
                displayName: 'admin',
                role: 'admin',
                createdAt: new Date().toISOString()
            });
            saveAccountDb(db);
        }

        return db;
    } catch (error) {
        const db = createDefaultAccountDb();
        saveAccountDb(db);
        return db;
    }
}

function saveAccountDb(db) {
    localStorage.setItem(ACCOUNT_DB_KEY, JSON.stringify(db));
    window.sharedStore?.saveFromLocalStorage?.(ACCOUNT_DB_KEY);
}

function loadAccountSession() {
    try {
        const session = JSON.parse(localStorage.getItem(ACCOUNT_SESSION_KEY));
        if (!session || !session.username || session.expiresAt <= Date.now()) {
            localStorage.removeItem(ACCOUNT_SESSION_KEY);
            return null;
        }

        const db = loadAccountDb();
        const user = db.users.find(account => account.username === session.username);
        return user || null;
    } catch (error) {
        localStorage.removeItem(ACCOUNT_SESSION_KEY);
        return null;
    }
}

function saveAccountSession(username) {
    localStorage.setItem(ACCOUNT_SESSION_KEY, JSON.stringify({
        username,
        expiresAt: Date.now() + ACCOUNT_SESSION_DURATION
    }));
}

function getHitSummary(cards) {
    return cards
        .filter(card => card.specialType || card.isDoubleRare)
        .map(card => ({
            id: card.id,
            name: card.name,
            rarity: card.specialType || card.rarity || 'hit',
            number: card.number
        }));
}

function createAccountModule() {
    let currentUser = loadAccountSession();
    let onSessionChange = null;
    let accountRoot = null;
    let modal = null;
    let adminPanel = null;
    let adminNavItem = null;
    let collectionPanel = null;
    let collectionNavItem = null;
    let openCollectionAfterLogin = false;

    function getCurrentUser() {
        return currentUser;
    }

    function createOrLogin(usernameInput) {
        const username = normalizeUsername(usernameInput);

        if (!/^[a-z0-9_-]{2,20}$/.test(username)) {
            throw new Error('Utilise 2 a 20 caracteres: lettres, chiffres, tirets ou underscores.');
        }

        const db = loadAccountDb();
        let user = db.users.find(account => account.username === username);

        if (!user) {
            user = {
                username,
                displayName: usernameInput.trim(),
                role: username === ADMIN_USERNAME ? 'admin' : 'user',
                createdAt: new Date().toISOString()
            };
            db.users.push(user);
            saveAccountDb(db);
        }

        currentUser = user;
        saveAccountSession(user.username);
        renderAccountUi();
        hideLogin();
        renderAdminPanel();
        renderCollectionPanel();

        if (openCollectionAfterLogin) {
            openCollectionAfterLogin = false;
            showCollectionView();
        }

        if (typeof onSessionChange === 'function') {
            onSessionChange(user);
        }

        return user;
    }

    function logout() {
        currentUser = null;
        localStorage.removeItem(ACCOUNT_SESSION_KEY);
        renderAccountUi();
        renderAdminPanel();
        renderCollectionPanel();

        if (typeof onSessionChange === 'function') {
            onSessionChange(null);
        }
    }

    function getCardKey(card) {
        const rawKey = card.localId || String(card.number || '').split('/')[0] || String(card.id || '').split('-').pop() || card.name || '';
        const numericKey = Number(rawKey);
        return Number.isFinite(numericKey) && numericKey > 0 ? String(numericKey) : String(rawKey).trim();
    }

    function getCardLite(card) {
        return {
            key: getCardKey(card),
            id: card.id,
            localId: card.localId,
            name: card.name,
            rarity: card.rarity,
            specialType: card.specialType || '',
            number: card.number,
            imageUrl: card.imageUrl,
            type: card.type
        };
    }

    function addCardsToCollection(usernameInput, cards) {
        const username = normalizeUsername(usernameInput);

        if (!username || !Array.isArray(cards) || !cards.length) {
            return null;
        }

        const db = loadAccountDb();
        db.collections ||= {};
        db.collections[username] ||= {};

        cards.forEach(card => {
            const key = getCardKey(card);

            if (!key) {
                return;
            }

            const previous = db.collections[username][key] || {
                ...getCardLite(card),
                count: 0,
                firstObtainedAt: new Date().toISOString()
            };

            db.collections[username][key] = {
                ...previous,
                ...getCardLite(card),
                count: (previous.count || 0) + 1,
                lastObtainedAt: new Date().toISOString()
            };
        });

        saveAccountDb(db);
        renderCollectionPanel();
        return db.collections[username];
    }

    function addCardsToCollectionInDb(db, usernameInput, cards, obtainedAt = new Date().toISOString()) {
        const username = normalizeUsername(usernameInput);

        if (!username || !Array.isArray(cards) || !cards.length) {
            return;
        }

        db.collections ||= {};
        db.collections[username] ||= {};

        cards.forEach(card => {
            const key = getCardKey(card);

            if (!key) {
                return;
            }

            const previous = db.collections[username][key] || {
                ...getCardLite(card),
                count: 0,
                firstObtainedAt: obtainedAt
            };

            db.collections[username][key] = {
                ...previous,
                ...getCardLite(card),
                count: (previous.count || 0) + 1,
                lastObtainedAt: obtainedAt
            };
        });
    }

    function rebuildCollectionsFromBoosters(db) {
        db.collections = {};
        [...db.boosters]
            .reverse()
            .forEach(entry => addCardsToCollectionInDb(db, entry.username, entry.cards, entry.openedAt));
    }

    function parseDateBoundary(value, endOfDay = false) {
        if (!value) {
            return null;
        }

        const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
        return Number.isNaN(date.getTime()) ? null : date.getTime();
    }

    function getCollectionResetMatches(db, filters = {}) {
        const usernames = new Set((filters.usernames || []).map(normalizeUsername).filter(Boolean));
        const startsAt = parseDateBoundary(filters.startDate);
        const endsAt = parseDateBoundary(filters.endDate, true);

        return db.boosters.filter(entry => {
            if (usernames.size && !usernames.has(normalizeUsername(entry.username))) {
                return false;
            }

            const openedAt = new Date(entry.openedAt).getTime();

            if (!Number.isFinite(openedAt)) {
                return !startsAt && !endsAt;
            }

            if (startsAt && openedAt < startsAt) {
                return false;
            }

            if (endsAt && openedAt > endsAt) {
                return false;
            }

            return true;
        });
    }

    function resetCollections(filters = {}) {
        const db = loadAccountDb();
        const matches = getCollectionResetMatches(db, filters);
        const idsToRemove = new Set(matches.map(entry => entry.id));

        if (!idsToRemove.size) {
            return {
                removedBoosters: 0,
                remainingBoosters: db.boosters.length
            };
        }

        db.boosters = db.boosters.filter(entry => !idsToRemove.has(entry.id));
        rebuildCollectionsFromBoosters(db);
        saveAccountDb(db);
        renderAdminPanel();
        renderCollectionPanel();

        return {
            removedBoosters: idsToRemove.size,
            remainingBoosters: db.boosters.length
        };
    }

    function recordBooster(cards, usernameOverride = null) {
        const username = normalizeUsername(usernameOverride || currentUser?.username);

        if (!username) {
            return null;
        }

        const db = loadAccountDb();
        const entry = {
            id: `booster-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            username,
            openedAt: new Date().toISOString(),
            setId: '151',
            cardCount: cards.length,
            hits: getHitSummary(cards),
            cards: cards.map(card => ({
                id: card.id,
                name: card.name,
                rarity: card.rarity,
                specialType: card.specialType || '',
                number: card.number,
                localId: card.localId,
                imageUrl: card.imageUrl,
                type: card.type,
                debugOrder: card.DEBUG_ORDER || ''
            }))
        };

        db.boosters.unshift(entry);
        saveAccountDb(db);
        addCardsToCollection(username, cards);
        renderAdminPanel();
        return entry;
    }

    function ensureHeaderUi() {
        if (accountRoot) {
            return;
        }

        const header = document.querySelector('header');
        if (!header) {
            return;
        }

        accountRoot = document.createElement('div');
        accountRoot.className = 'account-widget';
        header.appendChild(accountRoot);
    }

    function renderAccountUi() {
        ensureHeaderUi();
        if (!accountRoot) {
            return;
        }

        if (!currentUser) {
            accountRoot.innerHTML = `
                <button class="account-button" type="button" id="account-login-button">Connexion</button>
            `;
            document.getElementById('account-login-button')?.addEventListener('click', showLogin);
            return;
        }

        accountRoot.innerHTML = `
            <div class="account-pill ${currentUser.role === 'admin' ? 'admin' : ''}">
                <span>${currentUser.displayName || currentUser.username}</span>
                ${currentUser.role === 'admin' ? '<strong>Admin</strong>' : ''}
            </div>
            <button class="account-button subtle" type="button" id="account-logout-button">Quitter</button>
        `;
        document.getElementById('account-logout-button')?.addEventListener('click', logout);
    }

    function ensureLoginModal() {
        if (modal) {
            return;
        }

        modal = document.createElement('div');
        modal.className = 'account-modal hidden';
        modal.innerHTML = `
            <form class="account-card" id="account-form">
                <button class="account-close" type="button" aria-label="Fermer">&times;</button>
                <h2>Connexion optionnelle</h2>
                <p>Entre un nom d'utilisateur. S'il n'existe pas encore, il sera créé.</p>
                <div class="saved-users" id="saved-users"></div>
                <label for="account-username">Nom d'utilisateur</label>
                <input id="account-username" name="username" autocomplete="username" maxlength="20" required>
                <p class="account-error" id="account-error"></p>
                <button type="submit">Continuer</button>
                <small>Le compte <strong>admin</strong> ouvre le dashboard administrateur.</small>
            </form>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.account-close').addEventListener('click', hideLogin);

        modal.querySelector('#account-form').addEventListener('submit', event => {
            event.preventDefault();

            const error = modal.querySelector('#account-error');
            error.textContent = '';

            try {
                createOrLogin(modal.querySelector('#account-username').value);
            } catch (formError) {
                error.textContent = formError.message;
            }
        });
    }

    function renderSavedUsers() {
        ensureLoginModal();
        const savedUsers = modal.querySelector('#saved-users');
        const users = loadAccountDb().users;

        if (!savedUsers) {
            return;
        }

        if (!users.length) {
            savedUsers.innerHTML = '';
            return;
        }

        savedUsers.innerHTML = `
            <span>Utilisateurs existants</span>
            <div>
                ${users.map(user => `
                    <button type="button" class="saved-user-button" data-username="${user.username}">
                        ${user.displayName || user.username}${user.role === 'admin' ? ' - admin' : ''}
                    </button>
                `).join('')}
            </div>
        `;

        savedUsers.querySelectorAll('.saved-user-button').forEach(button => {
            button.addEventListener('click', () => createOrLogin(button.dataset.username));
        });
    }

    function showLogin() {
        ensureLoginModal();
        renderSavedUsers();
        modal.classList.remove('hidden');
        setTimeout(() => modal.querySelector('#account-username')?.focus(), 0);
    }

    function hideLogin() {
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    function ensureAdminPanel() {
        if (!adminNavItem) {
            const navList = document.querySelector('nav ul');
            if (navList) {
                adminNavItem = document.createElement('li');
                adminNavItem.className = 'admin-nav-item hidden';
                adminNavItem.innerHTML = '<button type="button">Admin</button>';
                navList.appendChild(adminNavItem);
                adminNavItem.querySelector('button').addEventListener('click', showAdminView);
            }
        }

        if (adminPanel) {
            return;
        }

        const main = document.querySelector('main');
        if (!main) {
            return;
        }

        adminPanel = document.createElement('section');
        adminPanel.className = 'admin-dashboard hidden';
        main.appendChild(adminPanel);
    }

    function ensureCollectionPanel() {
        if (!collectionNavItem) {
            const navItems = [...document.querySelectorAll('nav li')];
            collectionNavItem = navItems.find(item => item.textContent.trim() === 'Ma Collection') || null;

            if (collectionNavItem) {
                collectionNavItem.classList.remove('disabled');
                collectionNavItem.innerHTML = '<button type="button">Ma Collection</button>';
                collectionNavItem.querySelector('button').addEventListener('click', showCollectionView);
            }
        }

        if (collectionPanel) {
            return;
        }

        const main = document.querySelector('main');
        if (!main) {
            return;
        }

        collectionPanel = document.createElement('section');
        collectionPanel.className = 'collection-panel hidden';
        main.appendChild(collectionPanel);
    }

    function formatDate(value) {
        return new Date(value).toLocaleString('fr-FR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    function showAdminView() {
        ensureAdminPanel();
        if (!currentUser || currentUser.role !== 'admin' || !adminPanel) {
            return;
        }

        document.querySelector('.booster-selection')?.classList.add('hidden');
        document.getElementById('opening-area')?.classList.add('hidden');
        document.querySelector('.party-panel')?.classList.add('hidden');
        collectionPanel?.classList.add('hidden');
        adminPanel.classList.remove('hidden');
        renderAdminPanel();
    }

    function showBoosterView() {
        if (adminPanel) {
            adminPanel.classList.add('hidden');
        }
        if (collectionPanel) {
            collectionPanel.classList.add('hidden');
        }

        document.querySelector('.party-panel')?.classList.add('hidden');

        const openingArea = document.getElementById('opening-area');
        const cardsContainer = openingArea?.querySelector('.cards-container');
        const hasBoosterInProgress = Boolean(cardsContainer?.querySelector('.card, .pack-opening-intro'));

        if (openingArea && hasBoosterInProgress) {
            openingArea.classList.remove('hidden');
            document.querySelector('.booster-selection')?.classList.add('hidden');
            return;
        }

        openingArea?.classList.add('hidden');
        document.querySelector('.booster-selection')?.classList.remove('hidden');
        window.pokemonShotsApp?.updatePartyOpenerPreview?.();
    }

    function showCollectionView() {
        ensureCollectionPanel();

        if (!collectionPanel) {
            return;
        }

        if (!currentUser) {
            openCollectionAfterLogin = true;
            showLogin();
            return;
        }

        document.querySelector('.booster-selection')?.classList.add('hidden');
        document.getElementById('opening-area')?.classList.add('hidden');
        document.querySelector('.admin-dashboard')?.classList.add('hidden');
        document.querySelector('.party-panel')?.classList.add('hidden');
        collectionPanel.classList.remove('hidden');
        renderCollectionPanel();
    }

    function getAdminSummary(db) {
        const usersWithBoosters = new Set(db.boosters.map(entry => entry.username));
        const hitCount = db.boosters.reduce((total, entry) => total + entry.hits.length, 0);

        return {
            users: db.users.length,
            activeUsers: usersWithBoosters.size,
            boosters: db.boosters.length,
            hits: hitCount
        };
    }

    function renderCardList(cards) {
        return cards.map(card => `
            <li class="${card.specialType || card.rarity === 'ultraRare' ? 'is-hit' : ''}">
                <span>${card.debugOrder || '-'}</span>
                <strong>${card.name}</strong>
                <em>${card.specialType || card.rarity || 'standard'}</em>
                <small>${card.number || ''}</small>
            </li>
        `).join('');
    }

    function sortCardsByNumber(cards) {
        return [...cards].sort((a, b) => {
            const aNumber = Number(a.localId || String(a.number || '').split('/')[0]) || 9999;
            const bNumber = Number(b.localId || String(b.number || '').split('/')[0]) || 9999;
            return aNumber - bNumber || String(a.name || '').localeCompare(String(b.name || ''));
        });
    }

    function getCollectionForUser(username) {
        const db = loadAccountDb();
        return db.collections?.[normalizeUsername(username)] || {};
    }

    function getAllSetCards() {
        const cards = window.boosterOpener?.setData || window.pokemon151Data || [];
        const seen = new Set();

        return sortCardsByNumber(cards).filter(card => {
            const key = getCardKey(card);

            if (!key || seen.has(key)) {
                return false;
            }

            seen.add(key);
            return true;
        });
    }

    function getCardByKey(cardKey) {
        return getAllSetCards().find(card => getCardKey(card) === String(cardKey)) || null;
    }

    function applyDebugVariant(card, variant) {
        const copy = JSON.parse(JSON.stringify(card));

        if (variant === 'reverseHolo') {
            copy.isFoil = true;
            copy.isReverseHolo = true;
        } else if (variant === 'holo') {
            copy.isFoil = true;
        } else if (variant && variant !== 'normal') {
            copy.isFoil = true;
            copy.specialType = variant;
            if (variant === 'doubleRare') {
                copy.isDoubleRare = true;
            }
        }

        return copy;
    }

    function getBoosterTargetSize() {
        const structure = window.BoosterOpener?.BOOSTER_STRUCTURE || {};
        return Object.values(structure).reduce((total, value) => total + (Number(value) || 0), 0) || 11;
    }

    function consumeDebugNextBooster(boosterOpener = null) {
        const db = loadAccountDb();
        const entries = Array.isArray(db.debugNextBooster) ? db.debugNextBooster : [];

        if (!entries.length) {
            return null;
        }

        const booster = [];
        entries.forEach(entry => {
            const card = getCardByKey(entry.cardKey);
            const count = Math.max(1, Math.min(20, Number(entry.count) || 1));

            if (!card) {
                return;
            }

            for (let index = 0; index < count; index++) {
                booster.push({
                    ...applyDebugVariant(card, entry.variant || 'normal'),
                    DEBUG_ORDER: `DBG${booster.length + 1}`
                });
            }
        });

        const targetSize = getBoosterTargetSize();
        if (booster.length > 0 && booster.length < targetSize && typeof boosterOpener?.generateBooster === 'function') {
            const fillerCards = boosterOpener.generateBooster();
            const missingCount = targetSize - booster.length;

            fillerCards.slice(0, missingCount).forEach(card => {
                booster.push({
                    ...card,
                    DEBUG_ORDER: `AUTO${booster.length + 1}`
                });
            });
        }

        db.debugNextBooster = [];
        saveAccountDb(db);
        renderAdminPanel();

        return booster.length ? booster : null;
    }

    function getDebugBoosterEntryLabel(entry) {
        const card = getCardByKey(entry.cardKey);
        const variantLabels = {
            normal: 'normale',
            reverseHolo: 'reverse holo',
            holo: 'holo',
            doubleRare: 'Double Rare',
            ultraRare: 'Ultra Rare',
            illustrationRare: 'Illustration Rare',
            specialIllustrationRare: 'Illustration Spéciale',
            hyperRare: 'Hyper Rare'
        };

        return `${entry.count || 1}x ${card?.name || 'Carte inconnue'} (${variantLabels[entry.variant] || 'normale'})`;
    }

    function renderAdminDebugBooster(db) {
        const cards = getAllSetCards();
        const entries = Array.isArray(db.debugNextBooster) ? db.debugNextBooster : [];

        return `
            <form class="admin-reset-panel admin-debug-booster-panel" id="admin-debug-booster-form">
                <div>
                    <p>Debug</p>
                    <h3>Composer le prochain booster</h3>
                </div>
                <div class="admin-debug-booster-fields">
                    <label>
                        <span>Recherche</span>
                        <input type="search" id="admin-debug-card-search" placeholder="Nom ou numéro">
                    </label>
                    <label>
                        <span>Carte</span>
                        <select id="admin-debug-card">
                            ${cards.map(card => `
                                <option value="${getCardKey(card)}" data-search="${normalizeSearchText(`${card.localId || ''} ${card.number || ''} ${card.name || ''}`)}">${card.localId || card.number || ''} - ${card.name}</option>
                            `).join('')}
                        </select>
                    </label>
                    <label>
                        <span>Variante</span>
                        <select id="admin-debug-variant">
                            <option value="normal">Normale</option>
                            <option value="reverseHolo">Reverse holo</option>
                            <option value="holo">Holo rare</option>
                            <option value="doubleRare">Double Rare</option>
                            <option value="ultraRare">Ultra Rare</option>
                            <option value="illustrationRare">Illustration Rare</option>
                            <option value="specialIllustrationRare">Illustration Spéciale</option>
                            <option value="hyperRare">Hyper Rare</option>
                        </select>
                    </label>
                    <label>
                        <span>Quantité</span>
                        <input type="number" id="admin-debug-count" min="1" max="20" value="1">
                    </label>
                    <button class="reset-button" type="submit">Ajouter</button>
                </div>
                <div class="admin-debug-booster-next">
                    ${entries.length ? `
                        <ol>
                            ${entries.map(entry => `<li>${getDebugBoosterEntryLabel(entry)}</li>`).join('')}
                        </ol>
                        <button type="button" id="admin-debug-clear">Vider le booster debug</button>
                    ` : '<p class="admin-empty">Aucun booster debug préparé. Le prochain booster sera aléatoire.</p>'}
                </div>
                <p class="admin-reset-help">La liste ci-dessus remplace uniquement le prochain booster ouvert, puis elle est vidée automatiquement.</p>
            </form>
        `;
    }

    function bindAdminDebugBoosterForm() {
        const form = adminPanel?.querySelector('#admin-debug-booster-form');

        if (!form) {
            return;
        }

        const searchInput = form.querySelector('#admin-debug-card-search');
        const cardSelect = form.querySelector('#admin-debug-card');
        const filterCardOptions = () => {
            const query = normalizeSearchText(searchInput?.value).trim();
            let firstVisibleOption = null;

            cardSelect?.querySelectorAll('option').forEach(option => {
                const matches = !query || option.dataset.search.includes(query);
                option.hidden = !matches;

                if (matches && !firstVisibleOption) {
                    firstVisibleOption = option;
                }
            });

            if (cardSelect?.selectedOptions[0]?.hidden && firstVisibleOption) {
                cardSelect.value = firstVisibleOption.value;
            }
        };

        searchInput?.addEventListener('input', filterCardOptions);

        form.addEventListener('submit', event => {
            event.preventDefault();

            const db = loadAccountDb();
            db.debugNextBooster ||= [];
            db.debugNextBooster.push({
                cardKey: form.querySelector('#admin-debug-card')?.value || '',
                variant: form.querySelector('#admin-debug-variant')?.value || 'normal',
                count: Math.max(1, Math.min(20, Number(form.querySelector('#admin-debug-count')?.value) || 1))
            });
            saveAccountDb(db);
            renderAdminPanel();
        });

        form.querySelector('#admin-debug-clear')?.addEventListener('click', () => {
            const db = loadAccountDb();
            db.debugNextBooster = [];
            saveAccountDb(db);
            renderAdminPanel();
        });
    }

    function renderCollectionCard(card, collection) {
        const key = getCardKey(card);
        const owned = collection[key];
        const count = owned?.count || 0;
        const imageUrl = card.imageUrl || owned?.imageUrl || `assets/images/cards/151/${card.id}.jpg`;

        return `
            <article class="collection-card ${count ? 'is-owned' : 'is-missing'}">
                <div class="collection-card-image">
                    <img src="${imageUrl}" alt="${card.name}" loading="lazy" data-card-key="${key}">
                    <strong>x${count}</strong>
                </div>
                <div>
                    <span>${card.number || card.localId || ''}</span>
                    <h3>${card.name}</h3>
                    <p>${card.rarity || 'standard'}</p>
                </div>
            </article>
        `;
    }

    function renderCollectionPanel() {
        ensureCollectionPanel();

        if (!collectionPanel) {
            return;
        }

        if (!currentUser) {
            collectionPanel.innerHTML = `
                <div class="collection-header">
                    <div>
                        <p>Ma Collection</p>
                        <h2>Connecte-toi pour voir tes cartes</h2>
                    </div>
                    <button type="button" id="collection-login-button">Connexion</button>
                </div>
            `;
            collectionPanel.querySelector('#collection-login-button')?.addEventListener('click', showLogin);
            return;
        }

        const allCards = getAllSetCards();
        const collection = getCollectionForUser(currentUser.username);
        const ownedUnique = allCards.filter(card => (collection[getCardKey(card)]?.count || 0) > 0).length;
        const ownedTotal = Object.values(collection).reduce((total, card) => total + (card.count || 0), 0);

        collectionPanel.innerHTML = `
            <div class="collection-header">
                <div>
                    <p>Ma Collection</p>
                    <h2>${currentUser.displayName || currentUser.username}</h2>
                </div>
                <button type="button" id="collection-back-button">Retour aux boosters</button>
            </div>
            <div class="collection-summary">
                <article><span>Cartes différentes</span><strong>${ownedUnique}/${allCards.length}</strong></article>
                <article><span>Exemplaires</span><strong>${ownedTotal}</strong></article>
            </div>
            <div class="collection-grid">
                ${allCards.map(card => renderCollectionCard(card, collection)).join('')}
            </div>
        `;

        collectionPanel.querySelector('#collection-back-button')?.addEventListener('click', showBoosterView);
        bindCollectionImageFallbacks(allCards);
    }

    function bindCollectionImageFallbacks(cards) {
        const cardsByKey = new Map(cards.map(card => [getCardKey(card), card]));

        collectionPanel.querySelectorAll('.collection-card img').forEach(img => {
            img.addEventListener('error', () => {
                const card = cardsByKey.get(img.dataset.cardKey);

                if (card && typeof handleImageError === 'function') {
                    handleImageError(img, card);
                }
            }, { once: true });
        });
    }

    function renderBoosterEntry(entry) {
        const hitsText = entry.hits.length
            ? entry.hits.map(hit => `${hit.name} (${hit.rarity})`).join(', ')
            : 'Aucun hit';

        return `
            <details class="admin-booster-detail">
                <summary>
                    <div>
                        <strong>${entry.username}</strong>
                        <span>${formatDate(entry.openedAt)}</span>
                    </div>
                    <p>${hitsText}</p>
                </summary>
                <div class="admin-booster-meta">
                    <span>ID: ${entry.id}</span>
                    <span>Set ${entry.setId}</span>
                    <span>${entry.cardCount} cartes</span>
                </div>
                <ol class="admin-card-list">
                    ${renderCardList(entry.cards)}
                </ol>
            </details>
        `;
    }

    function getAdminResetUserOptions(db) {
        const usersWithCollections = new Set([
            ...Object.keys(db.collections || {}),
            ...db.boosters.map(entry => normalizeUsername(entry.username))
        ]);

        return db.users
            .filter(user => usersWithCollections.has(user.username))
            .map(user => `
                <label class="admin-reset-user">
                    <input type="checkbox" name="reset-users" value="${user.username}">
                    <span>${user.displayName || user.username}</span>
                </label>
            `).join('');
    }

    function getResetCriteriaLabel(filters) {
        const usernames = (filters.usernames || []).map(normalizeUsername).filter(Boolean);
        const userText = usernames.length ? usernames.join(', ') : 'tous les utilisateurs';
        const dateParts = [];

        if (filters.startDate) {
            dateParts.push(`depuis ${filters.startDate}`);
        }

        if (filters.endDate) {
            dateParts.push(`jusqu'au ${filters.endDate}`);
        }

        return `${userText}${dateParts.length ? `, ${dateParts.join(' ')}` : ''}`;
    }

    function bindAdminResetForm(db) {
        const form = adminPanel?.querySelector('#admin-reset-form');

        if (!form) {
            return;
        }

        form.querySelector('#admin-reset-select-all')?.addEventListener('click', () => {
            form.querySelectorAll('input[name="reset-users"]').forEach(input => {
                input.checked = true;
            });
        });

        form.querySelector('#admin-reset-clear-users')?.addEventListener('click', () => {
            form.querySelectorAll('input[name="reset-users"]').forEach(input => {
                input.checked = false;
            });
        });

        form.addEventListener('submit', event => {
            event.preventDefault();

            const filters = {
                usernames: [...form.querySelectorAll('input[name="reset-users"]:checked')].map(input => input.value),
                startDate: form.querySelector('#admin-reset-start')?.value || '',
                endDate: form.querySelector('#admin-reset-end')?.value || ''
            };

            const startsAt = parseDateBoundary(filters.startDate);
            const endsAt = parseDateBoundary(filters.endDate, true);
            const status = form.querySelector('#admin-reset-status');

            if (startsAt && endsAt && startsAt > endsAt) {
                if (status) {
                    status.textContent = 'La date de début doit être avant la date de fin.';
                }
                return;
            }

            const matches = getCollectionResetMatches(db, filters);

            if (!matches.length) {
                if (status) {
                    status.textContent = 'Aucun booster ne correspond à ces filtres.';
                }
                return;
            }

            const criteria = getResetCriteriaLabel(filters);
            const message = `Reset ${matches.length} booster${matches.length > 1 ? 's' : ''} pour ${criteria} ? Les collections seront reconstruites sans ces boosters.`;

            if (!window.confirm(message)) {
                return;
            }

            const result = resetCollections(filters);
            const nextStatus = adminPanel?.querySelector('#admin-reset-status');

            if (nextStatus) {
                nextStatus.textContent = `${result.removedBoosters} booster${result.removedBoosters > 1 ? 's retirés' : ' retiré'} des collections.`;
            }
        });
    }

    function renderAdminPartySettings() {
        if (!window.partyMode?.getDefaultSettings || !window.partyMode?.renderSettings) {
            return '';
        }

        return `
            <form class="admin-reset-panel admin-party-settings-panel" id="admin-party-settings-form">
                <div>
                    <p>Mode soirée</p>
                    <h3>Paramètres par défaut des futures soirées</h3>
                </div>
                ${window.partyMode.renderSettings(window.partyMode.getDefaultSettings())}
                <div class="admin-party-settings-actions">
                    <button class="reset-button" type="submit">Sauvegarder les paramètres par défaut</button>
                    <p class="admin-reset-status" id="admin-party-settings-status" aria-live="polite"></p>
                </div>
            </form>
        `;
    }

    function bindAdminPartySettingsForm() {
        const form = adminPanel?.querySelector('#admin-party-settings-form');

        if (!form || !window.partyMode?.collectSettings || !window.partyMode?.saveDefaultSettings) {
            return;
        }

        form.addEventListener('submit', event => {
            event.preventDefault();

            const settings = window.partyMode.collectSettings(form);
            window.partyMode.saveDefaultSettings(settings);

            const status = form.querySelector('#admin-party-settings-status');
            if (status) {
                status.textContent = 'Paramètres sauvegardés pour les prochaines soirées.';
            }
        });
    }

    function renderAdminPanel() {
        ensureAdminPanel();
        if (!adminPanel) {
            return;
        }

        const isAdmin = currentUser?.role === 'admin';
        adminNavItem?.classList.toggle('hidden', !isAdmin);

        if (!isAdmin) {
            adminPanel.classList.add('hidden');
            adminPanel.innerHTML = '';
            document.querySelector('.booster-selection')?.classList.remove('hidden');
            return;
        }

        const db = loadAccountDb();
        const summary = getAdminSummary(db);

        adminPanel.innerHTML = `
            <div class="admin-dashboard-header">
                <div>
                    <p>Administration</p>
                    <h2>Historique des boosters</h2>
                </div>
                <button type="button" id="admin-back-button">Retour aux boosters</button>
            </div>
            <div class="admin-summary-grid">
                <article><span>Utilisateurs</span><strong>${summary.users}</strong></article>
                <article><span>Actifs</span><strong>${summary.activeUsers}</strong></article>
                <article><span>Boosters</span><strong>${summary.boosters}</strong></article>
                <article><span>Hits</span><strong>${summary.hits}</strong></article>
            </div>
            ${renderAdminPartySettings()}
            ${renderAdminDebugBooster(db)}
            <form class="admin-reset-panel" id="admin-reset-form">
                <div>
                    <p>Reset collections</p>
                    <h3>Retirer des boosters des collections</h3>
                </div>
                <div class="admin-reset-users">
                    <div class="admin-reset-actions">
                        <span>Utilisateurs</span>
                        <button type="button" id="admin-reset-select-all">Tous</button>
                        <button type="button" id="admin-reset-clear-users">Aucun</button>
                    </div>
                    <div class="admin-reset-user-grid">
                        ${getAdminResetUserOptions(db) || '<p class="admin-empty">Aucune collection à reset.</p>'}
                    </div>
                </div>
                <div class="admin-reset-dates">
                    <label>
                        <span>Depuis</span>
                        <input type="date" id="admin-reset-start">
                    </label>
                    <label>
                        <span>Jusqu'au</span>
                        <input type="date" id="admin-reset-end">
                    </label>
                    <button class="reset-button" type="submit">Reset les collections ciblées</button>
                </div>
                <p class="admin-reset-help">Sans utilisateur coché, le reset vise tout le monde. Sans dates, il vise tout l'historique.</p>
                <p class="admin-reset-status" id="admin-reset-status" aria-live="polite"></p>
            </form>
            <div class="admin-history">
                ${db.boosters.length ? db.boosters.map(renderBoosterEntry).join('') : '<p class="admin-empty">Aucun booster ouvert pour le moment.</p>'}
            </div>
        `;

        adminPanel.querySelector('#admin-back-button')?.addEventListener('click', showBoosterView);
        bindAdminPartySettingsForm();
        bindAdminDebugBoosterForm();
        bindAdminResetForm(db);
    }

    async function init(options = {}) {
        onSessionChange = options.onSessionChange || null;
        await window.sharedStore?.hydrate?.([ACCOUNT_DB_KEY]);
        currentUser = loadAccountSession();
        renderAccountUi();
        ensureLoginModal();
        ensureCollectionPanel();
        renderAdminPanel();
        renderCollectionPanel();

        if (!currentUser) {
            renderAccountUi();
        } else if (typeof onSessionChange === 'function') {
            onSessionChange(currentUser);
        }

        window.sharedStore?.saveFromLocalStorage?.(ACCOUNT_DB_KEY);
    }

    return {
        init,
        getCurrentUser,
        getUsers: () => loadAccountDb().users,
        addCardsToCollection,
        refreshCollection: renderCollectionPanel,
        showLogin,
        createOrLogin,
        logout,
        recordBooster,
        consumeDebugNextBooster,
        resetCollections
    };
}

window.accounts = createAccountModule();
