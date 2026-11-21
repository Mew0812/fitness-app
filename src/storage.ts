import { emptyData, parseBackup } from './data'
import type { Data } from './data'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('myfitness', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('data')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('別のタブを閉じて再読み込みしてください。'))
  })
}
export async function loadData(): Promise<Data> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('data', 'readonly')
    const request = tx.objectStore('data').get('main')
    tx.oncomplete = () => { db.close(); try { resolve(request.result === undefined ? emptyData() : parseBackup(request.result)) } catch (e) { reject(e) } }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}
export async function saveData(data: Data, expected?: Data, beforeRestore = false): Promise<Data> {
  const clean = parseBackup(data)
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('data', 'readwrite')
    const store = tx.objectStore('data')
    const previous = store.get('main')
    let failure: unknown
    previous.onsuccess = () => {
      try {
        const current = previous.result === undefined ? emptyData() : parseBackup(previous.result)
        if (expected && JSON.stringify(current) !== JSON.stringify(parseBackup(expected))) {
          const error = new Error('別の画面でデータが更新されました。再読み込みしてからやり直してください。')
          error.name = 'ConcurrentUpdateError'
          throw error
        }
        // Retain legacy snapshots atomically with the first upgraded write.
        if (previous.result?.version === 1) store.put(previous.result, 'before-v2-migration')
        if (previous.result?.version === 1 || previous.result?.version === 2) store.put(previous.result, 'before-v3-migration')
        if ([1, 2, 3].includes(previous.result?.version)) store.put(previous.result, 'before-v4-migration')
        if ([1, 2, 3, 4].includes(previous.result?.version)) store.put(previous.result, 'before-v5-migration')
        if ([1, 2, 3, 4, 5, 6].includes(previous.result?.version)) store.put(previous.result, 'before-v7-migration')
        if (previous.result?.version >= 1 && previous.result.version < 8) store.put(previous.result, 'before-v8-migration')
        if (previous.result?.version >= 1 && previous.result.version < 9) store.put(previous.result, 'before-v9-migration')
        if (beforeRestore) store.put(current, 'before-cloud-restore')
        store.put(clean, 'main')
      } catch (error) {
        failure = error
        tx.abort()
      }
    }
    tx.oncomplete = () => { db.close(); resolve(clean) }
    tx.onabort = () => { db.close(); reject(failure ?? tx.error ?? new Error('保存できませんでした。')) }
  })
}

// Cloud metadata is separate from the existing workout/JSON format.
export async function readLocalValue<T>(key: string): Promise<T | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('data', 'readonly')
    const request = tx.objectStore('data').get(key)
    tx.oncomplete = () => { db.close(); resolve(request.result) }
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error ?? new Error('端末データを読み込めません。')) }
  })
}
export async function writeLocalValue<T>(key: string, value: T): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('data', 'readwrite')
    tx.objectStore('data').put(value, key)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error ?? new Error('端末に保存できません。')) }
  })
}
