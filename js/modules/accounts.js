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
        boosters: []
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

        if (typeof onSessionChange === 'function') {
            onSessionChange(null);
        }
    }

    function recordBooster(cards) {
        if (!currentUser) {
            return null;
        }

        const db = loadAccountDb();
        const entry = {
            id: `booster-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            username: currentUser.username,
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
                debugOrder: card.DEBUG_ORDER || ''
            }))
        };

        db.boosters.unshift(entry);
        saveAccountDb(db);
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
                <p>Entre un nom d'utilisateur. S'il n'existe pas encore, il sera cree.</p>
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
        adminPanel.classList.remove('hidden');
        renderAdminPanel();
    }

    function showBoosterView() {
        if (adminPanel) {
            adminPanel.classList.add('hidden');
        }

        document.querySelector('.booster-selection')?.classList.remove('hidden');
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
            <div class="admin-history">
                ${db.boosters.length ? db.boosters.map(renderBoosterEntry).join('') : '<p class="admin-empty">Aucun booster ouvert pour le moment.</p>'}
            </div>
        `;

        adminPanel.querySelector('#admin-back-button')?.addEventListener('click', showBoosterView);
    }

    function init(options = {}) {
        onSessionChange = options.onSessionChange || null;
        renderAccountUi();
        ensureLoginModal();
        renderAdminPanel();

        if (!currentUser) {
            renderAccountUi();
        } else if (typeof onSessionChange === 'function') {
            onSessionChange(currentUser);
        }
    }

    return {
        init,
        getCurrentUser,
        getUsers: () => loadAccountDb().users,
        showLogin,
        createOrLogin,
        logout,
        recordBooster
    };
}

window.accounts = createAccountModule();
