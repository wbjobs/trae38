import { useCallback, useRef } from 'react';
import * as ort from 'onnxruntime-web';
import { useAppStore } from '../store/appStore';
import { GENERATION_CONFIG } from '../types';
import { loadImage, preprocessImage } from '../utils/imageProcessor';
import {
  topKSampling,
  releaseTensor,
  releaseTensors,
  createInt32Tensor,
  createTensor,
  getTensorPool,
  forceGC,
} from '../utils/tensorUtils';
import { DynamicKVCacheManager } from '../utils/kvCache';
import {
  detectBrowser,
  getOptimizedGenerationConfig,
  isMemoryLow,
  shouldUseMemoryEfficientMode,
} from '../utils/browserDetect';

const TOKENIZER: Record<string, number> = {
  '<|startoftext|>': 50257,
  '<|endoftext|>': 50256,
};

const DECODER: Record<number, string> = {};

function initDecoder() {
  if (Object.keys(DECODER).length > 0) return;

  for (let i = 0; i < 256; i++) {
    const c = String.fromCharCode(i);
    DECODER[i] = c;
  }

  const bytesToUnicode = new Map<number, string>();
  let n = 0;
  for (let b = 0; b < 256; b++) {
    if (
      (b >= 33 && b <= 126) ||
      (b >= 161 && b <= 172) ||
      (b >= 174 && b <= 255)
    ) {
      bytesToUnicode.set(b, String.fromCharCode(b));
    } else {
      bytesToUnicode.set(b, String.fromCharCode(256 + n));
      n++;
    }
  }

  bytesToUnicode.forEach((value, key) => {
    DECODER[key] = value;
  });
}

function byteDecode(tokens: number[]): string {
  initDecoder();
  return tokens
    .map((t) => DECODER[t] || '')
    .join('')
    .replace(/Ġ/g, ' ')
    .replace(/Ċ/g, '\n');
}

