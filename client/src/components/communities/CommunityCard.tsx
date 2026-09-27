import { UsersIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { Community } from '../../types';

interface CommunityCardProps {
  community: Community;
  onClick: () => void;
  onJoin?: (e: React.MouseEvent) => void;
  isJoining?: boolean;
}

export function CommunityCard({ community, onClick, onJoin, isJoining }: CommunityCardProps) {
  const memberCount = community.memberCount ?? community.member_count ?? 1;
  const isFull = memberCount >= 1000;

  return (
    <div
      onClick={onClick}
      className="relative flex cursor-pointer flex-col justify-between rounded-xl border border-gray-200 bg-white p-6 transition-colors hover:border-gray-300"
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">{community.name}</h3>
          <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 shrink-0">
            <GlobeAltIcon className="h-3 w-3 text-gray-500" />
            Global
          </span>
        </div>

        <p className="mt-2 text-sm text-gray-600 line-clamp-2 min-h-[2.5rem]">
          {community.description || 'No description provided.'}
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-3">
        <div className="flex items-center text-xs text-gray-500">
          <UsersIcon className="mr-1.5 h-4 w-4 text-gray-400" />
          <span>{memberCount} / 1000 members</span>
        </div>

        <div className="flex items-center gap-2">
          {community.isMember ? (
            <span className="inline-flex items-center rounded-lg bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-800 border border-primary-200">
              Joined
            </span>
          ) : isFull ? (
            <span className="inline-flex items-center rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
              Full
            </span>
          ) : onJoin ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onJoin(e);
              }}
              disabled={isJoining}
              className="inline-flex items-center rounded-lg bg-primary-600 px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-primary-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isJoining ? 'Joining...' : 'Join'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
