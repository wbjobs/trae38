export interface BrowserInfo {
  name: string;
  version: string;
  isFirefox: boolean;
  isChrome: boolean;
  isSafari: boolean;
  isEdge: boolean;
  isMobile: boolean;
  memoryLimitMB: number;
  recommendedMaxLength: number;
}

export function detectBrowser(): BrowserInfo {
  const ua = navigator.userAgent;
  let name = 'unknown';
  let version = '0';

  if (/Edg\/([0-9.]+)/.test(ua)) {
    name = 'edge';
    version = RegExp.$1;
  } else if (/OPR\/([0-9.]+)/.test(ua) || /Opera\/([0-9.]+)/.test(ua)) {
    name = 'opera';
    version = RegExp.$1;
  } else if (/Chrome\/([0-9.]+)/.test(ua)) {
    name = 'chrome';
    version = RegExp.$1;
  } else if (/Firefox\/([0-9.]+)/.test(ua)) {
    name = 'firefox';
    version = RegExp.$1;
  } else if (/Safari\/([0-9.]+)/.test(ua)) {
    name = 'safari';
    version = RegExp.$1;
  }

  const isFirefox = name === 'firefox';
  const isChrome = name === 'chrome';
  const isSafari = name === 'safari';
  const isEdge = name === 'edge';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  let memoryLimitMB = 1024;
  let recommendedMaxLength = 50;

  if (isFirefox) {
    memoryLimitMB = 256;
    recommendedMaxLength = 30;
  } else if (isSafari) {
    memoryLimitMB = 512;
    recommendedMaxLength = 40;
  } else if (isMobile) {
    memoryLimitMB = 128;
    recommendedMaxLength = 20;
  }

  if ('deviceMemory' in navigator) {
    const deviceMemory = (navigator as any).deviceMemory;
    if (deviceMemory) {
      memoryLimitMB = Math.min(memoryLimitMB, deviceMemory * 1024 * 0.25);
      recommendedMaxLength = Math.min(
        recommendedMaxLength,
        Math.max(10, Math.floor(deviceMemory * 10))
      );
    }
  }

  return {
    name,
    version,
    isFirefox,
    isChrome,
    isSafari,
    isEdge,
    isMobile,
    memoryLimitMB,
    recommendedMaxLength,
  };
}

export function getMemoryUsageMB(): number {
  let total = 0;
  const perf = performance as any;
  if (perf && perf.memory && perf.memory.usedJSHeapSize) {
    total = perf.memory.usedJSHeapSize / (1024 * 1024);
  }
  return total;
}

export function isMemoryLow(thresholdMB: number = 200): boolean {
  const usage = getMemoryUsageMB();
  const browser = detectBrowser();
  return usage > browser.memoryLimitMB * 0.8 || usage > thresholdMB;
}

export function shouldUseMemoryEfficientMode(): boolean {
  const browser = detectBrowser();
  return browser.isFirefox || browser.isMobile || browser.isSafari;
}

export function getOptimizedGenerationConfig() {
  const browser = detectBrowser();
  const memoryEfficient = shouldUseMemoryEfficientMode();

  return {
    maxLength: memoryEfficient ? browser.recommendedMaxLength : 50,
    enableKVCacheReuse: true,
    enableTensorPool: true,
    executionProvider: browser.isFirefox ? 'wasm' : undefined,
    memArenaSize: browser.isFirefox ? 64 * 1024 * 1024 : undefined,
  };
}
