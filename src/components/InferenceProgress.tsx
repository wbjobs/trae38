import React from 'react';
import { Image, Cpu, Type, Check, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { INFERENCE_STEPS, InferenceStep } from '../types';

interface StepIndicatorProps {
  step: InferenceStep;
  label: string;
  icon: string;
  isActive: boolean;
  isComplete: boolean;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ step, label, icon, isActive, isComplete }) => {
  const getIcon = () => {
    switch (icon) {
      case 'image':
        return <Image size={20} />;
      case 'cpu':
        return <Cpu size={20} />;
      case 'type':
        return <Type size={20} />;
      case 'check':
        return <Check size={20} />;
      default:
        return <Cpu size={20} />;
    }
  };

  return (
    <div className="flex items-center">
      <div className={`flex flex-col items-center transition-all duration-500 ${
        isActive ? 'scale-110' : ''
      }`}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
          isComplete
            ? 'bg-green-500/20 text-green-400 border-2 border-green-500/50'
            : isActive
            ? 'bg-cyan-500/20 text-cyan-400 border-2 border-cyan-500 shadow-[0_0_20px_rgba(0,245,255,0.4)]'
            : 'bg-slate-800 text-slate-500 border-2 border-slate-700'
        }`}>
          {isActive && !isComplete ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            getIcon()
          )}
        </div>
        <span className={`mt-2 text-xs font-medium transition-colors duration-300 ${
          isComplete ? 'text-green-400' : isActive ? 'text-cyan-400' : 'text-slate-500'
        }`}>
          {label}
        </span>
      </div>
    </div>
  );
};

const Connector: React.FC<{ isActive: boolean; isComplete: boolean }> = ({ isActive, isComplete }) => (
  <div className="flex-1 h-0.5 mx-2 relative overflow-hidden">
    <div className="absolute inset-0 bg-slate-700" />
    <div
      className={`absolute inset-y-0 left-0 transition-all duration-1000 ${
        isComplete
          ? 'bg-green-500 w-full'
          : isActive
          ? 'bg-gradient-to-r from-cyan-500 to-fuchsia-500 animate-[shimmer_1s_linear_infinite] bg-[length:200%_100%] w-full'
          : 'bg-slate-700 w-0'
      }`}
    />
  </div>
);

export const InferenceProgress: React.FC = () => {
  const { inferenceStep, inferenceProgress, isInferencing } = useAppStore();

  if (!isInferencing && inferenceStep === 'idle') {
    return null;
  }

  const currentStepIndex = INFERENCE_STEPS.findIndex((s) => s.key === inferenceStep);

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
      <h3 className="text-lg font-bold text-slate-200 mb-6 flex items-center gap-2">
        <Cpu size={20} className="text-cyan-400" />
        推理进度
      </h3>

      <div className="flex items-center justify-center mb-6">
        {INFERENCE_STEPS.map((step, index) => (
          <React.Fragment key={step.key}>
            <StepIndicator
              step={step.key}
              label={step.label}
              icon={step.icon}
              isActive={index === currentStepIndex}
              isComplete={index < currentStepIndex || (index === currentStepIndex && inferenceProgress >= 100)}
            />
            {index < INFERENCE_STEPS.length - 1 && (
              <Connector
                isActive={index < currentStepIndex}
                isComplete={index < currentStepIndex - 1 || (index === currentStepIndex - 1 && inferenceProgress >= 100)}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="mb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">
            {INFERENCE_STEPS[currentStepIndex]?.label || '准备中...'}
          </span>
          <span className="text-lg font-bold text-cyan-400 font-mono">{inferenceProgress}%</span>
        </div>
        <div className="h-3 bg-slate-900 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-cyan-500 bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite] transition-all duration-300 ease-out"
            style={{ width: `${inferenceProgress}%` }}
          />
        </div>
      </div>

      {inferenceStep === 'complete' && (
        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-sm text-green-400 text-center font-medium">
            ✓ 图像描述生成完成！
          </p>
        </div>
      )}
    </div>
  );
};
