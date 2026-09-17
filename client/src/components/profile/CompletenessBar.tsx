import { useMemo } from 'react';

interface CompletenessBarProps {
  score: number;
}

export default function CompletenessBar({ score }: CompletenessBarProps) {
  const safeScore = Math.max(0, Math.min(100, score));
  
  const colorClass = useMemo(() => {
    if (safeScore < 25) return 'bg-red-500';
    if (safeScore < 50) return 'bg-orange-500';
    if (safeScore < 75) return 'bg-yellow-500';
    return 'bg-green-500';
  }, [safeScore]);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-700">Profile Completeness</span>
        <span className="text-sm font-bold text-gray-900">{safeScore}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-500 ease-out ${colorClass}`}
          style={{ width: `${safeScore}%` }}
        />
      </div>
      {safeScore < 100 && (
        <p className="text-xs text-gray-500 mt-2">
          Add more skills, interests, and projects to reach 100% and get better recommendations.
        </p>
      )}
    </div>
  );
}
