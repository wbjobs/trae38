import { create } from 'zustand';
import {
  ModelChunk,
  ChunkStatus,
  InferenceStep,
  MODEL_CHUNKS,
} from '../types';

interface AppState {
  modelChunks: ModelChunk[];
  modelLoadingProgress: number;
  isModelReady: boolean;
  inferenceStep: InferenceStep;
  inferenceProgress: number;
  generatedText: string;
  isInferencing: boolean;
  uploadedImage: File | null;
  imagePreview: string | null;
  cacheSize: number;
  error: string | null;

  uploadImage: (file: File, preview: string) => void;
  clearImage: () => void;
  setInferenceStep: (step: InferenceStep) => void;
  setInferenceProgress: (progress: number) => void;
  appendGeneratedText: (text: string) => void;
  clearGeneratedText: () => void;
  setIsInferencing: (value: boolean) => void;
  updateChunkProgress: (id: string, downloaded: number) => void;
  setChunkStatus: (id: string, status: ChunkStatus) => void;
  setIsModelReady: (value: boolean) => void;
  calculateOverallProgress: () => void;
  setCacheSize: (size: number) => void;
  setError: (error: string | null) => void;
  resetState: () => void;
}

const initialChunks: ModelChunk[] = MODEL_CHUNKS.map((chunk) => ({
  ...chunk,
  status: 'pending' as ChunkStatus,
  downloaded: 0,
}));

export const useAppStore = create<AppState>((set, get) => ({
  modelChunks: initialChunks,
  modelLoadingProgress: 0,
  isModelReady: false,
  inferenceStep: 'idle',
  inferenceProgress: 0,
  generatedText: '',
  isInferencing: false,
  uploadedImage: null,
  imagePreview: null,
  cacheSize: 0,
  error: null,

  uploadImage: (file: File, preview: string) =>
    set({ uploadedImage: file, imagePreview: preview }),

  clearImage: () =>
    set({ uploadedImage: null, imagePreview: null, generatedText: '' }),

  setInferenceStep: (step: InferenceStep) => set({ inferenceStep: step }),

  setInferenceProgress: (progress: number) =>
    set({ inferenceProgress: progress }),

  appendGeneratedText: (text: string) =>
    set((state) => ({ generatedText: state.generatedText + text })),

  clearGeneratedText: () => set({ generatedText: '' }),

  setIsInferencing: (value: boolean) => set({ isInferencing: value }),

  updateChunkProgress: (id: string, downloaded: number) =>
    set((state) => {
      const chunks = state.modelChunks.map((chunk) =>
        chunk.id === id ? { ...chunk, downloaded } : chunk
      );
      return { modelChunks: chunks };
    }),

  setChunkStatus: (id: string, status: ChunkStatus) =>
    set((state) => {
      const chunks = state.modelChunks.map((chunk) =>
        chunk.id === id ? { ...chunk, status } : chunk
      );
      return { modelChunks: chunks };
    }),

  setIsModelReady: (value: boolean) => set({ isModelReady: value }),

  calculateOverallProgress: () => {
    const { modelChunks } = get();
    const totalSize = modelChunks.reduce((acc, c) => acc + c.size, 0);
    const downloaded = modelChunks.reduce((acc, c) => acc + c.downloaded, 0);
    const progress = totalSize > 0 ? Math.round((downloaded / totalSize) * 100) : 0;
    set({ modelLoadingProgress: progress });
  },

  setCacheSize: (size: number) => set({ cacheSize: size }),

  setError: (error: string | null) => set({ error }),

  resetState: () =>
    set({
      inferenceStep: 'idle',
      inferenceProgress: 0,
      generatedText: '',
      isInferencing: false,
      error: null,
    }),
}));
