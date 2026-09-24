import React from 'react';
import { UserIcon } from '@heroicons/react/24/outline';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ 
  icon = <UserIcon className="w-6 h-6 text-gray-500" />, 
  title, 
  description, 
  action 
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white rounded-xl border border-gray-200 w-full min-h-[260px]">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-gray-600 mb-4 border border-gray-200">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1.5">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 max-w-md mb-5 leading-relaxed">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-lg text-white bg-primary-600 hover:bg-primary-700 transition-colors focus:outline-none focus:ring-1 focus:ring-primary-600 cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
