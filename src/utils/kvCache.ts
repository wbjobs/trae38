import * as ort from 'onnxruntime-web';
import { TensorMemoryPool } from './memoryPool';

interface KVCacheEntry {
  key: ort.Tensor | null;
  value: ort.Tensor | null;
  layerIndex: number;
  currentLength: number;
  maxLength: number;
}

export class DynamicKVCacheManager {
  private caches: Map<number, KVCacheEntry> = new Map();
  private numLayers: number;
  private numHeads: number;
  private headDim: number;
  private batchSize: number;
  private pool: TensorMemoryPool;
  private initialCapacity: number;
  private growthFactor: number;

  constructor(
    numLayers: number = 12,
    numHeads: number = 12,
    headDim: number = 64,
    batchSize: number = 1,
    pool?: TensorMemoryPool,
    initialCapacity: number = 8
  ) {
    this.numLayers = numLayers;
    this.numHeads = numHeads;
    this.headDim = headDim;
    this.batchSize = batchSize;
    this.pool = pool || new TensorMemoryPool(20, 30000);
    this.initialCapacity = initialCapacity;
    this.growthFactor = 2;

    for (let i = 0; i < numLayers; i++) {
      this.caches.set(i, {
        key: null,
        value: null,
        layerIndex: i,
        currentLength: 0,
        maxLength: 0,
      });
    }
  }

  private getTensorDims(seqLength: number): number[] {
    return [this.batchSize, this.numHeads, seqLength, this.headDim];
  }

  private allocateTensor(seqLength: number, data?: Float32Array): ort.Tensor {
    const dims = this.getTensorDims(seqLength);
    return this.pool.acquire('float32', dims, data);
  }

  public ensureCapacity(layerIndex: number, requiredLength: number): void {
    const cache = this.caches.get(layerIndex);
    if (!cache) return;

    if (requiredLength <= cache.maxLength) {
      return;
    }

    const newLength = Math.max(
      this.initialCapacity,
      Math.ceil(requiredLength * this.growthFactor)
    );

    const newDims = this.getTensorDims(newLength);
    const newKey = this.pool.acquire('float32', newDims);
    const newValue = this.pool.acquire('float32', newDims);

    if (cache.key && cache.value && cache.currentLength > 0) {
      const oldKeyData = cache.key.data as Float32Array;
      const oldValueData = cache.value.data as Float32Array;
      const newKeyData = newKey.data as Float32Array;
      const newValueData = newValue.data as Float32Array;

      const elementsToCopy = cache.currentLength * this.numHeads * this.headDim;

      for (let b = 0; b < this.batchSize; b++) {
        const oldOffset = b * this.numHeads * cache.maxLength * this.headDim;
        const newOffset = b * this.numHeads * newLength * this.headDim;

        for (let h = 0; h < this.numHeads; h++) {
          const oldHeadOffset = oldOffset + h * cache.maxLength * this.headDim;
          const newHeadOffset = newOffset + h * newLength * this.headDim;

          const src = oldKeyData.subarray(
            oldHeadOffset,
            oldHeadOffset + cache.currentLength * this.headDim
          );
          const dest = newKeyData.subarray(
            newHeadOffset,
            newHeadOffset + cache.currentLength * this.headDim
          );
          dest.set(src);

          const srcV = oldValueData.subarray(
            oldHeadOffset,
            oldHeadOffset + cache.currentLength * this.headDim
          );
          const destV = newValueData.subarray(
            newHeadOffset,
            newHeadOffset + cache.currentLength * this.headDim
          );
          destV.set(srcV);
        }
      }

      this.pool.release(cache.key);
      this.pool.release(cache.value);
    }

    cache.key = newKey;
    cache.value = newValue;
    cache.maxLength = newLength;

    console.debug(
      `KV Cache layer ${layerIndex} resized: ${cache.currentLength} -> ${newLength} tokens`
    );
  }

