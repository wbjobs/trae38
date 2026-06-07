export type ChunkStatus = 'pending' | 'downloading' | 'cached' | 'loaded' | 'error';

export type InferenceStep = 'idle' | 'preprocessing' | 'encoding' | 'decoding' | 'complete';

export interface ModelChunk {
  id: string;
  name: string;
  size: number;
  downloaded: number;
  status: ChunkStatus;
  url: string;
}

export interface InferenceProgress {
  step: InferenceStep;
  progress: number;
  message: string;
}

export interface CachedModel {
  id: string;
  name: string;
  data: Blob;
  timestamp: number;
  size: number;
}

export interface PreprocessResult {
  tensor: any;
  imageElement: HTMLImageElement;
}

export interface GenerationConfig {
  maxLength: number;
  temperature: number;
  topK: number;
  stopToken: number;
}

export const MODEL_CHUNKS: ModelChunk[] = [
  {
    id: 'vit-encoder-1',
    name: 'ViT Encoder Part 1',
    size: 70 * 1024 * 1024,
    downloaded: 0,
    status: 'pending',
    url: '/models/vit_encoder_chunk1.onnx',
  },
  {
    id: 'vit-encoder-2',
    name: 'ViT Encoder Part 2',
    size: 65 * 1024 * 1024,
    downloaded: 0,
    status: 'pending',
    url: '/models/vit_encoder_chunk2.onnx',
  },
  {
    id: 'gpt-decoder',
    name: 'GPT-2 Decoder',
    size: 65 * 1024 * 1024,
    downloaded: 0,
    status: 'pending',
    url: '/models/gpt_decoder_chunk3.onnx',
  },
];

export const IMAGE_SIZE = 224;

export const IMAGENET_MEAN = [0.485, 0.456, 0.406];
export const IMAGENET_STD = [0.229, 0.224, 0.225];

export const GENERATION_CONFIG: GenerationConfig = {
  maxLength: 50,
  temperature: 0.7,
  topK: 50,
  stopToken: 50256,
};

export const INFERENCE_STEPS: { key: InferenceStep; label: string; icon: string }[] = [
  { key: 'preprocessing', label: '图片预处理中', icon: 'image' },
  { key: 'encoding', label: '视觉编码中', icon: 'cpu' },
  { key: 'decoding', label: '文本解码中', icon: 'type' },
  { key: 'complete', label: '生成完成', icon: 'check' },
];
