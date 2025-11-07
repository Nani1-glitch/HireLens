
import React, { useState, useEffect } from 'react';

interface ScoreGaugeProps {
  score: number;
  label: string;
}

const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, label }) => {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    // Animate score changes
    let startTimestamp: number | null = null;
    let animationFrameId: number;
    const duration = 800;

    const step = (timestamp: number) => {
      if (!startTimestamp) {
        startTimestamp = timestamp;
      }
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setDisplayScore((prevScore) => {
        const startScore = prevScore;
        return progress * (score - startScore) + startScore;
      });
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };
    
    animationFrameId = requestAnimationFrame(step);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [score]);


  const radius = 80;
  const stroke = 12;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;

  const getScoreColor = (s: number) => {
    if (s < 50) return 'text-red-500';
    if (s < 75) return 'text-amber-400';
    return 'text-green-500';
  };
  
  const getStrokeColor = (s: number) => {
    if (s < 50) return 'stroke-red-500';
    if (s < 75) return 'stroke-amber-400';
    return 'stroke-green-500';
  };

  return (
    <div className="relative flex items-center justify-center w-[160px] h-[160px]">
      <svg
        height={radius * 2}
        width={radius * 2}
        className="-rotate-90"
      >
        <circle
          className="text-slate-700"
          stroke="currentColor"
          strokeWidth={stroke}
          fill="transparent"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          className={`${getStrokeColor(score)} transition-stroke duration-300`}
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="transparent"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          style={{
            strokeDasharray: `${circumference} ${circumference}`,
            strokeDashoffset,
            transition: 'stroke-dashoffset 0.8s ease-out',
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className={`text-5xl font-bold ${getScoreColor(score)}`}>
          {Math.round(displayScore)}
        </span>
        <span className="text-sm text-slate-400">{label}</span>
      </div>
    </div>
  );
};

export default ScoreGauge;