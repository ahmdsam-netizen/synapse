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
  const baseStyles = "inline-flex items-center font-medium rounded-full whitespace-nowrap transition-colors";
  
  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm"
  };

  const variantStyles = {
    skill: "bg-blue-50 text-blue-700",
    interest: "bg-green-50 text-green-700",
    role: "bg-purple-50 text-purple-700",
    tech: "bg-gray-100 text-gray-700",
    status: "bg-amber-50 text-amber-700"
  };

  const matchedStyles = matched ? "ring-2 ring-primary-400 bg-primary-50 text-primary-700 shadow-sm" : "";

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
            "ml-1 flex-shrink-0 rounded-full p-0.5 inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2",
            matched ? "hover:bg-primary-200 focus:ring-primary-500" : "hover:bg-black/10 focus:ring-black/20"
          )}
        >
          <XMarkIcon className={size === 'sm' ? "h-3 w-3" : "h-4 w-4"} />
        </button>
      )}
    </span>
  );
}
