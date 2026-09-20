import React from 'react';

export function SkeletonCard() {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-100 bg-white p-5 shadow-sm h-full min-h-[220px]">
      <div>
        {/* Top: Avatar & Info */}
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-full bg-gray-200 animate-pulse shrink-0" />
          <div className="min-w-0 flex-1 space-y-2 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
            <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
          </div>
        </div>

        {/* Bio */}
        <div className="mt-3 space-y-1.5">
          <div className="h-3 bg-gray-200 rounded w-full animate-pulse" />
          <div className="h-3 bg-gray-200 rounded w-4/5 animate-pulse" />
        </div>

        {/* Skills */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-6 w-14 bg-gray-200 rounded-full animate-pulse" />
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
        <div className="h-4 w-24 bg-gray-200 rounded-full animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="h-6 w-14 bg-gray-200 rounded-md animate-pulse" />
          <div className="h-6 w-6 bg-gray-200 rounded-md animate-pulse" />
        </div>
      </div>
    </div>
  );
}

