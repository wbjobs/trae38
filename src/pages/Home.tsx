import React, { useEffect } from 'react';
import { Brain, Shield, Zap, AlertTriangle, X } from 'lucide-react';
import { ImageUploader } from '../components/ImageUploader';
import { ModelLoader } from '../components/ModelLoader';
import { InferenceProgress } from '../components/InferenceProgress';
import { ResultDisplay } from '../components/ResultDisplay';
import { CacheManager } from '../components/CacheManager';
import { useAppStore } from '../store/appStore';

const Home: React.FC = () => {
  const { error, setError } = useAppStore();

  useEffect(() => {
    const title = document.querySelector('title');
    if (title) {
      title.style.opacity = '0';
      setTimeout(() => {
        title.style.opacity = '1';
      }, 100);
    }
  }, []);

  return (
    <div className="min-h-screen bg-cyber">
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-fuchsia-500/5 pointer-events-none" />
      
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8 md:py-12">
        <header className="text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-slate-800/50 backdrop-blur-sm rounded-full border border-slate-700/50 mb-6">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs text-cyan-400 font-mono uppercase tracking-wider">
              纯前端 AI 推理
            </span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-4">
            <span className="text-gradient animate-[shimmer_3s_linear_infinite] bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-cyan-400 bg-[length:200%_100%] bg-clip-text text-transparent">
              多模态 AI
            </span>
            <br />
            <span className="text-slate-200">图像描述生成器</span>
          </h1>
          
          <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto mb-8">
            上传图片，使用 ONNX Runtime Web 在浏览器本地运行 ViT-B/32 视觉编码器和 GPT-2 文本解码器，
            无需上传到服务器即可生成图片的文字描述。
          </p>

          <div className="flex flex-wrap justify-center gap-4 md:gap-6">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Shield size={16} className="text-cyan-400" />
              <span>隐私保护</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Zap size={16} className="text-fuchsia-400" />
              <span>本地推理</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Brain size={16} className="text-cyan-400" />
              <span>多模态模型</span>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="p-1 text-red-400 hover:text-red-300 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-6 mb-8">
          <div className="lg:col-span-3 space-y-6">
            <ImageUploader />
            <InferenceProgress />
            <ResultDisplay />
          </div>
          
          <div className="lg:col-span-2 space-y-6">
            <ModelLoader />
            <CacheManager />
            
            <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/30">
              <h4 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
                <Brain size={16} className="text-cyan-400" />
                技术说明
              </h4>
              <ul className="space-y-2 text-xs text-slate-500">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-0.5">→</span>
                  <span>视觉编码器: ViT-B/32 (224x224 输入)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-fuchsia-400 mt-0.5">→</span>
                  <span>文本解码器: GPT-2 小型版本</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-0.5">→</span>
                  <span>推理引擎: ONNX Runtime Web (WebGL)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-fuchsia-400 mt-0.5">→</span>
                  <span>缓存: IndexedDB (约 200MB)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-0.5">→</span>
                  <span>归一化: ImageNet mean/std</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <footer className="text-center pt-8 border-t border-slate-800">
          <p className="text-xs text-slate-600">
            模型文件约 200MB，首次加载需下载，后续访问使用本地缓存。所有推理在浏览器本地完成。
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Home;
