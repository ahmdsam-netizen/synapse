import React from 'react';
import { TrashIcon, ClockIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { BoardPosting } from '../../types';
import { TagChip } from './TagChip';
import { cn, formatTimeRemaining } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

interface PostingCardProps {
  posting: BoardPosting & { hasRequested?: boolean; isOwner?: boolean; pendingRequestCount?: number };
  onRequestClick?: () => void;
  onDeleteClick?: () => void;
  isMatchedTab?: boolean;
  isMyPost?: boolean;
}

export function PostingCard({
  posting,
  onRequestClick,
  onDeleteClick,
  isMatchedTab = false,
  isMyPost = false,
}: PostingCardProps) {
  const { user: currentUser } = useAuth();
  const isSelfPost = isMyPost || Boolean(posting.isOwner) || (Boolean(currentUser?.id) && (posting.creatorId === currentUser?.id || (posting as any).creator_id === currentUser?.id));

  const groupName = posting.groupName || (posting as any).group_name || 'Group';
  const rolesNeeded = posting.rolesNeeded || (posting as any).roles_needed || [];
  const requiredSkills = posting.requiredSkills || (posting as any).required_skills || [];
  const requiredInterests = posting.requiredInterests || (posting as any).required_interests || [];
  const slotsFilled = posting.slotsFilled ?? (posting as any).slots_filled ?? 0;
  const slotsTotal = posting.slotsTotal ?? (posting as any).slots_total ?? 0;
  const hasRequested = posting.hasRequested ?? (posting as any).has_requested ?? false;
  const expiresAt = posting.expiresAt || (posting as any).expires_at;
  const timeRemaining = formatTimeRemaining(expiresAt);

  const rawPct = posting.matchPercentage ?? (posting as any).match_percentage;
  const matchPct = rawPct !== undefined && rawPct !== null
    ? Math.round(rawPct)
    : posting.semantic_match_score !== undefined
      ? Math.round(posting.semantic_match_score * 100)
      : (posting as any).semanticMatchScore !== undefined
        ? Math.round((posting as any).semanticMatchScore * 100)
        : posting.matchScore !== undefined
          ? Math.round(posting.matchScore * 100)
          : undefined;
  
  const matchedSkills = isMatchedTab && ((posting as any).matchedSkills || (posting as any).matched_skills) 
    ? ((posting as any).matchedSkills || (posting as any).matched_skills) 
    : [];
  const matchedInterests = isMatchedTab && ((posting as any).matchedInterests || (posting as any).matched_interests) 
    ? ((posting as any).matchedInterests || (posting as any).matched_interests) 
    : [];

  const matchedSkillIds = new Set(matchedSkills.map((s: any) => typeof s === 'string' ? s : s.id || s.name));
  const matchedInterestIds = new Set(matchedInterests.map((i: any) => typeof i === 'string' ? i : i.id || i.name));

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex justify-between items-start gap-4">
        <div>
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <p className="text-xs font-medium text-gray-500">{groupName}</p>
            {!isSelfPost && matchPct !== undefined && (
              <span 
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200 shadow-2xs"
                title={`${matchPct}% Compatibility Match`}
              >
                <SparklesIcon className="h-3 w-3 text-emerald-600" />
                <span>{matchPct}% Match</span>
              </span>
            )}
            {timeRemaining && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700 border border-orange-200">
                <ClockIcon className="h-3 w-3" />
                <span>{timeRemaining}</span>
              </span>
            )}
            {posting.pendingRequestCount !== undefined && posting.pendingRequestCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                {posting.pendingRequestCount} pending request{posting.pendingRequestCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{posting.title}</h3>
        </div>
        {isMyPost || onDeleteClick ? (
          <button
            onClick={onDeleteClick}
            title="Delete this posting"
            className="inline-flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <TrashIcon className="h-4 w-4" />
            <span>Delete</span>
          </button>
        ) : (
          <button
            onClick={onRequestClick}
            disabled={hasRequested}
            className={cn(
              'shrink-0 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors',
              hasRequested
                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            )}
          >
            {hasRequested ? 'Requested' : 'Request to Join'}
          </button>
        )}
      </div>

      <p className="text-sm text-gray-600 line-clamp-2">{posting.description}</p>

      {rolesNeeded && rolesNeeded.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-700 mb-2">Roles Needed</p>
          <div className="flex flex-wrap gap-2">
            {rolesNeeded.map((role) => (
              <TagChip key={role} label={role} variant="role" />
            ))}
          </div>
        </div>
      )}

      {requiredSkills && requiredSkills.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-700 mb-2">Skills</p>
          <div className="flex flex-wrap gap-2">
            {requiredSkills.map((skill: any) => {
              const skillName = typeof skill === 'string' ? skill : skill.name;
              const skillId = typeof skill === 'string' ? skill : skill.id || skill.name;
              return (
                <TagChip 
                  key={skillId} 
                  label={skillName} 
                  variant="skill" 
                  matched={matchedSkillIds.has(skillId) || matchedSkillIds.has(skillName)} 
                />
              );
            })}
          </div>
        </div>
      )}

      {requiredInterests && requiredInterests.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-700 mb-2">Interests</p>
          <div className="flex flex-wrap gap-2">
            {requiredInterests.map((interest: any) => {
              const interestName = typeof interest === 'string' ? interest : interest.name;
              const interestId = typeof interest === 'string' ? interest : interest.id || interest.name;
              return (
                <TagChip 
                  key={interestId} 
                  label={interestName} 
                  variant="interest"
                  matched={matchedInterestIds.has(interestId) || matchedInterestIds.has(interestName)}
                />
              );
            })}
          </div>
        </div>
      )}

      {slotsTotal && slotsTotal > 0 && (
        <div className="mt-auto pt-4 flex items-center justify-between text-sm text-gray-500">
          <span>{slotsFilled || 0} / {slotsTotal} slots filled</span>
          <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full bg-primary-500"
              style={{ width: `${Math.min(100, ((slotsFilled || 0) / slotsTotal) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
