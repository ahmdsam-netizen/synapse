import React, { forwardRef } from 'react';

interface InfiniteScrollLoaderProps {
  isFetchingNextPage: boolean;
  hasNextPage?: boolean;
  onLoadMore?: () => void;
  label?: string;
}

export const InfiniteScrollLoader = forwardRef<HTMLDivElement, InfiniteScrollLoaderProps>(
  ({ isFetchingNextPage, hasNextPage = false, onLoadMore, label = 'Load More' }, ref) => {
    return (
      <div 
        ref={ref} 
        className="py-8 flex justify-center items-center w-full mt-2"
      >
        {hasNextPage ? (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 shadow-xs hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
          >
            {isFetchingNextPage ? (
              <div className="flex items-center space-x-2 text-primary-600">
                <div className="w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                <span>Loading more...</span>
              </div>
            ) : (
              <span>{label}</span>
            )}
          </button>
        ) : (
          <div className="text-sm text-gray-400 font-medium py-2">
            No more results
          </div>
        )}
      </div>
    );
  }
);

InfiniteScrollLoader.displayName = 'InfiniteScrollLoader';
