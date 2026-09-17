import React from 'react';

export function SkeletonCard() {
  return (
    <div className="flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-full min-h-[280px]">
      <div className="flex-1 p-5 flex flex-col">
        <div className="flex items-start space-x-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
            <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
          </div>
        </div>

        <div className="mb-4">
          <div className="h-5 w-24 bg-gray-200 rounded-full animate-pulse" />
        </div>

        <div className="space-y-3 mb-6">
          <div className="h-3 bg-gray-200 rounded w-1/4 animate-pulse" />
          <div className="flex flex-wrap gap-2">
            <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-6 w-24 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>
        
        <div className="mt-auto pt-4 border-t border-gray-50">
          <div className="h-4 w-1/3 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>

      <div className="p-4 pt-0 mt-auto">
        <div className="h-10 w-full bg-gray-200 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
