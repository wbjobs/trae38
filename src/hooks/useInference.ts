import { useCallback, useRef } from 'react';
import * as ort from 'onnxruntime-web';
import { useAppStore } from '../store/appStore';
import {
  GENERATION_CONFIG,
  BEAM_SEARCH_CONFIG,
  DESCRIPTION_DIMENSIONS,
  DESCRIPTION_STYLES,
  BeamHypothesis,
  DescriptionDimension,
  DescriptionStyle,
} from '../types';
import { loadImage, preprocessImage } from '../utils/imageProcessor';
import {
  topKSampling,
  softmax,
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
import {
  beamSearchStep,
  selectBestHypothesis,
  getAlternativeHypotheses,
  tokensToText,
} from '../utils/beamSearch';

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
  return tokensToText(tokens, DECODER);
}

function simpleEncode(text: string): number[] {
  const tokens: number[] = [];
  const lowerText = text.toLowerCase();

  for (let i = 0; i < lowerText.length; i++) {
    const charCode = lowerText.charCodeAt(i);
    tokens.push(charCode);
  }

  return tokens;
}

function buildDimensionPromptTokens(
  dimensionPrompt: string,
  stylePrompt: string,
  startToken: number
): number[] {
  const fullPrompt = `${stylePrompt}，${dimensionPrompt}`;
  const promptTokens = simpleEncode(fullPrompt);
  return [startToken, ...promptTokens];
}

async function runGreedyStep(
  decoderSession: ort.InferenceSession,
  imageEmbeddings: ort.Tensor,
  generatedTokens: number[],
  kvCache: DynamicKVCacheManager,
  pastKeyValues: (ort.Tensor | null)[],
  useCache: boolean,
  maxLength: number,
  stopToken: number,
  temperature: number,
  topK: number
): Promise<{ nextToken: number | null; isComplete: boolean; newPastKeyValues: (ort.Tensor | null)[] }> {
  let nextToken: number | null = null;
  let isComplete = false;

  const lastToken = generatedTokens[generatedTokens.length - 1];
  const inputIdsTensor = createInt32Tensor([lastToken], [1, 1]);

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
  const lastTokenLogits = logitsData.slice(logitsData.length - vocabSize);

  const sampledToken = topKSampling(lastTokenLogits, topK, temperature);

  if (
    sampledToken === stopToken ||
    sampledToken === TOKENIZER['<|endoftext|>'] ||
    generatedTokens.length >= maxLength
  ) {
    isComplete = true;
  } else {
    nextToken = sampledToken;
  }

  releaseTensor(inputIdsTensor);
  releaseTensors(Object.values(decoderOutputs));

  return { nextToken, isComplete, newPastKeyValues: pastKeyValues };
}