  public append(
    layerIndex: number,
    newKeyTensor: ort.Tensor,
    newValueTensor: ort.Tensor,
    newTokenLength: number = 1
  ): void {
    const cache = this.caches.get(layerIndex);
    if (!cache) return;

    const requiredLength = cache.currentLength + newTokenLength;
    this.ensureCapacity(layerIndex, requiredLength);

    if (!cache.key || !cache.value) return;

    const newKeyData = newKeyTensor.data as Float32Array;
    const newValueData = newValueTensor.data as Float32Array;
    const cacheKeyData = cache.key.data as Float32Array;
    const cacheValueData = cache.value.data as Float32Array;

    for (let b = 0; b < this.batchSize; b++) {
      const cacheOffset = b * this.numHeads * cache.maxLength * this.headDim;
      const newOffset = b * this.numHeads * newTokenLength * this.headDim;

      for (let h = 0; h < this.numHeads; h++) {
        const cacheHeadOffset =
          cacheOffset + h * cache.maxLength * this.headDim + cache.currentLength * this.headDim;
        const newHeadOffset = newOffset + h * newTokenLength * this.headDim;

        const src = newKeyData.subarray(
          newHeadOffset,
          newHeadOffset + newTokenLength * this.headDim
        );
        const dest = cacheKeyData.subarray(
          cacheHeadOffset,
          cacheHeadOffset + newTokenLength * this.headDim
        );
        dest.set(src);

        const srcV = newValueData.subarray(
          newHeadOffset,
          newHeadOffset + newTokenLength * this.headDim
        );
        const destV = cacheValueData.subarray(
          cacheHeadOffset,
          cacheHeadOffset + newTokenLength * this.headDim
        );
        destV.set(srcV);
      }
    }

    cache.currentLength = requiredLength;
  }

  public getKVForLayer(layerIndex: number): { key: ort.Tensor | null; value: ort.Tensor | null } {
    const cache = this.caches.get(layerIndex);
    if (!cache || cache.currentLength === 0) {
      return { key: null, value: null };
    }

    return {
      key: this.getSlicedTensor(cache.key!, cache.currentLength),
      value: this.getSlicedTensor(cache.value!, cache.currentLength),
    };
  }

  private getSlicedTensor(tensor: ort.Tensor, currentLength: number): ort.Tensor {
    const dims = this.getTensorDims(currentLength);
    const data = tensor.data as Float32Array;
    const slicedData = new Float32Array(dims.reduce((a, b) => a * b, 1));

    for (let b = 0; b < this.batchSize; b++) {
      const fullOffset = b * this.numHeads * tensor.dims[2] * this.headDim;
      const slicedOffset = b * this.numHeads * currentLength * this.headDim;

      for (let h = 0; h < this.numHeads; h++) {
        const fullHeadOffset = fullOffset + h * tensor.dims[2] * this.headDim;
        const slicedHeadOffset = slicedOffset + h * currentLength * this.headDim;

        const src = data.subarray(
          fullHeadOffset,
          fullHeadOffset + currentLength * this.headDim
        );
        const dest = slicedData.subarray(
          slicedHeadOffset,
          slicedHeadOffset + currentLength * this.headDim
        );
        dest.set(src);
      }
    }

    return new ort.Tensor('float32', slicedData, dims);
  }

  public getCurrentLength(): number {
    const firstCache = this.caches.get(0);
    return firstCache ? firstCache.currentLength : 0;
  }

  public getMemoryUsageMB(): number {
    let totalBytes = 0;
    this.caches.forEach((cache) => {
      if (cache.key) {
        const data = cache.key.data as ArrayBufferView;
        totalBytes += data.byteLength || 0;
      }
      if (cache.value) {
        const data = cache.value.data as ArrayBufferView;
        totalBytes += data.byteLength || 0;
      }
    });
    return totalBytes / (1024 * 1024);
  }

  public getStats(): {
    numLayers: number;
    currentLength: number;
    maxLength: number;
    memoryMB: number;
  } {
    const firstCache = this.caches.get(0);
    return {
      numLayers: this.numLayers,
      currentLength: firstCache?.currentLength || 0,
      maxLength: firstCache?.maxLength || 0,
      memoryMB: this.getMemoryUsageMB(),
    };
  }

  public reset(): void {
    this.caches.forEach((cache) => {
      if (cache.key) {
        this.pool.release(cache.key);
      }
      if (cache.value) {
        this.pool.release(cache.value);
      }
      cache.key = null;
      cache.value = null;
      cache.currentLength = 0;
      cache.maxLength = 0;
    });
  }

  public dispose(): void {
    this.caches.forEach((cache) => {
      if (cache.key && typeof cache.key.dispose === 'function') {
        cache.key.dispose();
      }
      if (cache.value && typeof cache.value.dispose === 'function') {
        cache.value.dispose();
      }
    });
    this.caches.clear();
  }

  public getPastKeyValues(): (ort.Tensor | null)[] {
    const result: (ort.Tensor | null)[] = [];
    for (let i = 0; i < this.numLayers; i++) {
      const { key, value } = this.getKVForLayer(i);
      result.push(key);
      result.push(value);
    }
    return result;
  }
}
