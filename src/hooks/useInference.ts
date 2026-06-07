import { useCallback } from 'react';
import * as ort from 'onnxruntime-web';
import { useAppStore } from '../store/appStore';
import { GENERATION_CONFIG } from '../types';
import { loadImage, preprocessImage } from '../utils/imageProcessor';
import { topKSampling, disposeTensor, disposeTensors } from '../utils/tensorUtils';

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

      try {
        setInferenceStep('preprocessing');
        setInferenceProgress(10);

        const img = await loadImage(uploadedImage);
        await new Promise((resolve) => setTimeout(resolve, 50));

        const { tensor: imageTensor } = preprocessImage(img);
        setInferenceProgress(25);

        setInferenceStep('encoding');
        const encoderFeeds: Record<string, ort.Tensor> = {
          pixel_values: imageTensor,
        };
        const encoderOutputs = await encoderSession.run(encoderFeeds);
        const imageEmbeddings = encoderOutputs.last_hidden_state || encoderOutputs.output;
        setInferenceProgress(50);

        setInferenceStep('decoding');
        const startToken = TOKENIZER['<|startoftext|>'];
        const generatedTokens: number[] = [startToken];
        const maxLength = GENERATION_CONFIG.maxLength;

        for (let i = 0; i < maxLength; i++) {
          const inputIdsTensor = new ort.Tensor(
            'int32',
            new Int32Array(generatedTokens),
            [1, generatedTokens.length]
          );

          const decoderFeeds: Record<string, ort.Tensor> = {
            input_ids: inputIdsTensor,
            encoder_hidden_states: imageEmbeddings,
          };

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

          if (nextToken === GENERATION_CONFIG.stopToken || nextToken === TOKENIZER['<|endoftext|>']) {
            break;
          }

          generatedTokens.push(nextToken);

          const newText = byteDecode([nextToken]);
          appendGeneratedText(newText);

          const progress = 50 + Math.round(((i + 1) / maxLength) * 45);
          setInferenceProgress(Math.min(progress, 95));

          disposeTensor(inputIdsTensor);
          disposeTensors(Object.values(decoderOutputs));

          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        disposeTensor(imageTensor);
        disposeTensor(imageEmbeddings);
        disposeTensors(Object.values(encoderOutputs));

        setInferenceProgress(100);
        setInferenceStep('complete');
      } catch (error) {
        console.error('Inference error:', error);
        setError(error instanceof Error ? error.message : 'Inference failed');
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
    ]
  );

  return { runInference };
}
