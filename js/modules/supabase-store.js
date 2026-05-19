(function initSharedStore() {
    const SUPABASE_URL = 'https://aznkndwhphthdinyovom.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_da8dencVZdr1qXRun905pA_s9w1LLkJ';
    const TABLE_NAME = 'app_state';
    const SYNC_MODE_STORAGE_KEY = 'pokemonShotsSyncMode';
    const saveQueues = new Map();

    function getSyncMode() {
        const queryMode = new URLSearchParams(window.location.search).get('sync');
        const savedMode = localStorage.getItem(SYNC_MODE_STORAGE_KEY);

        if (queryMode === 'prod' || queryMode === 'off') {
            localStorage.setItem(SYNC_MODE_STORAGE_KEY, queryMode);
            return queryMode;
        }

        if (savedMode === 'prod' || savedMode === 'off') {
            return savedMode;
        }

        const localHosts = new Set(['', 'localhost', '127.0.0.1', '::1']);
        return localHosts.has(window.location.hostname) ? 'off' : 'prod';
    }

    function initLocalOnlyStore() {
        console.info('[Pokemon Shots] Supabase desactive pour cet environnement. Donnees locales uniquement.');

        window.sharedStore = {
            hydrate: async () => {},
            save: async () => {},
            saveFromLocalStorage: () => Promise.resolve()
        };
    }

    if (getSyncMode() === 'off') {
        initLocalOnlyStore();
        return;
    }

    function getEndpoint(id = '') {
        const base = `${SUPABASE_URL}/rest/v1/${TABLE_NAME}`;
        return id ? `${base}?id=eq.${encodeURIComponent(id)}&select=data` : base;
    }

    function getHeaders(extra = {}) {
        return {
            apikey: SUPABASE_ANON_KEY,
            Authorization: SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
            ...extra
        };
    }

    async function load(id) {
        const response = await fetch(getEndpoint(id), {
            headers: getHeaders()
        });

        if (!response.ok) {
            throw new Error(`Supabase load failed (${response.status}): ${await response.text()}`);
        }

        const rows = await response.json();
        return rows[0]?.data ?? null;
    }

    async function save(id, data) {
        if (data === null) {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?id=eq.${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: getHeaders({
                    Prefer: 'return=minimal'
                })
            });

            if (!response.ok) {
                throw new Error(`Supabase delete failed (${response.status}): ${await response.text()}`);
            }

            console.info(`[Pokemon Shots] Donnees partagees supprimees: ${id}`);
            return;
        }

        const response = await fetch(getEndpoint(), {
            method: 'POST',
            headers: getHeaders({
                Prefer: 'resolution=merge-duplicates,return=minimal'
            }),
            body: JSON.stringify({
                id,
                data,
                updated_at: new Date().toISOString()
            })
        });

        if (!response.ok) {
            throw new Error(`Supabase save failed (${response.status}): ${await response.text()}`);
        }

        console.info(`[Pokemon Shots] Donnees partagees sauvegardees: ${id}`);
    }

    function queueSave(id, task) {
        const previousSave = saveQueues.get(id) || Promise.resolve();
        const nextSave = previousSave
            .catch(() => {})
            .then(task);

        const trackedSave = nextSave.finally(() => {
            if (saveQueues.get(id) === trackedSave) {
                saveQueues.delete(id);
            }
        });

        saveQueues.set(id, trackedSave);

        return nextSave;
    }

    function saveQueued(id, data) {
        return queueSave(id, () => save(id, data));
    }

    function shouldPushLocalWhenMissing(id, options) {
        if (Array.isArray(options?.pullOnlyIds) && options.pullOnlyIds.includes(id)) {
            return false;
        }

        return options?.pushLocalIfMissing !== false;
    }

    async function hydrate(ids, options = {}) {
        await Promise.all(ids.map(async id => {
            try {
                const remoteData = await load(id);

                if (remoteData !== null) {
                    localStorage.setItem(id, JSON.stringify(remoteData));
                    console.info(`[Pokemon Shots] Donnees partagees chargees: ${id}`);
                    return;
                }

                const localData = localStorage.getItem(id);
                if (localData && shouldPushLocalWhenMissing(id, options)) {
                    await saveQueued(id, JSON.parse(localData));
                } else if (!shouldPushLocalWhenMissing(id, options)) {
                    localStorage.removeItem(id);
                    console.info(`[Pokemon Shots] Donnees partagees absentes, cache local supprime: ${id}`);
                }
            } catch (error) {
                console.warn(`[Pokemon Shots] Synchronisation Supabase indisponible pour ${id}.`, error);
            }
        }));
    }

    function saveFromLocalStorage(id) {
        try {
            const rawValue = localStorage.getItem(id);
            JSON.parse(rawValue || 'null');

            return queueSave(id, () => {
                const nextRawValue = localStorage.getItem(id);
                const data = nextRawValue ? JSON.parse(nextRawValue) : null;
                return save(id, data);
            }).catch(error => {
                console.warn(`[Pokemon Shots] Sauvegarde Supabase echouee pour ${id}.`, error);
            });
        } catch (error) {
            console.warn(`[Pokemon Shots] Donnees locales invalides pour ${id}.`, error);
            return Promise.resolve();
        }
    }

    window.sharedStore = {
        hydrate,
        load,
        save: saveQueued,
        saveFromLocalStorage
    };
})();
