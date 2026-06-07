import React, { useState } from 'react';
import { PersonStanding, Mountain, Package, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { StructuredDescription as StructuredDescriptionType, DimensionResult } from '../types';

interface StructuredDescriptionProps {
  description: StructuredDescriptionType;
  isLoading?: boolean;
  currentDimension?: string;
}

const iconMap: Record<string, React.ComponentType<any>> = {
  'person-running': PersonStanding,
  'mountain': Mountain,
  'package': Package,
  'sparkles': Sparkles,
};

const colorMap: Record<string, { border: string; bg: string; text: string; iconBg: string }> = {
  cyan: {
    border: 'border-cyan-400/30',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    iconBg: 'bg-cyan-500/20',
  },
  fuchsia: {
    border: 'border-fuchsia-400/30',
    bg: 'bg-fuchsia-500/10',
    text: 'text-fuchsia-400',
    iconBg: 'bg-fuchsia-500/20',
  },
  yellow: {
    border: 'border-yellow-400/30',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    iconBg: 'bg-yellow-500/20',
  },
  green: {
    border: 'border-green-400/30',
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    iconBg: 'bg-green-500/20',
  },
};

const DimensionCard: React.FC<{
  result: DimensionResult;
  isLoading: boolean;
  isActive: boolean;
}> = ({ result, isLoading, isActive }) => {
  const [showAlternatives, setShowAlternatives] = useState(false);
  const colors = colorMap[result.color] || colorMap.cyan;
  const IconComponent = iconMap[result.icon] || Package;

  return (
    <div
      className={`rounded-xl border-2 p-5 transition-all duration-500 ${colors.border} ${colors.bg} ${
        isActive ? 'scale-[1.02] shadow-lg' : ''
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${colors.iconBg} ${colors.text} ${
            isLoading ? 'animate-pulse' : ''
          }`}
        >
          <IconComponent size={24} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className={`font-bold ${colors.text}`}>
              {result.label}
            </h4>
            {isLoading && isActive && (
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </div>

          {isLoading && isActive ? (
            <div className="space-y-2">
              <div className="h-4 bg-slate-700/50 rounded animate-pulse w-3/4" />
              <div className="h-4 bg-slate-700/50 rounded animate-pulse w-full" />
              <div className="h-4 bg-slate-700/50 rounded animate-pulse w-2/3" />
            </div>
          ) : result.text ? (
            <>
              <p className="text-slate-200 leading-relaxed">
                {result.text}
              </p>

              {result.beamResults && result.beamResults.alternatives.length > 0 && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowAlternatives(!showAlternatives)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    {showAlternatives ? (
                      <>
                        <ChevronUp size={14} />
                        收起备选
                      </>
                    ) : (
                      <>
                        <ChevronDown size={14} />
                        查看 {result.beamResults.alternatives.length} 个备选
                      </>
                    )}
                  </button>

                  {showAlternatives && (
                    <div className="mt-2 space-y-2">
                      {result.beamResults.alternatives.map((alt, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-slate-800/50 text-sm text-slate-400 border border-slate-700/50"
                        >
                          <span className="text-slate-500 mr-2">#{idx + 2}</span>
                          {alt}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-slate-500 italic">
              等待生成...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export const StructuredDescription: React.FC<StructuredDescriptionProps> = ({
  description,
  isLoading = false,
  currentDimension,
}) => {
  const dimensions: DimensionResult[] = [
    description.action,
    description.scene,
    description.objects,
    description.atmosphere,
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
          <span className="text-cyan-400">✨</span>
          结构化描述
        </h3>
        {isLoading && (
          <div className="text-sm text-slate-400">
            正在生成 {currentDimension}...
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {dimensions.map((dim) => (
          <DimensionCard
            key={dim.dimension}
            result={dim}
            isLoading={isLoading}
            isActive={currentDimension === dim.dimension}
          />
        ))}
      </div>
    </div>
  );
};
