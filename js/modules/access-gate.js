(function initAccessGate() {
    const ACCESS_PASSWORD = 'fullpd';
    const ACCESS_SESSION_KEY = 'pokemonShotsAccessSession';
    const ACCESS_DURATION_MS = 24 * 60 * 60 * 1000;

    function hasValidSession() {
        try {
            const session = JSON.parse(localStorage.getItem(ACCESS_SESSION_KEY));
            return Boolean(session?.unlocked && session.expiresAt > Date.now());
        } catch (error) {
            localStorage.removeItem(ACCESS_SESSION_KEY);
            return false;
        }
    }

    function saveSession() {
        localStorage.setItem(ACCESS_SESSION_KEY, JSON.stringify({
            unlocked: true,
            expiresAt: Date.now() + ACCESS_DURATION_MS
        }));
    }

    function unlock(gate) {
        saveSession();
        document.body.classList.remove('access-locked');
        gate.remove();
    }

    function renderGate() {
        if (hasValidSession()) {
            return;
        }

        document.body.classList.add('access-locked');

        const gate = document.createElement('div');
        gate.className = 'access-gate';
        gate.innerHTML = `
            <form class="access-gate-card" id="access-gate-form">
                <h2>Accès privé</h2>
                <p>Entre le mot de passe pour accéder à Pokémon Shots.</p>
                <label>
                    <span>Mot de passe</span>
                    <input id="access-gate-password" type="password" autocomplete="current-password" required>
                </label>
                <p class="access-gate-error" id="access-gate-error" aria-live="polite"></p>
                <button type="submit">Entrer</button>
            </form>
        `;

        document.body.appendChild(gate);

        const form = gate.querySelector('#access-gate-form');
        const input = gate.querySelector('#access-gate-password');
        const error = gate.querySelector('#access-gate-error');

        form.addEventListener('submit', event => {
            event.preventDefault();

            if (input.value === ACCESS_PASSWORD) {
                unlock(gate);
                return;
            }

            error.textContent = 'Mot de passe incorrect.';
            input.value = '';
            input.focus();
        });

        setTimeout(() => input.focus(), 0);
    }

    document.addEventListener('DOMContentLoaded', renderGate);
})();
