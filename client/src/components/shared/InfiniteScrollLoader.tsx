import React, { forwardRef } from 'react';

interface InfiniteScrollLoaderProps {
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
}

export const InfiniteScrollLoader = forwardRef<HTMLDivElement, InfiniteScrollLoaderProps>(
  ({ isFetchingNextPage, hasNextPage }, ref) => {
    return (
      <div 
        ref={ref} 
        className="py-8 flex justify-center items-center w-full mt-4"
      >
        {isFetchingNextPage ? (
          <div className="flex items-center space-x-2 text-primary-600">
            <div className="w-5 h-5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <span className="text-sm font-medium">Loading more...</span>
          </div>
        ) : !hasNextPage ? (
          <div className="text-sm text-gray-400 font-medium pb-8">
            No more results
          </div>
        ) : null}
      </div>
    );
  }
);

InfiniteScrollLoader.displayName = 'InfiniteScrollLoader';
