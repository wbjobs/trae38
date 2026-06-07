import { create } from 'zustand';
import {
  ModelChunk,
  ChunkStatus,
  InferenceStep,
  MODEL_CHUNKS,
  DescriptionStyle,
  StructuredDescription,
  DescriptionDimension,
  DESCRIPTION_DIMENSIONS,
} from '../types';

function createEmptyStructuredDescription(): StructuredDescription {
  const dims = DESCRIPTION_DIMENSIONS;
  return {
    action: {
      dimension: 'action',
      label: dims[0].label,
      text: '',
      icon: dims[0].icon,
      color: dims[0].color,
    },
    scene: {
      dimension: 'scene',
      label: dims[1].label,
      text: '',
      icon: dims[1].icon,
      color: dims[1].color,
    },
    objects: {
      dimension: 'objects',
      label: dims[2].label,
      text: '',
      icon: dims[2].icon,
      color: dims[2].color,
    },
    atmosphere: {
      dimension: 'atmosphere',
      label: dims[3].label,
      text: '',
      icon: dims[3].icon,
      color: dims[3].color,
    },
  };
}

interface AppState {
  modelChunks: ModelChunk[];
  modelLoadingProgress: number;
  isModelReady: boolean;
  inferenceStep: InferenceStep;
  inferenceProgress: number;
  generatedText: string;
  structuredDescription: StructuredDescription;
  currentDimension: DescriptionDimension | null;
  descriptionStyle: DescriptionStyle;
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
  setDescriptionStyle: (style: DescriptionStyle) => void;
  setCurrentDimension: (dim: DescriptionDimension | null) => void;
  setDimensionResult: (dim: DescriptionDimension, text: string, alternatives?: string[]) => void;
  clearStructuredDescription: () => void;
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
  structuredDescription: createEmptyStructuredDescription(),
  currentDimension: null,
  descriptionStyle: 'concise',
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

  setDescriptionStyle: (style: DescriptionStyle) =>
    set({ descriptionStyle: style }),

  setCurrentDimension: (dim: DescriptionDimension | null) =>
    set({ currentDimension: dim }),

  setDimensionResult: (dim: DescriptionDimension, text: string, alternatives?: string[]) =>
    set((state) => ({
      structuredDescription: {
        ...state.structuredDescription,
        [dim]: {
          ...state.structuredDescription[dim],
          text,
          beamResults: alternatives
            ? {
                best: text,
                alternatives,
              }
            : undefined,
        },
      },
    })),

  clearStructuredDescription: () =>
    set({
      structuredDescription: createEmptyStructuredDescription(),
      currentDimension: null,
    }),

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
      structuredDescription: createEmptyStructuredDescription(),
      currentDimension: null,
      isInferencing: false,
      error: null,
    }),
}));
