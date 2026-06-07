import React from 'react';
import { AlignLeft, AlignJustify, Smile, Check } from 'lucide-react';
import { DescriptionStyle, DESCRIPTION_STYLES } from '../types';

interface StyleSelectorProps {
  selectedStyle: DescriptionStyle;
  onStyleChange: (style: DescriptionStyle) => void;
  disabled?: boolean;
}

const iconMap: Record<string, React.ComponentType<any>> = {
  'align-left': AlignLeft,
  'align-justify': AlignJustify,
  'smile': Smile,
};

export const StyleSelector: React.FC<StyleSelectorProps> = ({
  selectedStyle,
  onStyleChange,
  disabled = false,
}) => {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
      <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
        <span className="text-cyan-400">🎨</span>
        描述风格
      </h3>

      <div className="grid grid-cols-3 gap-3">
        {DESCRIPTION_STYLES.map((style) => {
          const IconComponent = iconMap[style.icon] || AlignLeft;
          const isSelected = selectedStyle === style.key;

          return (
            <button
              key={style.key}
              onClick={() => !disabled && onStyleChange(style.key)}
              disabled={disabled}
              className={`relative p-4 rounded-xl border-2 transition-all duration-300 flex flex-col items-center gap-2 ${
                isSelected
                  ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_20px_rgba(0,245,255,0.2)]'
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-700/30'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02]'}`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <Check size={14} className="text-cyan-400" />
                </div>
              )}

              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isSelected
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'bg-slate-700/50 text-slate-400'
                }`}
              >
                <IconComponent size={20} />
              </div>

              <span
                className={`text-sm font-medium ${
                  isSelected ? 'text-cyan-400' : 'text-slate-300'
                }`}
              >
                {style.label}
              </span>

              <span className="text-xs text-slate-500">
                {style.prompt}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
