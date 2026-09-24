import React from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { cn } from '../../lib/utils';

export interface TagChipProps {
  label: string;
  variant: 'skill' | 'interest' | 'role' | 'tech' | 'status';
  matched?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  size?: 'sm' | 'md';
}

export function TagChip({
  label,
  variant,
  matched = false,
  removable = false,
  onRemove,
  size = 'sm'
}: TagChipProps) {
  const baseStyles = "inline-flex items-center font-medium rounded-md whitespace-nowrap transition-colors";
  
  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm"
  };

  const variantStyles = {
    skill: "bg-primary-50 text-primary-800 border border-primary-200",
    interest: "bg-gray-100 text-gray-800 border border-gray-200",
    role: "bg-gray-100 text-gray-800 border border-gray-200",
    tech: "bg-gray-100 text-gray-800 border border-gray-200",
    status: "bg-amber-50 text-amber-800 border border-amber-200"
  };

  const matchedStyles = matched ? "ring-1 ring-primary-600 bg-primary-100 text-primary-900 border border-primary-300" : "";

  return (
    <span className={cn(
      baseStyles,
      sizeStyles[size],
      matched ? matchedStyles : variantStyles[variant]
    )}>
      {label}
      {removable && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onRemove) onRemove();
          }}
          className={cn(
            "ml-1 flex-shrink-0 rounded p-0.5 inline-flex items-center justify-center focus:outline-none cursor-pointer",
            matched ? "hover:bg-primary-200 focus:ring-1 focus:ring-primary-500" : "hover:bg-black/10 focus:ring-1 focus:ring-gray-400"
          )}
        >
          <XMarkIcon className={size === 'sm' ? "h-3 w-3" : "h-4 w-4"} />
        </button>
      )}
    </span>
  );
}
