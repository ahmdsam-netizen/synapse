import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { connectionsApi } from '../../api/connections';
import { getInitials, timeAgo, cn } from '../../lib/utils';
import { TagChip } from './TagChip';
import toast from 'react-hot-toast';
import {
  UserPlusIcon,
  CheckIcon,
  ArrowTopRightOnSquareIcon,
  UserMinusIcon,
} from '@heroicons/react/24/outline';

export interface UserCardProps {
  user: any;
  mode?: 'connection' | 'second_degree' | 'similarity' | 'search';
  onConnect?: (userId: string) => void;
  onDisconnect?: (connectionId: string) => void;
  isDisconnecting?: boolean;
}

export function UserCard({
  user,
  mode = 'similarity',
  onConnect,
  onDisconnect,
  isDisconnecting = false,
}: UserCardProps) {
  const queryClient = useQueryClient();
  const [requestStatus, setRequestStatus] = useState<'idle' | 'loading' | 'requested' | 'error'>(
    user.connectionStatus === 'pending' || (user as any).status === 'pending' ? 'requested' : 'idle'
  );
  const [isConfirming, setIsConfirming] = useState(false);

  // Sync tick when fresh data arrives from backend (useState initializer only runs once on mount,
  // so if React Query served stale cache first, we need this effect to catch the update)
  useEffect(() => {
    if (user.connectionStatus === 'pending' || (user as any).status === 'pending') {
      setRequestStatus('requested');
    }
  }, [user.connectionStatus, (user as any).status]);

  const profileId = user.id || user.friendId;
  const connectionId = user.connectionId || user.connection_id || user.friendId || user.id;

  const handleConnect = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (requestStatus === 'requested' || requestStatus === 'loading') return;

    setRequestStatus('loading');
    try {
      await connectionsApi.sendRequest(user.id || profileId);
      setRequestStatus('requested');
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['connections', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['connections', 'second-degree'] });
      toast.success('Connection request sent!');
      if (onConnect) onConnect(user.id || profileId);
    } catch (error) {
      setRequestStatus('error');
      toast.error('Failed to send connection request.');
      setTimeout(() => setRequestStatus('idle'), 2000);
    }
  };

  // Compatibility match percentage (for similarity and search recommendation modes)
  const rawPct = user.matchPercentage ?? user.match_percentage;
  const matchPct =
    rawPct !== undefined && rawPct !== null
      ? Math.round(rawPct)
      : user.similarity_score !== undefined
        ? Math.round(user.similarity_score * 100)
        : user.similarityScore !== undefined
          ? Math.round(user.similarityScore * 100)
          : user.matchScore !== undefined
            ? Math.round(user.matchScore * 100)
            : undefined;

  const avatarUrl = user.avatarUrl || user.avatar_url;
  const name = user.name || 'Student';
  const college =
    user.collegeName || user.college_name || user.college?.name || 'College Member';
  const year = user.yearOfStudy || user.year_of_study || user.year || 1;
  const branch = user.branch;
  const bio = user.bio;
  const skills = user.skills || user.allSkills || user.all_skills || [];
  const matchedSkills = user.matchedSkills || [];
  const connectedAt = user.connectedAt || user.connected_at;
  const mutualCount = user.mutualCount ?? (user as any).mutual_count;
  const viaConnectionName =
    user.viaConnection?.name || user.viaConnectionName || (user as any).via_connection_name;

  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 hover:border-gray-300 transition-colors h-full">
      <div>
        {/* Top: Avatar & Info */}
        <div className="flex items-start gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-100 shrink-0"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-600 text-base font-semibold text-white ring-2 ring-gray-100">
              {getInitials(name)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <Link
              to={`/profile/${profileId}`}
              className="block truncate font-semibold text-gray-900 hover:text-primary-600 transition-colors"
            >
              {name}
            </Link>
            <p className="truncate text-xs text-gray-500">
              {college} • Year {year}
            </p>
            {branch && (
              <p className="truncate text-xs text-gray-400 mt-0.5">
                {branch}
              </p>
            )}
          </div>
        </div>

        {/* Bio */}
        {bio ? (
          <p className="mt-3 text-xs text-gray-600 line-clamp-2">
            {bio}
          </p>
        ) : user.lookingFor && user.lookingFor !== 'none' ? (
          <p className="mt-3 text-xs text-gray-500 line-clamp-2">
            <span className="font-medium text-gray-600">Looking for:</span> {user.lookingFor}
          </p>
        ) : null}

        {/* Skills */}
        {skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {skills.slice(0, 4).map((s: any, idx: number) => {
              const sName = typeof s === 'string' ? s : s.name;
              return (
                <TagChip
                  key={idx}
                  label={sName}
                  variant="skill"
                  size="sm"
                />
              );
            })}
            {skills.length > 4 && (
              <span className="self-center text-[10px] text-gray-400">
                +{skills.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bottom Footer: Left info & Right action buttons */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
        {/* LEFT SIDE: Connected date / Via text / Match % */}
        {mode === 'connection' ? (
          <span className="text-[11px] text-gray-400 shrink-0">
            {connectedAt ? `Connected ${timeAgo(connectedAt)}` : 'Connected'}
          </span>
        ) : mode === 'second_degree' ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 min-w-0">
            <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-800 border border-gray-200 shrink-0">
              {mutualCount ?? 1} mutual
            </span>
            {viaConnectionName && (
              <span
                className="truncate text-[11px] text-gray-500 max-w-[130px] sm:max-w-[150px]"
                title={`via ${viaConnectionName}`}
              >
                via <span className="font-medium text-gray-700">{viaConnectionName}</span>
              </span>
            )}
          </div>
        ) : (
          /* Similarity / Search Recommendation modes */
          <div className="flex items-center min-w-0">
            {matchPct !== undefined ? (
              <span
                className="inline-flex items-center shrink-0 rounded-md bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-800 border border-primary-200"
                title={`${matchPct}% Skill Overlap`}
              >
                {matchPct}% Skill Overlap
              </span>
            ) : user.sameCollege ? (
              <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-800 border border-gray-200 shrink-0">
                Same institution
              </span>
            ) : (
              <span className="text-[11px] text-gray-500 shrink-0">
                Suggested peer
              </span>
            )}
          </div>
        )}

        {/* RIGHT SIDE: Action Buttons */}
        {mode === 'connection' ? (
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to={`/profile/${profileId}`}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
            >
              <span>Profile</span>
              <ArrowTopRightOnSquareIcon className="h-3 w-3" />
            </Link>

            {isConfirming ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    if (onDisconnect) onDisconnect(connectionId);
                    setIsConfirming(false);
                  }}
                  disabled={isDisconnecting}
                  className="rounded px-2 py-1 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isDisconnecting ? '...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setIsConfirming(false)}
                  className="rounded px-1.5 py-1 text-[11px] text-gray-500 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsConfirming(true)}
                title="Disconnect"
                className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors cursor-pointer"
              >
                <UserMinusIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          /* 2nd-Degree & Recommendation modes: Profile + Connect icon button */
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to={`/profile/${profileId}`}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
            >
              <span>Profile</span>
              <ArrowTopRightOnSquareIcon className="h-3 w-3" />
            </Link>

            {requestStatus === 'requested' ? (
              <span
                title="Connection request sent"
                className="p-1 text-emerald-600 rounded cursor-default inline-flex items-center justify-center"
              >
                <CheckIcon className="h-4 w-4" />
              </span>
            ) : requestStatus === 'loading' ? (
              <span className="p-1 text-primary-600 inline-flex items-center justify-center">
                <div className="h-4 w-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              </span>
            ) : (
              <button
                onClick={handleConnect}
                title="Connect"
                className="p-1 text-gray-400 hover:text-primary-600 rounded transition-colors cursor-pointer"
              >
                <UserPlusIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
