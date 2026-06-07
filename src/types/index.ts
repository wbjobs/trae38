export type ChunkStatus = 'pending' | 'downloading' | 'cached' | 'loaded' | 'error';

export type InferenceStep = 'idle' | 'preprocessing' | 'encoding' | 'decoding' | 'complete';

export type DescriptionStyle = 'concise' | 'detailed' | 'humorous';

export type DescriptionDimension = 'action' | 'scene' | 'objects' | 'atmosphere';

export interface DescriptionDimensionConfig {
  key: DescriptionDimension;
  label: string;
  icon: string;
  prompt: string;
  color: string;
}

export interface BeamHypothesis {
  tokens: number[];
  score: number;
  text: string;
  isComplete: boolean;
}

export interface DimensionResult {
  dimension: DescriptionDimension;
  label: string;
  text: string;
  icon: string;
  color: string;
  beamResults?: {
    best: string;
    alternatives: string[];
  };
}

export interface StructuredDescription {
  action: DimensionResult;
  scene: DimensionResult;
  objects: DimensionResult;
  atmosphere: DimensionResult;
}

export interface BeamSearchConfig {
  beamSize: number;
  maxLength: number;
  temperature: number;
  lengthPenalty: number;
  earlyStopping: boolean;
}

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
  maxLength: 30,
  temperature: 0.7,
  topK: 50,
  stopToken: 50256,
};

export const BEAM_SEARCH_CONFIG: BeamSearchConfig = {
  beamSize: 3,
  maxLength: 30,
  temperature: 0.7,
  lengthPenalty: 0.6,
  earlyStopping: true,
};

export const INFERENCE_STEPS: { key: InferenceStep; label: string; icon: string }[] = [
  { key: 'preprocessing', label: '图片预处理中', icon: 'image' },
  { key: 'encoding', label: '视觉编码中', icon: 'cpu' },
  { key: 'decoding', label: '文本解码中', icon: 'type' },
  { key: 'complete', label: '生成完成', icon: 'check' },
];

export const DESCRIPTION_STYLES: { key: DescriptionStyle; label: string; prompt: string; icon: string }[] = [
  { key: 'concise', label: '简洁', prompt: '简短地', icon: 'align-left' },
  { key: 'detailed', label: '详细', prompt: '详细地', icon: 'align-justify' },
  { key: 'humorous', label: '幽默', prompt: '幽默风趣地', icon: 'smile' },
];

export const DESCRIPTION_DIMENSIONS: DescriptionDimensionConfig[] = [
  {
    key: 'action',
    label: '人物动作',
    icon: 'person-running',
    prompt: '描述人物的动作和姿态：',
    color: 'cyan',
  },
  {
    key: 'scene',
    label: '场景背景',
    icon: 'mountain',
    prompt: '描述场景和背景环境：',
    color: 'fuchsia',
  },
  {
    key: 'objects',
    label: '物体细节',
    icon: 'package',
    prompt: '描述物体和细节特征：',
    color: 'yellow',
  },
  {
    key: 'atmosphere',
    label: '整体氛围',
    icon: 'sparkles',
    prompt: '描述整体氛围和情感：',
    color: 'green',
  },
];
