import React, { useState, useEffect } from 'react';
import { Copy, Check, RefreshCw, Play } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useModelLoader } from '../hooks/useModelLoader';
import { useInference } from '../hooks/useInference';

export const ResultDisplay: React.FC = () => {
  const { generatedText, imagePreview, isInferencing, isModelReady, inferenceStep, resetState } = useAppStore();
  const { getSessions } = useModelLoader();
  const { runInference } = useInference();
  const [copied, setCopied] = useState(false);
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    if (isInferencing) {
      setDisplayText(generatedText);
    } else if (inferenceStep === 'complete') {
      setDisplayText(generatedText);
    } else {
      setDisplayText('');
    }
  }, [generatedText, isInferencing, inferenceStep]);

  const handleGenerate = async () => {
    if (!isModelReady) return;
    const { encoder, decoder } = getSessions();
    if (!encoder || !decoder) return;
    await runInference(encoder, decoder);
  };

  const handleCopy = async () => {
    if (!displayText) return;
    await navigator.clipboard.writeText(displayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    resetState();
  };

  if (!imagePreview) {
    return null;
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="grid md:grid-cols-2 gap-0">
        <div className="p-6 border-b md:border-b-0 md:border-r border-slate-700/50">
          <h4 className="text-sm font-medium text-slate-400 mb-4">上传图片</h4>
          <div className="relative rounded-lg overflow-hidden bg-slate-900/50">
            <img
              src={imagePreview}
              alt="Uploaded"
              className="w-full h-64 object-contain"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent pointer-events-none" />
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-slate-400">AI 描述</h4>
            <div className="flex items-center gap-2">
              {displayText && (
                <button
                  onClick={handleCopy}
                  className="p-2 text-slate-400 hover:text-cyan-400 transition-colors rounded-lg hover:bg-slate-700/50"
                  title="复制描述"
                >
                  {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                </button>
              )}
              {inferenceStep === 'complete' && (
                <button
                  onClick={handleReset}
                  className="p-2 text-slate-400 hover:text-cyan-400 transition-colors rounded-lg hover:bg-slate-700/50"
                  title="重新生成"
                >
                  <RefreshCw size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="min-h-[200px] bg-slate-900/50 rounded-lg p-4 mb-4">
            {displayText ? (
              <p className="text-slate-200 leading-relaxed font-mono text-sm">
                {displayText}
                {isInferencing && <span className="animate-pulse text-cyan-400">▊</span>}
              </p>
            ) : (
              <p className="text-slate-500 text-sm text-center py-8">
                点击下方按钮开始生成图片描述
              </p>
            )}
          </div>

          {!isInferencing && inferenceStep !== 'decoding' && (
            <button
              onClick={handleGenerate}
              disabled={!isModelReady || inferenceStep === 'complete'}
              className={`w-full py-3 px-6 rounded-lg font-medium flex items-center justify-center gap-2 transition-all duration-300 ${
                isModelReady && inferenceStep !== 'complete'
                  ? 'bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white hover:shadow-[0_0_20px_rgba(0,245,255,0.4)] hover:scale-[1.02]'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              {!isModelReady ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  模型加载中...
                </>
              ) : inferenceStep === 'complete' ? (
                <>
                  <Check size={18} />
                  生成完成
                </>
              ) : (
                <>
                  <Play size={18} />
                  开始生成描述
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
