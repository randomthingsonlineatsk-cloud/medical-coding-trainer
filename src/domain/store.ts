// IndexedDB persistence. Everything stays in this browser unless the user exports a file.
import type { CodingProject } from './coding'

const DB = 'medical-coding-trainer', STORE = 'projects', VERSION = 1
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, VERSION)
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'id' }) }
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
const tx = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open()
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
    t.oncomplete = () => db.close()
  })
}
export const saveProject = (p: CodingProject) => tx('readwrite', (s) => s.put(p))
export const listProjects = () => tx<CodingProject[]>('readonly', (s) => s.getAll() as IDBRequest<CodingProject[]>)
export const deleteProject = (id: string) => tx('readwrite', (s) => s.delete(id))

export function download(name: string, text: string, type = 'application/json') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
