import React, { useState, useRef } from 'react';
import { Upload, Image, X } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useImagePreprocess } from '../hooks/useImagePreprocess';

export const ImageUploader: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { imagePreview } = useAppStore();
  const { handleDrop, handleDragOver, handleInputChange, clearImage } = useImagePreprocess();

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  if (imagePreview) {
    return (
      <div className="relative group">
        <div className="relative overflow-hidden rounded-xl border-2 border-cyan-500/50 bg-slate-900/50 shadow-[0_0_30px_rgba(0,245,255,0.2)] transition-all duration-300">
          <img
            src={imagePreview}
            alt="Preview"
            className="w-full h-80 object-contain p-4"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <button
            onClick={clearImage}
            className="absolute top-4 right-4 p-2 bg-red-500/80 hover:bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      onDrop={(e) => {
        handleDrop(e);
        setIsDragging(false);
      }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      className={`relative cursor-pointer border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
        isDragging
          ? 'border-cyan-400 bg-cyan-500/10 scale-[1.02] shadow-[0_0_40px_rgba(0,245,255,0.4)]'
          : 'border-slate-600 bg-slate-800/30 hover:border-cyan-500/50 hover:bg-slate-800/50'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleInputChange}
        className="hidden"
      />
      
      <div className={`transition-all duration-300 ${isDragging ? 'scale-110' : ''}`}>
        <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
          isDragging ? 'bg-cyan-500/20' : 'bg-slate-700/50'
        }`}>
          {isDragging ? (
            <Image size={40} className="text-cyan-400 animate-pulse" />
          ) : (
            <Upload size={40} className="text-slate-400" />
          )}
        </div>
        
        <p className={`text-lg font-medium mb-2 ${
          isDragging ? 'text-cyan-400' : 'text-slate-300'
        }`}>
          {isDragging ? '释放以上传图片' : '点击或拖拽上传图片'}
        </p>
        <p className="text-sm text-slate-500">
          支持 JPG, PNG, WebP 格式
        </p>
      </div>
      
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-fuchsia-500/0 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    </div>
  );
};
