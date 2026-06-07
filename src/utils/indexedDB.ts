import { openDB, IDBPDatabase } from 'idb';
import { CachedModel, ModelChunk } from '../types';

const DB_NAME = 'ai-model-cache';
const DB_VERSION = 1;
const STORE_NAME = 'models';

let db: IDBPDatabase | null = null;

async function initDB(): Promise<IDBPDatabase> {
  if (db) return db;

  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('size', 'size');
      }
    },
  });

  return db;
}

export async function getCachedModel(id: string): Promise<CachedModel | null> {
  const database = await initDB();
  const result = await database.get(STORE_NAME, id);
  return result || null;
}

export async function saveCachedModel(model: CachedModel): Promise<void> {
  const database = await initDB();
  await database.put(STORE_NAME, model);
}

export async function deleteCachedModel(id: string): Promise<void> {
  const database = await initDB();
  await database.delete(STORE_NAME, id);
}

export async function clearAllCachedModels(): Promise<void> {
  const database = await initDB();
  await database.clear(STORE_NAME);
}

export async function getCacheSize(): Promise<number> {
  const database = await initDB();
  const models = await database.getAll(STORE_NAME);
  return models.reduce((total, model) => total + model.size, 0);
}

export async function checkAllChunksCached(chunks: ModelChunk[]): Promise<boolean> {
  const results = await Promise.all(
    chunks.map((chunk) => getCachedModel(chunk.id))
  );
  return results.every((result) => result !== null);
}

export async function getModelBlob(chunkId: string): Promise<Blob | null> {
  const cached = await getCachedModel(chunkId);
  return cached ? cached.data : null;
}

export async function saveModelChunk(
  chunk: ModelChunk,
  data: ArrayBuffer
): Promise<void> {
  const blob = new Blob([data], { type: 'application/octet-stream' });
  await saveCachedModel({
    id: chunk.id,
    name: chunk.name,
    data: blob,
    timestamp: Date.now(),
    size: data.byteLength,
  });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
