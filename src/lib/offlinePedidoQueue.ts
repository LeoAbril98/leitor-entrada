export type PendingPedido = {
    codigo: string;
    factory: string;
    quantidade: number;
    updated_at: string;
};

export type PedidoSyncLogEntry = {
    id: string;
    codigo: string;
    factory: string;
    quantidade: number;
    status: 'pending' | 'synced' | 'failed';
    message: string;
    created_at: string;
};

const DB_NAME = 'MKPedidosOfflineDB';
const DB_VERSION = 1;
const PENDING_STORE = 'pending_pedidos';
const LOG_STORE = 'sync_log';
const LEGACY_PENDING_KEY = '@MK_PEDIDOS_FABRICA_PENDING_SYNC';
const LEGACY_LOG_KEY = '@MK_PEDIDOS_FABRICA_SYNC_LOG';
const MAX_LOG_ENTRIES = 15;

const getPedidoKey = (codigo: string, factory: string) => `${String(codigo).trim()}__${String(factory).trim()}`;

type PendingPedidoRecord = PendingPedido & { key: string };

function supportsIndexedDB() {
    return typeof indexedDB !== 'undefined';
}

async function openOfflineDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(PENDING_STORE)) {
                db.createObjectStore(PENDING_STORE, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(LOG_STORE)) {
                db.createObjectStore(LOG_STORE, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = action(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => {
            db.close();
            reject(transaction.error);
        };
    });
}

function loadLegacyPendingPedidos(): PendingPedido[] {
    try {
        const raw = localStorage.getItem(LEGACY_PENDING_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Erro ao ler fila offline antiga:', error);
        return [];
    }
}

function saveLegacyPendingPedidos(rows: PendingPedido[]) {
    if (rows.length === 0) {
        localStorage.removeItem(LEGACY_PENDING_KEY);
        return;
    }
    localStorage.setItem(LEGACY_PENDING_KEY, JSON.stringify(rows));
}

function loadLegacySyncLog(): PedidoSyncLogEntry[] {
    try {
        const raw = localStorage.getItem(LEGACY_LOG_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Erro ao ler historico antigo de sincronizacao:', error);
        return [];
    }
}

function saveLegacySyncLog(rows: PedidoSyncLogEntry[]) {
    if (rows.length === 0) {
        localStorage.removeItem(LEGACY_LOG_KEY);
        return;
    }
    localStorage.setItem(LEGACY_LOG_KEY, JSON.stringify(rows.slice(0, MAX_LOG_ENTRIES)));
}

async function migrateLegacyStorage() {
    if (!supportsIndexedDB()) return;

    const legacyPending = loadLegacyPendingPedidos();
    for (const entry of legacyPending) {
        const record: PendingPedidoRecord = {
            ...entry,
            key: getPedidoKey(entry.codigo, entry.factory)
        };
        await withStore(PENDING_STORE, 'readwrite', (store) => store.put(record));
    }
    if (legacyPending.length > 0) localStorage.removeItem(LEGACY_PENDING_KEY);

    const legacyLog = loadLegacySyncLog();
    for (const entry of legacyLog) {
        await withStore(LOG_STORE, 'readwrite', (store) => store.put(entry));
    }
    if (legacyLog.length > 0) localStorage.removeItem(LEGACY_LOG_KEY);
}

export async function loadPendingPedidos(): Promise<PendingPedido[]> {
    if (!supportsIndexedDB()) return loadLegacyPendingPedidos();
    try {
        await migrateLegacyStorage();
        const records = await withStore<PendingPedidoRecord[]>(PENDING_STORE, 'readonly', (store) => store.getAll());
        return records.map(({ key, ...entry }) => entry);
    } catch (error) {
        console.error('Erro ao ler fila offline no IndexedDB:', error);
        return loadLegacyPendingPedidos();
    }
}

export async function getPendingPedidoCount() {
    return (await loadPendingPedidos()).length;
}

export async function queuePendingPedido(codigo: string, factory: string, quantidade: number) {
    const entry: PendingPedidoRecord = {
        key: getPedidoKey(codigo, factory),
        codigo: String(codigo).trim(),
        factory: String(factory).trim(),
        quantidade,
        updated_at: new Date().toISOString()
    };

    if (!supportsIndexedDB()) {
        const nextByKey = new Map(loadLegacyPendingPedidos().map((row) => [getPedidoKey(row.codigo, row.factory), row]));
        nextByKey.set(entry.key, entry);
        saveLegacyPendingPedidos(Array.from(nextByKey.values()));
        return;
    }

    try {
        await migrateLegacyStorage();
        await withStore(PENDING_STORE, 'readwrite', (store) => store.put(entry));
    } catch (error) {
        console.error('Erro ao salvar fila offline no IndexedDB:', error);
        const nextByKey = new Map(loadLegacyPendingPedidos().map((row) => [getPedidoKey(row.codigo, row.factory), row]));
        nextByKey.set(entry.key, entry);
        saveLegacyPendingPedidos(Array.from(nextByKey.values()));
    }
}

export async function removePendingPedido(codigo: string, factory: string) {
    const key = getPedidoKey(codigo, factory);

    if (!supportsIndexedDB()) {
        saveLegacyPendingPedidos(loadLegacyPendingPedidos().filter((entry) => getPedidoKey(entry.codigo, entry.factory) !== key));
        return;
    }

    try {
        await withStore(PENDING_STORE, 'readwrite', (store) => store.delete(key));
    } catch (error) {
        console.error('Erro ao remover fila offline no IndexedDB:', error);
        saveLegacyPendingPedidos(loadLegacyPendingPedidos().filter((entry) => getPedidoKey(entry.codigo, entry.factory) !== key));
    }
}

export async function clearPendingPedidos() {
    localStorage.removeItem(LEGACY_PENDING_KEY);
    if (!supportsIndexedDB()) return;
    try {
        await withStore(PENDING_STORE, 'readwrite', (store) => store.clear());
    } catch (error) {
        console.error('Erro ao limpar fila offline no IndexedDB:', error);
    }
}

export async function loadPedidoSyncLog(): Promise<PedidoSyncLogEntry[]> {
    if (!supportsIndexedDB()) return loadLegacySyncLog();
    try {
        await migrateLegacyStorage();
        const rows = await withStore<PedidoSyncLogEntry[]>(LOG_STORE, 'readonly', (store) => store.getAll());
        return rows.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, MAX_LOG_ENTRIES);
    } catch (error) {
        console.error('Erro ao ler historico no IndexedDB:', error);
        return loadLegacySyncLog();
    }
}

export async function addPedidoSyncLog(entry: Omit<PedidoSyncLogEntry, 'id' | 'created_at'>) {
    const nextEntry: PedidoSyncLogEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        created_at: new Date().toISOString()
    };

    if (!supportsIndexedDB()) {
        const nextLog = [nextEntry, ...loadLegacySyncLog()].slice(0, MAX_LOG_ENTRIES);
        saveLegacySyncLog(nextLog);
        return nextLog;
    }

    try {
        await migrateLegacyStorage();
        await withStore(LOG_STORE, 'readwrite', (store) => store.put(nextEntry));
        const rows = await loadPedidoSyncLog();
        const rowsToDelete = rows.slice(MAX_LOG_ENTRIES);
        for (const row of rowsToDelete) {
            await withStore(LOG_STORE, 'readwrite', (store) => store.delete(row.id));
        }
        return rows.slice(0, MAX_LOG_ENTRIES);
    } catch (error) {
        console.error('Erro ao gravar historico no IndexedDB:', error);
        const nextLog = [nextEntry, ...loadLegacySyncLog()].slice(0, MAX_LOG_ENTRIES);
        saveLegacySyncLog(nextLog);
        return nextLog;
    }
}

export async function clearPedidoSyncLog() {
    localStorage.removeItem(LEGACY_LOG_KEY);
    if (!supportsIndexedDB()) return;
    try {
        await withStore(LOG_STORE, 'readwrite', (store) => store.clear());
    } catch (error) {
        console.error('Erro ao limpar historico no IndexedDB:', error);
    }
}

export async function mergePendingPedidosIntoState<TFactory extends string>(
    base: Record<string, Record<TFactory, number>>,
    emptyFactories: Record<TFactory, number>
) {
    return (await loadPendingPedidos()).reduce((merged, entry) => {
        const codigo = String(entry.codigo).trim();
        const factory = String(entry.factory).trim() as TFactory;
        return {
            ...merged,
            [codigo]: {
                ...(merged[codigo] || { ...emptyFactories }),
                [factory]: Number(entry.quantidade) || 0
            }
        };
    }, base);
}
