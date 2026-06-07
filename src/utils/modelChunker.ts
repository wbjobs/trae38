import { ModelChunk } from '../types';
import { getModelBlob, saveModelChunk } from './indexedDB';

export interface DownloadProgress {
  chunkId: string;
  downloaded: number;
  total: number;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

export async function downloadChunkWithProgress(
  chunk: ModelChunk,
  onProgress: ProgressCallback
): Promise<ArrayBuffer> {
  const response = await fetch(chunk.url, {
    method: 'GET',
    headers: {
      'Accept-Ranges': 'bytes',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${chunk.name}: ${response.statusText}`);
  }

  const contentLength = Number(response.headers.get('Content-Length')) || chunk.size;
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body available');
  }

  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedBytes += value.length;

    onProgress({
      chunkId: chunk.id,
      downloaded: receivedBytes,
      total: contentLength,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}

export async function downloadAndCacheChunk(
  chunk: ModelChunk,
  onProgress: ProgressCallback
): Promise<ArrayBuffer> {
  const cached = await getModelBlob(chunk.id);
  if (cached) {
    const arrayBuffer = await cached.arrayBuffer();
    onProgress({
      chunkId: chunk.id,
      downloaded: arrayBuffer.byteLength,
      total: arrayBuffer.byteLength,
    });
    return arrayBuffer;
  }

  const data = await downloadChunkWithProgress(chunk, onProgress);
  await saveModelChunk(chunk, data);
  return data;
}

export async function downloadAllChunksParallel(
  chunks: ModelChunk[],
  onProgress: ProgressCallback
): Promise<Map<string, ArrayBuffer>> {
  const results = new Map<string, ArrayBuffer>();

  const promises = chunks.map(async (chunk) => {
    try {
      const data = await downloadAndCacheChunk(chunk, onProgress);
      results.set(chunk.id, data);
      return { chunkId: chunk.id, success: true };
    } catch (error) {
      console.error(`Failed to download chunk ${chunk.id}:`, error);
      return { chunkId: chunk.id, success: false, error };
    }
  });

  await Promise.all(promises);
  return results;
}

export async function loadChunksFromCache(
  chunks: ModelChunk[]
): Promise<Map<string, ArrayBuffer>> {
  const results = new Map<string, ArrayBuffer>();

  for (const chunk of chunks) {
    const blob = await getModelBlob(chunk.id);
    if (blob) {
      const buffer = await blob.arrayBuffer();
      results.set(chunk.id, buffer);
    }
  }

  return results;
}

export function mergeChunks(buffers: ArrayBuffer[]): ArrayBuffer {
  const totalLength = buffers.reduce((acc, buf) => acc + buf.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const buffer of buffers) {
    result.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }

  return result.buffer;
}