export function useInference() {
  const {
    uploadedImage,
    setInferenceStep,
    setInferenceProgress,
    appendGeneratedText,
    clearGeneratedText,
    setIsInferencing,
    setError,
  } = useAppStore();

  const kvCacheRef = useRef<DynamicKVCacheManager | null>(null);
  const browser = detectBrowser();
  const optimizedConfig = getOptimizedGenerationConfig();
  const memoryEfficient = shouldUseMemoryEfficientMode();

  const initializeKVCache = useCallback(() => {
    if (kvCacheRef.current) {
      kvCacheRef.current.reset();
    } else {
      kvCacheRef.current = new DynamicKVCacheManager(
        12,
        12,
        64,
        1,
        getTensorPool(),
        memoryEfficient ? 4 : 8
      );
    }
    return kvCacheRef.current;
  }, [memoryEfficient]);

  const cleanupKVCache = useCallback(() => {
    if (kvCacheRef.current) {
      kvCacheRef.current.dispose();
      kvCacheRef.current = null;
    }
  }, []);

  const getInputIdsTensor = useCallback(
    (tokens: number[], useCache: boolean): ort.Tensor => {
      if (useCache && tokens.length > 1) {
        const lastToken = tokens[tokens.length - 1];
        return createInt32Tensor([lastToken], [1, 1]);
      }
      return createInt32Tensor(tokens, [1, tokens.length]);
    },
    []
  );

  const yieldToMainThread = useCallback(async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (isMemoryLow(180)) {
      console.debug('Memory low, triggering GC...');
      forceGC();
    }
  }, []);

  const runInference = useCallback(
    async (
      encoderSession: ort.InferenceSession,
      decoderSession: ort.InferenceSession
    ): Promise<void> => {
      if (!uploadedImage) {
        setError('Please upload an image first');
        return;
      }

      setIsInferencing(true);
      clearGeneratedText();

      const maxLength = memoryEfficient
        ? optimizedConfig.maxLength
        : GENERATION_CONFIG.maxLength;

      console.debug('Starting inference with config:', {
        browser: browser.name,
        memoryEfficient,
        maxLength,
        memoryLimitMB: browser.memoryLimitMB,
      });

      try {
        setInferenceStep('preprocessing');
        setInferenceProgress(10);

        const img = await loadImage(uploadedImage);
        await yieldToMainThread();

        const { tensor: imageTensor } = preprocessImage(img);
        setInferenceProgress(25);
        await yieldToMainThread();

        setInferenceStep('encoding');
        const encoderFeeds: Record<string, ort.Tensor> = {
          pixel_values: imageTensor,
        };

        const encoderOutputs = await encoderSession.run(encoderFeeds);
        const imageEmbeddings = encoderOutputs.last_hidden_state || encoderOutputs.output;
        setInferenceProgress(50);
        await yieldToMainThread();

        setInferenceStep('decoding');
        const kvCache = initializeKVCache();

        const startToken = TOKENIZER['<|startoftext|>'];
        const generatedTokens: number[] = [startToken];
        const pastKeyValues: (ort.Tensor | null)[] = [];
        let useCache = false;

        for (let i = 0; i < maxLength; i++) {
          const inputIdsTensor = getInputIdsTensor(generatedTokens, useCache);

          const decoderFeeds: Record<string, ort.Tensor> = {
            input_ids: inputIdsTensor,
            encoder_hidden_states: imageEmbeddings,
          };

          if (useCache && pastKeyValues.length > 0) {
            for (let j = 0; j < pastKeyValues.length; j++) {
              const tensor = pastKeyValues[j];
              if (tensor) {
                decoderFeeds[`past_key_values.${j}`] = tensor;
              }
            }
          }

          const decoderOutputs = await decoderSession.run(decoderFeeds);
          const logits = decoderOutputs.logits || decoderOutputs.output;
          const logitsData = logits.data as Float32Array;
          const vocabSize = logits.dims[logits.dims.length - 1];
          const lastTokenLogits = logitsData.slice(
            logitsData.length - vocabSize
          );

          const nextToken = topKSampling(
            lastTokenLogits,
            GENERATION_CONFIG.topK,
            GENERATION_CONFIG.temperature
          );

          if (
            nextToken === GENERATION_CONFIG.stopToken ||
            nextToken === TOKENIZER['<|endoftext|>']
          ) {
            releaseTensor(inputIdsTensor);
            releaseTensors(Object.values(decoderOutputs));
            break;
          }

          generatedTokens.push(nextToken);

          const newText = byteDecode([nextToken]);
          appendGeneratedText(newText);

          const progress = 50 + Math.round(((i + 1) / maxLength) * 45);
          setInferenceProgress(Math.min(progress, 95));

          releaseTensor(inputIdsTensor);
          releaseTensors(Object.values(decoderOutputs));

          if (!useCache && generatedTokens.length > 1) {
            useCache = true;
          }

          if ((i + 1) % 3 === 0) {
            await yieldToMainThread();
          }

          if (isMemoryLow(browser.memoryLimitMB * 0.75)) {
            console.warn('Memory critically low, reducing generation length');
            break;
          }
        }

        releaseTensor(imageTensor);
        releaseTensor(imageEmbeddings);
        releaseTensors(Object.values(encoderOutputs));

        pastKeyValues.forEach((tensor) => {
          if (tensor) releaseTensor(tensor);
        });

        cleanupKVCache();
        forceGC();

        setInferenceProgress(100);
        setInferenceStep('complete');

        console.debug('Inference complete. Memory stats:', {
          poolStats: getTensorPool().getStats(),
          poolMemoryMB: getTensorPool().getMemoryUsage() / (1024 * 1024),
          generatedTokens: generatedTokens.length,
        });
      } catch (error) {
        console.error('Inference error:', error);

        cleanupKVCache();
        forceGC();

        if (
          error instanceof Error &&
          (error.message.includes('Out of memory') ||
            error.message.includes('memory') ||
            error.message.includes('abort'))
        ) {
          setError(
            '内存不足。建议使用 Chrome 浏览器，或关闭其他占用内存的标签页后重试。'
          );
        } else {
          setError(
            error instanceof Error ? error.message : '推理失败，请重试'
          );
        }
      } finally {
        setIsInferencing(false);
      }
    },
    [
      uploadedImage,
      setInferenceStep,
      setInferenceProgress,
      appendGeneratedText,
      clearGeneratedText,
      setIsInferencing,
      setError,
      memoryEfficient,
      optimizedConfig.maxLength,
      browser,
      initializeKVCache,
      cleanupKVCache,
      getInputIdsTensor,
      yieldToMainThread,
    ]
  );

  return { runInference };
}
