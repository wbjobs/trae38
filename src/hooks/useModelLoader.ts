import { useEffect, useCallback, useRef } from 'react';
import * as ort from 'onnxruntime-web';
import { useAppStore } from '../store/appStore';
import { MODEL_CHUNKS } from '../types';
import {
  downloadAllChunksParallel,
  loadChunksFromCache,
  mergeChunks,
  ProgressCallback,
} from '../utils/modelChunker';
import { checkAllChunksCached, getCacheSize, clearAllCachedModels } from '../utils/indexedDB';

ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;

export function useModelLoader() {
  const {
    updateChunkProgress,
    setChunkStatus,
    setIsModelReady,
    calculateOverallProgress,
    setCacheSize,
    setError,
  } = useAppStore();

  const encoderSessionRef = useRef<ort.InferenceSession | null>(null);
  const decoderSessionRef = useRef<ort.InferenceSession | null>(null);
  const isLoadingRef = useRef(false);

  const updateCacheSize = useCallback(async () => {
    const size = await getCacheSize();
    setCacheSize(size);
  }, [setCacheSize]);

  const handleProgress: ProgressCallback = useCallback(
    (progress) => {
      updateChunkProgress(progress.chunkId, progress.downloaded);
      calculateOverallProgress();
    },
    [updateChunkProgress, calculateOverallProgress]
  );

  const loadModel = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      MODEL_CHUNKS.forEach((chunk) => {
        setChunkStatus(chunk.id, 'downloading');
      });

      const allCached = await checkAllChunksCached(MODEL_CHUNKS);

      let chunkData: Map<string, ArrayBuffer>;
      if (allCached) {
        MODEL_CHUNKS.forEach((chunk) => {
          setChunkStatus(chunk.id, 'cached');
        });
        chunkData = await loadChunksFromCache(MODEL_CHUNKS);
        MODEL_CHUNKS.forEach((chunk) => {
          const data = chunkData.get(chunk.id);
          if (data) {
            updateChunkProgress(chunk.id, data.byteLength);
          }
        });
        calculateOverallProgress();
      } else {
        chunkData = await downloadAllChunksParallel(MODEL_CHUNKS, handleProgress);
        MODEL_CHUNKS.forEach((chunk) => {
          const data = chunkData.get(chunk.id);
          if (data) {
            setChunkStatus(chunk.id, 'cached');
          } else {
            setChunkStatus(chunk.id, 'error');
          }
        });
      }

      await updateCacheSize();

      const encoderChunk1 = chunkData.get('vit-encoder-1');
      const encoderChunk2 = chunkData.get('vit-encoder-2');
      const decoderChunk = chunkData.get('gpt-decoder');

      if (!encoderChunk1 || !encoderChunk2 || !decoderChunk) {
        throw new Error('Failed to load model chunks');
      }

      MODEL_CHUNKS.forEach((chunk) => {
        setChunkStatus(chunk.id, 'loaded');
      });

      const encoderBuffer = mergeChunks([encoderChunk1, encoderChunk2]);
      const decoderBuffer = decoderChunk;

      const sessionOptions: ort.InferenceSession.SessionOptions = {
        executionProviders: ['webgl', 'wasm'],
        graphOptimizationLevel: 'all',
        enableCpuMemArena: true,
      };

      const [encoderSession, decoderSession] = await Promise.all([
        ort.InferenceSession.create(encoderBuffer, sessionOptions),
        ort.InferenceSession.create(decoderBuffer, sessionOptions),
      ]);

      encoderSessionRef.current = encoderSession;
      decoderSessionRef.current = decoderSession;

      setIsModelReady(true);
      isLoadingRef.current = false;
    } catch (error) {
      console.error('Failed to load model:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      isLoadingRef.current = false;
    }
  }, [
    setChunkStatus,
    handleProgress,
    setIsModelReady,
    calculateOverallProgress,
    updateChunkProgress,
    updateCacheSize,
    setError,
  ]);

  const clearCache = useCallback(async () => {
    await clearAllCachedModels();
    await updateCacheSize();
    setIsModelReady(false);
    encoderSessionRef.current = null;
    decoderSessionRef.current = null;
    MODEL_CHUNKS.forEach((chunk) => {
      setChunkStatus(chunk.id, 'pending');
      updateChunkProgress(chunk.id, 0);
    });
    calculateOverallProgress();
  }, [setChunkStatus, updateChunkProgress, calculateOverallProgress, setIsModelReady, updateCacheSize]);

  const getSessions = useCallback(() => {
    return {
      encoder: encoderSessionRef.current,
      decoder: decoderSessionRef.current,
    };
  }, []);

  useEffect(() => {
    updateCacheSize();
  }, [updateCacheSize]);

  return {
    loadModel,
    clearCache,
    getSessions,
    isLoading: isLoadingRef.current,
  };
}
