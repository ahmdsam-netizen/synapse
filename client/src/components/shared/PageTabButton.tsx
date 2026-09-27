import React from 'react';
import { cn } from '../../lib/utils';

export interface PageTabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  count?: number | string | null;
  countVariant?: 'default' | 'highlight' | 'subtle';
  className?: string;
}

export function PageTabButton({
  active,
  onClick,
  icon: Icon,
  title,
  subtitle,
  count,
  countVariant = 'default',
  className,
}: PageTabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-between p-3.5 rounded-lg border text-sm font-semibold transition-all cursor-pointer text-left',
        active
          ? 'bg-primary-50 border-primary-600 text-primary-900 shadow-xs ring-1 ring-primary-600'
          : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50',
        className
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon
          className={cn(
            'h-5 w-5 shrink-0',
            active ? 'text-primary-700' : 'text-gray-400'
          )}
        />
        <div className="truncate">
          <span className="block font-semibold">{title}</span>
          <span className="text-[11px] font-normal text-gray-500">{subtitle}</span>
        </div>
      </div>
      {count !== undefined && count !== null && (
        <span
          className={cn(
            'ml-2 shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold',
            countVariant === 'highlight'
              ? 'bg-amber-100 text-amber-800'
              : countVariant === 'subtle'
              ? 'text-gray-400 font-normal'
              : 'bg-gray-100 text-gray-700'
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
