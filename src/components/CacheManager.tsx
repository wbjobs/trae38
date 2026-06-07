import React from 'react';
import { HardDrive, Trash2, Database } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useModelLoader } from '../hooks/useModelLoader';
import { formatBytes } from '../utils/indexedDB';

export const CacheManager: React.FC = () => {
  const { cacheSize } = useAppStore();
  const { clearCache } = useModelLoader();

  const handleClearCache = async () => {
    if (window.confirm('确定要清除所有缓存的模型文件吗？下次访问需要重新下载约 200MB 数据。')) {
      await clearCache();
    }
  };

  return (
    <div className="flex items-center justify-between bg-slate-800/30 backdrop-blur-sm rounded-xl px-6 py-4 border border-slate-700/30">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center">
          <Database size={20} className="text-cyan-400" />
        </div>
        <div>
          <h4 className="text-sm font-medium text-slate-300">本地缓存</h4>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <HardDrive size={12} />
            已使用: <span className="text-cyan-400 font-mono">{formatBytes(cacheSize)}</span>
          </p>
        </div>
      </div>
      
      <button
        onClick={handleClearCache}
        disabled={cacheSize === 0}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
          cacheSize > 0
            ? 'text-red-400 hover:bg-red-500/10 hover:border-red-500/30 border border-transparent'
            : 'text-slate-600 cursor-not-allowed'
        }`}
      >
        <Trash2 size={16} />
        清除缓存
      </button>
    </div>
  );
};