export function useInference() {
  const {
    uploadedImage,
    descriptionStyle,
    setInferenceStep,
    setInferenceProgress,
    appendGeneratedText,
    clearGeneratedText,
    clearStructuredDescription,
    setDimensionResult,
    setCurrentDimension,
    setIsInferencing,
    setError,
  } = useAppStore();

  const kvCacheRef = useRef<DynamicKVCacheManager | null>(null);
  const browser = detectBrowser();
  const optimizedConfig = getOptimizedGenerationConfig();
  const memoryEfficient = shouldUseMemoryEfficientMode();

  const getStylePrompt = useCallback((style: DescriptionStyle): string => {
    const styleConfig = DESCRIPTION_STYLES.find((s) => s.key === style);
    return styleConfig ? styleConfig.prompt : '';
  }, []);

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

  const yieldToMainThread = useCallback(async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (isMemoryLow(180)) {
      console.debug('Memory low, triggering GC...');
      forceGC();
    }
  }, []);

  const generateSingleDimensionGreedy = useCallback(
    async (
      decoderSession: ort.InferenceSession,
      imageEmbeddings: ort.Tensor,
      dimension: DescriptionDimension,
      stylePrompt: string
    ): Promise<{ text: string; alternatives: string[] }> => {
      const dimConfig = DESCRIPTION_DIMENSIONS.find((d) => d.key === dimension);
      if (!dimConfig) {
        return { text: '', alternatives: [] };
      }

      const maxLength = memoryEfficient
        ? optimizedConfig.maxLength
        : GENERATION_CONFIG.maxLength;

      const startToken = TOKENIZER['<|startoftext|>'];
      const promptTokens = buildDimensionPromptTokens(
        dimConfig.prompt,
        stylePrompt,
        startToken
      );

      const generatedTokens: number[] = [...promptTokens];
      const pastKeyValues: (ort.Tensor | null)[] = [];
      let useCache = false;

      const kvCache = initializeKVCache();

      for (let i = 0; i < maxLength; i++) {
        const result = await runGreedyStep(
          decoderSession,
          imageEmbeddings,
          generatedTokens,
          kvCache,
          pastKeyValues,
          useCache,
          maxLength + promptTokens.length,
          GENERATION_CONFIG.stopToken,
          GENERATION_CONFIG.temperature,
          GENERATION_CONFIG.topK
        );

        if (result.isComplete || result.nextToken === null) {
          break;
        }

        generatedTokens.push(result.nextToken);

        const newText = byteDecode([result.nextToken]);
        appendGeneratedText(newText);

        if (!useCache && generatedTokens.length > 1) {
          useCache = true;
        }

        if ((i + 1) % 2 === 0) {
          await yieldToMainThread();
        }

        if (isMemoryLow(browser.memoryLimitMB * 0.75)) {
          console.warn('Memory low, stopping dimension generation');
          break;
        }
      }

      kvCache.reset();

      const generatedOnly = generatedTokens.slice(promptTokens.length);
      const text = byteDecode(generatedOnly);

      return { text, alternatives: [] };
    },
    [
      memoryEfficient,
      optimizedConfig.maxLength,
      initializeKVCache,
      appendGeneratedText,
      yieldToMainThread,
      browser.memoryLimitMB,
    ]
  );

  const generateSingleDimensionBeam = useCallback(
    async (
      decoderSession: ort.InferenceSession,
      imageEmbeddings: ort.Tensor,
      dimension: DescriptionDimension,
      stylePrompt: string,
      beamSize: number = 3
    ): Promise<{ text: string; alternatives: string[] }> => {
      const dimConfig = DESCRIPTION_DIMENSIONS.find((d) => d.key === dimension);
      if (!dimConfig) {
        return { text: '', alternatives: [] };
      }

      const maxLength = memoryEfficient
        ? optimizedConfig.maxLength
        : BEAM_SEARCH_CONFIG.maxLength;

      const startToken = TOKENIZER['<|startoftext|>'];
      const promptTokens = buildDimensionPromptTokens(
        dimConfig.prompt,
        stylePrompt,
        startToken
      );

      let hypotheses: BeamHypothesis[] = [];

      const firstInputTensor = createInt32Tensor(promptTokens, [1, promptTokens.length]);
      const firstFeeds: Record<string, ort.Tensor> = {
        input_ids: firstInputTensor,
        encoder_hidden_states: imageEmbeddings,
      };

      const firstOutputs = await decoderSession.run(firstFeeds);
      const firstLogits = firstOutputs.logits || firstOutputs.output;
      const firstLogitsData = firstLogits.data as Float32Array;
      const vocabSize = firstLogits.dims[firstLogits.dims.length - 1];
      const firstLastLogits = firstLogitsData.slice(firstLogitsData.length - vocabSize);

      const firstProbs = softmax(firstLastLogits, BEAM_SEARCH_CONFIG.temperature);
      const firstCandidates = Array.from(firstProbs)
        .map((prob, index) => ({ prob, index }))
        .sort((a, b) => b.prob - a.prob)
        .slice(0, beamSize);

      for (const candidate of firstCandidates) {
        const tokens = [...promptTokens, candidate.index];
        hypotheses.push({
          tokens,
          score: Math.log(candidate.prob + 1e-10),
          text: '',
          isComplete: false,
        });
      }

      releaseTensor(firstInputTensor);
      releaseTensors(Object.values(firstOutputs));

      const kvCache = initializeKVCache();
      const pastKeyValues: (ort.Tensor | null)[] = [];

      for (let step = 0; step < maxLength; step++) {
        const beamResult = await beamSearchStep(
          decoderSession,
          imageEmbeddings,
          hypotheses,
          {
            ...BEAM_SEARCH_CONFIG,
            beamSize,
            maxLength: maxLength + promptTokens.length,
          },
          undefined,
          pastKeyValues
        );

        hypotheses = beamResult.hypotheses;

        const allComplete = hypotheses.every((h) => h.isComplete);
        if (allComplete) {
          break;
        }

        if ((step + 1) % 2 === 0) {
          await yieldToMainThread();
        }

        if (isMemoryLow(browser.memoryLimitMB * 0.75)) {
          console.warn('Memory low, stopping beam search');
          break;
        }
      }

      kvCache.reset();

      const bestHypo = selectBestHypothesis(hypotheses);
      const alternatives = getAlternativeHypotheses(hypotheses, 2);

      const bestGenerated = bestHypo.tokens.slice(promptTokens.length);
      const bestText = byteDecode(bestGenerated);

      const alternativeTexts = alternatives.map((alt) => {
        const altGenerated = alt.tokens.slice(promptTokens.length);
        return byteDecode(altGenerated);
      });

      pastKeyValues.forEach((tensor) => {
        if (tensor) releaseTensor(tensor);
      });

      return { text: bestText, alternatives: alternativeTexts };
    },
    [
      memoryEfficient,
      optimizedConfig.maxLength,
      initializeKVCache,
      yieldToMainThread,
      browser.memoryLimitMB,
    ]
  );

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
      clearStructuredDescription();

      const stylePrompt = getStylePrompt(descriptionStyle);
      const dimensions: DescriptionDimension[] = ['action', 'scene', 'objects', 'atmosphere'];
      const beamSize = memoryEfficient ? 1 : BEAM_SEARCH_CONFIG.beamSize;
      const useBeam = beamSize > 1;

      console.debug('Starting structured inference with config:', {
        browser: browser.name,
        memoryEfficient,
        beamSize,
        style: descriptionStyle,
        dimensions: dimensions.length,
      });

      const startTime = performance.now();
      let imageTensor: ort.Tensor | null = null;
      let imageEmbeddings: ort.Tensor | null = null;

      try {
        setInferenceStep('preprocessing');
        setInferenceProgress(5);

        const img = await loadImage(uploadedImage);
        await yieldToMainThread();

        const preprocessResult = preprocessImage(img);
        imageTensor = preprocessResult.tensor;
        setInferenceProgress(15);
        await yieldToMainThread();

        setInferenceStep('encoding');
        const encoderFeeds: Record<string, ort.Tensor> = {
          pixel_values: imageTensor,
        };

        const encoderOutputs = await encoderSession.run(encoderFeeds);
        imageEmbeddings = encoderOutputs.last_hidden_state || encoderOutputs.output;
        setInferenceProgress(30);
        await yieldToMainThread();

        setInferenceStep('decoding');

        for (let dimIdx = 0; dimIdx < dimensions.length; dimIdx++) {
          const dimension = dimensions[dimIdx];
          setCurrentDimension(dimension);

          const dimConfig = DESCRIPTION_DIMENSIONS.find((d) => d.key === dimension);
          if (dimConfig) {
            appendGeneratedText(`\n\n【${dimConfig.label}】\n`);
          }

          let result;

          if (useBeam) {
            result = await generateSingleDimensionBeam(
              decoderSession,
              imageEmbeddings,
              dimension,
              stylePrompt,
              beamSize
            );
          } else {
            result = await generateSingleDimensionGreedy(
              decoderSession,
              imageEmbeddings,
              dimension,
              stylePrompt
            );
          }

          setDimensionResult(dimension, result.text, result.alternatives);
          appendGeneratedText(result.text);

          const dimProgress = 30 + ((dimIdx + 1) / dimensions.length) * 65;
          setInferenceProgress(Math.min(Math.round(dimProgress), 95));

          await yieldToMainThread();
        }

        setCurrentDimension(null);

        if (imageTensor) releaseTensor(imageTensor);
        if (imageEmbeddings) releaseTensor(imageEmbeddings);
        releaseTensors(Object.values(encoderOutputs));

        cleanupKVCache();
        forceGC();

        const endTime = performance.now();
        const totalTime = (endTime - startTime) / 1000;

        setInferenceProgress(100);
        setInferenceStep('complete');

        console.debug('Inference complete. Stats:', {
          totalTime: `${totalTime.toFixed(2)}s`,
          targetTime: '< 3s',
          meetsTarget: totalTime < 3,
          beamSize,
          style: descriptionStyle,
          poolStats: getTensorPool().getStats(),
          poolMemoryMB: getTensorPool().getMemoryUsage() / (1024 * 1024),
        });

        if (totalTime > 3) {
          console.warn(
            `Inference took ${totalTime.toFixed(2)}s, which exceeds the 3s target.`
          );
        }
      } catch (error) {
        console.error('Inference error:', error);

        if (imageTensor) releaseTensor(imageTensor);
        if (imageEmbeddings) releaseTensor(imageEmbeddings);

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
        setCurrentDimension(null);
        setIsInferencing(false);
      }
    },
    [
      uploadedImage,
      descriptionStyle,
      memoryEfficient,
      setInferenceStep,
      setInferenceProgress,
      appendGeneratedText,
      clearGeneratedText,
      clearStructuredDescription,
      setDimensionResult,
      setCurrentDimension,
      setIsInferencing,
      setError,
      getStylePrompt,
      generateSingleDimensionGreedy,
      generateSingleDimensionBeam,
      yieldToMainThread,
      cleanupKVCache,
      browser,
    ]
  );

  return { runInference };
}
