const DB_NAME = "arknights-card";
const STORE = "state";
const KEY = "profile";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run(mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = operation(transaction.objectStore(STORE));
    transaction.oncomplete = () => { db.close(); resolve(request.result); };
    transaction.onerror = transaction.onabort = () => { db.close(); reject(transaction.error); };
  });
}

export const loadState = () => run("readonly", store => store.get(KEY)).catch(() => null);
export const saveState = state => run("readwrite", store => store.put(state, KEY));
export const clearState = () => run("readwrite", store => store.delete(KEY));
