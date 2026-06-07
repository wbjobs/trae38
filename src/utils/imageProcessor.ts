import * as ort from 'onnxruntime-web';
import { IMAGE_SIZE, IMAGENET_MEAN, IMAGENET_STD, PreprocessResult } from '../types';

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function preprocessImage(img: HTMLImageElement): PreprocessResult {
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_SIZE;
  canvas.height = IMAGE_SIZE;
  const ctx = canvas.getContext('2d')!;

  const scale = Math.max(IMAGE_SIZE / img.width, IMAGE_SIZE / img.height);
  const x = (IMAGE_SIZE - img.width * scale) / 2;
  const y = (IMAGE_SIZE - img.height * scale) / 2;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);
  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

  const imageData = ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE);
  const data = imageData.data;

  const floatData = new Float32Array(1 * 3 * IMAGE_SIZE * IMAGE_SIZE);

  for (let y = 0; y < IMAGE_SIZE; y++) {
    for (let x = 0; x < IMAGE_SIZE; x++) {
      const idx = (y * IMAGE_SIZE + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      floatData[0 * IMAGE_SIZE * IMAGE_SIZE + y * IMAGE_SIZE + x] =
        (r / 255 - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
      floatData[1 * IMAGE_SIZE * IMAGE_SIZE + y * IMAGE_SIZE + x] =
        (g / 255 - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
      floatData[2 * IMAGE_SIZE * IMAGE_SIZE + y * IMAGE_SIZE + x] =
        (b / 255 - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
    }
  }

  const tensor = new ort.Tensor('float32', floatData, [1, 3, IMAGE_SIZE, IMAGE_SIZE]);

  return { tensor, imageElement: img };
}

export function createImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function validateImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  return validTypes.includes(file.type);
}
