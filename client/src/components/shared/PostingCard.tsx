import React from 'react';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { BoardPosting } from '../../types';
import { TagChip } from './TagChip';
import { timeAgo, getInitials, cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

interface PostingCardProps {
  posting: BoardPosting & {
    hasRequested?: boolean;
    isOwner?: boolean;
    pendingRequestCount?: number;
  };
  onClick?: () => void;
  isMatchedTab?: boolean;
  isMyPost?: boolean;
}

export function PostingCard({
  posting,
  onClick,
  isMatchedTab = false,
  isMyPost = false,
}: PostingCardProps) {
  const { user: currentUser } = useAuth();
  const isSelfPost =
    isMyPost ||
    Boolean(posting.isOwner) ||
    (Boolean(currentUser?.id) &&
      (posting.creatorId === currentUser?.id ||
        (posting as any).creator_id === currentUser?.id));

  const groupName = posting.groupName || (posting as any).group_name || 'Group';
  const rolesNeeded = posting.rolesNeeded || (posting as any).roles_needed || [];

  const rawPct = posting.matchPercentage ?? (posting as any).match_percentage;
  const matchPct =
    rawPct !== undefined && rawPct !== null
      ? Math.round(rawPct)
      : posting.semantic_match_score !== undefined
        ? Math.round(posting.semantic_match_score * 100)
        : (posting as any).semanticMatchScore !== undefined
          ? Math.round((posting as any).semanticMatchScore * 100)
          : posting.matchScore !== undefined
            ? Math.round(posting.matchScore * 100)
            : undefined;

  const uploadTime = timeAgo(posting.createdAt || (posting as any).created_at);
  const community = ((posting.community || (posting as any).community || 'project') as string).toLowerCase();

  return (
    <div
      onClick={onClick}
      className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 hover:border-gray-300 transition-colors h-full cursor-pointer group"
    >
      <div>
        {/* Top: Avatar/Group Icon & Info */}
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 border border-primary-200 text-primary-700 font-bold text-sm shadow-2xs">
            {getInitials(groupName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="truncate text-xs text-gray-500 font-medium">
                {uploadTime}
              </span>
            </div>
            <h4 className="font-semibold text-gray-900 truncate mt-0.5 text-sm" title={groupName}>
              {groupName}
            </h4>
            {posting.collegeName && (
              <p className="truncate text-xs text-gray-400">
                {posting.collegeName}
              </p>
            )}
          </div>
        </div>

        {/* Posting Title */}
        <h3 className="mt-3 font-semibold text-gray-900 text-base line-clamp-1 group-hover:text-primary-600 transition-colors" title={posting.title}>
          {posting.title}
        </h3>

        {/* Roles Needed */}
        {rolesNeeded && rolesNeeded.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-gray-400 font-medium shrink-0">Role:</span>
            {rolesNeeded.slice(0, 3).map((role: string) => (
              <TagChip key={role} label={role} variant="role" size="sm" />
            ))}
            {rolesNeeded.length > 3 && (
              <span className="text-[10px] text-gray-400 font-medium self-center">
                +{rolesNeeded.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bottom Footer: Left match % or upload info & Right "View Detail" button */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
        {/* Left Info: Match % or status */}
        <div className="flex items-center min-w-0">
          {!isSelfPost && matchPct !== undefined ? (
            <div
              className="inline-flex items-center shrink-0 rounded-md bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-800 border border-primary-200"
              title={`${matchPct}% Skill Overlap`}
            >
              <span>{matchPct}% Skill Overlap</span>
            </div>
          ) : posting.pendingRequestCount !== undefined && posting.pendingRequestCount > 0 ? (
            <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200 shrink-0">
              {posting.pendingRequestCount} request{posting.pendingRequestCount > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-[11px] text-gray-400 shrink-0">
              {uploadTime}
            </span>
          )}
        </div>

        {/* Right Button: View Detail */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onClick) onClick();
          }}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors cursor-pointer"
        >
          <span>View Detail</span>
          <ArrowTopRightOnSquareIcon className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
