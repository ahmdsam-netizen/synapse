import React from 'react';
import { cn, formatTimeRemaining } from '../../lib/utils';
import { StatusBadge } from './StatusBadge';
import { UsersIcon, ClockIcon } from '@heroicons/react/24/outline';
import { Group } from '../../types';

interface GroupCardProps {
  group: Group;
  onClick: () => void;
  role?: 'admin' | 'member';
  pendingRequestsCount?: number;
}

export function GroupCard({ group, onClick, role, pendingRequestsCount = 0 }: GroupCardProps) {
  const timeLeft = formatTimeRemaining(group.expiresAt || (group as any).expires_at);

  return (
    <div
      onClick={onClick}
      className="relative flex cursor-pointer flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 transition-colors hover:border-gray-300"
    >
      {role === 'admin' && pendingRequestsCount > 0 && (
        <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow">
          {pendingRequestsCount > 99 ? '99+' : pendingRequestsCount}
        </div>
      )}

      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">{group.name}</h3>
      </div>

      <p className="text-sm text-gray-600 line-clamp-2 min-h-[2.5rem]">
        {group.description || 'No description provided.'}
      </p>

      <div className="mt-auto flex items-center justify-between pt-2">
        <div className="flex items-center text-sm text-gray-500">
          <UsersIcon className="mr-1.5 h-4 w-4" />
          {group.memberCount ?? (group as any).member_count ?? 1} {(group.maxMembers ?? (group as any).max_members) ? `/ ${group.maxMembers ?? (group as any).max_members}` : ''} members
        </div>
        
        <div className="flex items-center gap-2">
          {timeLeft && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                timeLeft === 'Expired'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              )}
            >
              <ClockIcon className="h-3 w-3" />
              {timeLeft}
            </span>
          )}
          {role && (
            <StatusBadge status={role} />
          )}
        </div>
      </div>
    </div>
  );
}
