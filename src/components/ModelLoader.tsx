import React, { useEffect } from 'react';
import { Download, Check, AlertCircle, Database } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useModelLoader } from '../hooks/useModelLoader';
import { formatBytes } from '../utils/indexedDB';
import { ModelChunk, ChunkStatus } from '../types';

interface ChunkProgressProps {
  chunk: ModelChunk;
}

const ChunkProgress: React.FC<ChunkProgressProps> = ({ chunk }) => {
  const percentage = chunk.size > 0 ? Math.round((chunk.downloaded / chunk.size) * 100) : 0;

  const getStatusIcon = (status: ChunkStatus) => {
    switch (status) {
      case 'pending':
        return <Database size={18} className="text-slate-500" />;
      case 'downloading':
        return <Download size={18} className="text-cyan-400 animate-pulse" />;
      case 'cached':
        return <Database size={18} className="text-yellow-400" />;
      case 'loaded':
        return <Check size={18} className="text-green-400" />;
      case 'error':
        return <AlertCircle size={18} className="text-red-400" />;
    }
  };

  const getStatusColor = (status: ChunkStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-slate-700';
      case 'downloading':
        return 'bg-gradient-to-r from-cyan-500 to-cyan-400';
      case 'cached':
        return 'bg-gradient-to-r from-yellow-500 to-yellow-400';
      case 'loaded':
        return 'bg-gradient-to-r from-green-500 to-green-400';
      case 'error':
        return 'bg-gradient-to-r from-red-500 to-red-400';
    }
  };

  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {getStatusIcon(chunk.status)}
          <span className="text-sm text-slate-300 font-mono">{chunk.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono">
            {formatBytes(chunk.downloaded)} / {formatBytes(chunk.size)}
          </span>
          <span className={`text-sm font-mono font-bold ${
            chunk.status === 'loaded' || chunk.status === 'cached' ? 'text-green-400' : 'text-cyan-400'
          }`}>
            {percentage}%
          </span>
        </div>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${getStatusColor(chunk.status)} transition-all duration-300 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export const ModelLoader: React.FC = () => {
  const { modelChunks, modelLoadingProgress, isModelReady } = useAppStore();
  const { loadModel } = useModelLoader();

  useEffect(() => {
    loadModel();
  }, [loadModel]);

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
          <Download size={20} className="text-cyan-400" />
          AI 模型加载
        </h3>
        {isModelReady && (
          <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium flex items-center gap-1">
            <Check size={14} />
            模型已就绪
          </span>
        )}
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">总进度</span>
          <span className="text-lg font-bold text-cyan-400 font-mono">{modelLoadingProgress}%</span>
        </div>
        <div className="h-3 bg-slate-900 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-cyan-500 bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite] transition-all duration-500 ease-out"
            style={{ width: `${modelLoadingProgress}%` }}
          />
        </div>
      </div>

      <div className="space-y-1">
        {modelChunks.map((chunk) => (
          <ChunkProgress key={chunk.id} chunk={chunk} />
        ))}
      </div>

      {!isModelReady && (
        <div className="mt-4 pt-4 border-t border-slate-700/50">
          <p className="text-xs text-slate-500 text-center">
            首次加载需要下载约 200MB 模型文件，之后会缓存到本地
          </p>
        </div>
      )}
    </div>
  );
};
