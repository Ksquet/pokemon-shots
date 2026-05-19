(function initSharedStore() {
    const SUPABASE_URL = 'https://aznkndwhphthdinyovom.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_da8dencVZdr1qXRun905pA_s9w1LLkJ';
    const TABLE_NAME = 'app_state';
    const saveQueues = new Map();

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

    async function hydrate(ids) {
        await Promise.all(ids.map(async id => {
            try {
                const remoteData = await load(id);

                if (remoteData !== null) {
                    localStorage.setItem(id, JSON.stringify(remoteData));
                    console.info(`[Pokemon Shots] Donnees partagees chargees: ${id}`);
                    return;
                }

                const localData = localStorage.getItem(id);
                if (localData) {
                    await saveQueued(id, JSON.parse(localData));
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
        save: saveQueued,
        saveFromLocalStorage
    };
})();
