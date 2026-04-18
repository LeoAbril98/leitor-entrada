const DB_NAME = 'WheelSketchDB';
const STORE_NAME = 'sketches';
const AUDIO_STORE = 'audio';
const DB_VERSION = 2; // Incrementar versão

export async function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = request.result;
            // Sketches store
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
            // Audio store
            if (!db.objectStoreNames.contains(AUDIO_STORE)) {
                db.createObjectStore(AUDIO_STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ... existing sketch functions ...

export async function saveAudio(codigo: string, audioBlob: Blob): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(AUDIO_STORE, 'readwrite');
        const store = transaction.objectStore(AUDIO_STORE);
        const request = store.put(audioBlob, codigo);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function getAudio(codigo: string): Promise<Blob | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(AUDIO_STORE, 'readonly');
        const store = transaction.objectStore(AUDIO_STORE);
        const request = store.get(codigo);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

export async function deleteAudio(codigo: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(AUDIO_STORE, 'readwrite');
        const store = transaction.objectStore(AUDIO_STORE);
        const request = store.delete(codigo);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function getAllAudioKeys(): Promise<string[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(AUDIO_STORE, 'readonly');
        const store = transaction.objectStore(AUDIO_STORE);
        const request = store.getAllKeys();
        request.onsuccess = () => resolve(request.result as string[]);
        request.onerror = () => reject(request.error);
    });
}

export async function saveSketch(codigo: string, dataUrl: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(dataUrl, codigo);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function getSketch(codigo: string): Promise<string | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(codigo);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

export async function deleteSketch(codigo: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(codigo);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function getAllSketches(): Promise<Record<string, string>> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        const keysRequest = store.getAllKeys();
        
        request.onsuccess = () => {
            keysRequest.onsuccess = () => {
                const result: Record<string, string> = {};
                keysRequest.result.forEach((key, i) => {
                    result[key as string] = request.result[i];
                });
                resolve(result);
            };
        };
        request.onerror = () => reject(request.error);
    });
}
