import * as ort from 'onnxruntime-web';

interface TensorCacheEntry {
  tensor: ort.Tensor;
  inUse: boolean;
  lastUsed: number;
}

interface TensorPoolKey {
  type: string;
  dims: string;
}

export class TensorMemoryPool {
  private pool: Map<string, TensorCacheEntry[]> = new Map();
  private maxPoolSize: number;
  private maxAge: number;

  constructor(maxPoolSize: number = 50, maxAge: number = 30000) {
    this.maxPoolSize = maxPoolSize;
    this.maxAge = maxAge;
    this.startCleanupTimer();
  }

  private getKey(type: string, dims: number[]): string {
    return `${type}:${dims.join('x')}`;
  }

  private getKeyFromString(key: string): TensorPoolKey {
    const [type, dimsStr] = key.split(':');
    return { type, dims: dimsStr };
  }

  public acquire(
    type: 'float32' | 'int32' | 'int64' | 'bool',
    dims: number[],
    data?: ArrayBufferView
  ): ort.Tensor {
    const key = this.getKey(type, dims);
    const pool = this.pool.get(key) || [];

    const freeEntry = pool.find((e) => !e.inUse);
    if (freeEntry) {
      freeEntry.inUse = true;
      freeEntry.lastUsed = Date.now();
      if (data) {
        this.copyDataToTensor(freeEntry.tensor, data);
      }
      return freeEntry.tensor;
    }

    const totalEntries = Array.from(this.pool.values()).reduce((acc, arr) => acc + arr.length, 0);
    if (totalEntries >= this.maxPoolSize) {
      this.cleanupOldest();
    }

    const tensorData = this.createTypedArray(type, dims, data) as any;
    const tensor = new ort.Tensor(type as any, tensorData, dims);

    pool.push({
      tensor,
      inUse: true,
      lastUsed: Date.now(),
    });
    this.pool.set(key, pool);

    return tensor;
  }

  public release(tensor: ort.Tensor): void {
    const key = this.getKey(tensor.type as string, [...tensor.dims]);
    const pool = this.pool.get(key);
    if (!pool) return;

    const entry = pool.find((e) => e.tensor === tensor);
    if (entry) {
      entry.inUse = false;
      entry.lastUsed = Date.now();
    }
  }

  public releaseAll(): void {
    this.pool.forEach((pool) => {
      pool.forEach((entry) => {
        entry.inUse = false;
      });
    });
  }

  public dispose(): void {
    this.pool.forEach((pool) => {
      pool.forEach((entry) => {
        if (entry.tensor && typeof entry.tensor.dispose === 'function') {
          entry.tensor.dispose();
        }
      });
    });
    this.pool.clear();
  }

  public disposeUnused(): void {
    const now = Date.now();
    this.pool.forEach((pool, key) => {
      const toKeep: TensorCacheEntry[] = [];
      const toDispose: TensorCacheEntry[] = [];

      pool.forEach((entry) => {
        if (!entry.inUse && now - entry.lastUsed > this.maxAge) {
          toDispose.push(entry);
        } else {
          toKeep.push(entry);
        }
      });

      toDispose.forEach((entry) => {
        if (entry.tensor && typeof entry.tensor.dispose === 'function') {
          entry.tensor.dispose();
        }
      });

      if (toKeep.length === 0) {
        this.pool.delete(key);
      } else {
        this.pool.set(key, toKeep);
      }
    });
  }

  private createTypedArray(
    type: string,
    dims: number[],
    data?: ArrayBufferView
  ): ArrayBufferView {
    const elementCount = dims.reduce((acc, d) => acc * d, 1);

    if (data) {
      return data;
    }

    switch (type) {
      case 'float32':
        return new Float32Array(elementCount);
      case 'int32':
        return new Int32Array(elementCount);
      case 'int64':
        return new BigInt64Array(elementCount);
      case 'bool':
        return new Uint8Array(elementCount);
      default:
        return new Float32Array(elementCount);
    }
  }

  private copyDataToTensor(tensor: ort.Tensor, data: ArrayBufferView): void {
    const dest = tensor.data as ArrayBufferView;
    const src = data as ArrayBufferView;

    if (dest instanceof Float32Array && src instanceof Float32Array) {
      dest.set(src);
    } else if (dest instanceof Int32Array && src instanceof Int32Array) {
      dest.set(src);
    } else if (dest instanceof BigInt64Array && src instanceof BigInt64Array) {
      dest.set(src);
    } else if (dest instanceof Uint8Array && src instanceof Uint8Array) {
      dest.set(src);
    } else {
      const destArr = new Float32Array(dest.buffer, dest.byteOffset, dest.byteLength / 4);
      const srcArr = new Float32Array(src.buffer, src.byteOffset, src.byteLength / 4);
      destArr.set(srcArr);
    }
  }

  private cleanupOldest(): void {
    const allEntries: { key: string; entry: TensorCacheEntry }[] = [];
    this.pool.forEach((pool, key) => {
      pool.forEach((entry) => {
        if (!entry.inUse) {
          allEntries.push({ key, entry });
        }
      });
    });

    if (allEntries.length === 0) return;

    allEntries.sort((a, b) => a.entry.lastUsed - b.entry.lastUsed);
    const toRemove = allEntries[0];

    if (toRemove.entry.tensor && typeof toRemove.entry.tensor.dispose === 'function') {
      toRemove.entry.tensor.dispose();
    }

    const pool = this.pool.get(toRemove.key)!;
    const newPool = pool.filter((e) => e !== toRemove.entry);
    if (newPool.length === 0) {
      this.pool.delete(toRemove.key);
    } else {
      this.pool.set(toRemove.key, newPool);
    }
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      this.disposeUnused();
    }, 10000);
  }

  public getStats(): { total: number; inUse: number; free: number } {
    let total = 0;
    let inUse = 0;
    let free = 0;

    this.pool.forEach((pool) => {
      total += pool.length;
      pool.forEach((entry) => {
        if (entry.inUse) {
          inUse++;
        } else {
          free++;
        }
      });
    });

    return { total, inUse, free };
  }

  public getMemoryUsage(): number {
    let totalBytes = 0;
    this.pool.forEach((pool) => {
      pool.forEach((entry) => {
        if (entry.tensor && entry.tensor.data) {
          const data = entry.tensor.data as ArrayBufferView;
          totalBytes += data.byteLength || 0;
        }
      });
    });
    return totalBytes;
  }
}

export const globalTensorPool = new TensorMemoryPool(30, 15000);
