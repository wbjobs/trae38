import * as ort from 'onnxruntime-web';
import { BeamHypothesis, BeamSearchConfig } from '../types';
import { softmax, createInt32Tensor, releaseTensor, releaseTensors } from './tensorUtils';

export interface BeamSearchCallbacks {
  onStep?: (step: number, hypotheses: BeamHypothesis[]) => void;
  shouldStop?: () => boolean;
}

function calculateLengthPenalty(length: number, alpha: number): number {
  return Math.pow((5 + length) / 6, alpha);
}

export async function beamSearchStep(
  decoderSession: ort.InferenceSession,
  imageEmbeddings: ort.Tensor,
  hypotheses: BeamHypothesis[],
  config: BeamSearchConfig,
  callbacks?: BeamSearchCallbacks,
  pastKeyValues: (ort.Tensor | null)[] = []
): Promise<{
  hypotheses: BeamHypothesis[];
  newPastKeyValues: (ort.Tensor | null)[];
}> {
  const { beamSize, maxLength, temperature, lengthPenalty } = config;

  const allCandidates: {
    hypothesisIndex: number;
    token: number;
    score: number;
    logits: Float32Array;
  }[] = [];

  const newPastKeyValues: (ort.Tensor | null)[] = [];

  for (let hIdx = 0; hIdx < hypotheses.length; hIdx++) {
    const hypo = hypotheses[hIdx];
    if (hypo.isComplete) continue;

    const lastToken = hypo.tokens[hypo.tokens.length - 1];
    const inputIdsTensor = createInt32Tensor([lastToken], [1, 1]);

    const decoderFeeds: Record<string, ort.Tensor> = {
      input_ids: inputIdsTensor,
      encoder_hidden_states: imageEmbeddings,
    };

    pastKeyValues.forEach((tensor, idx) => {
      if (tensor) {
        decoderFeeds[`past_key_values.${idx}`] = tensor;
      }
    });

    const decoderOutputs = await decoderSession.run(decoderFeeds);
    const logits = decoderOutputs.logits || decoderOutputs.output;
    const logitsData = logits.data as Float32Array;
    const vocabSize = logits.dims[logits.dims.length - 1];
    const lastTokenLogits = logitsData.slice(logitsData.length - vocabSize);

    const probs = softmax(lastTokenLogits, temperature);

    const indexedProbs = Array.from(probs)
      .map((prob, index) => ({ prob, index }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, beamSize * 2);

    for (const candidate of indexedProbs) {
      const newScore =
        hypo.score + Math.log(candidate.prob + 1e-10);
      allCandidates.push({
        hypothesisIndex: hIdx,
        token: candidate.index,
        score: newScore,
        logits: lastTokenLogits,
      });
    }

    releaseTensor(inputIdsTensor);
    releaseTensors(Object.values(decoderOutputs));

    if (callbacks?.shouldStop?.()) {
      break;
    }
  }

  allCandidates.sort((a, b) => b.score - a.score);

  const newHypotheses: BeamHypothesis[] = [];
  const completedHypotheses: BeamHypothesis[] = [];

  for (const candidate of allCandidates) {
    if (newHypotheses.length >= beamSize) break;

    const originalHypo = hypotheses[candidate.hypothesisIndex];
    const newTokens = [...originalHypo.tokens, candidate.token];
    const isComplete =
      candidate.token === 50256 ||
      candidate.token === 50257 ||
      newTokens.length >= maxLength;

    const penalty = calculateLengthPenalty(newTokens.length, lengthPenalty);
    const normalizedScore = candidate.score / penalty;

    const newHypo: BeamHypothesis = {
      tokens: newTokens,
      score: normalizedScore,
      text: '',
      isComplete,
    };

    if (isComplete) {
      completedHypotheses.push(newHypo);
    } else {
      newHypotheses.push(newHypo);
    }
  }

  if (newHypotheses.length < beamSize) {
    const remaining = beamSize - newHypotheses.length;
    newHypotheses.push(...completedHypotheses.slice(0, remaining));
  }

  callbacks?.onStep?.(hypotheses[0].tokens.length, newHypotheses);

  return {
    hypotheses: newHypotheses,
    newPastKeyValues,
  };
}

export function selectBestHypothesis(hypotheses: BeamHypothesis[]): BeamHypothesis {
  const sorted = [...hypotheses].sort((a, b) => b.score - a.score);
  return sorted[0];
}

export function getAlternativeHypotheses(
  hypotheses: BeamHypothesis[],
  count: number = 2
): BeamHypothesis[] {
  const sorted = [...hypotheses].sort((a, b) => b.score - a.score);
  return sorted.slice(1, count + 1);
}

export function tokensToText(tokens: number[], decoder: Record<number, string>): string {
  return tokens
    .map((t) => decoder[t] || '')
    .join('')
    .replace(/Ġ/g, ' ')
    .replace(/Ċ/g, '\n')
    .trim();
}

export function buildPromptTokens(
  dimensionPrompt: string,
  stylePrompt: string,
  tokenizer: Record<string, number>,
  encoder: (text: string) => number[]
): number[] {
  const fullPrompt = `${stylePrompt}${dimensionPrompt}`;
  const startToken = tokenizer['<|startoftext|>'] || 50257;
  const promptTokens = encoder(fullPrompt);
  return [startToken, ...promptTokens];
}

export function estimateBeamSearchTime(
  beamSize: number,
  maxLength: number,
  dimensions: number
): number {
  const avgTimePerStep = 80;
  const overhead = 500;
  return beamSize * maxLength * avgTimePerStep * dimensions + overhead;
}
