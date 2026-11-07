import React from 'react';
import {
  HandThumbUpIcon as HandThumbUpOutline,
  HandThumbDownIcon as HandThumbDownOutline,
  TrashIcon,
} from '@heroicons/react/24/outline';
import {
  HandThumbUpIcon as HandThumbUpSolid,
  HandThumbDownIcon as HandThumbDownSolid,
} from '@heroicons/react/24/solid';
import { Drop } from '../../types';
import { timeAgo, getInitials, cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

interface DropCardProps {
  drop: Drop;
  onVote: (dropId: string, voteType: 'up' | 'down') => void;
  onDelete?: (dropId: string) => void;
  isVoting?: boolean;
}

export function DropCard({ drop, onVote, onDelete, isVoting }: DropCardProps) {
  const { user: currentUser } = useAuth();
  const isOwner = currentUser?.id === drop.userId;

  const authorName = drop.user?.name || 'Anonymous Student';
  const collegeName = drop.user?.collegeName || drop.user?.college?.name || '';
  const branch = drop.user?.branch || '';
  const metaSubtitle = [branch, collegeName].filter(Boolean).join(' • ');

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 transition-colors hover:border-gray-300">
      <div className="flex items-start justify-between gap-3">
        {/* Author Header */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 border border-primary-200 text-primary-800 font-bold text-xs">
            {getInitials(authorName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-gray-900 text-sm truncate">{authorName}</h4>
              <span className="text-xs text-gray-400 font-medium shrink-0">
                {timeAgo(drop.createdAt)}
              </span>
            </div>
            {metaSubtitle && (
              <p className="text-xs text-gray-500 truncate">{metaSubtitle}</p>
            )}
          </div>
        </div>

        {/* Delete action if owner */}
        {isOwner && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(drop.id)}
            title="Delete Drop"
            className="rounded-lg p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="mt-3.5">
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
          {drop.content}
        </p>
      </div>

      {/* Footer Voting Actions */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
        <div className="flex items-center gap-2">
          {/* Thumbs Up Button */}
          <button
            type="button"
            disabled={isVoting}
            onClick={() => onVote(drop.id, 'up')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50',
              drop.userVote === 'up'
                ? 'border-primary-600 bg-primary-50 text-primary-800'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300'
            )}
          >
            {drop.userVote === 'up' ? (
              <HandThumbUpSolid className="h-4 w-4 text-primary-700" />
            ) : (
              <HandThumbUpOutline className="h-4 w-4 text-gray-500" />
            )}
            <span>{drop.upVotes || 0}</span>
          </button>

          {/* Thumbs Down Button */}
          <button
            type="button"
            disabled={isVoting}
            onClick={() => onVote(drop.id, 'down')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50',
              drop.userVote === 'down'
                ? 'border-red-300 bg-red-50 text-red-700'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300'
            )}
          >
            {drop.userVote === 'down' ? (
              <HandThumbDownSolid className="h-4 w-4 text-red-600" />
            ) : (
              <HandThumbDownOutline className="h-4 w-4 text-gray-500" />
            )}
            <span>{drop.downVotes || 0}</span>
          </button>
        </div>

        <span className="text-[11px] text-gray-400">
          {(drop.upVotes || 0) - (drop.downVotes || 0)} score
        </span>
      </div>
    </div>
  );
}
