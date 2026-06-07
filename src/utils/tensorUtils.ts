import * as ort from 'onnxruntime-web';

export function argmax(arr: Float32Array | number[]): number {
  let maxIndex = 0;
  let maxValue = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > maxValue) {
      maxValue = arr[i];
      maxIndex = i;
    }
  }
  return maxIndex;
}

export function softmax(arr: Float32Array, temperature: number = 1.0): Float32Array {
  const result = new Float32Array(arr.length);
  let maxVal = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > maxVal) maxVal = arr[i];
  }

  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    result[i] = Math.exp((arr[i] - maxVal) / temperature);
    sum += result[i];
  }

  for (let i = 0; i < arr.length; i++) {
    result[i] /= sum;
  }

  return result;
}

export function topKSampling(
  logits: Float32Array,
  k: number,
  temperature: number
): number {
  const probs = softmax(logits, temperature);
  const indexedProbs = Array.from(probs).map((prob, index) => ({ prob, index }));
  indexedProbs.sort((a, b) => b.prob - a.prob);

  const topK = indexedProbs.slice(0, k);
  const topKProbs = topK.map((item) => item.prob);
  const topKIndices = topK.map((item) => item.index);

  const sum = topKProbs.reduce((a, b) => a + b, 0);
  const normalized = topKProbs.map((p) => p / sum);

  let random = Math.random();
  for (let i = 0; i < normalized.length; i++) {
    random -= normalized[i];
    if (random <= 0) {
      return topKIndices[i];
    }
  }

  return topKIndices[0];
}

export function createInt32Tensor(data: number[], dims: number[]): any {
  const tensorData = new Int32Array(data);
  return new ort.Tensor('int32', tensorData, dims);
}

export function disposeTensor(tensor: any): void {
  if (tensor && typeof tensor.dispose === 'function') {
    tensor.dispose();
  }
}

export function disposeTensors(tensors: any[]): void {
  tensors.forEach((tensor) => disposeTensor(tensor));
}
