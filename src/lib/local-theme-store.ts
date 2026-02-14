/**
 * Local theme storage using IndexedDB.
 * Themes are stored entirely in the browser — no cloud uploads needed.
 */

const DB_NAME = "nls-themes";
const DB_VERSION = 1;
const STORE_NAME = "themes";

export interface LocalTheme {
  id: string;
  name: string;
  description: string;
  cssContent: string;
  jsContent: string | null;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveTheme(theme: LocalTheme): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(theme);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllThemes(): Promise<LocalTheme[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const themes = request.result as LocalTheme[];
      themes.sort((a, b) => b.createdAt - a.createdAt);
      resolve(themes);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getTheme(id: string): Promise<LocalTheme | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as LocalTheme | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteTheme(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
